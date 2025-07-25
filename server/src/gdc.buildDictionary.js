import { isUsableTerm } from '#shared/termdb.usecase.js'
import serverconfig from './serverconfig.js'
import { DEFAULT_SAMPLE_TYPE } from '#shared/terms.js'
import { cachedFetch, isRecoverableError } from './utils'
import { deepEqual } from '#shared/helpers.js'
import { joinUrl } from '#shared/joinUrl.js'

/******************** major tasks *****************
- parsing gdc variables and constructing in-memory termdb:
  HARDCODED LOGIC, does not need any configuration in dataset file
  standard termdb "interface" functions are added to ds.cohort.termdb.q{}

- determine default binconfig for all numeric terms
  added to term json objects
*/

/*
********************   functions    *************
gdcBuildDictionary
	mayAddTermAttribute
	assignDefaultBins
	makeTermdbQueries



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

export async function gdcBuildDictionary(ds) {
	const id2term = new Map()
	// k: term id, string with full path
	// v: term obj

	{
		// declare hardcoded survival term! there is one api https://portal.gdc.cancer.gov/auth/api/v0/analysis/survival that serves one type of surv data, thus one hardcoded term. wip parent_id is not set, later can nest under a branch
		const id = 'Overall Survival'
		const term = {
			id,
			name: id,
			type: 'survival',
			isleaf: true,
			// see querySamplesSurvival(): api returns time-to-event in number of days, and we convert it to decimal years; also about exit code assignment
			unit: 'year',
			values: { 0: { label: 'Alive' }, 1: { label: 'Dead' } },
			included_types_set: new Set(), // apply to leaf terms, should have its own term.type
			child_types_set: new Set() // empty for leaf terms
		}
		mayAddTermAttribute(term)
		term.included_types_set.add('survival')
		id2term.set(id, term)
	}

	// TODO switch to https://api.gdc.cancer.gov/cases/_mapping
	const { host, headers } = ds.getHostHeaders()
	const dictUrl = joinUrl(host.rest, 'ssm_occurrences/_mapping')
	const { body: re } = await cachedFetch(dictUrl, { headers }).catch(e => {
		console.log(e)
		if (isRecoverableError(e)) {
			ds.init.recoverableError = 'gdcBuildDictionary() ${dictUrl}'
		}
		// should still throw to stop code execution here and allow caller to catch
		throw 'failed to get GDC API _mapping: ' + (e.message || e)
	})

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
		survivalCount = 0,
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
				child_types_set: new Set(), // empty for leaf terms,
				groupsetting: { disabled: false }
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

	try {
		await assignDefaultBins(id2term, ds)
	} catch (e) {
		if (!ds.__gdc?.recoverableError) {
			console.log(e.stack || e)
			// must abort launch upon err. lack of term.bins system app will not work
			throw 'assignDefaultBins() failed: ' + (e.message || e)
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
	ds.cohort.termdb.termtypeByCohort.nested = { '': {} }
	if (categoricalCount) {
		ds.cohort.termdb.termtypeByCohort.push({ cohort: '', termType: 'categorical', termCount: categoricalCount })
		ds.cohort.termdb.termtypeByCohort.nested[''].categorical = categoricalCount
	}
	if (integerCount) {
		ds.cohort.termdb.termtypeByCohort.push({ cohort: '', termType: 'integer', termCount: integerCount })
		ds.cohort.termdb.termtypeByCohort.nested[''].integer = integerCount
	}
	if (floatCount) {
		ds.cohort.termdb.termtypeByCohort.push({ cohort: '', termType: 'float', termCount: floatCount })
		ds.cohort.termdb.termtypeByCohort.nested[''].float = floatCount
	}
	if (survivalCount) {
		ds.cohort.termdb.termtypeByCohort.push({ cohort: '', termType: 'survival', termCount: survivalCount })
		ds.cohort.termdb.termtypeByCohort.nested[''].survival = survivalCount
	}
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

const hardcodedBins = {
	'case.diagnoses.age_at_diagnosis': {
		default: {
			type: 'custom-bin',
			mode: 'discrete',
			lst: [
				{ startunbounded: true, stop: 10950, stopinclusive: true, label: '<=30 years' },
				{ start: 10950, stop: 21900, stopinclusive: true, label: '30-60 years' },
				{ start: 21900, stopunbounded: true, startinclusive: false, label: '>60years' }
			]
		}
	}
}

async function assignDefaultBins(id2term, ds) {
	const queryStrings = []
	const facet2termid = new Map() // term id is converted to facet for query, this maps it back
	for (const t of id2term.values()) {
		if (t.type != 'integer' && t.type != 'float') continue

		if (hardcodedBins[t.id]) {
			// a hardcoded bin config is avaialble for this term, use it and skip api query
			t.bins = hardcodedBins[t.id]
			continue
		}

		// no binning for this term, to query api and compute the bins
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
	if (queryStrings.length == 0) throw 'GDC: no numeric terms, should not happen'
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

	let assignedCount = 0,
		unassignedCount = 0

	const { host, headers } = ds.getHostHeaders()
	const { body: re } = await cachedFetch(host.graphql, {
		method: 'POST',
		body: { query, variables }
	})
		// uncomment this then() callback to test recoverable error handling,
		// use `npx tsx server.ts` from sjpp instead of `npm start`, and
		// have serverconfig.features.gdcCacheCheckWait=9000 to more clearly observe server log of errors
		// .then(_ => {
		// 	throw { status: 500 }
		// }) // server-side error, should be recoverable and not cause a crash
		.catch(e => {
			if (isRecoverableError(e)) {
				ds.init.recoverableError = 'assignDefaultBins() host.graphql'
			}
			// should throw to stop code execution here and allow caller to catch
			throw e
		})
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
}

/* not in use!
replaced with getNumericTermRange_graphql above

run on the fly query to api to grab some sample data points for this numeric term
to be able to get the min/max range of this term

id: gdc numeric term id, e.g. "case.demographic.year_of_death"
for this term, the function prints out: "Min=1992  Max=2021"
*/
async function getNumericTermRange(id, ds) {
	const { host, headers } = ds.getHostHeaders()
	// getting more datapoints will slow down the response
	const url = host.rest + '/ssm_occurrences?size=5000&fields=' + id
	const { body: re } = await cachedFetch(url, { headers }).catch(e => {
		if (isRecoverableError(e)) {
			ds.init.recoverableError = `getNumericTermRange() ${url}`
		}
		// should throw to stop code execution here and allow caller to catch
		throw e
	})
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
const skipFieldLines = new Set([
	'case.consent_type',
	'case.days_to_consent',
	'case.days_to_index',
	// 3-8-2024 sample_type has been deprecated from the data dictionary but will remain available in the  GDC API  response until v1 is retired
	'case.samples.sample_type'
])
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

	q.getRootTerms = async (req, cohortValues, treeFilter = null) => {
		// find terms without term.parent_id
		// first two args are not used
		const terms = []
		for (const term of id2term.values()) {
			if (term.parent_id == undefined) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.getTermChildren = async (req, id, cohortValues = null, treeFilter = null) => {
		// find terms which have term.parent_id as clicked term
		// req and cohortValues is in concordance with previous design and does not apply to gdc
		const terms = []
		for (const term of id2term.values()) {
			if (term.parent_id == id) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.findTermByName = async (searchStr, vocab, usecase = null, treeFilter = null) => {
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
		const supportedChartTypes = {
			'': [
				'dictionary', // to be able to show dictionary chart button at mass ui in correlation plot http://localhost:3000/?gdccorrelation=1
				'summarizeMutationDiagnosis',
				'summarizeCnvGeneexp'
			]
		}
		const numericTypeCount = {}
		// key: subcohort combinations, comma-joined, as in the subcohort_terms table
		// value: array of chart types allowed by term types

		for (const r of id2term.values()) {
			if (!r.type) continue
			// !!! r.cohort is undefined here as gdc data dictionary has no subcohort
			// replace with empty string to match the default cohort value from a db
			if (r.cohort === undefined) r.cohort = ''
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

	// same required property
	ds.cohort.termdb.term2SampleType = new Map()
	for (const id of id2term.keys()) {
		// set all terms to be default sample type, even if terms maybe describing case versus sample; also, the gdc dict data getter hardcodes to return term annotation data on cases, but not samples, so this is fine
		ds.cohort.termdb.term2SampleType.set(id, DEFAULT_SAMPLE_TYPE)
	}

	async function mayAddSamplecount4treeFilter(terms, treeFilter) {
		// if tree filter is given, add sample count for each term
		// FIXME revive this code
		if (terms.length == 0 || !treeFilter) return

		const tv2counts = await ds.termdb.termid2totalsize2
			.get(
				terms.map(i => i.id),
				JSON.parse(treeFilter)
			)
			.catch(e => {
				throw e
			})

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
