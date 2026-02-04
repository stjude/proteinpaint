import { dtTermTypes } from '#shared/terms.js'

/*
f{}
	filter object
returns a GDC filter object, or null if no filter

GDC filter: https://docs.gdc.cancer.gov/API/Users_Guide/Search_and_Retrieval/
*/
export function filter2GDCfilter(f, level = 0) {
	// gdc filter that will be returned
	let obj = {
		op: f.join || 'and',
		content: []
	}
	if (!Array.isArray(f.lst)) throw new Error('filter.lst[] not array')
	for (const item of f.lst) {
		if (item.type != 'tvs') {
			const f = filter2GDCfilter(item, level + 1)
			if (f) obj.content.push(f)
			continue
		}
		if (!item.tvs) throw new Error('item.tvs missing')
		if (!item.tvs.term) throw new Error('item.tvs.term missing')
		if (dtTermTypes.has(item.tvs.term.type)) {
			// geneVariant/dt term filtering will be performed during post-processing
			// (see mayFilterByGeneVariant() in server/src/mds3.init.js)
			continue
		}
		if (item.tvs.term.type == 'geneExpression') {
			if (level > 0) throw new Error(`gene expression filters are only supported at the root level of a nested filter`)
			// geneExpression term filtering will be performed during post-processing (see mayFilterByExpression() in server/src/mds3.gdc.js)
			continue
		}
		if (item.tvs.term.type == 'survival') {
			if (level > 0) throw new Error(`survival filters are only supported at the root level of a nested filter`)
			// survival term filtering will be performed during post-processing (see mayFilterBySurvival() in server/src/mds3.gdc.js)
			continue
		}

		if (item.tvs.values) {
			// categorical
			const f = {
				op: item.tvs.isnot ? '!=' : 'in',
				content: {
					field: mayChangeCase2Cases(item.tvs.term),
					value: item.tvs.values.map(i => i.key)
				}
			}
			obj.content.push(f)
			continue
		}
		if (item.tvs.ranges) {
			let f = {
				op: 'or',
				content: []
			}

			for (const range of item.tvs.ranges) {
				if (range.startunbounded) {
					f.content.push({
						op: range.stopinclusive ? (item.tvs.isnot ? '>' : '<=') : item.tvs.isnot ? '>=' : '<',
						content: { field: mayChangeCase2Cases(item.tvs.term), value: range.stop }
					})
					continue
				}
				if (range.stopunbounded) {
					f.content.push({
						op: range.startinclusive ? (item.tvs.isnot ? '<' : '>=') : item.tvs.isnot ? '<=' : '>',
						content: { field: mayChangeCase2Cases(item.tvs.term), value: range.start }
					})
					continue
				}
				f.content.push({
					op: 'and',
					content: [
						{
							op: range.startinclusive ? '>=' : '>',
							content: { field: mayChangeCase2Cases(item.tvs.term), value: range.start }
						},
						{
							op: range.stopinclusive ? '<=' : '<',
							content: { field: mayChangeCase2Cases(item.tvs.term), value: range.stop }
						}
					]
				})
			}
			if (item.tvs.isnot) f = { op: 'not', content: f }
			obj.content.push(f)
			continue
		}
		throw new Error('unknown tvs structure when converting to gdc filter')
	}
	if (!f.in) obj = { op: 'not', content: obj }
	return obj.content.length ? obj : null
}

/*
input: case.disease_type
output: cases.disease_type

when a term id begins with "case"
for the term to be used as a field in filter,
it must be written as "cases"
*/
function mayChangeCase2Cases(t) {
	const s = t.id || t.name
	const l = s.split('.')
	if (l[0] == 'case') l[0] = 'cases'
	return l.join('.')
}
