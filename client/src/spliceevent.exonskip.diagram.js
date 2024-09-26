import * as client from './client'
import { exoncolor, IN_frame, OUT_frame } from '#shared/common.js'
import spliceeventphrase from './spliceevent.phrase'

/* no longer doing sample-junction read count line plots
import {axisLeft} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory20} from 'd3-scale'
*/

/*
draw diagram for exon-skipping or exon alt usage

at tip of each junction, show read count value

for mds junction:
	only median read count for junctionB is given
	junctionAs do not have median read count over the same set of samples as junctionB, thus is waiting to be calculated
	when rendering diagram, will create <text> as read count placeholder for each junction, and return the junction-<text> mapping for further median read count summary

*/

export default function (arg) {
	/*
single event, arg:
	.event
		.isaltexon
		.isskipexon
	.holder
	.nophrase
*/

	const evt = arg.event

	const holder = arg.holder.append('div').style('vertical-align', 'top')

	if (!evt.isaltexon && !evt.isskipexon) {
		holder.append('div').text('.isskipexon or .isaltexon is not set for event')
		return
	}

	if (!arg.nophrase) {
		// print phrase as summary
		holder.append('div').html(spliceeventphrase(evt))
	}

	// svg for drawing diagram
	const diagram = arg.holder.append('svg').style('display', 'inline-block')

	// canonical junction read count
	const canonicaljunctionreadcounttext = new Map()
	// k: start.stop
	// v: <text>
	const canonicaljlst = [] // [start,stop] for each canonical junction

	/* svg for lineplot
not in use

let samplelineplot
if(evt.junctionB.data) {
	// track is multi-sample
	if(evt.junctionB.data.length>1) {
		// multiple samples for this event
		// draw a line plot to show junction read counts in each sample
		samplelineplot=arg.holder.append('svg')
			.style('display','inline-block')
			.style('margin-left','10px')
	} else {
		// single sample
		// no line plot
	}
}
*/

	const exonwidth = 40
	const exonheight = 20
	const junctionheight = 20
	const intronwidth = 20
	const xpad = 20
	const ypad = 20
	const fontsize = 14

	const diagramg = diagram.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// array idx of skipped exon
	const skipexonidxbegin = evt.skippedexon[0]
	const skipexonidxend = evt.skippedexon[evt.skippedexon.length - 1]

	// whether to show up1/down1 exon
	// this affects graph width
	let showup1exon = false
	let showdown1exon = false

	if (evt.isskipexon) {
		if (skipexonidxbegin > 1) {
			// still show up1 exon no matter if up1junction exists
			showup1exon = true
		}
		if (evt.down1junction) {
			showdown1exon = true
		}
	}

	diagram
		.attr(
			'width',
			xpad +
				(showup1exon ? exonwidth + intronwidth : 0) +
				exonwidth +
				intronwidth +
				(exonwidth + intronwidth) * evt.skippedexon.length +
				exonwidth +
				(showdown1exon ? exonwidth + intronwidth : 0) +
				xpad
		)
		.attr('height', ypad + fontsize + junctionheight + exonheight + junctionheight + fontsize + ypad)

	const exony = fontsize + junctionheight

	// always show exons from 5' to 3'

	// when in multi-sample mode, for each sample, gather junction read count by the order of junction 5->3
	const sample2jrc = new Map()

	let xoff = 0

	if (showup1exon) {
		// up1 exon
		diagramg
			.append('rect')
			.attr('x', xoff)
			.attr('y', exony)
			.attr('width', exonwidth)
			.attr('height', exonheight)
			.attr('fill', exoncolor)
		diagramg
			.append('text')
			.text('e' + (skipexonidxbegin - 1))
			.attr('x', xoff + exonwidth / 2)
			.attr('y', exony + exonheight / 2)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('fill', 'white')
			.attr('font-size', fontsize)
		xoff += exonwidth + intronwidth
		// up1 junction
		let nojunction = true
		let readcount = '?'
		// in multi-sample mode, if there is no sample from junctionB has up1junction, treat this junction as not exist
		if (evt.up1junction) {
			// up1 read count
			if (evt.junctionB.data) {
				if (evt.junctionB.data.length == 1) {
					const sampleid = evt.junctionB.data[0].tkid
					if (evt.up1junction.data) {
						for (const sampledata of evt.up1junction.data) {
							if (sampledata.tkid == sampleid) {
								nojunction = false
								readcount = sampledata.v
								break
							}
						}
					}
				} else if (evt.junctionB.data.length > 1) {
					let readcountsum = 0
					let samplecount = 0
					for (const sample1 of evt.junctionB.data) {
						for (const sample2 of evt.up1junction.data) {
							if (sample1.tkid == sample2.tkid) {
								readcountsum += sample2.v
								samplecount++
								break
							}
						}
					}
					if (samplecount > 0) {
						nojunction = false
						readcount = Math.ceil(readcountsum / samplecount)
					}
				}
			} else {
				nojunction = false
				readcount = evt.up1junction.v
			}
		}
		diagramg
			.append('path')
			.attr(
				'd',
				'M' +
					(xoff - intronwidth) +
					',' +
					(exony + exonheight) +
					'L' +
					(xoff - intronwidth / 2) +
					',' +
					(exony + exonheight + junctionheight) +
					'L' +
					xoff +
					',' +
					(exony + exonheight)
			)
			.attr('stroke', exoncolor)
			.attr('stroke-dasharray', nojunction ? '2,2' : 'none')
			.attr('fill', 'none')
		if (!nojunction) {
			// will print read count
			const text = diagramg
				.append('text')
				.text(readcount)
				.attr('x', xoff - intronwidth / 2)
				.attr('y', exony + exonheight + junctionheight + 2)
				.attr('font-size', fontsize)
				.attr('fill', 'black')
				.attr('font-family', client.font)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'hanging')
			canonicaljunctionreadcounttext.set(evt.up1junction.start + '.' + evt.up1junction.stop, text)
			canonicaljlst.push([evt.up1junction.start, evt.up1junction.stop])
		}
	}

	// the exon upstream of first skipped exon
	diagramg
		.append('rect')
		.attr('x', xoff)
		.attr('y', exony)
		.attr('width', exonwidth)
		.attr('height', exonheight)
		.attr('fill', exoncolor)
	diagramg
		.append('text')
		.text('e' + skipexonidxbegin) // print id of this exon is skipexonidxbegin
		.attr('x', xoff + exonwidth / 2)
		.attr('y', exony + exonheight / 2)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.attr('fill', 'white')
		.attr('font-size', fontsize)
	xoff += exonwidth + intronwidth

	// for each skipped exon including the one immediately after it
	for (let exonidx = skipexonidxbegin; exonidx <= skipexonidxend + 1; exonidx++) {
		const islastone = exonidx == skipexonidxend + 1

		// draw this exon
		diagramg
			.append('rect')
			.attr('x', xoff)
			.attr('y', exony)
			.attr('width', exonwidth)
			.attr('height', exonheight)
			.attr('fill', islastone ? exoncolor : 'none')
			.attr('stroke', islastone ? 'none' : exoncolor)
			.attr('shape-rendering', 'crispEdges')
		diagramg
			.append('text')
			.text('e' + (exonidx + 1)) // print id of this exon is skipexonidxbegin
			.attr('x', xoff + exonwidth / 2)
			.attr('y', exony + exonheight / 2)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('fill', islastone ? 'white' : exoncolor)
			.attr('font-size', fontsize)

		const thisjunction = evt.junctionAlst[exonidx - skipexonidxbegin]
		// A (canonical) junctions are allowed to be missing

		// at bottom, draw canonical junction
		// from the end of previous exon to start of current exon
		diagramg
			.append('path')
			.attr(
				'd',
				'M' +
					(xoff - intronwidth) +
					',' +
					(exony + exonheight) +
					'L' +
					(xoff - intronwidth / 2) +
					',' +
					(exony + exonheight + junctionheight) +
					'L' +
					xoff +
					',' +
					(exony + exonheight)
			)
			.attr('stroke', exoncolor)
			.attr('stroke-dasharray', thisjunction ? 'none' : '2,2')
			.attr('fill', 'none')

		if (thisjunction) {
			// this A junction exists, show read count
			// if multiple sample, show exon numbers instead
			let readcount = '?'
			if (evt.junctionB.data) {
				if (evt.junctionB.data.length == 1) {
					if (!thisjunction.data) {
						console.error('.data missing from junctionA')
					} else {
						for (const sampledata of thisjunction.data) {
							if (sampledata.tkid == evt.junctionB.data[0].tkid) {
								readcount = sampledata.v
								break
							}
						}
					}
				} else if (evt.junctionB.data.length > 1) {
					// multiple samples have this junction
					// show from-to exon number
					readcount = 'e' + exonidx + '-' + (exonidx + 1)
					// collect read count for each sample for line plot
					for (const thissample of evt.junctionB.data) {
						if (!sample2jrc.has(thissample.tkid)) {
							sample2jrc.set(thissample.tkid, {
								sampleobj: thissample,
								readcountlst: []
							})
						}
						// slot read count for this sample
						let thissamplereadcount = 0
						for (const sampledata of thisjunction.data) {
							if (sampledata.tkid == thissample.tkid) {
								thissamplereadcount = sampledata.v
								break
							}
						}
						sample2jrc.get(thissample.tkid).readcountlst.push(thissamplereadcount)
					}
				}
			} else {
				readcount = thisjunction.v
			}
			// show read count for this junction
			const text = diagramg
				.append('text')
				.text(readcount)
				.attr('x', xoff - intronwidth / 2)
				.attr('y', exony + exonheight + junctionheight + 2)
				.attr('font-size', fontsize)
				.attr('fill', 'black')
				.attr('font-family', client.font)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'hanging')
			canonicaljunctionreadcounttext.set(thisjunction.start + '.' + thisjunction.stop, text)
			canonicaljlst.push([thisjunction.start, thisjunction.stop])
		}
		xoff += exonwidth + intronwidth
	}

	// draw junction B
	{
		const midx = xoff - exonwidth - intronwidth - ((exonwidth + intronwidth) * evt.skippedexon.length + intronwidth) / 2

		diagramg
			.append('path')
			.attr(
				'd',
				'M' +
					((showup1exon ? exonwidth + intronwidth : 0) + exonwidth) +
					',' +
					exony +
					'L' +
					midx +
					',' +
					(exony - junctionheight) +
					'L' +
					(xoff - exonwidth - intronwidth) +
					',' +
					exony
			)
			.attr('fill', 'none')
			.attr('stroke', evt.color)

		// get read count of junction B
		let jBreadcount = '?'
		if (evt.junctionB.data) {
			if (evt.junctionB.data.length == 1) {
				jBreadcount = evt.junctionB.data[0].v
			} else {
				// multi-sample
				// show label instead of read count
				jBreadcount = 'e' + skipexonidxbegin + '-' + (skipexonidxend + 2)
				// for each sample, find jB read count and save it for line plot
				for (const thissample of evt.junctionB.data) {
					if (!sample2jrc.has(thissample.tkid)) {
						console.error('sample has junctionB but no junctionA! ' + thissample.tkid)
						continue
					}
					let readcount = 0
					for (const sampledata of evt.junctionB.data) {
						if (sampledata.tkid == thissample.tkid) {
							readcount = sampledata.v
							break
						}
					}
					sample2jrc.get(thissample.tkid).readcountlst.unshift(readcount)
				}
			}
		} else {
			jBreadcount = evt.junctionB.v
		}

		if (typeof evt.frame == 'boolean') {
			jBreadcount += ', ' + (evt.frame == IN_frame ? 'in frame' : 'out of frame')
		}

		// show junction B read count/label
		const bclab = diagramg
			.append('text')
			.text(jBreadcount)
			.attr('x', midx)
			.attr('y', exony - junctionheight - 2)
			.attr('font-size', fontsize)
			.attr('fill', evt.color)
			.attr('font-family', client.font)
			.attr('text-anchor', 'middle')
	}

	if (showdown1exon) {
		// down1 exon
		diagramg
			.append('rect')
			.attr('x', xoff)
			.attr('y', exony)
			.attr('width', exonwidth)
			.attr('height', exonheight)
			.attr('fill', exoncolor)
		diagramg
			.append('text')
			.text('e' + (skipexonidxend + 3))
			.attr('x', xoff + exonwidth / 2)
			.attr('y', exony + exonheight / 2)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('fill', 'white')
			.attr('font-size', fontsize)

		let nojunction = true
		let readcount = '?'
		// in multi-sample mode, if there is no sample from junctionB has down1junction, treat this junction as not exist
		if (evt.down1junction) {
			// up1 read count
			if (evt.junctionB.data) {
				if (evt.junctionB.data.length == 1) {
					const sampleid = evt.junctionB.data[0].tkid
					if (evt.down1junction.data) {
						for (const sampledata of evt.down1junction.data) {
							if (sampledata.tkid == sampleid) {
								nojunction = false
								readcount = sampledata.v
								break
							}
						}
					}
				} else if (evt.junctionB.data.length > 1) {
					let readcountsum = 0
					let samplecount = 0
					for (const sample1 of evt.junctionB.data) {
						for (const sample2 of evt.down1junction.data) {
							if (sample1.tkid == sample2.tkid) {
								readcountsum += sample2.v
								samplecount++
								break
							}
						}
					}
					if (samplecount > 0) {
						nojunction = false
						readcount = Math.ceil(readcountsum / samplecount)
					}
				}
			} else {
				nojunction = false
				readcount = evt.down1junction.v
			}
		}
		diagramg
			.append('path')
			.attr(
				'd',
				'M' +
					(xoff - intronwidth) +
					',' +
					(exony + exonheight) +
					'L' +
					(xoff - intronwidth / 2) +
					',' +
					(exony + exonheight + junctionheight) +
					'L' +
					xoff +
					',' +
					(exony + exonheight)
			)
			.attr('stroke', exoncolor)
			.attr('stroke-dasharray', nojunction ? '2,2' : 'none')
			.attr('fill', 'none')
		if (!nojunction) {
			// will print read count
			const text = diagramg
				.append('text')
				.text(readcount)
				.attr('x', xoff - intronwidth / 2)
				.attr('y', exony + exonheight + junctionheight + 2)
				.attr('font-size', fontsize)
				.attr('fill', 'black')
				.attr('font-family', client.font)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'hanging')
			canonicaljunctionreadcounttext.set(evt.down1junction.start + '.' + evt.down1junction.stop, text)
			canonicaljlst.push([evt.down1junction.start, evt.down1junction.stop])
		}
	}

	/*
if(samplelineplot) {
	// show lineplot
	const axisw=60
	const toppad=30
	const rightpad=10
	const midpad=10
	const barwidth=50
	const barheight=100
	const textpad=10
	const bottompad=10

	samplelineplot.attr('width',axisw+midpad+barwidth*(evt.skippedexon.length+2)+rightpad)
		.attr('height',toppad+barheight+textpad+fontsize+bottompad)

	const lpg=samplelineplot.append('g')
		.attr('transform','translate('+axisw+','+toppad+')')

	const colorset=scaleOrdinal(schemeCategory20)
	const samplelst=[]
	for(const sampledata of sample2jrc.values()) {
		sampledata.color=colorset(sampledata.sampleobj.tkid)
		samplelst.push(sampledata)
	}

	let minreadcount=samplelst[0].readcountlst[0]
	let maxreadcount=minreadcount
	for(const sampledata of samplelst) {
		for(const v of sampledata.readcountlst) {
			minreadcount=Math.min(minreadcount,v)
			maxreadcount=Math.max(maxreadcount,v)
		}
	}

	const yscale=scaleLinear().domain([minreadcount, maxreadcount]).range([barheight,0])
	client.axisstyle({
		axis:lpg.append('g').call(axisLeft().scale(yscale).ticks(5)),
		showline:true,
		fontsize:12,
		color:'black'
	})

	// the first pillar is junction B, show its label
	lpg.append('text')
		.text('e'+skipexonidxbegin+'-'+(skipexonidxend+2))
		.attr('x',midpad+barwidth*.5)
		.attr('y',barheight+textpad+fontsize)
		.attr('text-anchor','middle')
		.attr('font-size',fontsize)
		.attr('font-family',client.font)
		.attr('fill','black')

	// A junction labels
	for(let i=skipexonidxbegin; i<=skipexonidxend+1; i++) {
		lpg.append('text')
			.text('e'+(i)+'-'+(i+1))
			.attr('x',midpad+barwidth*( (i-skipexonidxbegin)+1.5))
			.attr('y',barheight+textpad+fontsize)
			.attr('text-anchor','middle')
			.attr('font-size',fontsize)
			.attr('font-family',client.font)
			.attr('fill','black')
	}

	const lines_g=lpg.selectAll()
		.data(samplelst)
		.enter().append('g')
		.attr('fill',(d)=>d.color)
		.attr('stroke',(d)=>d.color)

	const dots=lines_g.selectAll()
		.data((d)=>{
			return d.readcountlst
		})
		.enter().append('circle')
		.attr('r',2)
		.attr('cx',(d,i)=>midpad+barwidth*(i+.5))
		.attr('cy',(d)=>yscale(d))

	const lines=lines_g.selectAll()
		.data((d)=>{
			const lst=[]
			for(let i=0; i<d.readcountlst.length-1; i++) {
				lst.push({from:d.readcountlst[i], to:d.readcountlst[i+1]})
			}
			return lst
		})
		.enter().append('line')
		.attr('x1',(d,i)=> midpad+barwidth*(i+.5))
		.attr('x2',(d,i)=> midpad+barwidth*(i+1.5))
		.attr('y1',(d)=> yscale(d.from))
		.attr('y2',(d)=> yscale(d.to))
}
*/

	return [canonicaljunctionreadcounttext, canonicaljlst]
}
