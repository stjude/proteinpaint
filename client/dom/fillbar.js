import { select } from 'd3-selection'
/*
draw a horizontal bar with bg and fg to show percentage

td: holder
	optional, if missing, will return svg html
v: 
	.f fraction
	.v1 numerator, optional
	.v2 denominator
at:
	optional
	.width
	.height
	.fillbg
	.fill
	.readcountcredible
*/

export function fillbar(td, v, at) {
	if (!at) at = {}
	const w = at.width || 40
	const h = at.height || 12

	let g

	if (td) {
		td.attr('aria-label', (v.f * 100).toFixed(0) + '%' + (v.v1 != undefined ? ' (' + v.v1 + '/' + v.v2 + ')' : ''))
		g = td.append('svg').attr('width', w).attr('height', h)
	} else {
		g = select(document.body).append('svg')
	}

	let y = 0
	// fill bg
	g.append('rect')
		.attr('y', y)
		.attr('width', w)
		.attr('height', h)
		.attr('fill', at.fillbg || '#CBE2F5')
	// fill fg
	g.append('rect')
		.attr('y', y)
		.attr('width', w * v.f)
		.attr('height', h)
		.attr('fill', at.fill || '#69A1D1')

	if (at.readcountcredible && v.v2 < at.readcountcredible) {
		// wash with gray
		const smudge = '#545454'
		const smudge2 = 0.3
		g.append('rect').attr('y', y).attr('width', w).attr('height', h).attr('fill', smudge).attr('fill-opacity', smudge2)
	}

	if (td) return g

	g.remove()
	return '<svg width=' + w + ' height=' + h + '>' + g.node().innerHTML + '</svg>'
}
