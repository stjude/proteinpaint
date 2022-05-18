const got = require('got')
const get_termlst2size = require('./mds3.gdc').get_termlst2size
const isUsableTerm = require('../shared/termdb.usecase').isUsableTerm

/* parse gdc dictionary, and store as in-memory termdb
does not need any dataset configuration, entirely hardcoded logic

termdb "interface" functions are added to ds.cohort.termdb.q{}
*/

const apihost = process.env.PP_GDC_HOST || 'https://api.gdc.cancer.gov'
// the api endpoint from which following 3 sections of info are returned
const endpoint = apihost + '/ssm_occurrences/_mapping'

/* 
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
	...

re.expand: []
	'case',
	'case.demographic',
	'case.diagnoses',
	'case.diagnoses.pathology_details',
	'case.diagnoses.treatments',
	'case.exposures',
	'case.family_histories',
	'case.observation',
	'case.observation.input_bam_file',
	'case.observation.normal_genotype',
	'case.observation.read_depth',
	'case.observation.sample',
*/

// skip these two lines from re.fields[]
// as primary_site and disease_type are currently loaded from case/ level
// and these two lines are duplicating and causing err
const skip_fields_lines = ['case.project.disease_type', 'case.project.primary_site']

// prefix for keys in re._mapping{}
const mapping_prefix = 'ssm_occurrence_centrics'

export async function initDictionary(ds) {
	const id2term = (ds.cohort.termdb.id2term = new Map())
	const response = await got(endpoint, {
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
	if (!re.fields) throw 'returned data does not have .fields'
	if (!Array.isArray(re.fields)) throw '.fields not array'
	if (!re.expand) throw 'returned data does not have .expand'
	if (!Array.isArray(re.expand)) throw '.expand not array'

	// step 1: add leaf terms
	let skipLineCount = 0,
		unknownTermType = 0,
		categoricalCount = 0,
		integerCount = 0,
		floatCount = 0,
		duplicateID = 0
	for (const term_path_str of re.fields) {
		if (maySkipLine(term_path_str)) {
			skipLineCount++
			continue
		}

		if (skip_fields_lines.includes(term_path_str)) {
			skipLineCount++
			continue
		}

		const term_paths = term_path_str.split('.')

		const term_id = term_paths[term_paths.length - 1]
		/* TODO id may be duplicating
		if(id2term.has(term_id)) {
			term_id = term_paths.join('/')
		}
		*/

		const term_obj = {
			id: term_id,
			name: term_id[0].toUpperCase() + term_id.slice(1).replace(/_/g, ' '),
			path: term_path_str,
			isleaf: true,
			parent_id: term_paths[term_paths.length - 2],
			fields: term_paths.slice(1)
			//child_types: [] // TODO: may set in the future to support hiding childless parent terms in the tree menu
		}

		// step 2: add type of leaf terms from _mapping:{}
		const t_map = re._mapping[mapping_prefix + '.' + term_path_str]
		if (t_map) {
			if (t_map.type == 'keyword') {
				term_obj.type = 'categorical'
				categoricalCount++
			} else if (t_map.type == 'long') {
				term_obj.type = 'integer'
				integerCount++
			} else if (t_map.type == 'double') {
				term_obj.type = 'float'
				floatCount++
			}
		}
		if (!term_obj.type) {
			unknownTermType++
			continue
		}

		/*
		if(id2term.has(term_id)) console.log(term_path_str, id2term.get(term_id).path)

		XXX known issue

		the same leaf level ID can appear at multiple branches, e.g.
		case.diagnoses.vascular_invasion_type
		case.diagnoses.pathology_details.vascular_invasion_type

		current id2term Map can only keep one of the two terms
		no way to keep both
		*/

		if (id2term.has(term_id)) {
			duplicateID++
		} else {
			id2term.set(term_id, term_obj)
		}
	}

	// step 3: add parent  and root terms
	for (const term_str of re.expand) {
		if (maySkipLine(term_str)) {
			continue
		}
		const term_levels = term_str.split('.')

		const term_id = term_levels.length == 1 ? term_str : term_levels[term_levels.length - 1]
		// TODO term_id may already be present in id2term

		const term_obj = {
			id: term_id,
			name: term_id[0].toUpperCase() + term_id.slice(1).replace(/_/g, ' '),
			path: term_str,
			fields: term_str.split('.').slice(1)
			// included_types: [] // TODO update term.included_types usage to this method
			// child_types: [] // TODO: may set in the future to support hiding childless parent terms in the tree menu
		}
		if (term_levels.length > 1) term_obj.parent_id = term_levels[term_levels.length - 2]
		id2term.set(term_id, term_obj)
	}

	//step 5: remove 'case' term, remove "case" as the first level
	id2term.delete('case')
	for (const term of id2term.values()) {
		if (term.parent_id == 'case') {
			// this term is a direct child of "case"
			delete term.parent_id

			// hope later able to move it to "Misc" branch
			//term.parent_id = 'Miscellaneous'
		}
	}

	/* adding Misc branch does not work, as term.path is required
	id2term.set('Miscellaneous', {
		id: 'Miscellaneous',
		name:'Miscellaneous',
	})
	*/

	console.log(
		ds.cohort.termdb.id2term.size,
		'variables parsed from GDC dictionary,',
		skipLineCount,
		'lines skipped,',
		unknownTermType,
		'lines with unknown term type,',
		categoricalCount,
		integerCount,
		floatCount,
		'categorical/integer/float #terms,',
		duplicateID,
		'duplicating terms skipped'
	)

	// freeze gdc dictionary as it's readonly and must not be changed by treeFilter or other features
	Object.freeze(ds.cohort.termdb.id2term)
	init_termdb_queries(ds.cohort.termdb, ds)
}

function maySkipLine(line) {
	if (line.startsWith('ssm') || line.startsWith('case.observation') || line.startsWith('case.available_variation_data'))
		return true
	return false
}

function init_termdb_queries(termdb, ds) {
	const q = (termdb.q = {})

	q.getRootTerms = async (vocab, treeFilter = null) => {
		// find terms without term.parent_id
		const terms = []
		for (const term of termdb.id2term.values()) {
			if (term.parent_id == undefined) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.getTermChildren = async (id, vocab, treeFilter = null) => {
		// find terms which have term.parent_id as clicked term
		const terms = []
		for (const term of termdb.id2term.values()) {
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
		for (const term of termdb.id2term.values()) {
			if (usecase && !isUsableTerm(term, usecase)) continue
			if (term.id.includes(searchStr)) terms.push(JSON.parse(JSON.stringify(term)))
		}
		await mayAddSamplecount4treeFilter(terms, treeFilter)
		return terms
	}

	q.getAncestorIDs = id => {
		const search_term = termdb.id2term.get(id)
		if (!search_term) return
		// ancestor terms are already defined in term.path seperated by '.'
		const re = search_term.path ? search_term.path.split('.') : ['']
		if (re.length > 1) re.pop() // remove the last element of array which is the query term itself
		return re
	}
	q.getAncestorNames = q.getAncestorIDs

	q.termjsonByOneid = id => {
		return JSON.parse(JSON.stringify(termdb.id2term.get(id)))
	}

	q.getSupportedChartTypes = () => {
		// this function is required for server-provided termdbConfig
		const supportedChartTypes = {}
		const numericTypeCount = {}
		// key: subcohort combinations, comma-joined, as in the subcohort_terms table
		// value: array of chart types allowed by term types

		for (const r of termdb.id2term.values()) {
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
		if (terms.length == 0 || !treeFilter) return
		let termlst = []
		for (const term of terms) {
			if (term.path)
				termlst.push({
					path: term.path.replace('case.', '').replace(/\./g, '__'),
					type: term.type
				})
		}

		if (termlst.length == 0) return

		const tv2counts = await get_termlst2size({
			api: ds.termdb.termid2totalsize2.gdcapi,
			ds,
			termlst,
			treeFilter: JSON.parse(treeFilter)
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
