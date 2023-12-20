/*
nested filter documented at:
https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit?pli=1#heading=h.eeqtb17pxcp0

ds: required by get_numerical()

CTEname: Provides the prefix of CTEs at this level (filter.lst[])
  Optional, not required for root level.
  Each recursion will append a postfix "_i" to the CTEname

Recursively generates CTE statements based on the nested filter
each run processes one level of filter.lst[]
One CTE is made for each item of filter.lst[], with name "CTEname_<i>"
A superCTE is made to cap this level, with name "CTEname"

*/

export async function getFilterCTEs(filter, ds, CTEname = 'f') {
	if (!filter) return
	if (filter.type != 'tvslst') throw 'filter.type is not "tvslst" but: ' + filter.type
	if (!Array.isArray(filter.lst)) throw 'filter.lst must be an array'
	if (filter.lst.length == 0) return console.error('filter.lst[] is zero length, see if is an error')
	if (filter.lst.length == 1) {
		// only one element at this level, disregard "join"
		if (filter.lst[0].type == 'tvslst') throw 'only one element at a level: type should not be "tvslst"'
	} else {
		// multiple elements at this level
		if (filter.join != 'or' && filter.join != 'and')
			throw 'multiple elements at a level: filter.join must equal either "or" or "and"'
	}
	if (!('in' in filter)) filter.in = true // currently not handled by the client

	// list of CTEnames in filter.lst[]
	const thislevelCTEnames = []
	// cumulative CTE of this level and sub levels
	const CTEs = []
	// cumulative values
	const values = []
	for (const [i, item] of filter.lst.entries()) {
		const CTEname_i = CTEname + '_' + i
		let f
		if (item.type == 'tvslst') {
			f = await getFilterCTEs(item, ds, CTEname_i)
			// .filters: str, the CTE cascade, not used here!
			// .CTEs: [] list of individual CTE string
			// .values: []
			// .CTEname: str
		} else if (!item.tvs) {
			throw `filter item should have a 'tvs' or 'lst' property`
		} else if (item.tvs.term.type == 'categorical') {
			f = get_categorical(item.tvs, CTEname_i)
			// .CTEs: []
			// .values:[]
			// .CTEname
		} else if (item.tvs.term.type == 'survival') {
			f = get_survival(item.tvs, CTEname_i)
		} else if (item.tvs.term.type == 'samplelst') {
			f = get_samplelst(item.tvs, CTEname_i)
		} else if (item.tvs.term.type == 'integer' || item.tvs.term.type == 'float') {
			f = get_numerical(item.tvs, CTEname_i, ds)
		} else if (item.tvs.term.type == 'condition') {
			f = get_condition(item.tvs, CTEname_i)
		} else if (item.tvs.term.type == 'geneVariant') {
			f = await get_geneVariant(item.tvs, CTEname_i, ds)
		} else {
			throw 'unknown term type'
		}
		thislevelCTEnames.push(f.CTEname)
		CTEs.push(...f.CTEs)
		values.push(...f.values)
	}

	const JOINOPER = filter.join == 'and' ? 'INTERSECT' : 'UNION'
	const superCTE = thislevelCTEnames.map(name => 'SELECT * FROM ' + name).join('\n' + JOINOPER + '\n')
	if (filter.in) {
		CTEs.push(`
				${CTEname} AS (
					${superCTE}
				)
			`)
	} else {
		CTEs.push(`
				${CTEname} AS (
					SELECT id as sample
					FROM sampleidmap
					WHERE sample NOT IN (
						${superCTE}
					)
				)
			`)
	}
	return {
		filters: CTEs.join(',\n'),
		CTEs,
		values,
		CTEname
	}
}

// makesql_by_tvsfilter helpers
// put here instead of inside makesql_by_tvsfilter
// to parse function once at server start instead of
// multiple times per server request
function get_categorical(tvs, CTEname) {
	return {
		CTEs: [
			`
		  ${CTEname} AS (
				SELECT sample
				FROM anno_categorical
				WHERE term_id = ?
				AND value ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})
			)`
		],
		values: [tvs.term.id, ...tvs.values.map(i => i.key)],
		CTEname
	}
}

function get_survival(tvs, CTEname) {
	return {
		CTEs: [
			`
		  ${CTEname} AS (
				SELECT sample
				FROM survival
				WHERE term_id = ?
				${tvs.q?.cutoff ? 'AND tte >= ' + tvs.q?.cutoff : ''}
				AND exit_code ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})
			)`
		],
		values: [tvs.term.id, ...tvs.values.map(i => i.key)],
		CTEname
	}
}

function get_samplelst(tvs, CTEname) {
	const samples = []
	for (const field in tvs.term.values) {
		const list = tvs.term.values[field].list
		samples.push(...list)
	}
	return {
		CTEs: [
			`
		  ${CTEname} AS (
				SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${Array(samples.length).fill('?').join(', ')})
			)`
		],
		values: [...samples.map(value => value.sampleId)],
		CTEname
	}
}

async function get_geneVariant(tvs, CTEname, ds) {
	const tw = { term: tvs.term, q: {} }
	const data = await ds.mayGetGeneVariantData(tw, { genome: ds.genomename })
	/*
	data here is map of sampleId-mutationData pairs, e.g.
	63 => { sample: 63, TP53: { key: 'TP53', values: [Array], label: 'TP53' } },
	56 => {}, ...
	*/
	const samplenames = []
	for (const [key, value] of data) {
		const sampleValues = value[tvs.term.name].values
		/*
		sampleVlaues here is an array of results for each available dt for the sampleID. e.g.
		[
			{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'germline' },
			{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'somatic' },
			{ dt: 2, class: 'Blank', _SAMPLEID_: 21 },
			{ dt: 4, class: 'WT', _SAMPLEID_: 21 }
		]
		*/
		let includeSample = true
		for (const tvsValue of tvs.values) {
			/* tvs.values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at this round of edit-and-apply, e.g.
            [
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'germline'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'somatic'},
                {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
                {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
            ]
            */
			const sampleValueLst = sampleValues.filter(
				v => v.dt == tvsValue.dt && (tvsValue.origin ? tvsValue.origin == v.origin : true)
			)
			for (const sampleValue of sampleValueLst) {
				if (tvsValue.mclassExcludeLst.includes(sampleValue?.class)) {
					includeSample = false
					break
				}
			}
		}
		if (includeSample) samplenames.push(key)
	}

	return {
		CTEs: [
			`
		  ${CTEname} AS (
				SELECT id as sample
				FROM sampleidmap
				WHERE id IN (${samplenames.map(i => '?').join(', ')})
			)`
		],
		values: [...samplenames],
		CTEname
	}
}

function get_numerical(tvs, CTEname, ds) {
	/*
for the case e.g. '0' is for "Not exposed", range.value can be either '0' or 0, string or number
as it cannot be decided what client will provide
so here need to allow both string and number as range.value
*/
	if (!tvs.ranges) throw '.ranges{} missing'
	const values = [tvs.term.id]
	// get term object
	const term = ds.cohort.termdb.q.termjsonByOneid(tvs.term.id)
	const rangeclauses = []
	let hasactualrange = false // if true, will exclude special categories

	for (const range of tvs.ranges) {
		if ('value' in range) {
			// special category
			// where value for ? can be number or string, doesn't matter
			const negator = tvs.isnot ? '!' : ''
			rangeclauses.push(`value ${negator}= ?`)
			values.push('' + range.value)
		} else {
			// actual range
			hasactualrange = true
			const lst = []
			if (!range.startunbounded) {
				if (range.startinclusive) {
					lst.push('value >= ?')
				} else {
					lst.push('value > ? ')
				}
				values.push(range.start)
			}
			if (!range.stopunbounded) {
				if (range.stopinclusive) {
					lst.push('value <= ?')
				} else {
					lst.push('value < ? ')
				}
				values.push(range.stop)
			}
			const negator = tvs.isnot ? 'NOT ' : ''
			if (lst.length) rangeclauses.push(negator + '(' + lst.join(' AND ') + ')')
		}
	}

	let excludevalues
	if (hasactualrange && term.values) {
		excludevalues = Object.keys(term.values)
			.filter(key => term.values[key].uncomputable)
			.map(Number)
			.filter(key => tvs.isnot || !tvs.ranges.find(range => 'value' in range && Number(range.value) == key))
		if (excludevalues.length) values.push(...excludevalues)
	}
	const combinedClauses = rangeclauses.join(' OR ')
	return {
		CTEs: [
			`
		    ${CTEname} AS (
				SELECT sample
				FROM anno_${term.type}
				WHERE term_id = ?
				${combinedClauses ? 'AND (' + combinedClauses + ')' : ''}
				${excludevalues && excludevalues.length ? `AND value NOT IN (${excludevalues.map(d => '?').join(',')})` : ''}
			)`
		],
		values,
		CTEname
	}
}

function get_condition(tvs, CTEname) {
	let value_for
	if (tvs.bar_by_children) value_for = 'child'
	else if (tvs.bar_by_grade) value_for = 'grade'
	else throw 'must set the bar_by_grade or bar_by_children query parameter'

	let restriction
	if (tvs.value_by_max_grade) restriction = 'max_grade'
	else if (tvs.value_by_most_recent) restriction = 'most_recent'
	else if (tvs.value_by_computable_grade) restriction = 'computable_grade'
	else throw 'unknown setting of value_by_?'

	const CTEs = []
	const values = []
	if (tvs.values) {
		values.push(tvs.term.id, ...tvs.values.map(i => '' + i.key))
		CTEs.push(`
			${CTEname} AS (
				SELECT sample
				FROM ${value_for == 'grade' ? 'precomputed_chc_grade' : 'precomputed_chc_child'}
				WHERE term_id = ? 
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (${tvs.values.map(i => '?').join(', ')})
			)`)
	} else if (tvs.grade_and_child) {
		throw `-- Todo: tvs.grade_and_child`
		//grade_and_child: [{grade, child_id}]
		for (const gc of tvs.grade_and_child) {
			values.push(tvs.term.id, '' + gc.grade)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'grade'
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (?)`)

			values.push(tvs.term.id, gc.child_id)
			CTEs.push(`
				SELECT sample
				FROM precomputed
				WHERE term_id = ? 
				AND value_for = 'child'
				AND ${restriction} = 1
				AND value ${tvs.isnot ? 'NOT' : ''} IN (?)`)
		}
	} else {
		throw 'unknown condition term filter type: expecting term-value "values" or "grade_and_child" key'
	}
	return {
		CTEs,
		values,
		CTEname
	}
}
