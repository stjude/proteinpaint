import serverconfig from './serverconfig'
import { connect_db } from './utils'
import { isUsableTerm } from '../shared/termdb.usecase'
import { authApi } from './auth'
import { DEFAULT_SAMPLE_TYPE, numericTypes } from '#shared/terms.js'

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
	} catch (e) {
		throw `Cannot connect db ${dbfile}: ${e.message || e}`
	}

	ds.cohort.db.connection = cn

	const tables = listDbTables(cn)
	ds.cohort.db.tables = tables
	ds.cohort.db.tableColumns = {}
	for (const table of tables) {
		const columns = listTableColumns(cn, table)
		ds.cohort.db.tableColumns[table] = columns
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

	ds.cohort.termdb.sample_types = new Map()
	if (tables.has('sample_types')) {
		const rows = cn.prepare('SELECT * FROM sample_types').all()
		for (const row of rows) {
			ds.cohort.termdb.sample_types.set(row.id, { name: row.name, plural_name: row.plural_name })
		}
		ds.cohort.termdb.hasAncestry = ds.cohort.termdb.sample_types.size > 1
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
		let rows = cn.prepare('SELECT id, sample_type FROM terms').all()
		for (const { id, sample_type } of rows) ds.cohort.termdb.term2SampleType.set(id, sample_type || DEFAULT_SAMPLE_TYPE)
	} else {
		let rows = cn.prepare('SELECT id FROM terms').all()
		for (const { id } of rows) ds.cohort.termdb.term2SampleType.set(id, DEFAULT_SAMPLE_TYPE)
	}
	if (tables.has('sampleidmap')) {
		const i2s = new Map(),
			s2i = new Map()
		let rows = cn.prepare('SELECT * FROM sampleidmap').all()
		let totalCount = 0
		for (const { id, name } of rows) {
			i2s.set(id, name)
			s2i.set(name, id)
			totalCount++ //for dbs without cohorts or types
		}
		q.id2sampleName = id => i2s.get(id)
		q.sampleName2id = s => s2i.get(s)
		if (tables.has('cohort_sample_types')) {
			rows = cn.prepare('SELECT * from cohort_sample_types').all()
			q.getCohortSampleCount = cohortKey => {
				let counts = rows
					.filter(row => row.cohort == cohortKey || cohortKey == undefined) //one may have multiple types and a default cohort
					.map(row => {
						const sample_type = ds.cohort.termdb.sample_types.get(row.sample_type)
						return `${row.sample_count} ${row.sample_count > 1 ? sample_type.plural_name : sample_type.name}`
					})
				let total = counts.join(' and ')

				return total
			}
		} else if (tables.has('cohorts')) {
			rows = cn.prepare('SELECT cohort, sample_count from cohorts').all()
			console.log(rows)
			q.getCohortSampleCount = cohortKey => {
				let counts = rows
					.filter(row => row.cohort == cohortKey)
					.map(row => {
						return `${row.sample_count} ${row.sample_count > 1 ? 'samples' : 'sample'}`
					})
				let total = counts.join(' and ')
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
		q.getRootTerms = (cohortStr = '') => {
			const cacheId = cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			const tmp = sql.all(cohortStr)
			const re = tmp.map(i => {
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				t.name = i.name || t.name
				t.included_types = i.included_types ? i.included_types.split(',') : ['TO-DO-PLACEHOLDER']
				t.child_types = i.child_types ? i.child_types.split(',') : []
				return t
			})
			cache.set(cacheId, re)
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
		q.getTermChildren = (id, cohortStr = '') => {
			const cacheId = id + ';;' + cohortStr
			if (cache.has(cacheId)) return cache.get(cacheId)
			const tmp = sql.all([cohortStr, id])
			let re = undefined
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
			return re
		}
	}
	{
		// may not cache result of this one as query string may be indefinite
		// instead, will cache prepared statement by cohort
		const sql = cn.prepare(
			`SELECT id, name, jsondata, s.included_types
			FROM terms t
			JOIN subcohort_terms s ON s.term_id = t.id AND s.cohort=?
			WHERE name LIKE ?`
		)
		q.findTermByName = (n, cohortStr = '', treeFilter = null, usecase = null) => {
			const tmp = sql.all([cohortStr, '%' + n + '%'])
			if (tmp) {
				const r = []
				for (const i of tmp) {
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
	returns list of chart types based on term types from each subcohort combination
	*/
	q.getSupportedChartTypes = embedder => {
		mayComputeTermtypeByCohort(ds)
		// ds.cohort.termdb.termtypeByCohort[] is set

		const cred = serverconfig.dsCredentials?.[ds.label]
		const supportedChartTypes = {}
		const numericTypeCount = {}
		// key: subcohort combinations, comma-joined, alphabetically sorted, as in the subcohort_terms table
		// value: array of chart types allowed by term types
		for (const r of ds.cohort.termdb.termtypeByCohort) {
			if (!r.type) continue // skip ungraphable parent terms

			if (!(r.cohort in supportedChartTypes)) {
				supportedChartTypes[r.cohort] = new Set(['regression', 'summary'])
				if (ds.cohort.scatterplots) supportedChartTypes[r.cohort].add('sampleScatter')

				numericTypeCount[r.cohort] = 0
				if (ds.cohort.allowedChartTypes?.includes('matrix')) supportedChartTypes[r.cohort].add('matrix')
				if (ds.cohort.allowedChartTypes?.includes('brainImaging')) supportedChartTypes[r.cohort].add('brainImaging')
				const forbiddenRoutes = authApi.getForbiddenRoutesForDsEmbedder(ds.label, embedder)
				if (!forbiddenRoutes.includes('termdb') && !forbiddenRoutes.includes('*')) {
					supportedChartTypes[r.cohort].add('dataDownload')
					supportedChartTypes[r.cohort].add('sampleView')
					if (ds.queries?.singleCell) supportedChartTypes[r.cohort].add('singleCellPlot')
				}
			}
			if (serverconfig.features?.draftChartTypes) {
				// TODO: move draft charts out of flag once stable
				supportedChartTypes[r.cohort].add(...serverconfig.features.draftChartTypes)
			}
			if (r.type == 'survival' && !supportedChartTypes[r.cohort].has('survival'))
				supportedChartTypes[r.cohort].add('survival')
			if (r.type == 'condition' && !supportedChartTypes[r.cohort].has('cuminc'))
				supportedChartTypes[r.cohort].add('cuminc')
			if (numericTypes.has(r.type)) numericTypeCount[r.cohort] += r.samplecount
		}

		/*
		this logic allows to add chart types generally applicable to all numeric terms
		but boxplot and scatter are now child types under "summary" plot.
		*/
		for (const cohort in numericTypeCount) {
			//if (numericTypeCount[cohort] > 0) supportedChartTypes[cohort].add('boxplot')
			if (numericTypeCount[cohort] > 1) supportedChartTypes[cohort].add('sampleScatter')
		}

		// convert to array
		for (const cohort in supportedChartTypes) {
			supportedChartTypes[cohort] = [...supportedChartTypes[cohort]]
		}

		// may restrict the visible chart options
		if (ds.cohort.allowedChartTypes) {
			for (const cohort in supportedChartTypes) {
				supportedChartTypes[cohort] = supportedChartTypes[cohort].filter(c => ds.cohort.allowedChartTypes.includes(c))
			}
		}

		// determine eligible chart types based on optional genomic queries
		if (ds.queries) {
			if (ds.queries.snvindel || ds.queries.trackLst) {
				// suitable datatypes are present, enable genomeBrowser chart
				for (const cohort in supportedChartTypes) {
					supportedChartTypes[cohort].push('genomeBrowser')
				}
			}
			if (ds.queries.geneExpression) {
				for (const cohort in supportedChartTypes) {
					supportedChartTypes[cohort].push('geneExpression')
					supportedChartTypes[cohort].push('sampleScatter')
				}
				// TODO support clustering on dict terms
			}
			if (ds.queries.metaboliteIntensity)
				for (const cohort in supportedChartTypes) {
					supportedChartTypes[cohort].push('sampleScatter')
					supportedChartTypes[cohort].push('metaboliteIntensity')
				}
			if (ds.queries.rnaseqGeneCount) {
				for (const cohort in supportedChartTypes) supportedChartTypes[cohort].push('DEanalysis')
			}
			if (ds.queries.singleCell) {
				for (const cohort in supportedChartTypes) supportedChartTypes[cohort].push('singleCellPlot')
			}
		}

		return supportedChartTypes
	}

	q.getSingleSampleData = function (sampleId, term_ids = []) {
		const termClause = !term_ids.length ? '' : `and term_id in (${term_ids.map(t => '?').join(',')})`

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
		union all 
		select term_id, (min_years_to_event || ' ' || value) as value 
		from precomputed_chc_grade 
		where max_grade=1 and sample=? ${termClause}
		union all 
		select term_id, (tte || ' ' || exit_code) as value 
		from survival 
		where sample=? ${termClause}) join terms on terms.id = term_id`
		const sql = cn.prepare(query)
		const rows = sql.all([
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
		])
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

export function listDbTables(cn) {
	const rows = cn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
	return new Set(rows.map(i => i.name))
}

export function listTableColumns(cn, table) {
	const rows = cn.prepare(`SELECT name FROM PRAGMA_TABLE_INFO('${table}')`).all()
	return rows.map(i => i.name)
}

export function mayComputeTermtypeByCohort(ds) {
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

	for dataset with subcohort:
	[
	  { cohort: 'XYZ', type: '', samplecount: 615 },
	  { cohort: 'XYZ', type: 'categorical', samplecount: 393 },
	  { cohort: 'ABC', type: '', samplecount: 636 },
	  { cohort: 'ABC', type: 'categorical', samplecount: 457 },
	  ...
	  { cohort: 'XYZ,ABC', type: '', samplecount: 614 },
	  { cohort: 'XYZ,ABC', type: 'categorical', samplecount: 393 },
	  ...
	]

	for dataset without subcohort:
	[
		  { cohort: '', type: '', samplecount: 11 },
		  { cohort: '', type: 'categorical', samplecount: 65 },
		  { cohort: '', type: 'float', samplecount: 1 },
		  { cohort: '', type: 'survival', samplecount: 2 }
	]

	*/
	ds.cohort.termdb.termtypeByCohort = ds.cohort.db.connection
		.prepare(
			`WITH c AS (
			SELECT cohort, term_id
			FROM subcohort_terms s
			GROUP BY cohort, term_id
		) 
		SELECT cohort, type, count(*) as samplecount
		FROM terms t
		JOIN c ON c.term_id = t.id
		GROUP BY cohort, type`
		)
		.all()
}
