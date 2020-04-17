import { event as d3event, mouse as d3mouse } from 'd3-selection'
import { axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { make_radios } from './dom'

/*

important: tk.uninitialized will be deleted by getData at the first launch
to tell backend to provide color scale

tk can predefine if bam file has chr or not

tk {}
.box_move
.box_stay
.clickedtemplate
	.qname
	.isfirst
	.islast
*/

const labyspace = 5
const buttonrowheight = 20
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
		delete tk.partstack

		tk.data = await getData(tk, block)
		if (tk.data.colorscale) {
			// available from 1st query, cache
			tk.colorscale = tk.data.colorscale
		}

		renderTk(tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		tk.dom.img.attr('width', 0).attr('height', 0)
		tk.dom.img_cover.attr('width', 0).attr('height', 0)
		tk.height_main = tk.height = 100
		block.tkcloakoff(tk, { error: e.message || e })
	}

	block.block_setheight()
}

async function getData(tk, block, additional = []) {
	const lst = ['genome=' + block.genome.name, 'regions=' + JSON.stringify(tk.regions), ...additional]
	if (tk.uninitialized) {
		lst.push('getcolorscale=1')
		delete tk.uninitialized
	}
	if (tk.asPaired) lst.push('asPaired=1')
	if ('nochr' in tk) lst.push('nochr=' + tk.nochr)
	if (tk.file) lst.push('file=' + tk.file)
	if (tk.url) lst.push('url=' + tk.url)
	if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)

	const data = await client.dofetch2('tkbam?' + lst.join('&'))
	if (data.error) throw data.error
	return data
}

function renderTk(tk, block) {
	update_boxes(tk, block)

	if (tk.partstack) {
		tk.dom.buttonrowtop.transition().attr('transform', 'scale(1)')
		tk.dom.buttonrowbottom
			.transition()
			.attr('transform', 'translate(0,' + (buttonrowheight + tk.data.height) + ') scale(1)')
		tk.dom.imgg.transition().attr('transform', 'translate(0,' + buttonrowheight + ')')
		tk.dom.img
			.attr('xlink:href', tk.data.src)
			.attr('width', tk.data.width)
			.attr('height', tk.data.height)
	} else {
		tk.dom.buttonrowtop.transition().attr('transform', 'scale(0)')
		tk.dom.buttonrowbottom.transition().attr('transform', 'translate(0,' + tk.data.height + ') scale(0)')
		tk.dom.imgg.transition().attr('transform', 'translate(0,0)')
		tk.dom.img
			.attr('xlink:href', tk.data.src)
			.attr('width', tk.data.width)
			.attr('height', tk.data.height)
	}
	tk.dom.img_cover.attr('width', tk.data.width).attr('height', tk.data.height)

	tk.nochr = tk.data.nochr

	tk.tklabel.each(function() {
		tk.leftLabelMaxwidth = this.getBBox().width
	})
	tk.label_count
		.text(
			(tk.data.count.r ? tk.data.count.r + ' reads' : '') +
				(tk.data.count.t ? ', ' + tk.data.count.t + ' templates' : '')
		)
		.each(function() {
			tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
		})
	block.setllabel()

	tk.height_main = tk.height = (tk.partstack ? buttonrowheight * 2 : 0) + tk.data.height
	tk.height_main += tk.toppad + tk.bottompad
}

function update_boxes(tk, block) {
	// update move/stay boxes after getting new data
	tk.box_move.attr('width', 0)
	update_box_stay(tk, block)
}

function update_box_stay(tk, block) {
	// just the stay box
	if (!tk.data.templatebox) {
		tk.box_stay.attr('width', 0)
		return
	}
	if (!tk.clickedtemplate) {
		tk.box_stay.attr('width', 0)
		return
	}
	for (const t of tk.data.templatebox) {
		if (t.qname == tk.clickedtemplate.qname) {
			if (tk.asPaired || (t.isfirst && tk.clickedtemplate.isfirst) || (t.islast && tk.clickedtemplate.islast)) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				tk.box_stay
					.attr('width', bx2 - bx1)
					.attr('height', t.y2 - t.y1)
					.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
				return
			}
		}
	}
	// clicked template not found
	tk.box_stay.attr('width', 0)
}

function makeTk(tk, block) {
	tk.dom = {
		buttonrowtop: tk.glider.append('g').attr('transform', 'scale(0)'),
		buttonrowbottom: tk.glider.append('g').attr('transform', 'scale(0)'),
		imgg: tk.glider.append('g')
	}
	tk.dom.buttonrowtop
		.append('text')
		.attr('y', 15)
		.text('Full stack')
		.attr('class', 'sja_clbtext2')
		.on('click', async () => {
			delete tk.partstack
			block.tkcloakon(tk)
			tk.data = await getData(tk, block)
			renderTk(tk, block)
			block.tkcloakoff(tk, {})
			block.block_setheight()
		})

	tk.dom.scrolltop4 = tk.dom.buttonrowtop
		.append('text')
		.attr('x', 180)
		.attr('y', 15)
		.text('Scroll up ' + stackpagesize + ' reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, stackpagesize, true)
		})
	tk.dom.scrolltop3 = tk.dom.buttonrowtop
		.append('text')
		.attr('x', 340)
		.attr('y', 15)
		.text(stackpagesize / 2 + ' reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, stackpagesize / 2, true)
		})
	tk.dom.scrolltop2 = tk.dom.buttonrowtop
		.append('text')
		.attr('x', 440)
		.attr('y', 15)
		.text('5 reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, 5, true)
		})
	tk.dom.scrolltop1 = tk.dom.buttonrowtop
		.append('text')
		.attr('x', 540)
		.attr('y', 15)
		.text('1 read')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, 1, true)
		})

	tk.dom.scrollbottom4 = tk.dom.buttonrowbottom
		.append('text')
		.attr('x', 140)
		.attr('y', 15)
		.text('Scroll down ' + stackpagesize + ' reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, stackpagesize)
		})
	tk.dom.scrollbottom3 = tk.dom.buttonrowbottom
		.append('text')
		.attr('x', 340)
		.attr('y', 15)
		.text(stackpagesize / 2 + ' reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, stackpagesize / 2)
		})
	tk.dom.scrollbottom2 = tk.dom.buttonrowbottom
		.append('text')
		.attr('x', 440)
		.attr('y', 15)
		.text('5 reads')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, 5)
		})
	tk.dom.scrollbottom1 = tk.dom.buttonrowbottom
		.append('text')
		.attr('x', 540)
		.attr('y', 15)
		.text('1 read')
		.attr('class', 'sja_clbtext2')
		.on('click', () => {
			scroll_partstack(tk, block, 1)
		})

	tk.dom.img = tk.dom.imgg.append('image')
	// put flyers behind cover
	tk.box_move = tk.dom.imgg
		.append('rect')
		.attr('stroke', 'black')
		.attr('fill', 'none')
	tk.box_stay = tk.dom.imgg
		.append('rect')
		.attr('stroke', 'magenta')
		.attr('fill', 'none')

	let mousedownx // not to trigger clicking after press and drag on a read
	tk.dom.img_cover = tk.dom.imgg
		.append('rect')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.on('mousedown', () => {
			mousedownx = d3event.clientX
		})
		.on('mousemove', () => {
			if (tk.data.allowpartstack) {
				// to show horizontal line
				return
			}
			if (!tk.data.templatebox) return
			const [mx, my] = d3mouse(tk.dom.img_cover.node())
			for (const t of tk.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					tk.box_move
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')
					return
				}
			}
		})
		.on('click', () => {
			if (mousedownx != d3event.clientX) return
			const [mx, my] = d3mouse(tk.dom.img_cover.node())
			if (tk.data.allowpartstack) {
				do_partstack(tk, block, my - tk.data.messagerowheights)
				return
			}
			if (!tk.data.templatebox) return
			for (const t of tk.data.templatebox) {
				const bx1 = Math.max(0, t.x1)
				const bx2 = Math.min(block.width, t.x2)
				if (mx > bx1 && mx < bx2 && my > t.y1 && my < t.y2) {
					if (tk.clickedtemplate && tk.clickedtemplate.qname == t.qname) {
						// same template
						if (tk.asPaired || (t.isfirst && tk.clickedtemplate.isfirst) || (t.islast && tk.clickedtemplate.islast)) {
							// paired mode
							// or single mode and correct read
							// box under cursor is highlighted, cancel
							delete tk.clickedtemplate
							tk.box_stay.attr('width', 0)
							return
						}
					}
					// a different template or different read from the same template
					// overwrite
					tk.clickedtemplate = {
						qname: t.qname
					}
					if (tk.asPaired) {
						tk.clickedtemplate.isfirst = true
					} else {
						if (t.isfirst) tk.clickedtemplate.isfirst = true
						if (t.islast) tk.clickedtemplate.islast = true
					}
					tk.box_stay
						.attr('width', bx2 - bx1)
						.attr('height', t.y2 - t.y1)
						.attr('transform', 'translate(' + bx1 + ',' + t.y1 + ')')

					getReadInfo(tk, block, t, block.pxoff2region(mx))

					return
				}
			}
		})

	tk.asPaired = false

	tk.tklabel.text(tk.name).attr('dominant-baseline', 'auto')
	let laby = block.labelfontsize
	tk.label_count = block.maketklefthandle(tk, laby)

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})

	tk.readpane = client.newpane({ x: 100, y: 100, closekeep: 1 })
	tk.readpane.pane.style('display', 'none')
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
		'qname=' + box.qname,
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

async function do_partstack(tk, block, y) {
	// tk.data is still old, full stack
	const clickstackidx = Math.floor(y / tk.data.stackheight)
	tk.stackcount = tk.data.stackcount // should only be for full stack number
	tk.partstack = {
		start: Math.max(0, clickstackidx - stackpagesize / 2),
		stop: Math.min(tk.data.stackcount, clickstackidx + stackpagesize / 2)
	}
	block.tkcloakon(tk)
	tk.data = await getData(tk, block, ['stackstart=' + tk.partstack.start, 'stackstop=' + tk.partstack.stop])
	renderTk(tk, block)
	block.tkcloakoff(tk, {})
	block.block_setheight()
}

async function scroll_partstack(tk, block, length, scrollup) {
	if (scrollup) {
		if (tk.partstack.start <= 0) return
		const scrollable = Math.min(tk.partstack.start, length)
		tk.partstack = {
			start: tk.partstack.start - scrollable,
			stop: tk.partstack.stop - scrollable
		}
	} else {
		if (tk.partstack.stop >= tk.stackcount) return
		const scrollable = Math.min(length, tk.stackcount - tk.partstack.stop)
		tk.partstack = {
			start: tk.partstack.start + scrollable,
			stop: tk.partstack.stop + scrollable
		}
	}

	if (tk.partstack.start <= 0) {
		tk.dom.scrolltop4.text('At the top')
		tk.dom.scrolltop3.attr('transform', 'scale(0)')
		tk.dom.scrolltop2.attr('transform', 'scale(0)')
		tk.dom.scrolltop1.attr('transform', 'scale(0)')
	} else {
		tk.dom.scrolltop4.text('Scroll up ' + stackpagesize + ' reads')
		tk.dom.scrolltop3.attr('transform', 'scale(1)')
		tk.dom.scrolltop2.attr('transform', 'scale(1)')
		tk.dom.scrolltop1.attr('transform', 'scale(1)')
	}
	if (tk.partstack.stop >= tk.stackcount) {
		tk.dom.scrollbottom4.text('At the bottom')
		tk.dom.scrollbottom3.attr('transform', 'scale(0)')
		tk.dom.scrollbottom2.attr('transform', 'scale(0)')
		tk.dom.scrollbottom1.attr('transform', 'scale(0)')
	} else {
		tk.dom.scrollbottom4.text('Scroll down ' + stackpagesize + ' reads')
		tk.dom.scrollbottom3.attr('transform', 'scale(1)')
		tk.dom.scrollbottom2.attr('transform', 'scale(1)')
		tk.dom.scrollbottom1.attr('transform', 'scale(1)')
	}
	block.tkcloakon(tk)
	tk.data = await getData(tk, block, ['stackstart=' + tk.partstack.start, 'stackstop=' + tk.partstack.stop])
	renderTk(tk, block)
	block.tkcloakoff(tk, {})
	block.block_setheight()
}
