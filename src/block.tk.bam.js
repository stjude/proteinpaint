import { select as d3select, event as d3event, mouse as d3mouse } from 'd3-selection'
import { axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { make_radios } from './dom'

/*

important: tk.uninitialized will be deleted by getData at the first launch
to tell backend to provide color scale

tk can predefine if bam file has chr or not

tk.groups[]

group {}
.data{}
	.templatebox[] // optional
.data_fullstack{}
	.messagerowheights
	.stackcount
	.stackheight
	.allowpartstack
.dom{}
	.imgg
	.img_fullstack
	.img_partstack
	.box_move
	.box_stay
	.vslider{}
		.g
		.boxy
.clickedtemplate // set when a template is clicked
	.qname
	.isfirst
	.islast
.partstack{}
	.start
	.stop
.height

enter_partstack()
*/

const labyspace = 5
const stackpagesize = 60

export async function loadTk(tk, block) {
	block.tkcloakon(tk)
	block.block_setheight()

	if (tk.uninitialized) {
		makeTk(tk, block)
	}

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = []

	let xoff = 0
	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			x: xoff
		})
		xoff += r.width + block.regionspace
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const [idx, r] of block.subpanels.entries()) {
			xoff += r.leftpad
			regions.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx: idx,
				x: xoff
			})
			xoff += r.width
		}
	}

	tk.regions = regions

	try {
		// loadTk is called by pan/zoom, and will always cancel partstack
		if (tk.groups) {
			for (const g of tk.groups) {
				delete g.partstack
				delete g.dom.vslider.boxy
			}
		}

		const data = await getData(tk, block)
		if (data.error) throw data.error
		if (data.colorscale) {
			// available from 1st query, cache
			tk.colorscale = data.colorscale
		}

		renderTk(data, tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		if (tk.groups) {
			for (const g of tk.groups) {
				g.dom.img_fullstack.attr('width', 0).attr('height', 0)
				g.dom.img_partstack.attr('width', 0).attr('height', 0)
				g.dom.img_cover.attr('width', 0).attr('height', 0)
			}
		}
		tk.height_main = tk.height = 100
		block.tkcloakoff(tk, { error: e.message || e })
	}

	block.block_setheight()
}

async function getData(tk, block, additional = []) {
	const lst = ['genome=' + block.genome.name, 'regions=' + JSON.stringify(tk.regions), ...additional]
	if (tk.variant) {
		lst.push('variant=' + tk.variant.chr + '.' + tk.variant.pos + '.' + tk.variant.ref + '.' + tk.variant.alt)
	}
	if (tk.uninitialized) {
		lst.push('getcolorscale=1')
		delete tk.uninitialized
	}
	if (tk.asPaired) lst.push('asPaired=1')
	if ('nochr' in tk) lst.push('nochr=' + tk.nochr)
	if (tk.file) lst.push('file=' + tk.file)
	if (tk.url) lst.push('url=' + tk.url)
	if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)
	if (window.devicePixelRatio > 1) lst.push('devicePixelRatio=' + window.devicePixelRatio)

	const data = await client.dofetch2('tkbam?' + lst.join('&'))
	if (data.error) throw data.error
	return data
}

function renderTk(data, tk, block) {
	/*
server can either generate groups anew (1. upon init 2. change blast parameter),
or update existing groups (pan or zoom), in which groupidx will be provided
*/
	tk.nochr = data.nochr
	if (!tk.groups) {
		tk.groups = []
		for (const g of data.groups) {
			tk.groups.push(makeGroup(g, tk, block))
		}
	} else {
		updateExistingGroups(data, tk, block)
	}
	setTkHeight(tk)
	tk.tklabel.each(function() {
		tk.leftLabelMaxwidth = this.getBBox().width
	})
	let countr = 0,
		countt = 0
	for (const g of tk.groups) {
		countr += g.data.count.r
		if (tk.asPaired) {
			countt += g.data.count.t
		}
	}
	tk.label_count
		.text((countr ? countr + ' reads' : '') + (countt ? ', ' + countt + ' templates' : ''))
		.each(function() {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	block.setllabel()
}

function matchGroup(tk, gd) {
	// TODO match by something from gb
	const g = tk.groups[0]
	g.data = gd
	return g
}

function setTkHeight(tk) {
	// call after any group is updated
	let h = 0
	for (const g of tk.groups) {
		g.dom.imgg.transition().attr('transform', 'translate(0,' + h + ')')
		if (g.partstack) {
			// slider visible
			g.dom.vslider.g.transition().attr('transform', 'translate(0,' + h + ')')
		}
		h += g.data.height
	}
	tk.height_main = tk.height = h
	tk.height_main += tk.toppad + tk.bottompad
}

function updateExistingGroups(data, tk, block) {
	// to update all existing groups and reset each group to fullstack
	for (const gd of data.groups) {
		const group = matchGroup(tk, gd)

		update_boxes(group, tk, block)

		// in full stack
		group.dom.img_fullstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		//tk.config_handle.transition().attr('x', 0)
		group.dom.vslider.g.transition().attr('transform', 'scale(0)')
		group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
	}
}

function update_boxes(group, tk, block) {
	// update move/stay boxes after getting new data
	group.dom.box_move.attr('width', 0)
	update_box_stay(group, tk, block)
}

function update_box_stay(group, tk, block) {
	// just the stay box
	if (!group.data.templatebox) {
		group.dom.box_stay.attr('width', 0)
		return
	}
	if (!group.clickedtemplate) {
		group.dom.box_stay.attr('width', 0)
		return
	}
	for (const t of group.data.templatebox) {
		if (t.qname == group.clickedtemplate.qname) {
			if (tk.asPaired || (t.isfirst && group.clickedtemplate.isfirst) || (t.islast && group.clickedtemplate.islast)) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				group.dom.box_stay
					.attr('width', bx2 - bx1)
					.attr('height', t.y2 - t.y1)
					.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
				return
			}
		}
	}
	// clicked template not found
	group.dom.box_stay.attr('width', 0)
}

function makeTk(tk, block) {
	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})

	tk.readpane = client.newpane({ x: 100, y: 100, closekeep: 1 })
	tk.readpane.pane.style('display', 'none')
	// <g> of each group is added dynamically to glider
	tk.dom = {
		vsliderg: tk.gright.append('g')
	}
	tk.asPaired = false

	tk.tklabel.text(tk.name).attr('dominant-baseline', 'auto')
	let laby = block.labelfontsize
	tk.label_count = block.maketklefthandle(tk, laby)
}

function makeGroup(gd, tk, block) {
	// make a group object using returned data for this group, and show tk image
	const group = {
		data: gd,
		dom: {
			imgg: tk.glider.append('g'),
			vslider: {
				g: tk.dom.vsliderg.append('g').attr('transform', 'scale(0)')
			}
		}
	}
	group.dom.img_fullstack = group.dom.imgg
		.append('image')
		.attr('xlink:href', group.data.src)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
	group.dom.img_partstack = group.dom.imgg
		.append('image')
		.attr('width', 0)
		.attr('height', 0)

	// put flyers behind cover
	group.dom.box_move = group.dom.imgg
		.append('rect')
		.attr('stroke', 'black')
		.attr('fill', 'none')
	group.dom.box_stay = group.dom.imgg
		.append('rect')
		.attr('stroke', 'magenta')
		.attr('fill', 'none')

	let mousedownx // not to trigger clicking after press and drag on a read
	group.dom.img_cover = group.dom.imgg
		.append('rect')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('width', group.data.width)
		.attr('height', group.data.height)
		.on('mousedown', () => {
			mousedownx = d3event.clientX
		})
		.on('mousemove', () => {
			if (group.data.allowpartstack) {
				// to show horizontal line
				return
			}
			if (!group.data.templatebox) return
			const [mx, my] = d3mouse(group.dom.img_cover.node())
			for (const t of group.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					group.dom.box_move
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
					return
				}
			}
		})
		.on('click', () => {
			if (mousedownx != d3event.clientX) return
			const [mx, my] = d3mouse(group.dom.img_cover.node())
			if (group.data.allowpartstack) {
				enter_partstack(group, tk, block, my - group.data.messagerowheights)
				return
			}
			if (!group.data.templatebox) return
			for (const t of group.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					if (group.clickedtemplate && group.clickedtemplate.qname == t.qname) {
						// same template
						if (
							tk.asPaired ||
							(t.isfirst && group.clickedtemplate.isfirst) ||
							(t.islast && group.clickedtemplate.islast)
						) {
							// paired mode
							// or single mode and correct read
							// box under cursor is highlighted, cancel
							delete group.clickedtemplate
							group.dom.box_stay.attr('width', 0)
							return
						}
					}
					// a different template or different read from the same template
					// overwrite
					group.clickedtemplate = {
						qname: t.qname
					}
					if (tk.asPaired) {
						group.clickedtemplate.isfirst = true
					} else {
						if (t.isfirst) group.clickedtemplate.isfirst = true
						if (t.islast) group.clickedtemplate.islast = true
					}
					group.dom.box_stay
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')

					getReadInfo(tk, block, t, block.pxoff2region(mx))
					return
				}
			}
		})

	group.dom.vslider.bar = group.dom.vslider.g
		.append('rect')
		.attr('fill', '#eee')
		.attr('x', 10)
		.attr('width', 20)
		.on('mouseover', () => group.dom.vslider.bar.attr('fill', '#fae8e8'))
		.on('mouseout', () => group.dom.vslider.bar.attr('fill', '#eee'))
		.on('click', () => {
			delete group.dom.vslider.boxy
			delete group.partstack
			group.data = group.data_fullstack
			renderGroup(group, tk, block)
			setTkHeight(tk)
			block.block_setheight()
		})
	group.dom.vslider.boxg = group.dom.vslider.g.append('g')
	group.dom.vslider.box = group.dom.vslider.boxg
		.append('rect')
		.attr('fill', '#c7edc5')
		.attr('width', 40)
		.on('mousedown', () => {
			d3event.preventDefault()
			group.dom.vslider.box.attr('fill', '#9ed19b')
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxy + deltay <= 0) return
				} else {
					if (group.dom.vslider.boxy + deltay >= group.data.height - group.dom.vslider.boxh) return
				}
				deltay = d
				group.dom.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.vslider.boxy + deltay) + ')')
				group.dom.img_partstack.attr(
					'y',
					-((deltay * group.data_fullstack.stackcount * group.data.stackheight) / group.data.height)
				)
				group.dom.box_move.attr('width', 0)
				group.dom.box_stay.attr('width', 0)
			})
			b.on('mouseup', async () => {
				group.dom.vslider.box.attr('fill', '#c7edc5')
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxy += deltay
				const delta = Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
				group.partstack.start += delta
				group.partstack.stop += delta
				block.tkcloakon(tk)
				// tell server which group to update
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				setTkHeight(tk)
				block.tkcloakoff(tk, {})
				block.block_setheight()
			})
		})

	group.dom.vslider.boxtopline = group.dom.vslider.boxg
		.append('line')
		.attr('stroke', '#9ed19b')
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.vslider.boxtopline.attr('stroke', '#36a32f'))
		.on('mouseout', () => group.dom.vslider.boxtopline.attr('stroke', '#9ed19b'))
		.on('mousedown', () => {
			d3event.preventDefault()
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxy + deltay <= 0) return
				} else {
					if (group.dom.vslider.boxh - deltay <= (stackpagesize * group.data.height) / group.data_fullstack.stackcount)
						return
				}
				deltay = d
				group.dom.vslider.boxg.attr('transform', 'translate(0,' + (group.dom.vslider.boxy + deltay) + ')')
				group.dom.vslider.box.attr('height', group.dom.vslider.boxh - deltay)
				group.dom.vslider.boxbotline
					.attr('y1', group.dom.vslider.boxh - deltay)
					.attr('y2', group.dom.vslider.boxh - deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxy += deltay
				group.partstack.start += Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
				block.tkcloakon(tk)
				// tell server which group to update
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				block.tkcloakoff(tk, {})
				setTkHeight(tk)
				block.block_setheight()
			})
		})
	group.dom.vslider.boxbotline = group.dom.vslider.boxg
		.append('line')
		.attr('stroke', '#9ed19b')
		.attr('stroke-width', 3)
		.attr('x2', 40)
		.on('mouseover', () => group.dom.vslider.boxbotline.attr('stroke', '#36a32f'))
		.on('mouseout', () => group.dom.vslider.boxbotline.attr('stroke', '#9ed19b'))
		.on('mousedown', () => {
			d3event.preventDefault()
			const y0 = d3event.clientY
			let deltay = 0
			const b = d3select(document.body)
			b.on('mousemove', () => {
				const y1 = d3event.clientY
				const d = y1 - y0
				if (d < 0) {
					if (group.dom.vslider.boxh + d <= (stackpagesize * group.data.height) / group.data_fullstack.stackcount)
						return
				} else {
					if (group.dom.vslider.boxy + deltay >= group.data.height - group.dom.vslider.boxh) return
				}
				deltay = d
				group.dom.vslider.box.attr('height', group.dom.vslider.boxh + deltay)
				group.dom.vslider.boxbotline
					.attr('y1', group.dom.vslider.boxh + deltay)
					.attr('y2', group.dom.vslider.boxh + deltay)
			})
			b.on('mouseup', async () => {
				b.on('mousemove', null).on('mouseup', null)
				if (deltay == 0) return
				group.dom.vslider.boxh += deltay
				group.partstack.stop += Math.ceil((group.data_fullstack.stackcount * deltay) / group.data.height)
				block.tkcloakon(tk)
				const _d = await getData(tk, block, [
					'stackstart=' + group.partstack.start,
					'stackstop=' + group.partstack.stop
				])
				group.data = _d.groups[0]
				renderGroup(group, tk, block)
				setTkHeight(tk)
				block.tkcloakoff(tk, {})
				block.block_setheight()
			})
		})
	return group
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const d = tk.tkconfigtip.d.append('div')

	{
		const row = d.append('div')
		row
			.append('span')
			.html('Show reads as:&nbsp;')
			.style('opacity', 0.5)
		make_radios({
			holder: row,
			options: [
				{ label: 'single', value: 'single', checked: !tk.asPaired },
				{ label: 'paired', value: 'paired', checked: tk.asPaired }
			],
			styles: { display: 'inline-block' },
			callback: () => {
				tk.asPaired = !tk.asPaired
				loadTk(tk, block)
			}
		})
	}

	d
		.append('div')
		.style('font-size', '.8em')
		.style('width', '300px').html(`
	<ul style="padding-left:15px">
	  <li><b>Matches</b> are rendered as gray boxes aligned to the reference.</li>
	  <li><b>Mismatches</b> will be checked when 1 bp is wider than 1 pixel, and are rendered as red boxes aligned to the reference.</li>
	  <li><b>Softclips</b> are rendered as blue boxes not aligned to the reference.</li>
	  <li><b>Base qualities</b> are rendered when 1 bp is wider than 2 pixels. See color scale below. When base quality is not used or is unavailable, full colors are used.</li>
	  <li><b>Sequences</b> from mismatch and softclip will be printed when 1 bp is wider than 7 pixels.</li>
	  <li>An <b>insertion</b> with on-screen size wider than 1 pixel will be rendered as cyan text between aligned bases, in either a letter or the number of inserted bp. Text color scales by average base quality when that's in use.</li>
	  <li><b>Deletions</b> are gaps joined by red horizontal lines.</li>
	  <li><b>Split reads</b> and splice junctions are indicated by solid gray lines.</li>
	  <li><b>Read pairs</b> are joined by dashed gray lines.</li>
	</ul>`)
	d.append('div')
		.style('margin-top', '10px')
		.append('img')
		.attr('src', tk.colorscale)
}

async function getReadInfo(tk, block, box, tmp) {
	/*
get info for a read/template
if is single mode, will be single read and with first/last info
if is pair mode, is the template
*/
	client.appear(tk.readpane.pane)
	tk.readpane.header.text('Read info')
	tk.readpane.body.selectAll('*').remove()
	const wait = tk.readpane.body.append('div').text('Loading...')

	const [ridx, pos] = tmp
	const lst = [
		'getread=1',
		'qname=' + encodeURIComponent(box.qname), // convert + to %2B, so it can be kept the same but not a space instead
		'genome=' + block.genome.name,
		'chr=' + block.rglst[ridx].chr,
		'pos=' + pos,
		'viewstart=' + block.rglst[ridx].start,
		'viewstop=' + block.rglst[ridx].stop
	]
	if (tk.nochr) lst.push('nochr=1')
	if (tk.file) lst.push('file=' + tk.file)
	if (tk.url) lst.push('url=' + tk.url)
	if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)
	if (tk.asPaired) {
		lst.push('getpair=1')
	} else {
		if (box.isfirst) lst.push('getfirst=1')
		else if (box.islast) lst.push('getlast=1')
	}
	const data = await client.dofetch2('tkbam?' + lst.join('&'))
	wait.remove()
	if (data.error) {
		client.sayerror(tk.readpane.body, data.error)
		return
	}

	tk.readpane.body.append('div').html(data.html)
}

async function enter_partstack(group, tk, block, y) {
	// enter part stack mode from full stack mode
	group.data_fullstack = group.data
	const clickstackidx = (group.partstack ? group.partstack.start : 0) + Math.floor(y / group.data.stackheight)
	// set start/stop of tk.partstack, ensure stop-start=stackpagesize
	if (clickstackidx < stackpagesize / 2) {
		// clicked too close to top
		group.partstack = {
			start: 0,
			stop: stackpagesize
		}
	} else if (clickstackidx > group.data_fullstack.stackcount - stackpagesize / 2) {
		// clicked too close to bottom
		group.partstack = {
			start: group.data_fullstack.stackcount - stackpagesize,
			stop: group.data_fullstack.stackcount
		}
	} else {
		group.partstack = {
			start: clickstackidx - stackpagesize / 2,
			stop: clickstackidx + stackpagesize / 2
		}
	}
	block.tkcloakon(tk)
	const _d = await getData(tk, block, ['stackstart=' + group.partstack.start, 'stackstop=' + group.partstack.stop])
	group.data = _d.groups[0]
	renderGroup(group, tk, block)

	setTkHeight(tk)
	block.tkcloakoff(tk, {})
	block.block_setheight()
}

function renderGroup(group, tk, block) {
	update_boxes(group, tk, block)
	if (group.partstack) {
		group.dom.img_partstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
			.attr('y', 0)
		group.dom.img_fullstack.attr('width', 0).attr('height', 0)
		//tk.config_handle.transition().attr('x', 40)
		group.dom.vslider.g.transition().attr('transform', 'translate(0,' + group.data.messagerowheights + ') scale(1)')
		group.dom.vslider.bar.transition().attr('height', group.data.height)
		group.dom.vslider.boxy = (group.data.height * group.partstack.start) / group.data_fullstack.stackcount
		group.dom.vslider.boxh =
			(group.data.height * (group.partstack.stop - group.partstack.start)) / group.data_fullstack.stackcount
		group.dom.vslider.box.transition().attr('height', group.dom.vslider.boxh)
		group.dom.vslider.boxbotline
			.transition()
			.attr('y1', group.dom.vslider.boxh)
			.attr('y2', group.dom.vslider.boxh)
		group.dom.vslider.boxg.transition().attr('transform', 'translate(0,' + group.dom.vslider.boxy + ')')
	} else {
		group.dom.img_fullstack
			.attr('xlink:href', group.data.src)
			.attr('width', group.data.width)
			.attr('height', group.data.height)
		group.dom.img_partstack.attr('width', 0).attr('height', 0)
		//tk.config_handle.transition().attr('x', 0)
		group.dom.vslider.g.transition().attr('transform', 'scale(0)')
	}
	group.dom.img_cover.attr('width', group.data.width).attr('height', group.data.height)
}
