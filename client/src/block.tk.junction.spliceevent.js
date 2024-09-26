import { select as d3select } from 'd3-selection'
import { axisLeft } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { rgb as d3rgb } from 'd3-color'
import { exoncolor, IN_frame, OUT_frame, spliceeventchangegmexon } from '#shared/common.js'
import * as client from './client'
import { mapjunctiontoexons } from './spliceevent.prep'
import { findexonskipping } from './spliceevent.exonskip'
import spliceeventphrase from './spliceevent.phrase'
import getdefault_exonskipalt from './spliceevent.exonskip.getdefault'

/*

used on browser/client

assume all junctions and genes to compare are on the same chr


*/

export function spliceeventanalyze(tk, block) {
	/*
	run this after both the junction and gene tracks have been loaded

	some conditions to halt:
	1. no gene track
	2. 3 or more genes in view range

	*/

	if (tk.eventsg) {
		// clear previous rendering before doing anything
		tk.eventsg.selectAll('*').remove()
	}
	if (tk.type != client.tkt.junction) {
		return
	}
	if (!tk.data) {
		return
	}
	if (tk.data.length == 0) {
		// no junction in view range
		return
	}

	const [gmdataerr, gmdata] = getgmdata(block)

	if (gmdataerr) {
		const fontsize = 12
		const pad = 2
		tk.eventsg
			.append('rect')
			.attr('width', block.width)
			.attr('height', pad * 2 + fontsize)
			.attr('fill', '#f1f1f1')
		tk.eventsg
			.append('text')
			.text(gmdataerr)
			.attr('font-family', client.font)
			.attr('font-size', fontsize)
			.attr('fill', '#858585')
			.attr('text-anchor', 'middle')
			.attr('x', block.width / 2)
			.attr('y', pad + fontsize / 2)
			.attr('dominant-baseline', 'central')
		tk.height_main += pad * 2 + fontsize
		block.block_setheight()
		return
	}

	if (!gmdata) {
		// no gene data
		return
	}

	// clear events
	for (const junction of tk.data) {
		delete junction.spliceevents
	}

	mapjunctiontoexons(tk.data, gmdata)

	const allevents = []

	const exonskipalt = findexonskipping(tk.totalsamplecount > 1, tk.data, gmdata)

	if (exonskipalt.length > 0) {
		for (const exonset of exonskipalt) {
			if (exonlstoutofrange(exonset.exonlst, block)) {
				continue
			}

			allevents.push(exonset)
			for (const thisevt of exonset.eventlst) {
				if (!thisevt.junctionB.spliceevents) {
					thisevt.junctionB.spliceevents = []
				}
				thisevt.junctionB.spliceevents.push(thisevt)
			}
		}
	}

	if (allevents.length) {
		rendereventsintrack(allevents, tk, block)
	}

	// end of export
}

//////////// render //////////

function rendereventsintrack(allevents, tk, block) {
	const labelfontsize = 10
	const stackspace = 1
	const boxlabelspacing = 2

	let stackheight
	if (tk.totalsamplecount > 1) {
		// multi-sample, 3 rows
		stackheight = labelfontsize * 3 + stackspace * 2
	} else {
		stackheight = labelfontsize * 2 + stackspace
	}

	for (const eventset of allevents) {
		// each is a set of events anchored to the same exon set

		eventset.g = tk.eventsg.append('g')

		// all events in this set share the same junctionB!
		const junctionB = eventset.eventlst[0].junctionB
		const jbstr = junctionB.chr + '-' + junctionB.start + '-' + junctionB.stop // for junction frame caching

		eventset.toplabel = eventset.g
			.append('text')
			.text(eventset.toplabelsays)
			.attr('font-size', labelfontsize)
			.attr('font-family', client.font)
			.attr('fill', eventset.color)
			.attr('y', labelfontsize / 2)
			.attr('dominant-baseline', 'central')
		if (tk.totalsamplecount > 1) {
			eventset.middlelabel = eventset.g
				.append('text')
				.text(eventset.middlelabelsays)
				.attr('font-size', labelfontsize)
				.attr('font-family', client.font)
				.attr('fill', eventset.color)
				.attr('y', labelfontsize * 1.5)
				.attr('dominant-baseline', 'central')
		}

		/*
	frame-checking
	go over events, label those no checking
		.isaltexon
		noncoding gm
		skipped exons at utr
	check against cache
	*/
		let willshowframe = false
		let thiseventframe = null
		// null means frame info was not known for all events in this set
		for (const evt of eventset.eventlst) {
			if (evt.isaltexon) {
				// don't check alternative exon usage
				evt.framenocheck = true
				continue
			}
			if (evt.isskipexon) {
				if (!evt.gm.coding) {
					// noncoding gm
					evt.framenocheck = true
					continue
				}
				if (evt.utr3 || evt.utr5) {
					// skipped exons at utr
					evt.framenocheck = true
					continue
				}
			}
			willshowframe = true
			if (block.genome.junctionframecache.has(jbstr)) {
				let isoform
				if (evt.isskipexon) {
					isoform = evt.gm.isoform
				}
				const thisframe = block.genome.junctionframecache.get(jbstr).get(isoform)
				if (thisframe == undefined) {
					// this isoform not registered for this junction
				} else {
					evt.frame = thisframe
					if (thiseventframe == null) {
						thiseventframe = thisframe
					} else {
						if (thisframe == IN_frame) {
							// is in-frame, show as in-frame
							thiseventframe = IN_frame
						}
					}
				}
			} else {
				// this junction not registered
			}
		}
		eventset.bottomlabel = eventset.g
			.append('text')
			.text(
				eventset.bottomlabelsays +
					(willshowframe
						? ', ' + (thiseventframe == null ? 'checking' : thiseventframe == IN_frame ? 'IN' : 'OUT')
						: '')
			)
			.attr('font-size', labelfontsize)
			.attr('font-family', client.font)
			.attr('fill', eventset.color)
			.attr('y', stackheight - labelfontsize / 2)
			.attr('dominant-baseline', 'central')

		if (willshowframe && thiseventframe == null) {
			// frame info not known for all events
			for (const evt of eventset.eventlst) {
				let gm
				if (evt.isaltexon) {
					gm = evt.gmB
				} else if (evt.isskipexon) {
					gm = evt.gm
				}
				if (!block.genome.junctionframecache.has(jbstr)) {
					checkjunctionframe({
						jbstr: jbstr,
						evt: evt,
						gm: gm,
						block: block,
						eventset: eventset
					})
					continue
				}
				if (!block.genome.junctionframecache.get(jbstr).has(gm.isoform)) {
					checkjunctionframe({
						jbstr: jbstr,
						evt: evt,
						gm: gm,
						block: block,
						eventset: eventset
					})
				}
			}
		}

		// draw exon boxes
		// determine box pixel range
		const exonobjlst = []
		let boxstart = null,
			boxstop
		for (const exon of eventset.exonlst) {
			const pointa = block.seekcoord(exon.chr, exon.start)[0]
			if (!pointa) {
				console.log('skipped exon start position not mapped: ' + exon.start)
				return
			}
			/*
		exon.stop - 1
		make sure to get position for exonic base
		so that in splicingrna mode of gmtk, skipped exons won't extend into intron gap
		*/
			const pointb = block.seekcoord(exon.chr, exon.stop - 1)[0]
			if (!pointb) {
				console.log('skipped exon stop position not mapped: ' + exon.stop)
				return
			}
			const exonobj = {
				x: Math.min(pointa.x, pointb.x),
				w: Math.max(1, Math.abs(pointa.x - pointb.x))
			}
			exonobj.rect = eventset.g
				.append('rect')
				.attr('fill', eventset.color)
				.attr('width', exonobj.w)
				.attr('height', stackheight)
				.attr('shape-rendering', 'crispEdges')
				.on('click', () => {
					console.log(eventset)
				})
			if (boxstart == null) {
				boxstart = exonobj.x
				boxstop = exonobj.x + exonobj.w
			} else {
				boxstart = Math.min(boxstart, exonobj.x)
				boxstop = Math.max(boxstop, exonobj.x + exonobj.w)
			}
			exonobjlst.push(exonobj)
		}

		// position exon boxes, starting from boxstart
		for (const exon of exonobjlst) {
			exon.rect.attr('x', exon.x - boxstart)
		}

		eventset.boxstart = boxstart
		eventset.boxwidth = boxstop - boxstart

		if (eventset.exonlst.length > 1) {
			// show through line
			eventset.g
				.append('line')
				.attr('stroke', eventset.color)
				.attr('stroke-opacity', 0.2)
				.attr('stroke-width', 2)
				.attr('shape-rendering', 'crispEdges')
				.attr('x1', 0)
				.attr('x2', eventset.boxwidth)
				.attr('y1', stackheight / 2 - 0.5)
				.attr('y2', stackheight / 2 - 0.5)
		}
		eventset.toplabel.each(function () {
			eventset.labelwidth = this.getBBox().width
		})
		if (eventset.middlelabel) {
			eventset.middlelabel.each(function () {
				eventset.labelwidth = this.getBBox().width
			})
		}
		eventset.bottomlabel.each(function () {
			eventset.labelwidth = Math.max(eventset.labelwidth, this.getBBox().width)
		})
		if (eventset.labelwidth > eventset.boxstart) {
			eventset.labelonright = true
			eventset.toplabel.attr('x', eventset.boxwidth + boxlabelspacing)
			eventset.bottomlabel.attr('x', eventset.boxwidth + boxlabelspacing)
			if (eventset.middlelabel) {
				eventset.middlelabel.attr('x', eventset.boxwidth + boxlabelspacing)
			}
		} else {
			eventset.toplabel.attr('text-anchor', 'end').attr('x', -boxlabelspacing)
			eventset.bottomlabel.attr('text-anchor', 'end').attr('x', -boxlabelspacing)
			if (eventset.middlelabel) {
				eventset.middlelabel.attr('text-anchor', 'end').attr('x', -boxlabelspacing)
			}
		}
		// mouseover cover
		eventset.cover = eventset.g
			.append('rect')
			.attr('x', eventset.labelonright ? 0 : -eventset.labelwidth - boxlabelspacing)
			.attr('width', eventset.labelwidth + boxlabelspacing + eventset.boxwidth)
			.attr('height', stackheight)
			.attr('fill', '#858585')
			.attr('fill-opacity', 0)
			.on('mouseover', () => {
				eventset.cover.attr('fill-opacity', 0.1)
			})
			.on('mouseout', () => {
				eventset.cover.attr('fill-opacity', 0)
			})
			.on('click', () => {
				tk.tktip.clear()
				displayspliceevents(eventset.eventlst, tk.tktip.d)
				tk.tktip.showunder(eventset.cover.node())
			})
	}

	// stacking
	const stacks = [0]

	for (const eventset of allevents) {
		let x1 = eventset.boxstart - (eventset.labelonright ? 0 : boxlabelspacing + eventset.labelwidth)
		let x2 = eventset.boxstart + eventset.boxwidth + (eventset.labelonright ? boxlabelspacing + eventset.labelwidth : 0)
		for (let stackidx = 0; stackidx < stacks.length; stackidx++) {
			if (x1 > stacks[stackidx]) {
				eventset.stackidx = stackidx
				stacks[stackidx] = x2
				break
			}
			// still looking
			if (!eventset.labelonright) {
				// label is on left
				// see if swinging to right fix it
				const newx1 = eventset.boxstart
				const newx2 = eventset.boxstart + eventset.boxwidth + boxlabelspacing + eventset.labelwidth
				if (newx1 > stacks[stackidx] && newx2 <= block.width) {
					// swing to right
					eventset.labelonright = true
					eventset.stackidx = stackidx
					stacks[stackidx] = newx2
					eventset.toplabel.attr('x', eventset.boxwidth + boxlabelspacing).attr('text-anchor', 'start')
					eventset.bottomlabel.attr('x', eventset.boxwidth + boxlabelspacing).attr('text-anchor', 'start')
					if (eventset.middlelabel) {
						eventset.middlelabel.attr('x', eventset.boxwidth + boxlabelspacing).attr('text-anchor', 'start')
					}
					eventset.cover.attr('x', 0)
					break
				}
			}
		}
		if (eventset.stackidx == undefined) {
			eventset.stackidx = stacks.length
			stacks.push(x2)
		}
		eventset.g.attr(
			'transform',
			'translate(' + eventset.boxstart + ',' + eventset.stackidx * (stackheight + stackspace) + ')'
		)
	}

	tk.height_main += stacks.length * (stackheight + stackspace) + tk.bottompad
	block.block_setheight()
}

function checkjunctionframe(arg) {
	/*
	- jbstr
	- evt
	- gm
	- block
	- eventset
	*/
	if (!arg.block.genome.junctionframecache.has(arg.jbstr)) {
		arg.block.genome.junctionframecache.set(arg.jbstr, new Map())
	}
	if (!arg.gm.coding) {
		// noncoding
		arg.block.genome.junctionframecache.get(arg.jbstr).set(arg.gm.isoform, false)
		mayupdateeventsetlabel(arg)
		return
	}

	const gm2 = spliceeventchangegmexon(arg.gm, arg.evt)

	client
		.dofetch2('translategm', { method: 'POST', body: JSON.stringify({ genome: arg.block.genome.name, gm: gm2 }) })
		.then(data => {
			if (!data) {
				console.log('server error')
				return
			}
			if (data.error) {
				console.log(data.error)
				return
			}
			if (typeof data.frame != 'boolean') {
				console.log('invalid result from translategm: ' + data.frame)
				return
			}
			arg.evt.frame = data.frame
			// cache result
			arg.block.genome.junctionframecache.get(arg.jbstr).set(arg.gm.isoform, data.frame)
			mayupdateeventsetlabel(arg)
		})
}

function mayupdateeventsetlabel(arg) {
	if (!arg.block.genome.junctionframecache.has(arg.jbstr)) {
		// safe guard
		// jbstr should already be there
		return
	}
	/*
	about one single junctionB

	upon frame checked for all events,
	indicate frame for a set of events in the stack display
	show IN whenever there is any in-frame, otherwise show OUT
	*/
	let frame = OUT_frame
	for (const evt of arg.eventset.eventlst) {
		if (evt.framenocheck) {
			// no checking frame
			continue
		}
		let isoform
		if (evt.isskipexon) {
			isoform = evt.gm.isoform
		}
		const thisframe = arg.block.genome.junctionframecache.get(arg.jbstr).get(isoform)
		if (thisframe == undefined) {
			// no result for this isoform yet
			return
		}
		if (thisframe == IN_frame) {
			frame = IN_frame
		}
	}
	// update frame in stack display
	arg.eventset.bottomlabel.text(arg.eventset.bottomlabelsays + ', ' + (frame == IN_frame ? 'IN' : 'OUT'))
}

export function displayspliceevents(events, holder) {
	// select one event and display diagram
	const evt2showidx = getdefault_exonskipalt(events)

	if (events.length > 1) {
		// more events, show phrase only
		holder.append('div').style('margin', '3px 0px').style('color', '#858585').text('Additional interpretations:')
		const name = Math.random().toString()
		for (const [idx, evt] of events.entries()) {
			const id = name + idx
			const row = holder.append('div').style('margin-top', '3px')
			row
				.append('input')
				.attr('type', 'radio')
				.property('checked', idx == evt2showidx)
				.attr('name', name)
				.attr('id', id)
				.on('change', () => {
					displayspliceevents_show(events, idx, showdiv)
				})
			row
				.append('label')
				.attr('for', id)
				.html('&nbsp;' + spliceeventphrase(evt))
		}
	}

	const showdiv = holder.append('div')

	displayspliceevents_show(events, evt2showidx, showdiv)
}

function displayspliceevents_show(events, idx, div) {
	div.selectAll('*').remove()
	import('./spliceevent.exonskip.diagram').then(p => {
		p.default({
			event: events[idx],
			holder: div,
			nophrase: events.length > 1
		})
	})
}

///////////// helpers /////////////

function exonlstoutofrange(lst, block) {
	/*
	when doing event analysis, it took data of entire gene body
	and sometimes the junctions are huge, and the view range is narrow
	so it will find events that are out of view range
	do not show these

	check if the entire list of exons is out of range
	a set of splicing events share this list of exons
	if out of range, the events won't be mentioned on the browser display
	each: { chr, start, stop }
	*/

	const chr = lst[0].chr
	let start = lst[0].start
	let stop = lst[0].stop
	for (const e of lst) {
		start = Math.min(start, e.start)
		stop = Math.max(stop, e.stop)
	}
	const starthit = block.seekcoord(chr, start)[0]
	const stophit = block.seekcoord(chr, stop)[0]

	if (!starthit || !stophit) {
		// unreasonable case
		return true
	}

	/*
	see what sides are each end in
	if both ends are out of bounds in left or right, then skip
	don't skip if start is left, and stop is right, event should be visible
	*/
	let startoutleft = false
	let startoutright = false
	if (starthit.x <= 0) {
		startoutleft = true
	} else if (starthit.x >= block.width) {
		startoutright = true
	}

	let stopoutleft = false
	let stopoutright = false
	if (stophit.x <= 0) {
		stopoutleft = true
	} else if (stophit.x >= block.width) {
		stopoutright = true
	}

	if (startoutleft && stopoutleft) return true
	if (startoutright && stopoutright) return true
	return false
}

function getgmdata(block) {
	/*
	to work in browser, not offline
	can reject if 3 or more genes in view range
	*/
	if (!block.gmmode || block.gmmode == client.gmmode.genomic) {
		/*
		in genome mode
		require gene track for the gene data
		*/
		const genetk = []
		for (const t of block.tklst) {
			if (t.__isgene) {
				genetk.push(t)
			}
		}
		if (genetk.length == 0) {
			return ['Add a gene track to analyze splice junctions.']
		}
		const gmdatalst = []
		for (const t of genetk) {
			if (t.gmdata) {
				for (const m of t.gmdata) {
					gmdatalst.push(m)
				}
			}
		}
		if (gmdatalst.length == 0) {
			// no genes from view range
			return [null]
		}
		/*
		check how many genes are there in view range
		if 3 or more, reject, do not overwhelm server
		*/
		const regions = []
		for (const m of gmdatalst) {
			let overlap = false
			for (const r of regions) {
				if (Math.max(r.start, m.start) < Math.min(r.stop, m.stop)) {
					overlap = true
					r.start = Math.min(r.start, m.start)
					r.stop = Math.max(r.stop, m.stop)
					break
				}
			}
			if (!overlap) {
				regions.push({ start: m.start, stop: m.stop })
			}
		}
		if (regions.length >= 3) {
			return ['Zoom in on a single gene to analyze splice junctions.']
		}
		return [null, gmdatalst]
	}
	if (block.gmmode == client.gmmode.gmsum) {
		// showing sum of isoforms
		if (!block.allgm) {
			return ['Error: block.allgm[] is missing']
		}
		return [null, block.allgm]
	}
	// in gm mode and viewing single isoform
	if (!block.usegm) {
		return ['Error: block.usegm is missing']
	}
	return [null, [block.usegm]]
}
