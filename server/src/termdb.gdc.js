import got from 'got'
import path from 'path'
import { isUsableTerm } from '#shared/termdb.usecase'
import serverconfig from './serverconfig'

/*
******************** functions *************
initGDCdictionary
	makeTermdbQueries
	getOpenProjects
	testGDCapi
		testRestApi
		testGraphqlApi
	cacheAliquot2submitterMapping
		fetchIdsFromGdcApi


- parsing gdc variables and constructing in-memory termdb:
  HARDCODED LOGIC, does not need any configuration in dataset file

- querying list of open-access projects
  also hardcoded logic, not relying on dataset config


standard termdb "interface" functions are added to ds.cohort.termdb.q{}

adds following things:

1. ds.cohort.termdb.q={ ... "standard" termdb callbacks ... }
2. ds.gdcOpenProjects = set of project ids that are open-access

*/

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const apihostGraphql = apihost + (apihost.includes('/v0') ? '' : '/v0') + '/graphql'

// TODO switch to https://api.gdc.cancer.gov/cases/_mapping
const dictUrl = path.join(apihost, 'ssm_occurrences/_mapping')

/*
*** handling of default bin configurations ***

bin configs for gdc numeric terms are hardcoded in hardcodeBinconfigs()
we should hardcode this for all gdc numeric terms known to us
since bin config is required for numeric terms by our code

on pp server start, this script will identify all numeric terms
for those terms that are not found in termId2bins{}:
- it will print an alert message
- it will query on the fly to retrieve some datapoints of this term and compute min/max
- it assigns dummy bin to this term, so the code won't break
- a new commit should be made to add the new term(s) to hardcodeBinconfigs(),
  by electing some reasonable bin config based on its min/max

*/
const dummyBins = {
	default: {
		mode: 'discrete',
		type: 'regular-bin',
		bin_size: 1,
		startinclusive: false,
		stopinclusive: true,
		first_bin: {
			startunbounded: true,
			stop: 0
		},
		last_bin: {
			start: 1,
			stopunbounded: true
		}
	}
}

const termId2bins = hardcodeBinconfigs()

/* 

sections from api return that are used to build in-memory termdb

******************* Part 1
to derive type (categorical/integer/float) for terms

re._mapping: {}
	'ssm_occurrence_centrics.case.available_variation_data': {
		description: '',
		doc_type: 'ssm_occurrence_centrics',
		field: 'case.available_variation_data',
		full: 'ssm_occurrence_centrics.case.available_variation_data',
		type: 'keyword'
	},
	'ssm_occurrence_centrics.case.case_id': {
		description: '',
		doc_type: 'ssm_occurrence_centrics',
		field: 'case.case_id',
		full: 'ssm_occurrence_centrics.case.case_id',
		type: 'keyword'
	},

******************* Part 2
to generate leaf terms and hierarchies
each row is a leaf term, the whole line is term id
from the line, derive hierarchies, e.g.
case{} >> case.demographic{} >> case.demographic.age_at_index{type:float}

re.fields: []
	'case.available_variation_data',
	'case.case_id',
	'case.consent_type',
	'case.days_to_consent',
	'case.days_to_index',
	'case.demographic.age_at_index',
	'case.demographic.age_is_obfuscated',
	'case.demographic.cause_of_death',
	'case.demographic.days_to_birth',
	'case.demographic.days_to_death',
	'case.demographic.demographic_id',
	'case.disease_type'
	'case.project.disease_type',
	...

	SKIPPED:
		"case.available_variation_data"
	lines starting with "case.observation":
		"case.observation.center",
		"case.observation.input_bam_file.normal_bam_uuid",
		"case.observation.input_bam_file.tumor_bam_uuid",
		"case.observation.mutation_status",
		"case.observation.normal_genotype.match_norm_seq_allele1",
		"case.observation.normal_genotype.match_norm_seq_allele2",
		"case.observation.observation_id",
		"case.observation.read_depth.n_depth",
		...
	lines starting with "ssm":
	    "ssm.chromosome",
		"ssm.clinical_annotations.civic.gene_id",
		"ssm.clinical_annotations.civic.variant_id",
		"ssm.consequence.consequence_id",
		"ssm.consequence.transcript.aa_change",
		"ssm.consequence.transcript.aa_end",
		"ssm.consequence.transcript.aa_start",
		"ssm.consequence.transcript.annotation.amino_acids",
		...

******************* Part 3
to add the .isObjectList:true attribute on a parent term
"nested": [
	"case.diagnoses",
	"case.diagnoses.pathology_details",
	"case.diagnoses.treatments",
	"case.exposures",
	"case.family_histories",
	"case.observation",
	"ssm.consequence"
]


******************* Unused parts
"defaults": [
	"ssm_occurrence_autocomplete",
	"ssm_occurrence_id"
],
"multi": [],
re.expand: []
	'case',
	'case.demographic',
	'case.diagnoses',
	'case.diagnoses.pathology_details',
	'case.diagnoses.treatments',
	...
*/

// prefix for keys in re._mapping{}
const mapping_prefix = 'ssm_occurrence_centrics'

export async function initGDCdictionary(ds) {
	const id2term = new Map()
	// k: term id, string with full path
	// v: term obj

	const response = await got(dictUrl, {
		method: 'GET',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
	})
	let re
	try {
		re = JSON.parse(response.body)
	} catch (e) {
		throw 'invalid JSON from GDC dictionary'
	}

	if (!re._mapping) throw 'returned data does not have ._mapping'
	if (!Array.isArray(re.fields)) throw '.fields not array'
	if (!Array.isArray(re.nested)) throw '.nested not array'
	const nestedSet = new Set(re.nested)

	// step 1: add leaf terms
	let skipLineCount = 0,
		unknownTermType = 0,
		categoricalCount = 0,
		integerCount = 0,
		floatCount = 0,
		parentCount = 0

	for (const fieldLine of re.fields) {
		if (maySkipFieldLine(fieldLine)) {
			skipLineCount++
			continue
		}

		const termLevels = fieldLine.split('.')

		/*
		for term with multiple levels (all terms should have 2 or more levels), create parent term

		e.g. for ['case','demographic','age_at_index']

		make two terms, first one is root:
			{id:'case.demographic',name:''}

		second one is leaf under this root:
			{id:'case.demographic.age_at_index', parent_id:'case.demographic', type:'float', ...}
		*/

		for (let i = 1; i < termLevels.length; i++) {
			const parentId = termLevels.slice(0, i).join('.')
			const currentId = parentId + '.' + termLevels[i]
			const name = termLevels[i][0].toUpperCase() + termLevels[i].slice(1).replace(/_/g, ' ')

			// always create an object for currentId
			// when recording this term in id2term{}, force term id to be lower case
			// so that findTermByName can work
			const termObj = {
				id: currentId.toLowerCase(),
				name,
				included_types_set: new Set(), // apply to leaf terms, should have its own term.type
				child_types_set: new Set() // empty for leaf terms
			}

			if (i == termLevels.length - 1) {
				// this is a leaf term
				termObj.isleaf = true
				// assign type for leaf term
				const t = re._mapping[mapping_prefix + '.' + currentId]
				if (t) {
					if (t.type == 'keyword') {
						termObj.type = 'categorical'
						categoricalCount++
					} else if (t.type == 'long') {
						termObj.type = 'integer'
						termObj.bins = termId2bins[termObj.id] || JSON.parse(JSON.stringify(dummyBins))
						integerCount++
					} else if (t.type == 'double') {
						termObj.type = 'float'
						termObj.bins = termId2bins[termObj.id] || JSON.parse(JSON.stringify(dummyBins))
						floatCount++
					} else {
						console.log('GDC !!! ERR !!! Unknown variable type: ' + t.type)
					}
					if ((termObj.type == 'integer' || termObj.type == 'float') && !termId2bins[termObj.id]) {
						console.log(`GDC !!! Lack bin config for ${termObj.type} ${termObj.id}`)
						await getNumericTermRange(termObj.id)
						// print out min/max for this term to assist manual curation of binconfig,
						// a new commit should be made to hardcode config of this term in termId2bins
					}
				}

				if (!termObj.type) {
					// no type assigned, error
					unknownTermType++
				}

				mayAddTermAttribute(termObj)
			}

			// whether this term has parent
			if (i == 1) {
				/* this is a root term, do not add parent_id
				e.g. case.disease_type, which is a leaf term without a parent
				as we do not want "case" as a root term
				thus case.disease_type itself is a root term
				*/
			} else {
				termObj.parent_id = parentId

				if (termObj.type) {
					// use this term's type to fill in child_types_set
					termObj.included_types_set.add(termObj.type)
					let p = id2term.get(parentId)
					while (p) {
						p.included_types_set.add(termObj.type)
						p.child_types_set.add(termObj.type)
						if (p.parent_id) {
							p = id2term.get(p.parent_id)
						} else {
							break
						}
					}
				}
			}

			// if nested
			if (nestedSet.has(currentId)) {
				termObj.isObjectList = true
			}

			id2term.set(currentId, termObj)
		}
	}

	for (const t of id2term.values()) {
		if (!t.type) parentCount++
		// produce required attributes on terms, to be returned from getRootTerms() and getTermChildren()
		t.included_types = [...t.included_types_set]
		t.child_types = [...t.child_types_set]
		delete t.included_types_set
		delete t.child_types_set
	}

	console.log(
		'GDC dictionary:',
		id2term.size,
		'total variables,',
		skipLineCount,
		'lines skipped,',
		unknownTermType,
		'lines with unknown term type,',
		'categorical=' + categoricalCount,
		'integer=' + integerCount,
		'float=' + floatCount,
		'parent=' + parentCount
	)

	// id2term is readonly and must not be changed by treeFilter or other features
	Object.freeze(id2term)

	makeTermdbQueries(ds, id2term)

	ds.cohort.termdb.termtypeByCohort = []
	if (categoricalCount) ds.cohort.termdb.termtypeByCohort.push({ cohort: '', type: 'categorical' })
	if (integerCount) ds.cohort.termdb.termtypeByCohort.push({ cohort: '', type: 'integer' })
	if (floatCount) ds.cohort.termdb.termtypeByCohort.push({ cohort: '', type: 'float' })

	/**********************************
	       additional prepping
	**********************************/
	await getOpenProjects(ds)

	testGDCapi() // do not await
	cacheAliquot2submitterMapping(ds) // do not await on this
}

function mayAddTermAttribute(t) {
	if (t.id == 'case.diagnoses.age_at_diagnosis') {
		t.printDays2years = true // print 25868 as '70 years, 318 days'
		return
	}
}

/*
run on the fly query to api to grab some sample data points for this numeric term
to be able to get the min/max range of this term

id: gdc numeric term id, e.g. "case.demographic.year_of_death"
for this term, the function prints out: "Min=1992  Max=2021"

*/
async function getNumericTermRange(id) {
	// getting more datapoints will slow down the response
	const response = await got(apihost + '/ssm_occurrences?size=5000&fields=' + id, { method: 'GET' })
	const re = JSON.parse(response.body)
	if (!Array.isArray(re.data.hits)) return
	let min = null,
		max = null
	const levels = id.split('.')
	for (const h of re.data.hits) {
		// h is data for one case
		// this case may have 1 or multiple values for this term, do a recursion and collect all values into this array
		const collectValues = []
		trace(h, 0, collectValues)

		for (const v of collectValues) {
			if (min == null) {
				min = v
				max = v
			} else {
				min = Math.min(min, v)
				max = Math.max(max, v)
			}
		}
	}
	console.log(`Min=${min}  Max=${max}`)

	// recursion function
	function trace(point, i, collectValues) {
		const newPoint = point[levels[i]]
		if (newPoint == undefined) {
			// likely because the sample lacks value for this term, ignore
			return
		}
		if (Number.isFinite(newPoint)) {
			// reaches a numeric value and is collected into array; should be the end of levels[]
			collectValues.push(newPoint)
			return
		}
		if (Array.isArray(newPoint)) {
			// this level corresponds to multiple values e.g. diagnoses[], do recursion in each element
			for (const p2 of newPoint) {
				trace(p2, i + 1, collectValues)
			}
		} else if (typeof newPoint == 'object') {
			trace(newPoint, i + 1, collectValues)
		} else {
			// invalid type of this value
			console.log(`GDC !!! ERR !!! a sample has invalid value for ${id}: ${newPoint}`)
		}
	}
}

// hardcoded rules to skip some lines from re.fields[]
// one thing or the other we do not want these to show up in dictionary
const skipFieldLines = new Set(['case.consent_type', 'case.days_to_consent', 'case.days_to_index'])
function maySkipFieldLine(line) {
	if (
		line.startsWith('ssm') ||
		line.startsWith('case.observation') ||
		line.startsWith('case.available_variation_data')
	) {
		// skip lines beginning with these
		// uncomment to see what's skipped
		// console.log(line)
		return true
	}
	if (line.endsWith('_id') && !line.endsWith('project_id')) {
		// skip lines ending with _id
		// console.log(line)
		return true
	}
	// skip these hardcoded terms
	if (skipFieldLines.has(line)) return true
}

/* in order to work with backend /termdb? route,
add following queries to ds.cohort.termdb.q{}
as done in server_init_db_queries() of termdb.sql.js
q.getRootTerms
q.getTermChildren
q.findTermByName
q.getAncestorIDs
q.getAncestorNames
q.termjsonByOneid
q.getSupportedChartTypes
*/
function makeTermdbQueries(ds, id2term) {
	const q = (ds.cohort.termdb.q = {})

	q.getRootTerms = async (vocab, treeFilter = null) => {
		// find terms without term.parent_id
		const terms = []
		for (const term of id2term.values()) {
			if (term.parent_id == undefined) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.getTermChildren = async (id, cohortValues = null, treeFilter = null) => {
		// find terms which have term.parent_id as clicked term
		// cohortValues is in concordance with previous design and does not apply to gdc
		const terms = []
		for (const term of id2term.values()) {
			if (term.parent_id == id) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.findTermByName = async (searchStr, limit = null, vocab, treeFilter = null, usecase = null) => {
		searchStr = searchStr.toLowerCase() // convert to lowercase
		// replace space with _ to match with id of terms
		if (searchStr.includes(' ')) searchStr = searchStr.replace(/\s/g, '_')
		// find terms that have term.id containing search string
		const terms = []
		for (const term of id2term.values()) {
			if (usecase && !isUsableTerm(term, usecase)) continue
			if (term.id.includes(searchStr)) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.getAncestorIDs = id => {
		if (!id2term.has(id)) return // invalid id
		/* id is valid term id
		ancestor terms are already defined in term.path seperated by '.'
		for case.diagnoses.treatments.state, it should return
		['case.diagnoses', 'case.diagnoses.treatments']
		*/
		const lst = id.split('.')
		const ancestorIds = []
		for (let i = 1; i < lst.length; i++) {
			ancestorIds.push(lst.slice(0, i + 1).join('.'))
		}
		return ancestorIds
	}
	q.getAncestorNames = q.getAncestorIDs

	q.termjsonByOneid = id => {
		const t = id2term.get(id)
		if (t) return JSON.parse(JSON.stringify(t))
		return null
	}

	q.getSupportedChartTypes = () => {
		// this function is required for server-provided termdbConfig
		// TODO FIXME if this is needed??
		const supportedChartTypes = {}
		const numericTypeCount = {}
		// key: subcohort combinations, comma-joined, as in the subcohort_terms table
		// value: array of chart types allowed by term types

		for (const r of id2term.values()) {
			if (!r.type) continue
			// !!! r.cohort is undefined here as gdc data dictionary has no subcohort
			if (!(r.cohort in supportedChartTypes)) {
				supportedChartTypes[r.cohort] = ['barchart', 'table', 'regression']
				numericTypeCount[r.cohort] = 0
			}
			if (r.type == 'survival' && !supportedChartTypes[r.cohort].includes('survival'))
				supportedChartTypes[r.cohort].push('survival')
			if (r.type == 'condition' && !supportedChartTypes[r.cohort].includes('cuminc'))
				supportedChartTypes[r.cohort].push('cuminc')
			if (r.type == 'float' || r.type == 'integer') numericTypeCount[r.cohort] += r.samplecount
		}
		for (const cohort in numericTypeCount) {
			if (numericTypeCount[cohort] > 0) supportedChartTypes[cohort].push('boxplot')
			if (numericTypeCount[cohort] > 1) supportedChartTypes[cohort].push('scatterplot')
		}
		return supportedChartTypes
	}

	async function mayAddSamplecount4treeFilter(terms, treeFilter) {
		// if tree filter is given, add sample count for each term
		// FIXME revive this code
		if (terms.length == 0 || !treeFilter) return

		const tv2counts = await ds.termdb.termid2totalsize2.get(
			terms.map(i => i.id),
			JSON.parse(treeFilter)
		)

		// add term.disabled if samplesize if zero
		for (const term of terms) {
			if (term) {
				const tv2count = tv2counts.get(term.id)
				if (term.type == 'categorical' && tv2count) {
					if (!tv2count.length) {
						term.disabled = true
						term.samplecount = 0
					} else term.samplecount = tv2count.map(c => c[1]).reduce((a, b) => a + b)
				} else if (term.type == 'integer' || term.type == 'float') {
					term.samplecount = tv2count['total']
					if (tv2count['total'] == 0) term.disabled = true
				}
			}
		}
	}
}

async function getOpenProjects(ds) {
	const headers = {
		'Content-Type': 'application/json',
		Accept: 'application/json'
	}

	const data = {
		filters: {
			op: 'and',
			content: [
				{
					op: '=',
					content: {
						field: 'access',
						value: 'open'
					}
				},
				{
					op: '=',
					content: {
						field: 'data_type',
						value: 'Masked Somatic Mutation'
					}
				}
			]
		},
		facets: 'cases.project.project_id',
		size: 0
	}

	const tmp = await got(path.join(apihost, 'files'), { method: 'POST', headers, body: JSON.stringify(data) })

	const re = JSON.parse(tmp.body)

	ds.gdcOpenProjects = new Set()

	if (re?.data?.aggregations?.['cases.project.project_id']?.buckets) {
		for (const b of re.data.aggregations['cases.project.project_id'].buckets) {
			// key is project_id value
			if (b.key) ds.gdcOpenProjects.add(b.key)
		}
		console.log('GDC open-access projects:', ds.gdcOpenProjects.size)
	} else {
		console.log("getting open project_id but return is not re.data.aggregations['cases.project.project_id'].buckets")
	}
}

/* this function is called when the gdc mds3 dataset is initiated on a pp instance
primary purpose is to catch malformed api URLs
when running this on sj prod server, the gdc api can be down due to maintainance, and we do not want to prevent our server from launching
thus do not halt process if api is down
*/
async function testGDCapi() {
	try {
		await testRestApi(apihost + '/ssms')
		await testRestApi(apihost + '/ssm_occurrences')
		await testRestApi(apihost + '/cases')
		await testRestApi(apihost + '/files')
		await testRestApi(apihost + '/analysis/top_mutated_genes_by_project')
		// /data/ and /slicing/view/ are not tested as they require file uuid which is unstable across data releases
		await testGraphqlApi(apihostGraphql)
	} catch (e) {
		console.error(`
##########################################
#
#   GDC API unavailable
#   ${apihost}
#   ${apihostGraphql}
#
##########################################`)
	}
}

async function testRestApi(url) {
	try {
		const t = new Date()
		await got(url)
		console.log('GDC API okay: ' + url, new Date() - t, 'ms')
	} catch (e) {
		throw 'gdc api down: ' + url
	}
}

async function testGraphqlApi(url) {
	// FIXME lightweight method to test if graphql is accessible?
	const t = new Date()
	try {
		const query = `query termislst2total( $filters: FiltersArgument) {
		explore {
			cases {
				aggregations (filters: $filters, aggregations_filter_themselves: true) {
					primary_site {buckets { doc_count, key }}
				}
			}
		}}`
		await got.post(url, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables: {} })
		})
	} catch (e) {
		throw 'gdc api down: ' + url
	}
	console.log('GDC GraphQL API okay: ' + url, new Date() - t, 'ms')
}

async function cacheAliquot2submitterMapping(ds) {
	try {
		ds.aliquot2submitter = {
			cache: new Map(),
			get: async aliquot_id => {
				if (ds.aliquot2submitter.cache.has(aliquot_id)) return ds.aliquot2submitter.cache.get(aliquot_id)

				/* 
				as on the fly api query is still slow, especially to query one at a time for hundreds of ids
				simply return unconverted id to preserve performance
				*/
				return aliquot_id

				// converts one id on the fly while the cache is still loading
				//await fetchIdsFromGdcApi(ds, null, null, aliquot_id)
				//return ds.aliquot2submitter.cache.get(aliquot_id)
			}
		}

		if (serverconfig.features.stopGdcCacheAliquot) return console.log('GDC aliquot2submitter not cached!')

		// key: aliquot uuid
		// value: submitter id
		const totalCases = await fetchIdsFromGdcApi(ds, 1, 0)
		if (!Number.isInteger(totalCases)) throw 'gdc totalCases not integer'

		const begin = new Date()
		console.log('Start to cache aliquot IDs of', totalCases, 'cases...')

		const size = 1000 // fetch 1000 ids at a time
		for (let i = 0; i < Math.ceil(totalCases / size); i++) {
			await fetchIdsFromGdcApi(ds, size, i * 1000)
		}

		console.log('Done caching', ds.aliquot2submitter.cache.size, 'aliquot IDs.', new Date() - begin, 'ms')
	} catch (e) {
		console.log('Error at caching: ' + e)
	}
}

/*
input:
	ds:
		gdc dataset object
	size:int
	from:int
		null or integer
		if null, aliquot_id must be given
	aliquot_id:str

output:
	re.data.pagination.total

aliquot-to-submitter mapping are automatically cached
*/
async function fetchIdsFromGdcApi(ds, size, from, aliquot_id) {
	const param = ['fields=samples.portions.analytes.aliquots.aliquot_id,samples.submitter_id']
	if (aliquot_id) {
		param.push(
			'filters={"op":"and","content":[{"op":"=","content":{"field":"samples.portions.analytes.aliquots.aliquot_id","value":["' +
				aliquot_id +
				'"]}}]}'
		)
	} else {
		if (!Number.isInteger(size) || !Number.isInteger(from)) throw 'size and from not integers'
		param.push('size=' + size)
		param.push('from=' + from)
	}

	const tmp = await got(apihost + '/cases?' + param.join('&'))
	const re = JSON.parse(tmp.body)
	if (!Array.isArray(re?.data?.hits)) throw 're.data.hits[] not array'
	/*
	re.data.hits = [
	  {
		"id": "c2829ab9-d5b2-5a82-a134-de9c591363de",
		"samples": [
		  {
			"submitter_id": "TARGET-50-PAJNID-01A",
			"portions": [
			  {
				"analytes": [
				  {
					"aliquots": [
					  {
						"aliquot_id": "123bd4c3-6e36-4514-8d06-9f1f408cd1aa"
					  }
					]
				  }
				]
			  },
			  { ... more analytes ... }
	*/
	for (const h of re.data.hits) {
		if (!Array.isArray(h.samples)) continue //throw 'hit.samples[] not array'
		for (const sample of h.samples) {
			const submitter_id = sample.submitter_id
			if (!Array.isArray(sample.portions)) continue // throw 'sample.portions[] not array'
			for (const portion of sample.portions) {
				if (!Array.isArray(portion.analytes)) continue //throw 'portion.analytes not array'
				for (const analyte of portion.analytes) {
					if (!Array.isArray(analyte.aliquots)) continue //throw 'analyte.aliquots not array'
					for (const aliquot of analyte.aliquots) {
						const aliquot_id = aliquot.aliquot_id
						if (!aliquot_id) throw 'aliquot.aliquot_id missing'
						ds.aliquot2submitter.cache.set(aliquot_id, submitter_id)
					}
				}
			}
		}
	}
	return re.data?.pagination?.total
}

// hardcode bin configs for *all* numeric terms
function hardcodeBinconfigs() {
	// this provides a concise way to declare bin config for each term
	const id2binStat = {
		'case.demographic.age_at_index': { bin_size: 10, first_bin_stop: 30 },
		'case.demographic.days_to_birth': { bin_size: 1000, first_bin_stop: -3000 },
		'case.diagnoses.circumferential_resection_margin': null,
		'case.demographic.days_to_death': { bin_size: 1000, first_bin_stop: 1000 }
		//'': {bin_size:, first_bin_stop:},
	}
	const termId2bins = {}
	for (const id in id2binStat) {
		const c = id2binStat[id]
		if (c) {
			termId2bins[id] = {
				default: {
					mode: 'discrete',
					type: 'regular-bin',
					bin_size: c.bin_size,
					startinclusive: false,
					stopinclusive: true,
					first_bin: {
						startunbounded: true,
						stop: c.first_bin_stop
					}
				}
			}
		} else {
			termId2bins[id] = dummyBins
		}
	}
	return termId2bins
}
