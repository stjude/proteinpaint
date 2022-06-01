/*
data[ {} ]
.kvlst[]
.k
.v
*/
export function make_table_2col(holder, data, overlen) {
	const color = '#9e9e9e'
	const table = holder
		.append('table')
		.style('margin', '5px 8px')
		.style('font-size', 'inherit')
		.attr('class', 'sja_simpletable')
	for (const i of data) {
		const tr = table.append('tr')
		if (i.kvlst) {
			tr.append('td')
				.attr('rowspan', i.kvlst.length)
				.style('padding', '3px')
				.style('color', color)
				.html(i.k)
			tr.append('td')
				.style('padding', '3px')
				.style('color', color)
				.html(i.kvlst[0].k)
			tr.append('td')
				.style('padding', '3px')
				.html(i.kvlst[0].v)
			for (let j = 1; j < i.kvlst.length; j++) {
				const tr2 = table.append('tr')
				tr2
					.append('td')
					.style('padding', '3px')
					.style('color', color)
					.html(i.kvlst[j].k)
				tr2
					.append('td')
					.style('padding', '3px')
					.html(i.kvlst[j].v)
			}
		} else {
			tr.append('td')
				.attr('colspan', 2)
				.style('padding', '3px')
				.style('color', color)
				.html(i.k)
			const td = tr.append('td').style('padding', '3px')
			if (overlen && i.v.length > overlen) {
				td.html(i.v.substr(0, overlen - 3) + ' ...&raquo;')
					.attr('class', 'sja_clbtext')
					.on('click', () => {
						td.html(i.v)
							.classed('sja_clbtext', false)
							.on('click', null)
					})
			} else {
				td.html(i.v)
			}
		}
	}
	return table
}
