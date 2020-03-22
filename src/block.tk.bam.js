import { event as d3event } from 'd3-selection'
import { axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'

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
		'stackspace=' + tk.stackspace
	]
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

	d.append('div')
		.text('RNA-seq coverage is shown at all covered bases.')
		.style('font-size', '.8em')
		.style('opacity', 0.5)
	{
		const row = d.append('div').style('margin', '5px 0px')
		row.append('span').html('Bar height&nbsp;')
		row
			.append('input')
			.attr('type', 'numeric')
			.property('value', tk.rna.coveragebarh)
			.style('width', '80px')
			.on('keyup', () => {
				if (!client.keyupEnter()) return
				const v = Number.parseInt(d3event.target.value)
				if (v <= 20) return
				if (v == tk.rna.coveragebarh) return
				tk.rna.coveragebarh = v
				loadTk(tk, block)
			})
	}
	{
		const row = d.append('div').style('margin', '5px 0px')
		const id = Math.random()
		row
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', id)
			.property('checked', tk.rna.coverageauto)
			.on('change', () => {
				tk.rna.coverageauto = d3event.target.checked
				fixed.style('display', tk.rna.coverageauto ? 'none' : 'inline')
				loadTk(tk, block)
			})
		row
			.append('label')
			.html('&nbsp;automatic scale')
			.attr('for', id)
		const fixed = row
			.append('div')
			.style('display', tk.rna.coverageauto ? 'none' : 'inline')
			.style('margin-left', '20px')
		fixed.append('span').html('Fixed max&nbsp')
		fixed
			.append('input')
			.attr('value', 'numeric')
			.property('value', tk.rna.coveragemax)
			.style('width', '50px')
			.on('keyup', () => {
				if (!client.keyupEnter()) return
				const v = Number.parseInt(d3event.target.value)
				if (v <= 0) return
				if (v == tk.rna.coveragemax) return
				tk.rna.coveragemax = v
				loadTk(tk, block)
			})
	}

	// dna bar h
	d.append('div')
		.text('SNPs are only shown for those heterozygous in DNA.')
		.style('font-size', '.8em')
		.style('opacity', 0.5)
		.style('margin-top', '25px')
	{
		const row = d.append('div').style('margin', '5px 0px')
		row.append('span').html('Bar height&nbsp;')
		row
			.append('input')
			.attr('type', 'numeric')
			.property('value', tk.dna.coveragebarh)
			.style('width', '80px')
			.on('keyup', () => {
				if (!client.keyupEnter()) return
				const v = Number.parseInt(d3event.target.value)
				if (v <= 20) return
				if (v == tk.dna.coveragebarh) return
				tk.dna.coveragebarh = v
				loadTk(tk, block)
			})
	}
	{
		const row = d.append('div').style('margin', '5px 0px 25px 0px')
		row.append('span').html('Allele color&nbsp;&nbsp;Ref:&nbsp;')
		row
			.append('input')
			.attr('type', 'color')
			.property('value', tk.dna.refcolor)
			.on('change', () => {
				tk.dna.refcolor = d3event.target.value
				loadTk(tk, block)
			})
		row.append('span').html('&nbsp;Alt:&nbsp;')
		row
			.append('input')
			.attr('type', 'color')
			.property('value', tk.dna.altcolor)
			.on('change', () => {
				tk.dna.altcolor = d3event.target.value
				loadTk(tk, block)
			})
	}
	configPanel_rnabam(tk, block, loadTk)
}
