/*
f{}
	filter object
returns a GDC filter object
TODO support nested filter
*/
export function filter2GDCfilter(f) {
	// gdc filter
	const obj = {
		op: 'and',
		content: []
	}
	if (!Array.isArray(f.lst)) throw 'filter.lst[] not array'
	for (const item of f.lst) {
		if (item.type != 'tvs') throw 'filter.lst[] item.type!="tvs"'
		if (!item.tvs) throw 'item.tvs missing'
		if (!item.tvs.term) throw 'item.tvs.term missing'

		if (item.tvs.values) {
			// categorical
			const f = {
				op: 'in',
				content: {
					field: mayChangeCase2Cases(item.tvs.term.id),
					value: item.tvs.values.map(i => i.key)
				}
			}
			obj.content.push(f)
		} else if (item.tvs.ranges) {
			for (const range of item.tvs.ranges) {
				if (range.startunbounded) {
					obj.content.push({
						op: range.stopinclusive ? '<=' : '<',
						content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.stop }
					})
					continue
				}
				if (range.stopunbounded) {
					obj.content.push({
						op: range.startinclusive ? '>=' : '>',
						content: { field: mayChangeCase2Cases(item.tvs.term.id), value: range.start }
					})
					continue
				}
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
	}
	return obj
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
