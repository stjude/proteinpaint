import * as client from './client'
import { exoncolor } from '#shared/common.js'

/*
mapping of a junction to a gene, with no recognizable event

either on same gene, or different genes

*/

const exonwidth = 30 // width of part of exon without text
const intronwidth = 30
const exonxpad = 5

const junctionBcolor = '#990000'

const exonheight = 20
const fontsize = 14
const junctionheight = 20
const xpad = 15
const ypad = 15

export function samegene(arg) {
	/*
	two ends of the junction are on same gene

	arg:

	.holder
	.isoform
		isoform of which the left/end of the junction are both on
	.reverse BOOL
		gene is on reverse strand, will need to flip exonleft/exonright and such
	.ongene{}
		.exonleft
		.exonright
		.exonleftin
		.exonrightin
		.intronleft
		.intronright
		.leftout
		.rightout
	*/

	const isoform = arg.isoform
	if (!isoform) {
		arg.holder.text('.event missing')
		return
	}
	if (!arg.ongene) {
		holder.text('.ongene missing')
		return
	}

	// with given isoform, collect mappings on this isoform
	let exonleft, exonright, exonleftin, exonrightin, intronleft, intronright, leftout, rightout

	if (arg.ongene.exonleft) {
		const a = arg.ongene.exonleft.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) exonright = a
		else exonleft = a
	}
	if (arg.ongene.exonright) {
		const a = arg.ongene.exonright.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) exonleft = a
		else exonright = a
	}
	if (arg.ongene.exonleftin) {
		const a = arg.ongene.exonleftin.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) exonrightin = a
		else exonleftin = a
	}
	if (arg.ongene.exonrightin) {
		const a = arg.ongene.exonrightin.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) exonleftin = a
		else exonrightin = a
	}
	if (arg.ongene.intronleft) {
		const a = arg.ongene.intronleft.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) intronright = a
		else intronleft = a
	}
	if (arg.ongene.intronright) {
		const a = arg.ongene.intronright.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) intronleft = a
		else intronright = a
	}
	if (arg.ongene.leftout) {
		const a = arg.ongene.leftout.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) rightout = a
		else leftout = a
	}
	if (arg.ongene.rightout) {
		const a = arg.ongene.rightout.filter(i => i.isoform == isoform)[0]
		if (arg.reverse) leftout = a
		else rightout = a
	}

	const svg = arg.holder.append('svg').attr('width', 1).attr('height', 1)

	if (exonleft) {
		if (exonright) {
			exonleft_exonright(exonleft, exonright, svg)
		} else if (exonrightin) {
			exonleft_exonrightin(exonleft, exonrightin, svg)
		} else if (intronright) {
			exonleft_intronright(exonleft, intronright, svg)
		} else {
			exonleft_rightout(exonleft, svg)
		}
	} else if (exonleftin) {
		if (exonright) {
			exonleftin_exonright(exonleftin, exonright, svg)
		} else if (exonrightin) {
			exonleftin_exonrightin(exonleftin, exonrightin, svg)
		} else if (intronright) {
			exonleftin_intronright(exonleftin, intronright, svg)
		} else {
			exonleftin_rightout(exonleftin, svg)
		}
	} else if (intronleft) {
		if (exonright) {
			intronleft_exonright(intronleft, exonright, svg)
		} else if (exonrightin) {
			intronleft_exonrightin(intronleft, exonrightin, svg)
		} else if (intronright) {
			intronleft_intronright(intronleft, intronright, svg)
		} else {
			intronleft_rightout(intronleft, svg)
		}
	} else {
		if (exonright) {
			leftout_exonright(exonright, svg)
		} else if (exonrightin) {
			leftout_exonrightin(exonrightin, svg)
		} else if (intronright) {
			leftout_intronright(intronright, svg)
		}
	}
}

export function differentgenes(arg) {
	/*
	two ends of junction are on different genes
	showing left/right as is, no adjusting of strand

	left gene name | left glyph | gap | right glyph | right gene name
	*/
	const svg = arg.holder.append('svg')
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	let x1 = 0,
		x2 = 0 // ends of junction

	let exonleft, exonleftin, intronleft
	if (arg.ongene.exonleft) {
		exonleft = arg.ongene.exonleft[0]
	} else if (arg.ongene.exonleftin) {
		exonleftin = arg.ongene.exonleftin[0]
	} else if (arg.ongene.intronleft) {
		intronleft = arg.ongene.intronleft[0]
	}

	let x = 0
	g.append('text')
		.text(exonleft ? exonleft.gene : exonleftin ? exonleftin.gene : intronleft ? intronleft.gene : 'Left gene')
		.attr('x', 0)
		.attr('y', junctionheight + exonheight / 2)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			x = this.getBBox().width
		})
	x += 5
	if (exonleft) {
		const w = renderRightExon(x, exonleft.exonidx, g)
		x += w
		x1 = x
	} else if (exonleftin) {
		const w = renderRightExon(x, exonleftin.exonidx, g)
		x1 = x + w / 2
		x += w
	} else if (intronleft) {
		const w1 = renderRightExon(x, intronleft.intronidx, g)
		renderIntron(g, x + w1, x + w1 + intronwidth)
		const w2 = renderRightExon(x + w1 + intronwidth, intronleft.intronidx + 1, g)
		x += w1
		x1 = x + intronwidth / 2
		x += intronwidth + w2
	}
	x += 30

	let exonright, exonrightin, intronright
	if (arg.ongene.exonright) {
		exonright = arg.ongene.exonright[0]
	} else if (arg.ongene.exonrightin) {
		exonrightin = arg.ongene.exonrightin[0]
	} else if (arg.ongene.intronright) {
		intronright = arg.ongene.intronright[0]
	}
	if (exonright) {
		const w = renderRightExon(x, exonright.exonidx, g)
		x2 = x
		x += w
	} else if (exonrightin) {
		const w = renderRightExon(x, exonrightin.exonidx, g)
		x2 = x + w / 2
		x += w
	} else if (intronright) {
		const w1 = renderRightExon(x, intronright.intronidx, g)
		renderIntron(g, x + w1, x + w1 + intronwidth)
		const w2 = renderRightExon(x + w1 + intronwidth, intronright.intronidx + 1, g)
		x += w1
		x2 = x + intronwidth / 2
		x += intronwidth + w2
	}
	x += 5
	g.append('text')
		.text(exonright ? exonright.gene : exonrightin ? exonrightin.gene : intronright ? intronright.gene : 'Right gene')
		.attr('x', x)
		.attr('y', junctionheight + exonheight / 2)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			x += this.getBBox().width
		})

	renderJunction(g, x1, x2, intronleft, intronright)

	svg.attr('width', xpad * 2 + x).attr('height', junctionheight + exonheight + ypad * 2)
}

/////////////////// plotters

function exonleft_exonright(l, r, svg) {
	/*
	junction start/stop matches to normal exon start/stop
	could be normal splicing or abnormal if across multiple exons
	*/
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	const isnormaljunction = r.exonidx - l.exonidx == 1

	// junction x1,x2
	const x1 = renderLeftExon(l.exonidx, g)
	let x2 = x1

	x2 += renderMidExons(x2, l.exonidx, r.exonidx, g)

	if (!isnormaljunction) {
		// intron, only draw line when is not normal junction
		renderIntron(g, x2, x2 + intronwidth)
	}
	x2 += intronwidth

	const rightboxw = renderRightExon(x2, r.exonidx, g)

	renderJunction(g, x1, x2, false, false, true)

	svg.attr('width', xpad * 2 + x2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleft_exonrightin(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	const x1 = renderLeftExon(l.exonidx, g)
	let x2 = x1

	x2 += renderMidExons(x2, l.exonidx, r.exonidx, g)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth

	const rightboxw = renderRightExon(x2, r.exonidx, g)

	x2 += rightboxw / 2 // junction lands inside 3' exon

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + rightboxw / 2).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleft_intronright(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const x1 = renderLeftExon(l.exonidx, g)
	let x2 = x1

	x2 += renderMidExons(x2, l.exonidx, r.intronidx + 1, g)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth / 2

	const rightboxw = renderRightExon(x2 + intronwidth / 2, r.intronidx + 1, g)

	renderJunction(g, x1, x2, false, true)

	svg.attr('width', xpad * 2 + x2 + intronwidth / 2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleft_rightout(l, svg) {
	/*
	junction start/stop matches to normal exon start/stop
	could be normal splicing or abnormal if across multiple exons
	*/
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1,x2
	const x1 = renderLeftExon(l.exonidx, g)
	const x2 = x1 + intronwidth

	g.append('text')
		.text('OUT')
		.attr('x', x2 + 5)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + 40).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleftin_exonright(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.exonidx, g)
	const x1 = leftboxw / 2
	let x2 = leftboxw

	x2 += renderMidExons(x2, l.exonidx, r.exonidx, g)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth

	const rightboxw = renderRightExon(x2, r.exonidx, g)

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleftin_exonrightin(l, r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.exonidx, g)

	if (l.exonidx == r.exonidx) {
		// in same exon!!
		const x1 = leftboxw / 3
		const x2 = (leftboxw * 2) / 3
		g.append('path')
			.attr('d', 'M' + x1 + ',' + junctionheight + 'L' + (x1 + x2) / 2 + ',0' + 'L' + x2 + ',' + junctionheight)
			.attr('stroke', junctionBcolor)
			.attr('fill', 'none')
		svg.attr('width', xpad * 2 + leftboxw).attr('height', ypad * 2 + junctionheight * 2 + exonheight)
		return
	}

	const x1 = leftboxw / 2
	let x2 = leftboxw

	x2 += renderMidExons(x2, l.exonidx, r.exonidx, g)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth

	const rightboxw = renderRightExon(x2, r.exonidx, g)
	x2 += rightboxw / 2

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + rightboxw / 2).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleftin_intronright(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.exonidx, g)
	const x1 = leftboxw / 2
	let x2 = leftboxw

	x2 += renderMidExons(x2, l.exonidx, r.intronidx + 1, g)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth / 2

	const rightboxw = renderRightExon(x2 + intronwidth / 2, r.intronidx + 1, g)

	renderJunction(g, x1, x2, false, true)

	svg.attr('width', xpad * 2 + x2 + intronwidth / 2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function exonleftin_rightout(l, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.exonidx, g)
	const x1 = leftboxw / 2
	let x2 = leftboxw + intronwidth

	g.append('text')
		.text('OUT')
		.attr('x', x2 + 5)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + 40).attr('height', ypad * 2 + junctionheight + exonheight)
}

function intronleft_exonright(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.intronidx, g)
	const x1 = leftboxw + intronwidth / 2
	let x2 = leftboxw + intronwidth

	renderIntron(g, leftboxw, x2)

	x2 += renderMidExons(x2, l.intronidx, r.exonidx, g, true)

	const rightboxw = renderRightExon(x2, r.exonidx, g)

	renderJunction(g, x1, x2, true)

	svg.attr('width', xpad * 2 + x2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function intronleft_exonrightin(l, r, svg) {
	// must be abnormal junction
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.intronidx, g)
	const x1 = leftboxw + intronwidth / 2
	let x2 = leftboxw + intronwidth

	renderIntron(g, leftboxw, x2)

	x2 += renderMidExons(x2, l.intronidx, r.exonidx, g, true)

	const rightboxw = renderRightExon(x2, r.exonidx, g)
	x2 += rightboxw / 2

	renderJunction(g, x1, x2, true)

	svg.attr('width', xpad * 2 + x2 + rightboxw / 2).attr('height', ypad * 2 + junctionheight + exonheight)
}

function intronleft_intronright(l, r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.intronidx, g)

	if (l.intronidx == r.intronidx) {
		// start and stop in same intron

		renderIntron(g, leftboxw, leftboxw + 30)
		const x1 = leftboxw + 10
		const x2 = leftboxw + 20

		renderJunction(g, x1, x2, true, true)

		const rightboxw = renderRightExon(x2 + 10, r.intronidx + 1, g)

		svg.attr('width', xpad * 2 + leftboxw + 30 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
		return
	}

	// start and stop in different introns

	const x1 = leftboxw + intronwidth / 2
	let x2 = leftboxw + intronwidth

	renderIntron(g, leftboxw, x2)

	x2 += renderMidExons(x2, l.intronidx, r.intronidx + 1, g, true)

	renderIntron(g, x2, x2 + intronwidth)
	x2 += intronwidth / 2

	const rightboxw = renderRightExon(x2 + intronwidth / 2, r.intronidx + 1, g)

	renderJunction(g, x1, x2, true, true)

	svg.attr('width', xpad * 2 + x2 + intronwidth / 2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function intronleft_rightout(l, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// junction x1, x2
	const leftboxw = renderLeftExon(l.intronidx, g)
	const x1 = leftboxw + intronwidth / 2
	let x2 = leftboxw + intronwidth

	// intron
	renderIntron(g, leftboxw, x2)

	const rightboxw = renderRightExon(x2, l.intronidx + 1, g)
	x2 += rightboxw + 10

	g.append('text')
		.text('OUT')
		.attr('x', x2)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)

	renderJunction(g, x1, x2, true)

	svg.attr('width', xpad * 2 + x2 + 30).attr('height', ypad * 2 + junctionheight + exonheight)
}

function leftout_exonright(r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	let leftboxw
	g.append('text')
		.text('OUT')
		.attr('x', 0)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			leftboxw = this.getBBox().width
		})

	const x1 = leftboxw + 5

	const x2 = x1 + intronwidth

	const rightboxw = renderRightExon(x2, r.exonidx, g)

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + rightboxw).attr('height', ypad * 2 + junctionheight + exonheight)
}

function leftout_exonrightin(r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	let leftboxw
	g.append('text')
		.text('OUT')
		.attr('x', 0)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			leftboxw = this.getBBox().width
		})

	const x1 = leftboxw + 5

	const rightboxw = renderRightExon(x1 + intronwidth, r.exonidx, g)

	const x2 = x1 + intronwidth + rightboxw / 2

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + rightboxw / 2).attr('height', ypad * 2 + junctionheight + exonheight)
}

function leftout_intronright(r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	let leftboxw
	g.append('text')
		.text('OUT')
		.attr('x', 0)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			leftboxw = this.getBBox().width
		})

	const x1 = leftboxw + 5

	const exon1w = renderRightExon(x1 + 30, r.intronidx, g)
	renderIntron(g, x1 + 30 + exon1w, x1 + 30 + exon1w + intronwidth)

	const x2 = x1 + 30 + exon1w + intronwidth / 2

	const exon2w = renderRightExon(x1 + 30 + exon1w + intronwidth, r.intronidx + 1, g)

	renderJunction(g, x1, x2, false, true)

	svg
		.attr('width', xpad * 2 + x1 + 30 + exon1w + intronwidth + exon2w)
		.attr('height', ypad * 2 + junctionheight + exonheight)
}

function leftout_rightout(l, r, svg) {
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	let leftboxw
	g.append('text')
		.text('OUT')
		.attr('x', 0)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			leftboxw = this.getBBox().width
		})

	const x1 = leftboxw + 5

	const rightboxw = renderRightExon(leftboxw + intronwidth, l.gene, g)

	const x2 = leftboxw + intronwidth + rightboxw + intronwidth

	g.append('text')
		.text('OUT')
		.attr('x', x2 + 5)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', junctionBcolor)
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)

	renderJunction(g, x1, x2)

	svg.attr('width', xpad * 2 + x2 + 30).attr('height', ypad * 2 + junctionheight + exonheight)
}

//////////////////// helpers

function renderIntron(g, x1, x2) {
	g.append('line')
		.attr('x1', x1)
		.attr('y1', junctionheight + exonheight / 2)
		.attr('x2', x2)
		.attr('y2', junctionheight + exonheight / 2)
		.attr('stroke', exoncolor)
		.attr('shape-rendering', 'crispEdges')
}

function renderJunction(g, x1, x2, x1atintron, x2atintron, isnormal) {
	g.append('path')
		.attr(
			'd',
			'M' +
				x1 +
				',' +
				(junctionheight + (x1atintron ? exonheight / 2 : 0)) +
				'L' +
				(x1 + x2) / 2 +
				',0' +
				'L' +
				x2 +
				',' +
				(junctionheight + (x2atintron ? exonheight / 2 : 0))
		)
		.attr('stroke', isnormal ? exoncolor : junctionBcolor)
		.attr('fill', 'none')
}

function renderLeftExon(exonidx, g) {
	// left most exon, shown in most cases
	const text = 'e' + (exonidx + 1)
	let textw
	g.append('text')
		.text(text)
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			textw = this.getBBox().width
		})
		.remove()
	const boxw = exonxpad * 2 + textw
	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', 0)
		.attr('y', junctionheight)
		.attr('width', boxw)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')
	g.append('text')
		.text(text)
		.attr('text-anchor', 'middle')
		.attr('x', boxw / 2)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', 'white')
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
	return boxw
}

function renderRightExon(x, exonidx, g) {
	/* right most exon
	exonidx can be a string
	*/
	let text
	if (Number.isInteger(exonidx)) {
		text = 'e' + (exonidx + 1)
	} else {
		text = text
	}
	let textw
	g.append('text')
		.text(text)
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
		.each(function () {
			textw = this.getBBox().width
		})
		.remove()
	const boxw = exonxpad * 2 + textw
	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', x)
		.attr('y', junctionheight)
		.attr('width', boxw)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')
	// right exon number
	g.append('text')
		.text(text)
		.attr('text-anchor', 'middle')
		.attr('x', x + boxw / 2)
		.attr('y', junctionheight + exonheight / 2)
		.attr('fill', 'white')
		.attr('dominant-baseline', 'central')
		.attr('font-size', fontsize)
		.attr('font-family', client.font)
	return boxw
}

function width4middleexons(exonnum) {
	if (exonnum < 3) return 12
	if (exonnum < 6) return 7
	return 4
}

function renderMidExons(x, lidx, ridx, g, showintronafterexon) {
	// exons in between l/r
	// by default, show intron before exon

	const midexonnum = ridx - 1 - lidx
	if (midexonnum == 0) return 0
	const smallwidth = width4middleexons(midexonnum)

	let w = 0

	for (let i = lidx + 1; i < ridx; i++) {
		// intron line
		if (!showintronafterexon) {
			g.append('line')
				.attr('x1', x + w)
				.attr('y1', junctionheight + exonheight / 2)
				.attr('x2', x + w + smallwidth)
				.attr('y2', junctionheight + exonheight / 2)
				.attr('stroke', exoncolor)
				.attr('shape-rendering', 'crispEdges')
			w += smallwidth
		}
		// mid exon, no number
		g.append('rect')
			.attr('fill', exoncolor)
			.attr('stroke', exoncolor)
			.attr('x', x + w)
			.attr('y', junctionheight)
			.attr('width', smallwidth)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		w += smallwidth

		// intron line
		if (showintronafterexon) {
			g.append('line')
				.attr('x1', x + w)
				.attr('y1', junctionheight + exonheight / 2)
				.attr('x2', x + w + smallwidth)
				.attr('y2', junctionheight + exonheight / 2)
				.attr('stroke', exoncolor)
				.attr('shape-rendering', 'crispEdges')
			w += smallwidth
		}
	}
	return w
}
