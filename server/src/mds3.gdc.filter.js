import { dtTerms } from '#shared/common.js'

/*
f{}
	filter object
returns a GDC filter object, or null if no filter

GDC filter: https://docs.gdc.cancer.gov/API/Users_Guide/Search_and_Retrieval/

TODO !!support nested filter!!
*/
export function filter2GDCfilter(f) {
	// gdc filter that will be returned
	const obj = {
		op: f.in ? 'and' : 'not',
		content: []
	}
	if (!Array.isArray(f.lst)) throw 'filter.lst[] not array'
	for (const item of f.lst) {
		if (item.type != 'tvs') throw 'filter.lst[] item.type!="tvs"'
		if (!item.tvs) throw 'item.tvs missing'
		if (!item.tvs.term) throw 'item.tvs.term missing'
		if (dtTerms.map(t => t.type).includes(item.tvs.term.type)) {
			// geneVariant/dt term filtering will be performed during post-processing
			// (see mayFilterByGeneVariant() in server/src/mds3.init.js)
			continue
		}

		if (item.tvs.values) {
			// categorical
			const f = {
				op: item.tvs.isnot ? '!=' : 'in',
				content: {
					field: mayChangeCase2Cases(item.tvs.term.id),
					value: item.tvs.values.map(i => i.key)
				}
			}
			obj.content.push(f)
			continue
		}
		if (item.tvs.ranges) {
			for (const range of item.tvs.ranges) {
				if (range.startunbounded) {
					obj.content.push({
						op: range.stopinclusive ? (item.tvs.isnot ? '>' : '<=') : item.tvs.isnot ? '>=' : '<',
						content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.stop }
					})
					continue
				}
				if (range.stopunbounded) {
					obj.content.push({
						op: range.startinclusive ? (item.tvs.isnot ? '<' : '>=') : item.tvs.isnot ? '<=' : '>',
						content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.start }
					})
					continue
				}
				if (item.tvs.isnot) {
					obj.content.push({
						op: 'or',
						content: [
							{
								op: 'and',
								content: [
									{
										op: range.startinclusive ? '<' : '<=',
										content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.start }
									}
								]
							},
							{
								op: 'and',
								content: [
									{
										op: range.stopinclusive ? '>' : '>=',
										content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.stop }
									}
								]
							}
						]
					})
				} else {
					obj.content.push({
						op: 'and',
						content: [
							{
								op: range.startinclusive ? '>=' : '>',
								content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.start }
							},
							{
								op: range.stopinclusive ? '<=' : '<',
								content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.stop }
							}
						]
					})
				}
			}
			continue
		}
		throw 'unknown tvs structure when converting to gdc filter'
	}
	return obj.content.length ? obj : null
}

/*
input: case.disease_type
output: cases.disease_type

when a term id begins with "case"
for the term to be used as a field in filter,
it must be written as "cases"
*/
function mayChangeCase2Cases(s) {
	const l = s.split('.')
	if (l[0] == 'case') l[0] = 'cases'
	return l.join('.')
}
