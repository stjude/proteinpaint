import * as client from './client'
import { exoncolor, IN_frame, OUT_frame } from '#shared/common.js'

/*
a5ss or a3ss


arg.event
.a5ss
.a3ss  boolean
.isoform
.gene
.strand   +/-
.junctionA
.junctionB

.exon5idx
.altinintron
.altinexon   boolean
.sitedist


draw diagram for one compete site definition

check if aberrant splice site is exonic or intronic
make horizontal space in exon/intron to print aberrant-compete site distance

for exon-truncation:
	print truncated length (site distance) in white text
for exon-exnension:
	draw hollow box with extended length (site distance) at the extended end of exon

width of site distance (distlabelw) determine box width

*/

const junctionBcolor = '#990000'
const color_truncateexon = '#00A352'

export default function (arg) {
	const evt = arg.event
	if (!evt) {
		arg.holder.text('.event missing')
		return
	}

	if (evt.a5ss == undefined && evt.a3ss == undefined) {
		arg.holder.text('not a5ss or a3ss')
		return
	}

	const exonwidth = 30 // width of part of exon without text
	const intronwidth = 30

	const exonheight = 20
	const distfontsize = exonheight - 5
	const junctionheight = 20
	const xpad = 30
	const ypad = 20

	const svg = arg.holder.append('svg')
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// aberrant-compete site distance
	// width of text label also determines box size
	const distlabel = evt.sitedist + ' nt'

	let distlabelw
	g.append('text')
		.text(distlabel)
		.attr('font-size', distfontsize)
		.attr('font-family', client.font)
		.each(function () {
			distlabelw = this.getBBox().width
		})
		.remove()
	const distlabelpad = 5

	// logical: aberrant site location
	let leftinexon = false // truncation
	let rightinexon = false
	let leftinintron = false // extension
	let rightinintron = false

	if (evt.a5ss) {
		if (evt.altinexon) leftinexon = true
		else leftinintron = true
	} else {
		if (evt.altinexon) rightinexon = true
		else rightinintron = true
	}

	let x = 0
	// delineates normal intron start/stop x pos, for drawing junctions later
	let intronstart
	let intronstop

	// left exon
	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', x)
		.attr('y', junctionheight)
		.attr('width', exonwidth)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')

	// left exon number
	g.append('text')
		.text('e' + (evt.exon5idx + 1))
		.attr('text-anchor', 'middle')
		.attr('x', x + exonwidth / 2)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', 'white')
		.attr('dominant-baseline', 'central')
		.attr('font-size', distfontsize)
		.attr('font-family', client.font)

	x += exonwidth

	if (leftinexon) {
		// truncated part of exon with dist label
		g.append('rect')
			.attr('fill', color_truncateexon)
			.attr('stroke', color_truncateexon)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
		x += distlabelw + distlabelpad * 2
	}

	intronstart = x

	if (leftinintron || rightinintron) {
		// print site dist in intron
		// check if to print dist on left or right
		if (leftinintron) {
			// print on left, no change to x
		} else {
			// print on right
			x += intronwidth
		}
		// white hollow box for extended exon
		g.append('rect')
			.attr('fill', 'none')
			.attr('stroke', exoncolor)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
			.attr('dominant-baseline', 'central')
		x += distlabelw + distlabelpad * 2

		if (leftinintron) {
			x += intronwidth
		}
	} else {
		x += intronwidth
	}

	intronstop = x

	// intron line
	g.append('line')
		.attr('x1', intronstart + (leftinintron ? distlabelw + distlabelpad * 2 : 0))
		.attr('y1', junctionheight + exonheight / 2)
		.attr('x2', intronstop - (rightinintron ? distlabelw + distlabelpad * 2 : 0))
		.attr('y2', junctionheight + exonheight / 2)
		.attr('stroke', exoncolor)
		.attr('shape-rendering', 'crispEdges')

	// right exon
	if (rightinexon) {
		// show truncated exon, with dist label
		g.append('rect')
			.attr('fill', color_truncateexon)
			.attr('stroke', color_truncateexon)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
		x += distlabelw + distlabelpad * 2
	}

	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', x)
		.attr('y', junctionheight)
		.attr('width', exonwidth)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')

	// right exon number
	g.append('text')
		.text('e' + (evt.exon5idx + 1 + 1))
		.attr('text-anchor', 'middle')
		.attr('x', x + exonwidth / 2)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', 'white')
		.attr('dominant-baseline', 'central')
		.attr('font-size', distfontsize)
		.attr('font-family', client.font)

	// aberrant junction line
	{
		let x1, x2
		if (leftinexon || leftinintron) {
			x2 = intronstop
			if (leftinexon) {
				x1 = intronstart - distlabelw - distlabelpad * 2
			} else {
				x1 = intronstart + distlabelw + distlabelpad * 2
			}
		} else {
			x1 = intronstart
			if (rightinintron) {
				x2 = intronstop - distlabelw - distlabelpad * 2
			} else {
				x2 = intronstop + distlabelw + distlabelpad * 2
			}
		}

		g.append('path')
			.attr('d', 'M' + x1 + ',' + junctionheight + 'L' + (x1 + x2) / 2 + ',0' + 'L' + x2 + ',' + junctionheight)
			.attr('stroke', junctionBcolor)
			.attr('fill', 'none')
		// aberrant junction read count
		g.append('text')
			.text(evt.junctionB.v + (evt.frame != undefined ? (evt.frame == IN_frame ? ', in frame' : ',out of frame') : ''))
			.attr('x', (x1 + x2) / 2)
			.attr('y', -1)
			.attr('text-anchor', 'middle')
			.attr('font-size', distfontsize)
			.attr('fill', junctionBcolor)
	}

	// normal junction
	let jAreadcounttext
	{
		const line = g
			.append('path')
			.attr(
				'd',
				'M' +
					intronstart +
					',' +
					(junctionheight + exonheight) +
					'L' +
					(intronstart + intronstop) / 2 +
					',' +
					(junctionheight * 2 + exonheight) +
					'L' +
					intronstop +
					',' +
					(junctionheight + exonheight)
			)
			.attr('stroke', exoncolor)
			.attr('fill', 'none')
		const nj = evt.junctionA
		if (nj) {
			// has normal junction
			jAreadcounttext = g
				.append('text')
				.text(nj.v)
				.attr('x', (intronstart + intronstop) / 2)
				.attr('y', junctionheight * 2 + exonheight + 1)
				.attr('text-anchor', 'middle')
				.attr('font-size', distfontsize)
				.attr('dominant-baseline', 'hanging')
		} else {
			// no normal junction at competing site
			line.attr('stroke-dasharray', '3,3')
		}
	}

	svg
		.attr('width', xpad * 2 + exonwidth * 2 + intronwidth + distlabelw + distlabelpad * 2)
		.attr('height', ypad * 2 + junctionheight * 2 + exonheight)
	return jAreadcounttext
}
