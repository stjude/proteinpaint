import got from 'got'
import path from 'path'
import { isUsableTerm } from '#shared/termdb.usecase'
import serverconfig from './serverconfig'

/*
******************** functions *************
initGDCdictionary
	assignDefaultBins
	makeTermdbQueries
	getOpenProjects
	testGDCapi
		testRestApi
		testGraphqlApi
	cacheSampleIdMapping
		fetchIdsFromGdcApi


******************** major tasks *****************
- parsing gdc variables and constructing in-memory termdb:
  HARDCODED LOGIC, does not need any configuration in dataset file
  standard termdb "interface" functions are added to ds.cohort.termdb.q{}

- determine default binconfig for all numeric terms
  added to term json objects

- querying list of open-access projects
  stores at: ds.gdcOpenProjects = set of project ids that are open-access

- test gdc api, make sure they're all online

- cache sample/case name/uuid mapping
  creates these new dataset-level attributes
  ds.__gdc {
  	aliquot2submitter{ get() }
  	map2caseid{ get() }
	casesWithExpData Set
  }
*/

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
const apihostGraphql = apihost + (apihost.includes('/v0') ? '' : '/v0') + '/graphql'

// TODO switch to https://api.gdc.cancer.gov/cases/_mapping
const dictUrl = path.join(apihost, 'ssm_occurrences/_mapping')

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
						integerCount++
					} else if (t.type == 'double') {
						termObj.type = 'float'
						floatCount++
					} else {
						console.log('GDC !!! ERR !!! Unknown variable type: ' + t.type)
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

	await assignDefaultBins(id2term)

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

	// Important!
	// do not await on following, as they execute logic that are optional for server function, and should not halt server launch
	testGDCapi() // do not await
	cacheSampleIdMapping(ds) // do not await
}

function mayAddTermAttribute(t) {
	if (t.id == 'case.diagnoses.age_at_diagnosis') {
		//show the term by other units
		// print 25868 as '70 years, 318 days'
		t.valueConversion = {
			scaleFactor: 1 / 365,
			fromUnit: 'day',
			toUnit: 'year'
		}
		return
	}
}

/*
default bin configs are auto-determined based on distribution of each term (min/max/..), retrieved on the fly from api
dummy bin is used when a valid distribution is not available
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
async function assignDefaultBins(id2term) {
	const queryStrings = []
	const facet2termid = new Map() // term id is converted to facet for query, this maps it back
	for (const t of id2term.values()) {
		if (t.type == 'integer' || t.type == 'float') {
			const facet = t.id.replace('case.', '').replace(/\./g, '__')
			facet2termid.set(facet, t.id)
			queryStrings.push(
				facet +
					` {
			   stats {
					Min : min
					Max: max
					Mean: avg
					SD: std_deviation
					count
				}
				range(ranges: $filters2) {
				  buckets {
					doc_count
					key
				  }
				}
			}`
			)
		}
	}
	if (queryStrings.length == 0) throw 'GDC: no numeric terms'
	const query = `
	  query ContinuousAggregationQuery($caseFilters: FiltersArgument, $filters: FiltersArgument, $filters2: FiltersArgument) {
	  viewer {
		explore {
		  cases {
			aggregations(case_filters: $caseFilters, filters: $filters) {
				${queryStrings.join('\n')}
			}
		  }
		}
	  }
	}`

	const variables = {
		caseFilters: {},
		filters: {},
		filters2: { op: 'range', content: [{ ranges: [{ from: 0, to: 1 }] }] } // 0/1 values will not affect query
	}

	try {
		let assignedCount = 0,
			unassignedCount = 0

		const response = await got.post(apihostGraphql, {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const re = JSON.parse(response.body)
		if (typeof re.data?.viewer?.explore?.cases?.aggregations != 'object')
			throw 'return not object: re.data.viewer.explore.cases.aggregations{}'
		for (const [facet, termid] of facet2termid) {
			const term = id2term.get(termid)
			if (!(facet in re.data.viewer.explore.cases.aggregations)) {
				console.log('GDC: no stats object returned for numeric term', termid)
				term.bins = dummyBins
				unassignedCount++
				continue
			}
			const s = re.data.viewer.explore.cases.aggregations[facet].stats
			if (typeof s != 'object') {
				console.log('GDC: aggregations[facet].stats{} is not object')
				// allow some terms to have no info
				// assign dummy bin so not to break
				term.bins = dummyBins
				unassignedCount++
				continue
			}
			/*
			{
			  diagnoses__days_to_recurrence: {
				range: { buckets: [Array] },
				stats: {
				  Max: 3782,
				  Mean: 819.9636363636364,
				  Min: 58,
				  SD: 715.6613630457312,
				  count: 165
				}
			  }
			}
			*/
			if (!Number.isFinite(s.Max) || !Number.isFinite(s.Min)) {
				//console.log('GDC numeric term min/max not numeric '+termid)
				term.bins = dummyBins
				unassignedCount++
				continue
			}

			if (s.Max <= s.Min) {
				// unable to calculate bin
				term.bins = dummyBins
				unassignedCount++
				continue
			}
			const x = (s.Max - s.Min) / 5
			const binsize = term.type == 'integer' ? Math.ceil(x) : x
			term.bins = {
				default: {
					mode: 'discrete',
					type: 'regular-bin',
					bin_size: binsize,
					startinclusive: false,
					stopinclusive: true,
					first_bin: {
						startunbounded: true,
						stop: s.Min + binsize
					}
				}
			}
			assignedCount++
		}
		console.log(`GDC default binning: ${assignedCount} assigned, ${unassignedCount} unassigned`)
	} catch (e) {
		console.log(e.message || e)
	}
}

/* not in use!
replaced with getNumericTermRange_graphql above

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

	if (!Array.isArray(re?.data?.aggregations?.['cases.project.project_id']?.buckets)) {
		console.log("getting open project_id but return is not re.data.aggregations['cases.project.project_id'].buckets[]")
		return
	}
	for (const b of re.data.aggregations['cases.project.project_id'].buckets) {
		// key is project_id value
		if (b.key) ds.gdcOpenProjects.add(b.key)
	}
	console.log('GDC open-access projects:', ds.gdcOpenProjects.size)
}

/* this function is called when the gdc mds3 dataset is initiated on a pp instance
primary purpose is to catch malformed api URLs
when running this on sj prod server, the gdc api can be down due to maintainance, and we do not want to prevent our server from launching
thus do not halt process if api is down
*/
async function testGDCapi() {
	try {
		// all these apis are available on gdc production and are publicly available
		// if any returns an error code, will abort
		{
			const u = path.join(apihost, 'ssms')
			const c = await testRestApi(u)
			if (c) throw `${u}: ${c}`
		}
		{
			const u = path.join(apihost, 'ssm_occurrences')
			const c = await testRestApi(u)
			if (c) throw `${u}: ${c}`
		}
		{
			const u = path.join(apihost, 'cases')
			const c = await testRestApi(u)
			if (c) throw `${u}: ${c}`
		}
		{
			const u = path.join(apihost, 'files')
			const c = await testRestApi(u)
			if (c) throw `${u}: ${c}`
		}
		{
			const u = path.join(apihost, 'analysis/top_mutated_genes_by_project')
			const c = await testRestApi(u)
			if (c) throw `${u}: ${c}`
		}

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

/*
if url is accessible, do not return
if gets error:
	return error code if available, so downstream logic can further act on the code
	if no error code, throw and abort
*/
async function testRestApi(url) {
	try {
		const t = new Date()
		await got(url)
		console.log('GDC API okay: ' + url, new Date() - t, 'ms')
	} catch (e) {
		if (e.code) return e.code
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

/*
cache gdc sample id mappings
this is an optional step and can be skipped on dev machines
- create a map from sample aliquot id to sample submitter id, for displaying in mds3 tk
- create a map from differet ids to case uuid, for creating gdc cohort with selected samples
- cache list of case uuids with expression data
*/
async function cacheSampleIdMapping(ds) {
	// create new attr to map to sample submitter id; it will only map from aliquot id to this id,
	// as this mapping is only used in mds3 tk, which shows ssm on samples but not cases
	ds.__gdc = {
		// gather these arbitrary gdc stuff under __gdc{} to be safe
		aliquot2submitter: {
			cache: new Map(),
			get: async aliquot_id => {
				if (ds.__gdc.aliquot2submitter.cache.has(aliquot_id)) return ds.__gdc.aliquot2submitter.cache.get(aliquot_id)

				/* 
				as on the fly api query is still slow, especially to query one at a time for hundreds of ids
				simply return unconverted id to preserve performance
				*/
				return aliquot_id

				// converts one id on the fly while the cache is still loading
				//await fetchIdsFromGdcApi(ds, null, null, aliquot_id)
				//return ds.__gdc.aliquot2submitter.cache.get(aliquot_id)
			}
		},
		// create new attr to map to case uuid, from 3 kinds of ids: aliquot, sample submitter, and case submitter
		// this mapping serves case selection from mds3 and matrix, where input can be one of these different types
		map2caseid: {
			cache: new Map(),
			get: input => {
				return ds.__gdc.map2caseid.cache.get(input)
				// NOTE if mapping is not found, do not return input, caller will call convert2caseId() to map on demand
			}
		},
		caseid2submitter: new Map(), // k: case uuid, v: case submitter id
		caseIds: new Set(), //
		casesWithExpData: new Set()
	}

	// caching action is fine-tuned by the feature toggle on a pp instance; log out detailed status per setting
	if ('stopGdcCacheAliquot' in serverconfig.features) {
		// flag is set
		if (Number.isInteger(serverconfig.features.stopGdcCacheAliquot)) {
			// flag value is integer (suppose to be positive integer)
			// allow to run a short test on dev machine
			console.log('GDC: running limited sample ID caching')
		} else {
			// flag value is not integer, do not run this function at all
			console.log('GDC: sample IDs are not cached!')
			return
		}
	} else {
		// flag not set; this should be on prod server
		console.log('GDC: caching complete sample ID mapping')
	}

	try {
		// key: aliquot uuid
		// value: submitter id
		const totalCases = await fetchIdsFromGdcApi(ds, 1, 0)
		if (!Number.isInteger(totalCases)) throw 'gdc totalCases not integer'

		const begin = new Date()
		console.log('GDC: Start to cache sample IDs of', totalCases, 'cases...')

		const size = 1000 // fetch 1000 ids at a time
		for (let i = 0; i < Math.ceil(totalCases / size); i++) {
			await fetchIdsFromGdcApi(ds, size, i * 1000)
			if (
				Number.isInteger(serverconfig.features.stopGdcCacheAliquot) &&
				i >= serverconfig.features.stopGdcCacheAliquot
			) {
				// stop caching after this number of loops, to speed up testing
				break
			}
		}

		await checkExpressionAvailability(ds)

		console.log('GDC: Done caching sample IDs. Time:', Math.ceil((new Date() - begin) / 1000), 's')
		console.log('\t', ds.__gdc.aliquot2submitter.cache.size, 'aliquot IDs to sample submitter id,')
		console.log('\t', ds.__gdc.caseid2submitter.size, 'case uuid to submitter id,')
		console.log('\t', ds.__gdc.map2caseid.cache.size, 'different ids to case uuid,')
		console.log('\t', ds.__gdc.casesWithExpData.size, 'cases with gene expression data.')
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
	const param = ['fields=submitter_id,samples.portions.analytes.aliquots.aliquot_id,samples.submitter_id']
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

	//console.log(re.data.hits[0]) // uncomment to examine output

	/*
	re.data.hits = [
	  {
	  	// the "id" value seems to be case.case_id
		// it is always here even if 'case.case_id' is not included in fields
		"id": "c2829ab9-d5b2-5a82-a134-de9c591363de",
		submitter_id: 'TCGA-LL-A6FQ', // case submitter id
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
			]
		  }
		]
	  }
	 ]
	*/
	for (const h of re.data.hits) {
		const case_id = h.id
		if (!case_id) throw 'h.id (case uuid) missing'
		ds.__gdc.caseIds.add(case_id)

		const case_submitter_id = h.submitter_id
		if (!case_submitter_id) throw 'h.submitter_id missing'

		ds.__gdc.caseid2submitter.set(case_id, case_submitter_id)

		/*
		below shows different uuids mapping to same submitter id
		this is the reason case submitter id must not be used to align data in oncomatrix, as it's not unique across Projects

		if(ds.__gdc.map2caseid.cache.has(case_submitter_id)) {
			console.log(case_submitter_id, case_id, ds.__gdc.map2caseid.cache.get(case_submitter_id))
		}
		*/

		ds.__gdc.map2caseid.cache.set(case_submitter_id, case_id)

		if (!Array.isArray(h.samples)) continue //throw 'hit.samples[] not array'
		for (const sample of h.samples) {
			const sample_submitter_id = sample.submitter_id
			if (!sample_submitter_id) throw 'sample.submitter_id missing'

			ds.__gdc.map2caseid.cache.set(sample_submitter_id, case_id)

			if (!Array.isArray(sample.portions)) continue // throw 'sample.portions[] not array'
			for (const portion of sample.portions) {
				if (!Array.isArray(portion.analytes)) continue //throw 'portion.analytes not array'
				for (const analyte of portion.analytes) {
					if (!Array.isArray(analyte.aliquots)) continue //throw 'analyte.aliquots not array'
					for (const aliquot of analyte.aliquots) {
						const aliquot_id = aliquot.aliquot_id
						if (!aliquot_id) throw 'aliquot.aliquot_id missing'
						ds.__gdc.aliquot2submitter.cache.set(aliquot_id, sample_submitter_id)
						ds.__gdc.map2caseid.cache.set(aliquot_id, case_id)
					}
				}
			}
		}
	}
	return re.data?.pagination?.total
}

async function checkExpressionAvailability(ds) {
	// hardcodes this url since the api is only in uat now. replace with path.join() when it's in prod
	const url = 'https://uat-portal.gdc.cancer.gov/auth/api/v0/gene_expression/availability'

	{
		/*
		when the api is released in production, delete this check and move it into testGDCapi()
		exp api is only available on uat now, thus it works if the pp server ip is whitelisted, otherwise won't work and will skip this function
		*/
		const c = await testRestApi(url)
		if (c == 'ERR_NON_2XX_3XX_RESPONSE') {
			// this is expected code that this instance has access to the uat but the request lacks parameters
		} else {
			// this instance does not have access to uat. quit this function and do not abort
			return
		}
	}

	const idLst = [...ds.__gdc.caseIds]
	const response = await got.post(url, {
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ case_ids: idLst })
	})
	const re = JSON.parse(response.body)
	// {"cases":{"details":[{"case_id":"4abbd258-0f0c-4428-901d-625d47ad363a","has_gene_expression_values":true}],"with_gene_expression_count":1,"without_gene_expression_count":0},"genes":null}
	if (!Array.isArray(re.cases?.details)) throw 're.cases.details[] not array'
	for (const c of re.cases.details) {
		if (c.has_gene_expression_values) ds.__gdc.casesWithExpData.add(c.case_id)
	}

	delete ds.__gdc.caseIds
}
