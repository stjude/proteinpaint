/*
make a html table of two columns, for showing a list of key-value pairs.
1st column shows key in gray text, 2nd column shows value in black text, or arbitrary button/svg etc
as rows are added, as soon as table width exceeds a limit, it auto scrolls

to create new table:

	const table = table2col({holder})

to add a new row with only text data:

	table.addRow('Key', 'Value')

if need to insert html and other dynamic contents instead of plain text, do this instead:

	const [td1,td2] = table.addRow()
	td1.html(xx)
	td2.append('input')...


arg{}
	.holder
	.margin
*/
export function table2col(arg) {
	const scrollDiv = arg.holder.append('div').style('max-width', '80vw')

	const table = scrollDiv
		.append('table')
		.style('margin', arg.margin || '5px 8px')
		.attr('class', 'sja_simpletable')
		.attr('data-testid', 'sja_simpletable')
	return {
		scrollDiv,
		table,
		addRow: (text1, text2) => {
			if (table.node().offsetHeight > 500) {
				scrollDiv
					.style('height', '450px')
					.style('resize', 'both')
					.style('overflow-y', 'scroll')
					.attr('class', 'sjpp_show_scrollbar')
			}
			const tr = table.append('tr')
			const td1 = tr.append('td').style('padding', '3px').style('color', '#555')
			const td2 = tr.append('td')
			if (text1 != undefined) td1.text(text1)
			if (text2 != undefined) td2.text(text2)
			return [td1, td2]
		}
	}
}

/*
data[ {} ]
.kvlst[]
.k
.v

deprecated, replace with above
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
			tr.append('td').attr('rowspan', i.kvlst.length).style('padding', '3px').style('color', color).html(i.k)
			tr.append('td').style('padding', '3px').style('color', color).html(i.kvlst[0].k)
			tr.append('td').style('padding', '3px').html(i.kvlst[0].v)
			for (let j = 1; j < i.kvlst.length; j++) {
				const tr2 = table.append('tr')
				tr2.append('td').style('padding', '3px').style('color', color).html(i.kvlst[j].k)
				tr2.append('td').style('padding', '3px').html(i.kvlst[j].v)
			}
		} else {
			tr.append('td').attr('colspan', 2).style('padding', '3px').style('color', color).html(i.k)
			const td = tr.append('td').style('padding', '3px')
			if (overlen && i.v.length > overlen) {
				td.html(i.v.substr(0, overlen - 3) + ' ...&raquo;')
					.attr('class', 'sja_clbtext')
					.on('click', () => {
						td.html(i.v).classed('sja_clbtext', false).on('click', null)
					})
			} else {
				td.html(i.v)
			}
		}
	}
	return table
}
