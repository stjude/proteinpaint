import { connect_db } from './utils.js'
import { authApi } from './auth.js'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { DEFAULT_SAMPLE_TYPE, numericTypes } from '#shared/terms.js'
import type { isSupportedChartCallbacks } from '#types'

/*
server_init_db_queries()
listDbTables()
mayComputeTermtypeByCohort()
*/

/*
initiate db queries and produce function wrappers
run only once

as long as the termdb table and logic is universal
probably fine to hardcode such query strings here
and no need to define them in each dataset
thus less things to worry about...
*/
export function server_init_db_queries(ds) {
	if (!ds.cohort) throw 'ds.cohort missing'
	if (!ds.cohort.db) throw 'ds.cohort.db missing'
	if (!ds.cohort.termdb) throw 'ds.cohort.termdb missing'

	const dbfile = ds.cohort.db.file_fullpath || ds.cohort.db.file
	if (!dbfile) throw 'both file and file_fullpath missing'

	let cn
	try {
		console.log('Connecting', dbfile)
		cn = connect_db(dbfile)
		console.log(`DB connected for ${ds.label}: ${dbfile}`)
	} catch (e: any) {
		throw `Cannot connect db ${dbfile}: ${e.message || e}`
	}

	ds.cohort.db.connection = cn

	const tables = listDbTables(cn)
	ds.cohort.db.tables = tables
	ds.cohort.db.tableColumns = {}
	for (const table of tables) {
		const columns = listTableColumns(cn, table)
		ds.cohort.db.tableColumns[table as string] = columns
	}
	const schema_tables = [
		'cohorts',
		'sampleidmap',
		'terms',
		'ancestry',
		'alltermsbyorder',
		'termhtmldef',
		'category2vcfsample',
		'chronicevents',
		'precomputed_chc_grade',
		'precomputed_chc_child',
		'precomputed_cuminc',
		'precomputed_cox',
		'subcohort_terms',
		'subcohort_samples',
		'survival',
		'features',
		'cohort_features',
		'anno_integer',
		'anno_float',
		'anno_categorical',
		'buildDate'
	]

	// ds.cohort.termdb.sampleTypes has been added in mds3.init.js
	if (tables.has('sample_types')) {
		const rows = cn.prepare('SELECT * FROM sample_types').all()

		for (const row of rows) {
			ds.cohort.termdb.sampleTypes[row.id] = {
				name: row.name,
				plural_name: row.plural_name,
				parent_id: row.parent_id
			}
		}
		ds.cohort.termdb.hasSampleAncestry = Object.keys(ds.cohort.termdb.sampleTypes).length > 1
	}

	for (const table of schema_tables) if (!tables.has(table)) console.log(`${table} table missing!!!!!!!!!!!!!!!!!!!!`)
	//throw `${table} table missing`
	if (!tables.has('terms')) throw 'terms table missing'
	if (!tables.has('ancestry')) throw 'ancestry table missing'
	if (ds.cohort.termdb.selectCohort && !tables.has('subcohort_terms'))
		throw 'subcohort_terms table is missing while termdb.selectCohort is enabled'

	ds.cohort.termdb.q = {}
	const q = ds.cohort.termdb.q

	if (tables.has('buildDate')) {
		q.get_buildDate = cn.prepare('select date from buildDate')
	}

	if (tables.has('term2genes')) {
		/*
		this db has optional table that maps term id to gene set, right now only used for msigdb
		set termMatch2geneSet flag to true for client termdb tree to be aware of it via termdbConfig{}
		add the getter function
		*/
		ds.cohort.termdb.termMatch2geneSet = true
		const s = cn.prepare('SELECT genes FROM term2genes WHERE id=?')
		const cache = new Map()
		q.getGenesetByTermId = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t && t.genes) {
				const lst = JSON.parse(t.genes)
				cache.set(id, lst)
				return lst
			}
			return undefined
		}
	}
	ds.cohort.termdb.term2SampleType = new Map()
	if (ds.cohort.db.tableColumns['terms'].includes('sample_type')) {
		const rows = cn.prepare('SELECT id, sample_type FROM terms').all()
		for (const { id, sample_type } of rows) ds.cohort.termdb.term2SampleType.set(id, sample_type || DEFAULT_SAMPLE_TYPE)
	} else {
		const rows = cn.prepare('SELECT id FROM terms').all()
		for (const { id } of rows) ds.cohort.termdb.term2SampleType.set(id, DEFAULT_SAMPLE_TYPE)
	}
	if (tables.has('sampleidmap')) {
		const i2s = new Map(),
			s2i = new Map()
		const rows = cn.prepare('SELECT * FROM sampleidmap').all()
		let totalCount = 0
		for (const { id, name } of rows) {
			i2s.set(id, name)
			s2i.set(name, id)
			totalCount++ //for dbs without cohorts or types
		}
		q.id2sampleName = id => i2s.get(id)
		q.sampleName2id = s => s2i.get(s)
		if (tables.has('cohort_sample_types')) {
			const rows = cn.prepare('SELECT * from cohort_sample_types').all()
			q.getCohortSampleCount = cohortKey => {
				const counts = rows
					.filter(row => row.cohort == cohortKey || cohortKey == undefined) //one may have multiple types and a default cohort
					.map(row => {
						const sample_type = ds.cohort.termdb.sampleTypes[row.sample_type]
						return `${row.sample_count} ${row.sample_count > 1 ? sample_type.plural_name : sample_type.name}`
					})
				const total = counts.join(' and ')
				return total
			}
		} else if (tables.has('cohorts')) {
			const rows = cn.prepare('SELECT cohort, sample_count from cohorts').all()
			q.getCohortSampleCount = cohortKey => {
				const counts = rows
					.filter(row => row.cohort == cohortKey)
					.map(row => {
						return `${row.sample_count} ${row.sample_count > 1 ? 'samples' : 'sample'}`
					})
				const total = counts.join(' and ')
				if (total == '')
					//older db does not have types or sample_count
					return `${totalCount} samples`
				else return total
			}
		} else q.getCohortSampleCount = () => `${totalCount} samples`
	}

	if (tables.has('category2vcfsample')) {
		const s = cn.prepare('SELECT * FROM category2vcfsample')
		// must be cached as there are lots of json parsing
		let cache
		q.getcategory2vcfsample = () => {
			if (cache) return cache
			cache = s.all()
			for (const i of cache) {
				i.q = JSON.parse(i.q)
				i.categories = JSON.parse(i.categories)
			}
			return cache
		}
	}
	if (tables.has('alltermsbyorder')) {
		const s = cn.prepare('SELECT * FROM alltermsbyorder')
		let cache
		q.getAlltermsbyorder = () => {
			if (cache) return cache
			const tmp = s.all()
			cache = []
			for (const i of tmp) {
				const term = q.termjsonByOneid(i.id)
				if (term) {
					// alltermsbyorder maybe out of sync and some terms may be deleted
					cache.push({
						group_name: i.group_name,
						term
					})
				}
			}
			return cache
		}
	}
	{
		const s = cn.prepare('SELECT name, jsondata FROM terms WHERE id=?')
		const cache = new Map()
		/* should only cache result for valid term id, not for invalid ids
		as invalid id is arbitrary and indefinite
		an attack using random strings as termid can overwhelm the server memory
		*/
		q.termjsonByOneid = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t) {
				const j = JSON.parse(t.jsondata)
				j.id = id
				j.name = t.name || j.name
				cache.set(id, j)
				return j
			}
			return undefined
		}
	}

	{
		const s = cn.prepare('select id from terms where parent_id=?')
		const cache = new Map()
		q.termIsLeaf = id => {
			if (cache.has(id)) return cache.get(id)
			let re = true
			const t = s.get(id)
			if (t && t.id) re = false
			cache.set(id, re)
			return re
		}
	}

	{
		const sql = cn.prepare(
			`SELECT id, name, jsondata, s.included_types, s.child_types
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?
			WHERE parent_id is null
			GROUP BY id
			ORDER BY child_order ASC`
		)
		const cache = new Map()
		q.getRootTerms = (req, cohortStr = '') => {
			const cacheId = cohortStr
			let re
			if (cache.has(cacheId)) re = cache.get(cacheId)
			else {
				const tmp = sql.all(cohortStr)
				re = tmp.map(i => {
					const t = JSON.parse(i.jsondata)
					t.id = i.id
					t.name = i.name || t.name
					t.included_types = i.included_types ? i.included_types.split(',') : ['TO-DO-PLACEHOLDER']
					t.child_types = i.child_types ? i.child_types.split(',') : []
					return t
				})
				cache.set(cacheId, re)
			}
			// may filter out hidden terms from result, as needed
			re = filterTerms(req, ds, re)
			return re
		}
	}
	{
		const s = cn.prepare('SELECT parent_id FROM terms WHERE id=?')
		{
			const cache = new Map()
			q.termHasParent = id => {
				if (cache.has(id)) return cache.get(id)
				let re = false
				const t = s.get(id)
				if (t && t.parent_id) re = true
				cache.set(id, re)
				return re
			}
		}
		{
			const cache = new Map()
			q.getTermParentId = id => {
				if (cache.has(id)) return cache.get(id)
				let re = undefined
				const t = s.get(id)
				if (t && t.parent_id) re = t.parent_id
				cache.set(id, re)
				return re
			}
		}
		{
			const cache = new Map()
			q.getTermParent = id => {
				if (cache.has(id)) return cache.get(id)
				const pid = q.getTermParentId(id)
				let re = undefined
				if (pid) {
					re = q.termjsonByOneid(pid)
				}
				cache.set(id, re)
				return re
			}
		}
	}

	/*
		template: STR
		- sql statement with a JOINCLAUSE substring to be replaced with cohort value, if applicable, or removed otherwise
	*/
	{
		const sql = cn.prepare(
			`SELECT id, name, type, jsondata, s.included_types, s.child_types 
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=? 
			WHERE id IN (SELECT id FROM terms WHERE parent_id=?)
			GROUP BY id
			ORDER BY child_order ASC`
		)

		const cache = new Map()
		q.getTermChildren = (req, id, cohortStr = '') => {
			const cacheId = id + ';;' + cohortStr
			let re: any = undefined
			if (cache.has(cacheId)) re = cache.get(cacheId)
			else {
				const tmp = sql.all([cohortStr, id])
				if (tmp) {
					re = tmp.map(i => {
						const j = JSON.parse(i.jsondata)
						j.id = i.id
						j.name = i.name || j.name
						j.included_types = i.included_types ? i.included_types.split(',') : []
						j.child_types = i.child_types ? i.child_types.split(',') : []
						return j
					})
				}
				cache.set(cacheId, re)
			}
			// may filter out hidden terms from result, as needed
			re = filterTerms(req, ds, re)
			return re
		}
	}
	{
		// may not cache result of this one as query string may be indefinite
		// instead, will cache prepared statement by cohort
		const sql = cn.prepare(
			`SELECT id, name, parent_id, jsondata, s.included_types
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?
			WHERE name LIKE ?`
		)
		// it can accept an optional treeFilter parameter which is not used here, but used in gdc
		q.findTermByName = (n, cohortStr = '', usecase = null) => {
			const tmp = sql.all([cohortStr, '%' + n + '%'])
			if (tmp) {
				const r: string[] = []
				for (const i of tmp) {
					if (i.parent_id == '*') continue
					if (!i.jsondata) continue
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					j.name = i.name || j.name
					j.included_types = i.included_types ? i.included_types.split(',') : []
					if (!usecase || isUsableTerm(j, usecase).has('plot')) r.push(j)
				}
				return r
			}
			return undefined
		}
	}
	{
		const s1 = cn.prepare('SELECT MAX(value) AS v FROM anno_integer WHERE term_id=?')
		const s2 = cn.prepare('SELECT MAX(value) AS v FROM anno_float WHERE term_id=?')
		const cache = new Map()
		q.findTermMaxvalue = (id, isint) => {
			if (cache.has(id)) return cache.get(id)
			const tmp = (isint ? s1 : s2).get(id)
			if (tmp) {
				cache.set(id, tmp.v)
				return tmp.v
			}
			return undefined
		}
	}

	{
		/* get all sample-values for one term
		only works for atomic terms categorical/float/integer, not for condition
		uses:
		- get per-sample pc/admix values
		- singlecell cell annotations
		*/
		const t2s = {
			float: cn.prepare('SELECT sample,value FROM anno_float WHERE term_id=?'),
			integer: cn.prepare('SELECT sample,value FROM anno_integer WHERE term_id=?'),
			categorical: cn.prepare('SELECT sample,value FROM anno_categorical WHERE term_id=?')
		}
		q.getAllValues4term = id => {
			const t = q.termjsonByOneid(id)
			if (!t) return undefined
			const s = t2s[t.type]
			if (!s) return undefined
			const tmp = s.all(id)
			if (!tmp || tmp.length == 0) return undefined
			const s2v = new Map()
			for (const a of tmp) {
				s2v.set(a.sample, a.value)
			}
			return s2v
		}
	}

	{
		const s = cn.prepare('SELECT ancestor_id FROM ancestry WHERE term_id=?')
		const cache = new Map()
		q.getAncestorIDs = id => {
			if (cache.has(id)) return cache.get(id)
			const tmp = s.all(id).map(i => i.ancestor_id)
			cache.set(id, tmp)
			return tmp
		}
	}
	{
		const s = cn.prepare('SELECT t.name FROM ancestry as a, terms as t WHERE a.term_id=? AND t.id=a.ancestor_id')
		const cache = new Map()
		q.getAncestorNames = id => {
			if (cache.has(id)) return cache.get(id)
			const tmp = s.all(id).map(i => i.name)
			cache.set(id, tmp)
			return tmp
		}
	}
	{
		const s = cn.prepare(
			`select id, name, json_extract(jsondata, '$.plotType') as subtype, json_extract(jsondata, '$.domainDetails') as details from terms where type='multivalue' and parent_id=?`
		)
		const cache = new Map()
		q.get_multivalue_tws = parent_id => {
			if (cache.has(parent_id)) return cache.get(parent_id)
			const items = s.all(parent_id)
			const terms = items.map(item => {
				return {
					$id: item.id,
					term: { id: item.id, name: item.name, type: 'multivalue', subtype: item.subtype, details: item.details }
				}
			})
			cache.set(parent_id, terms)
			return terms
		}
	}
	{
		/* term id is required, sample id is optional
		if sample is missing, select all sample and category by term id
			return [ {sample=str, value=?}, ... ]
		else, return single value by sample and term
		*/
		const s = {
			categorical: cn.prepare('SELECT value FROM anno_categorical WHERE term_id=?'),
			integer: cn.prepare('SELECT value FROM anno_integer WHERE term_id=?'),
			float: cn.prepare('SELECT value FROM anno_float WHERE term_id=?')
		}
		const s_sampleInt = {
			categorical: cn.prepare('SELECT value FROM anno_categorical WHERE term_id=? AND sample=?'),
			integer: cn.prepare('SELECT value FROM anno_integer WHERE term_id=? AND sample=?'),
			float: cn.prepare('SELECT value FROM anno_float WHERE term_id=? AND sample=?')
		}
		const s_sampleStr = {
			categorical: cn.prepare('SELECT value FROM anno_categorical a,sampleidmap s WHERE term_id=? AND s.name=?'),
			integer: cn.prepare('SELECT value FROM anno_integer a,sampleidmap s WHERE term_id=? AND s.name=?'),
			float: cn.prepare('SELECT value FROM anno_float a, sampleidmap s WHERE term_id=? AND s.name=?')
		}
		if (tables.has('anno_date')) {
			s_sampleInt['date'] = cn.prepare('SELECT value FROM anno_date a, sampleidmap s WHERE term_id=? AND s.name=?')
			s_sampleStr['date'] = cn.prepare('SELECT value FROM anno_date a, sampleidmap s WHERE term_id=? AND s.name=?')
		}

		q.getSample2value = (id, sample = null) => {
			const term = q.termjsonByOneid(id)
			if (!sample) return s[term.type].all(id)
			if (typeof sample == 'string') return s_sampleStr[term.type].all(id, sample)
			return s_sampleInt[term.type].all(id, sample)
		}
	}
	if (tables.has('termhtmldef')) {
		//get term_info for a term
		//rightnow only few conditional terms have grade info
		const s = cn.prepare('SELECT jsonhtml FROM termhtmldef WHERE id=?')
		const cache = new Map()
		q.getTermInfo = id => {
			if (cache.has(id)) return cache.get(id)
			const t = s.get(id)
			if (t) {
				const j = JSON.parse(t.jsonhtml)
				j.id = id
				cache.set(id, j)
				return j
			}
			return undefined
		}
	}

	/* 
		generates commonCharts with optional overrides to ensure that ds-specific overrides are not shared across different datasets
		this is used by getSupportedChartTypes()
		scope commonCharts inside the init function; also compute it once on server startup and no need to repeat it in getSupportedChartTypes()
	*/
	const commonCharts = Object.assign(
		{},
		defaultCommonCharts,
		(ds.isSupportedChartOverride as isSupportedChartCallbacks) || {}
	)

	mayComputeTermtypeByCohort(ds) // ds.cohort.termdb.termtypeByCohort[] is set. needed by getSupportedChartTypes()

	/*
	compute and return list of chart types based on term types from each subcohort, and non-dictionary query data
	for showing as chart buttons in mass ui
	*/
	q.getSupportedChartTypes = req => {
		// based on request, derive forbiddenRoutes and clientAuthResults that ds can use to tailor chart support
		const info = authApi.getNonsensitiveInfo(req)
		// must do the check so as not to fail tsc compiler check (auth.js is not ts)
		const authInfo = typeof info == 'object' ? info : { forbiddenRoutes: [] }
		const supportedChartTypes = {} // key: subcohort string, value: list of chart types allowed for this cohort

		for (const [cohort, cohortTermTypes] of Object.entries(ds.cohort.termdb.termtypeByCohort.nested)) {
			supportedChartTypes[cohort] = []

			for (const [chartType, isSupported] of Object.entries(commonCharts)) {
				if (isSupported({ ds, cohortTermTypes, cohort, ...authInfo })) {
					// this chart type is supported based on context
					supportedChartTypes[cohort].push(chartType)
				}
			}
		}
		return supportedChartTypes
	}

	q.getSingleSampleData = function (sampleId, term_ids = []) {
		const termClause = !term_ids.length ? '' : `and term_id in (${term_ids.map(() => '?').join(',')})`
		const query = `select term_id, value, jsondata from ( select term_id, value 
		from anno_categorical 
		where sample=? ${termClause}
		union all 
		select term_id, 
		value from anno_float 
		where sample=? ${termClause}
		union all  
		select term_id, value 
		from anno_integer 
		where sample=? ${termClause}
		${tables.has('anno_date') ? 'union all select term_id, value from anno_date where sample=? ' + termClause : ''}
		union all 
		select term_id, (min_years_to_event || ' ' || value) as value 
		from precomputed_chc_grade 
		where max_grade=1 and sample=? ${termClause}
		union all 
		select term_id, (tte || ' ' || exit_code) as value 
		from survival 
		where sample=? ${termClause}) join terms on terms.id = term_id`
		const sql = cn.prepare(query)
		const params = [
			sampleId,
			...term_ids,
			sampleId,
			...term_ids,
			sampleId,
			...term_ids,
			sampleId,
			...term_ids,
			sampleId,
			...term_ids
		]
		if (tables.has('anno_date')) params.push(sampleId, ...term_ids)
		const rows = sql.all(params)
		return rows
	}

	q.getProfileFacilities = function () {
		const query = `select name from sampleidmap join 
		anno_categorical on sampleidmap.id = anno_categorical.sample
		where term_id = 'sampleType' and value = 'Facility'`
		const sql = cn.prepare(query)
		const rows = sql.all()
		return rows
	}
}

// ds computes term visibility in dictionary based on client auth; returns list of visible terms
// function name is intentionally general but not specific to auth, later might add other term filtering context in here
export function filterTerms(req, ds, terms) {
	if (!ds.cohort.termdb.isTermVisible || !terms?.length) return terms
	return terms.filter(term => ds.cohort.termdb.isTermVisible(req.query.__protected__.clientAuthResult, term.id))
}

/*
	This section defines common chart types, such as 'summary charts', which are generally applicable to any dataset (ds).
	These chart types can be computed based on term types or the availability of ds.queries{}, for example, survival or singleCell charts.

	Each chart type has a callback function equivalent to isSupported() that executes on context parameters 
	to determine if the chart type should be displayed (returns true) or not (returns false).

	This is not an exhaustive list:
	- numericDictCluster is not defined here; it is defined in the specific dataset that requires it.
	- Special "uncommon" chart types are not included here.

	These chart types can be overridden by ds.isSupportedChartOverride{} within the init() function to:
	- Hide a common chart type by providing a callback that returns false 
	  (e.g., even if a dataset has a survival term, a collaborator may not want the KM plot to be shown).
	- Add a special "uncommon" chart type (e.g., profile).
	- Supply a new callback for an existing chart type to execute ad-hoc logic (e.g., considering the user's role).
*/

const defaultCommonCharts: isSupportedChartCallbacks = {
	dictionary: () => true,
	matrix: () => true,
	/*
	parent type: regression
	child types: linear/logistic/cox
	- if parent is disabled, all child types are not accessible
	- when parent is accessible, availability of each child type is individually calculated based on data types and allows for ds override for customization
	*/
	regression: () => true,
	linear: ({ cohortTermTypes }) => cohortTermTypes.numeric > 0, // numeric term present and could be used as linear outcome
	logistic: () => true, // always enabled by default because: numeric/categorical/condition terms could all be used as outcome. later we will support custom samplelst term of two groups as outcome. a ds can provide an override to hide it if needed
	cox: ({ cohortTermTypes }) => {
		// requires either survival or condition term as cox outcome
		return (cohortTermTypes.survival || 0) + (cohortTermTypes.condition || 0) > 0
	},

	facet: () => true,
	survival: ({ cohortTermTypes }) => cohortTermTypes.survival > 0,
	cuminc: ({ cohortTermTypes }) => cohortTermTypes.condition > 0,

	/*
	parent type: sampleScatter
	child type: dynamicScatter
	*/
	sampleScatter: ({ ds, cohortTermTypes }) => {
		// corresponds to the "Scatter Plot" chart button. it covers both premade scatter plots, as well as dynamic scatter input ui on clicking the "Scatter Plot" chart button
		if (ds.cohort.scatterplots) return true
		if (ds.queries?.geneExpression) return true
		if (ds.queries?.metaboliteIntensity) return true
		if (cohortTermTypes.numeric > 1) return true // numeric is always prefilled for convenience, does not have to check if property exists
		return false
	},
	dynamicScatter: ({ ds, cohortTermTypes }) => {
		// can be considered a "child type" of "sampleScatter".
		// corresponds to the two-term-selection-ui on clicking "Scatter Plot" chart button.
		if (ds.queries?.geneExpression) return true
		if (ds.queries?.metaboliteIntensity) return true
		if (cohortTermTypes.numeric > 1) return true // numeric is always prefilled for convenience, does not have to check if property exists
		return false
	},

	genomeBrowser: ({ ds }) => {
		// will need to add more logic
		if (ds.queries?.snvindel || ds.queries?.trackLst) return true
		return false
	},
	singleCellPlot: ({ ds }) => ds.queries?.singleCell,
	correlationVolcano: ({ ds }) => ds.cohort.correlationVolcano,
	geneExpression: ({ ds }) => ds.queries?.geneExpression,
	metaboliteIntensity: ({ ds }) => ds.queries?.metaboliteIntensity,
	DA: ({ ds }) => ds.queries?.rnaseqGeneCount,
	brainImaging: ({ ds }) => ds.queries?.NIdata,
	DziViewer: ({ ds }) => ds.queries?.DZImages, // replaced by WSIViewer, but keep it here just in case
	WSIViewer: ({ ds }) => ds.queries?.WSImages,
	imagePlot: ({ ds }) => ds.queries?.images,
	dataDownload: ({ forbiddenRoutes }) => {
		// ---  sample-level charts  ---
		// not shown if a portal/embedder (request origin) is forbidden to access certain server routes;
		// may need to be recomputed for every `/termdb/config` request because the embedder and login status may change
		return !forbiddenRoutes.includes('termdb') && !forbiddenRoutes.includes('*')
	},
	sampleView: ({ forbiddenRoutes }) => {
		return !forbiddenRoutes.includes('termdb') && !forbiddenRoutes.includes('*')
	},
	/* enable grin2 when this is available
	this solution:
	- loads alteration data from per-sample json files
	- this query already combines data from multiple query types, thus no need to assess availability of each of those
	alternative:
	- assess availability of snvindel/cnv/svfusion etc
	*/
	grin2: ({ ds }) => ds.queries?.singleSampleMutation
}

export function listDbTables(cn) {
	const rows = cn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
	return new Set(rows.map(i => i.name))
}

export function listTableColumns(cn, table) {
	const rows = cn.prepare(`SELECT name FROM PRAGMA_TABLE_INFO('${table}')`).all()
	return rows.map(i => i.name)
}

function mayComputeTermtypeByCohort(ds) {
	if (ds.cohort.termdb.termtypeByCohort) {
		if (!Array.isArray(ds.cohort.termdb.termtypeByCohort)) throw 'termtypeByCohort is not array'
		// already set, by one of two methods:
		// 1. db query below
		// 2. gdc dictionary building
		return
	}

	if (!ds.cohort?.db?.connection) throw 'termtypeByCohort[] not set but cohort.db.connection missing'

	/*
	not available; perform db query for the first request, and cache the results

	(as this query may be expensive thus do not want to run it for every request...)
	
	when termType: '', it indicates a branch term that is not used to annotate samples

	for dataset with subcohort:
	[
	  { cohort: 'XYZ', termType: '', termCount: 615 }, // filtered out in sql, can add back as needed
	  { cohort: 'XYZ', termType: 'categorical', termCount: 393 },
	  { cohort: 'ABC', termType: '', termCount: 636 },
	  { cohort: 'ABC', termType: 'categorical', termCount: 457 },
	  ...
	  { cohort: 'XYZ,ABC', termType: '', termCount: 614 },
	  { cohort: 'XYZ,ABC', termType: 'categorical', termCount: 393 },
	  ...
	]

	for dataset without subcohort:
	[
		  { cohort: '', termType: '', termCount: 11 }, // filtered out in sql, can add back as needed
		  { cohort: '', termType: 'categorical', termCount: 65 },
		  { cohort: '', termType: 'float', termCount: 1 },
		  { cohort: '', termType: 'survival', termCount: 2 }
	]

	*/
	const rows = ds.cohort.db.connection
		.prepare(
			`WITH c AS (
			SELECT cohort, term_id
			FROM subcohort_terms s
			GROUP BY cohort, term_id
		) 
		SELECT cohort, type as termType, count(*) as termCount 
		FROM terms t
		JOIN c ON c.term_id = t.id AND t.type != '' AND t.type IS NOT NULL
		GROUP BY cohort, termType`
		)
		.all()

	// flat list/array
	ds.cohort.termdb.termtypeByCohort = rows
	// freeze to avoid accidental rewrites by consumer code
	for (const r of rows) Object.freeze(r)

	// nested data by cohort name, more convenient to use in some cases
	const nested = {}
	for (const r of rows) {
		if (!nested[r.cohort]) nested[r.cohort] = { numeric: 0 } // guarantees that this convenience property exists
		nested[r.cohort][r.termType] = r.termCount
		// for convenience, precompute the number of numeric terms in cohort
		if (numericTypes.has(r.termType)) nested[r.cohort].numeric += r.termCount
	}
	Object.freeze(nested)
	// freeze to avoid accidental rewrites by consumer code
	for (const v of Object.values(nested)) Object.freeze(v)
	ds.cohort.termdb.termtypeByCohort.nested = nested
}
