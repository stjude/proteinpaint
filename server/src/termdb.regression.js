import path from 'path'
import { get_term_cte } from './termdb.sql'
import { getFilterCTEs } from './termdb.filter'
import { lines2R } from './utils'

export async function get_regression(q, ds) {
	try {
		if (!ds.cohort) throw 'cohort missing from ds'
		q.ds = ds
		q.independent = JSON.parse(decodeURIComponent(q.independent))
		// termY === outcome term
		q.termY = ds.cohort.termdb.q.termjsonByOneid(q.term1_id)
		q.termY_id = q.term1_id
		q.termY_q = JSON.parse(q.term1_q)
		delete q.term1_id
		delete q.term1_q
		const header = ['outcome']
		for (const i in q.independent) {
			const term = q.independent[i]
			const termnum = 'term' + i
			q[termnum + '_id'] = term.id
			if (term.q) q[termnum + '_q'] = term.q
			header.push(term.id) //('var'+i)//(term.term.name)
			term.term = ds.cohort.termdb.q.termjsonByOneid(term.id)
		}
		const rows = get_matrix(q)
		const tsv = [header.join('\t')]
		const termYvalues = q.termY.values || {}
		const independentTypes = q.independent.map(t => t.type)
		const termTypes = [q.termY.type, ...independentTypes]
		// Convert SJLIFE term types to R classes
		const colClasses = termTypes.map(type => type2class.get(type))
		if ('cutoff' in q) colClasses[0] = 'factor'
		const regressionType = q.regressionType || 'linear'
		for (const row of rows) {
			const outcomeVal = termYvalues[row.outcome] && termYvalues[row.outcome].uncomputable ? 'NA' : row.outcome
			const meetsCutoff = 'cutoff' in q && outcomeVal != 'NA' && Number(outcomeVal) >= q.cutoff ? 1 : 0 //console.log(meetsCutoff, q.cutoff, outcomeVal, Number(outcomeVal), regressionType)
			const line = ['cutoff' in q ? meetsCutoff : outcomeVal]
			for (const i in q.independent) {
				const value = row['val' + i]
				const term = q.independent[i]
				const val = term.term && term.term.values && term.term.values[value]
				line.push(val && val.uncomputable ? 'NA' : value)
			}
			if (line[0] != 'NA') tsv.push(line.join('\t'))
		}
		const data = await lines2R('regression.R', tsv, [regressionType, colClasses.join(',')])
		const result = []
		let table, lineCnt
		for (const line of data) {
			if (line.startsWith('#')) {
				if (table) result.push(table)
				const [format, name] = line.split('#').slice(1)
				table = {
					name: name,
					format: format,
					rows: []
				}
				lineCnt = 0
				continue
			}
			if (table.format === 'matrix') {
				lineCnt++
				if (lineCnt === 1) {
					table.keys = line.split('\t')
					continue
				}
			}
			table.rows.push(line.split('\t'))
		}
		result.push(table)
		return result
	} catch (e) {
		if (e.stack) console.log(e.stack)
		return { error: e.message || e }
	}
}

function get_matrix(q) {
	/*
works for only termdb terms; non-termdb attributes will not work

gets partitioned data for regression analysis

returns
	[{
		outcome, 
		key0, val0, // independent variable 0, required
		key1, val1, // independent variable 1, optional
		key?, val?, // additional independent variables, optional
		...
	}]

q{}
	.filter
	.ds
	.term[Y,0,1,2, ...]_id
	.term[Y,0,1,2, ...]_q
*/

	if (typeof q.filter == 'string') q.filter = JSON.parse(decodeURIComponent(q.filter))
	const filter = getFilterCTEs(q.filter, q.ds)
	// must copy filter.values as its copy may be used in separate SQL statements,
	// for example get_rows or numeric min-max, and each CTE generator would
	// have to independently extend its copy of filter values
	const values = filter ? filter.values.slice() : []
	const outcome = get_term_cte(q, values, 'Y', filter)
	const ctes = []
	const columns = []
	for (const key in q) {
		if (key.startsWith('term') && key.endsWith('_id') && key != 'termY_id') {
			const i = Number(key.split('_')[0].replace('term', ''))
			ctes.push(get_term_cte(q, values, i, filter))
			columns.push(`t${i}.key AS key${i}, t${i}.value AS val${i}`)
		}
	}

	const statement = `WITH
		${filter ? filter.filters + ',' : ''}
		${outcome.sql},
		${ctes.map(t => t.sql).join(',\n')}
		SELECT
			Y.sample AS sample,
			Y.value AS outcome,
      ${columns.join(',\n')}
		FROM ${outcome.tablename} Y
		${ctes.map((t, i) => `JOIN ${t.tablename} t${i} ON t${i}.sample = Y.sample`).join('\n')}
		${filter ? 'WHERE Y.sample IN ' + filter.CTEname : ''}`
	// console.log(76, statement, values)
	const lst = q.ds.cohort.db.connection.prepare(statement).all(values)
	return lst
}

const type2class = new Map([
	['integer', 'integer'],
	['float', 'numeric'],
	['survival', 'numeric'],
	['categorical', 'factor'],
	['condition', 'factor']
])
