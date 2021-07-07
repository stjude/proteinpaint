/*

$ npx tape modules/test/*.spec.js

*/

const tape = require('tape')
const getFilterCTEs = require('../termdb.filter').getFilterCTEs
const sjlife = require('./load.sjlife').init('termdb.test.js')
server_init_db_queries(sjlife.ds, sjlife.cn)

tape('\n', function(test) {
	test.pass('-***- modules/termdb.filter specs -***-')
	test.end()
})

tape('simple filter', function(test) {
	const filter = getFilterCTEs({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'wgs_sequenced', type: 'categorical' },
					values: [{ key: '1', label: 'Yes' }] // always assumed OR
				}
			}
		]
	})

	//console.log(filter.CTEs.join(',\n'))
	//console.log(filter.values)
	test.deepEqual(
		Object.keys(filter).sort((a, b) => (a < b ? -1 : 1)),
		['CTEname', 'CTEs', 'filters', 'values'],
		'should return an object with the four expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.equal(
		filter.filters.split('?').length - 1,
		filter.values.length,
		'CTE string should have the same number of ? as values[]'
	)
	test.equal(filter.CTEs.length, 2, 'should return two CTE clauses for this simple filter')
	test.end()
})

tape('nested filter', function(test) {
	const filter = getFilterCTEs(
		{
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'wgs_sequenced', type: 'categorical' },
						values: [{ key: '1', label: 'Yes' }] // always assumed OR
					}
				},
				{
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						{
							type: 'tvs',
							tvs: {
								term: { id: 'sex', type: 'categorical' },
								values: [{ key: 'male', label: 'male' }]
							}
						},
						{
							type: 'tvs',
							tvs: {
								term: { id: 'diaggrp', type: 'categorical' },
								values: [{ key: 'ALL', label: 'ALL' }]
							}
						},
						{
							type: 'tvslst',
							in: true,
							join: 'and',
							lst: [
								{
									type: 'tvs',
									tvs: {
										term: { id: 'agedx', type: 'float' },
										ranges: [{ start: 1, stop: 5 }]
									}
								},
								{
									type: 'tvs',
									tvs: {
										term: { id: 'aaclassic_5', type: 'float' },
										ranges: [{ start: 1000, stop: 4000 }]
									}
								}
							]
						}
					]
				}
			]
		},
		sjlife.ds
	)

	//console.log(filter.CTEs.join(',\n'))
	//console.log(filter.values)
	test.deepEqual(
		Object.keys(filter).sort((a, b) => (a < b ? -1 : 1)),
		['CTEname', 'CTEs', 'filters', 'values'],
		'should return an object with the four expected keys'
	)
	test.equal(filter.CTEname, 'f', 'should return the default CTE name')
	test.equal(
		filter.filters.split('?').length - 1,
		filter.values.length,
		'CTE string should have the same number of ? as values[]'
	)
	test.equal(filter.CTEs.length, 8, 'should return 8 CTE clauses for this complex filter')
	test.end()
})

function server_init_db_queries(ds, cn) {
	/*
initiate db queries and produce function wrappers
run only once

as long as the termdb table and logic is universal
probably fine to hardcode such query strings here
and no need to define them in each dataset
thus less things to worry about...
*/
	if (!ds.cohort) throw 'ds.cohort missing'
	if (!ds.cohort.db) throw 'ds.cohort.db missing'
	ds.cohort.db.connection = cn

	if (!ds.cohort.termdb) throw 'ds.cohor.termdb missing'
	ds.cohort.termdb.q = {}
	const q = ds.cohort.termdb.q

	{
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
	{
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
		const s = cn.prepare('SELECT jsondata FROM terms WHERE id=?')
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
		const s = cn.prepare('SELECT id,jsondata FROM terms WHERE parent_id is null')
		let cache = null
		q.getRootTerms = () => {
			if (cache) return cache
			cache = s.all().map(i => {
				const t = JSON.parse(i.jsondata)
				t.id = i.id
				return t
			})
			return cache
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
	{
		const s = cn.prepare('SELECT id,jsondata FROM terms WHERE id IN (SELECT id FROM terms WHERE parent_id=?)')
		const cache = new Map()
		q.getTermChildren = id => {
			if (cache.has(id)) return cache.get(id)
			const tmp = s.all(id)
			let re = undefined
			if (tmp) {
				re = tmp.map(i => {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					return j
				})
			}
			cache.set(id, re)
			return re
		}
	}
	{
		// may not cache result of this one as query string may be indefinite
		const s = cn.prepare('SELECT id,jsondata FROM terms WHERE name LIKE ?')
		q.findTermByName = (n, limit) => {
			const tmp = s.all('%' + n + '%')
			if (tmp) {
				const lst = []
				for (const i of tmp) {
					const j = JSON.parse(i.jsondata)
					j.id = i.id
					lst.push(j)
					if (lst.length == 10) break
				}
				return lst
			}
			return undefined
		}
	}
	{
		const s1 = cn.prepare('SELECT MAX(CAST(value AS INT))  AS v FROM annotations WHERE term_id=?')
		const s2 = cn.prepare('SELECT MAX(CAST(value AS REAL)) AS v FROM annotations WHERE term_id=?')
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
		// select sample and category, only for categorical term
		// right now only for category-overlay on maf-cov plot
		const s = cn.prepare('SELECT sample,value FROM annotations WHERE term_id=?')
		q.getSample2value = id => {
			return s.all(id)
		}
	}
	{
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
}
