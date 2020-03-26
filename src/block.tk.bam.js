import { event as d3event } from 'd3-selection'
import { axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { make_radios } from './dom'

/*

*/

const labyspace = 5

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
		// reset max

		tk.data = await getData(tk, block)

		renderTk(tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		tk.img.attr('width', 0).attr('height', 0)
		tk.height_main = tk.height = 100
		block.tkcloakoff(tk, { error: e.message || e })
	}

	block.block_setheight()
}

async function getData(tk, block) {
	const lst = [
		'genome=' + block.genome.name,
		'regions=' + JSON.stringify(tk.regions),
		'stackheight=' + tk.stackheight,
		'stackspace=' + tk.stackspace,
		'ntspace=' + tk.ntspace
	]
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
	tk.img
		.attr('xlink:href', tk.data.src)
		.attr('width', tk.data.width)
		.attr('height', tk.data.height)
	tk.nochr = tk.data.nochr

	tk.tklabel.each(function() {
		tk.leftLabelMaxwidth = this.getBBox().width
	})
	block.setllabel()

	tk.height_main = tk.height = tk.data.height
	tk.height_main += tk.toppad + tk.bottompad
}

function makeTk(tk, block) {
	delete tk.uninitialized
	tk.img = tk.glider.append('image')
	if (!tk.stackheight) tk.stackheight = 13 // make it dependent on range size
	if (!tk.stackspace) tk.stackspace = 1
	if (!tk.ntspace) tk.ntspace = 5 // reads in the same stack are spaced by this # of nt apart
	tk.asPaired = false

	tk.tklabel.text(tk.name).attr('dominant-baseline', 'auto')

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})
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
				{ label: 'paired, joined by dashed line', value: 'paired', checked: tk.asPaired }
			],
			style: { display: 'inline-block' },
			callback: () => {
				tk.asPaired = !tk.asPaired
				loadTk(tk, block)
			}
		})
		d.append('div')
			.text('Split reads are joined by solid lines.')
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}
}
