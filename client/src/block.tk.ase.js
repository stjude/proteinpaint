import { axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as client from './client'
import { rnabamtk_initparam, configPanel_rnabam } from './block.mds.svcnv.share'
import * as common from '#shared/common.js'
import * as expressionstat from './block.mds.expressionstat'

/*
on the fly ase track
runs off RNA bam and VCF


********************** EXPORTED
loadTk()


********************** INTERNAL
getdata_region
renderTk
renderTk_covplot
renderTk_fpkm
configPanel

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
		tk.dna.coveragemax = 0
		if (tk.rna.coverageauto) tk.rna.coveragemax = 0

		for (const r of regions) {
			await getdata_region(r, tk, block)
		}

		renderTk(tk, block)

		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		tk.height_main = tk.height = 100
		block.tkcloakoff(tk, { error: e.message || e })
	}

	block.block_setheight()
}

function getdata_region(r, tk, block) {
	const arg = {
		genome: block.genome.name,
		samplename: tk.samplename,
		rnabamfile: tk.rnabamfile,
		rnabamurl: tk.rnabamurl,
		rnabamindexURL: tk.rnabamindexURL,
		rnabamtotalreads: tk.rnabamtotalreads,
		rnabamispairedend: tk.rnabamispairedend,
		vcffile: tk.vcffile,
		vcfurl: tk.vcfurl,
		vcfindexURL: tk.vcfindexURL,
		rnabarheight: tk.rna.coveragebarh,
		dnabarheight: tk.dna.coveragebarh,
		barypad: tk.barypad,
		chr: r.chr,
		start: r.start,
		stop: r.stop,
		width: r.width,
		checkrnabam: tk.checkrnabam,
		refcolor: tk.dna.refcolor,
		altcolor: tk.dna.altcolor,
		devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1
	}
	if (!tk.rna.coverageauto) {
		// fixed
		arg.rnamax = tk.rna.coveragemax
	}

	return client.dofetch('ase', arg).then(data => {
		if (data.error) throw data.error
		r.genes = data.genes
		r.fpkmrangelimit = data.fpkmrangelimit
		if (data.covplotrangelimit) {
			// no cov plot
			r.covplotrangelimit = data.covplotrangelimit
		} else {
			// has cov plot
			r.coveragesrc = data.coveragesrc
			tk.dna.coveragemax = Math.max(tk.dna.coveragemax, data.dnamax)
			if (tk.rna.coverageauto) {
				tk.rna.coveragemax = Math.max(tk.rna.coveragemax, data.rnamax)
			}
		}
	})
}

function renderTk(tk, block) {
	tk.glider.selectAll('*').remove()

	for (const p of tk.subpanels) {
		p.glider
			.attr('transform', 'translate(0,0)') // it may have been panned
			.selectAll('*')
			.remove()
	}

	renderTk_covplot(tk, block)
	renderTk_fpkm(tk, block)

	// gene fpkm

	block.setllabel()
	tk.height_main += tk.toppad + tk.bottompad
}

function renderTk_covplot(tk, block) {
	const noploth = 30 // row height for not showing plot
	const anyregionwithcovplot = tk.regions.find(r => r.coveragesrc)

	if (anyregionwithcovplot) {
		// at least 1 region has rna/dna cov plot
		// position labels accordingly
		client.axisstyle({
			axis: tk.rna.coverageaxisg.attr('transform', 'scale(1) translate(0,0)').call(
				axisLeft()
					.scale(scaleLinear().domain([0, tk.rna.coveragemax]).range([tk.rna.coveragebarh, 0]))
					.tickValues([0, tk.rna.coveragemax])
			),
			showline: true
		})
		tk.tklabel.attr('y', tk.rna.coveragebarh / 2 - 7)
		tk.rna.coveragelabel.attr('y', tk.rna.coveragebarh / 2 + 2).attr('transform', 'scale(1)')

		client.axisstyle({
			axis: tk.dna.coverageaxisg
				.attr('transform', 'scale(1) translate(0,' + (tk.rna.coveragebarh + tk.barypad) + ')')
				.call(
					axisLeft()
						.scale(scaleLinear().domain([0, tk.dna.coveragemax]).range([0, tk.dna.coveragebarh]))
						.tickValues([0, tk.dna.coveragemax])
				),
			showline: true
		})
		tk.dna.coveragelabel
			.attr('transform', 'scale(1)')
			.attr('y', tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh / 2)
			.each(function () {
				tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, this.getBBox().width)
			})

		tk.height_main = tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh
	} else {
		// no region has cov plot
		tk.dna.coverageaxisg.attr('transform', 'scale(0)')
		tk.rna.coverageaxisg.attr('transform', 'scale(0)')
		tk.dna.coveragelabel.attr('transform', 'scale(0)')
		tk.rna.coveragelabel.attr('transform', 'scale(0)')

		tk.height_main = noploth
	}

	for (const r of tk.regions) {
		if (r.covplotrangelimit) {
			// no plot
			tk.glider
				.append('text')
				.text('Zoom in under ' + common.bplen(r.covplotrangelimit) + ' to show coverage plot')
				.attr('font-size', block.laelfontsize)
				.attr('text-anchor', 'middle')
				.attr('x', r.x + r.width / 2)
				.attr('y', noploth / 2)
			continue
		}
		tk.glider
			.append('image')
			.attr('x', r.x)
			.attr('width', r.width)
			.attr('height', tk.rna.coveragebarh + tk.barypad + tk.dna.coveragebarh)
			.attr('xlink:href', r.coveragesrc)
	}
}

function renderTk_fpkm(tk, block) {
	/*
1. if anything to render across all regions, make axis, else, hide axis & label
2. for each region, if has gene fpkm, plot; else, show out of bound
*/
	const noploth = 30 // row height for not showing plot
	const anyregionwithfpkm = tk.regions.find(r => !r.fpkmrangelimit)

	let maxfpkm = 0
	for (const r of tk.regions) {
		if (r.fpkmrangelimit) continue
		if (r.genes) {
			for (const g of r.genes) {
				if (Number.isFinite(g.fpkm)) maxfpkm = Math.max(maxfpkm, g.fpkm)
				expressionstat.measure(g, tk.gecfg)
			}
		}
	}

	const y = tk.height_main + tk.yspace1

	if (anyregionwithfpkm && maxfpkm > 0) {
		client.axisstyle({
			axis: tk.fpkm.axisg.attr('transform', 'scale(1) translate(0,' + y + ')').call(
				axisLeft()
					.scale(scaleLinear().domain([0, maxfpkm]).range([tk.fpkm.barh, 0]))
					.tickValues([0, maxfpkm])
			),
			showline: true
		})
		tk.fpkm.label.attr('y', y + tk.fpkm.barh / 2).attr('transform', 'scale(1)')

		tk.height_main += tk.yspace1 + tk.fpkm.barh
	} else {
		// no region has fpkm
		tk.fpkm.axisg.attr('transform', 'scale(0)')
		tk.fpkm.label.attr('transform', 'scale(0)')
		tk.height_main += noploth
	}

	for (const r of tk.regions) {
		if (r.fpkmrangelimit) {
			// no plot
			tk.glider
				.append('text')
				.text('Zoom in under ' + common.bplen(r.fpkmrangelimit) + ' to show gene ' + tk.gecfg.datatype + ' values')
				.attr('font-size', block.laelfontsize)
				.attr('text-anchor', 'middle')
				.attr('x', r.x + r.width / 2)
				.attr('y', y + noploth / 2)
			continue
		}
		if (!r.genes) continue

		if (maxfpkm == 0) {
			// within range but still no data
			continue
		}

		const rsf = r.width / (r.stop - r.start)

		for (const gene of r.genes) {
			if (!Number.isFinite(gene.fpkm)) continue

			// plot this gene

			const color = expressionstat.ase_color(gene, tk.gecfg)
			const boxh = (tk.fpkm.barh * gene.fpkm) / maxfpkm

			let x1, x2
			if (r.reverse) {
				x1 = r.x + rsf * (r.stop - Math.min(r.stop, gene.stop))
				x2 = r.x + rsf * (r.stop - Math.max(r.start, gene.start))
			} else {
				x1 = r.x + rsf * (Math.max(r.start, gene.start) - r.start)
				x2 = r.x + rsf * (Math.min(r.stop, gene.stop) - r.start)
			}

			const line = tk.glider
				.append('line')
				.attr('x1', x1)
				.attr('x2', x2)
				.attr('y1', y + tk.fpkm.barh - boxh)
				.attr('y2', y + tk.fpkm.barh - boxh)
				.attr('stroke', color)
				.attr('stroke-width', 2)
				.attr('stroke-opacity', 0.4)
			const box = tk.glider
				.append('rect')
				.attr('x', x1)
				.attr('y', y + tk.fpkm.barh - boxh)
				.attr('width', x2 - x1)
				.attr('height', boxh)
				.attr('fill', color)
				.attr('fill-opacity', 0.2)
			tk.glider
				.append('rect')
				.attr('x', x1)
				.attr('y', y + tk.fpkm.barh - boxh - 2)
				.attr('width', x2 - x1)
				.attr('height', boxh + 2)
				.attr('fill', 'white')
				.attr('fill-opacity', 0)
				.on('mouseover', event => {
					line.attr('stroke-opacity', 0.5)
					box.attr('fill-opacity', 0.3)
					tooltip_genefpkm(gene, tk)
				})
				.on('mouseout', event => {
					line.attr('stroke-opacity', 0.4)
					box.attr('fill-opacity', 0.2)
					tk.tktip.hide()
				})
		}
	}
}

function tooltip_genefpkm(gene, tk) {
	tk.tktip.clear().show(event.clientX, event.clientY)
	const lst = [
		{
			k: gene.gene + ' ' + tk.gecfg.datatype,
			v: gene.fpkm
		}
	]
	const table = client.make_table_2col(tk.tktip.d, lst)
	expressionstat.showsingleitem_table(gene, tk.gecfg, table)
}

function makeTk(tk, block) {
	delete tk.uninitialized

	if (!tk.barypad) tk.barypad = 0

	if (!tk.rna) tk.rna = {}
	tk.rna.coverageaxisg = tk.gleft.append('g')
	tk.rna.coveragelabel = block
		.maketklefthandle(tk)
		.attr('class', null)
		.attr('dominant-baseline', 'hanging')
		.text('RNA coverage')
	tk.rna.coverageauto = true
	if (!tk.rna.coveragebarh) tk.rna.coveragebarh = 50

	if (!tk.dna) tk.dna = {}
	tk.dna.coverageaxisg = tk.gleft.append('g')
	tk.dna.coveragelabel = block.maketklefthandle(tk).attr('class', null).text('DNA coverage')
	tk.dna.coveragemax = 0
	if (!tk.dna.coveragebarh) tk.dna.coveragebarh = 50
	if (!tk.dna.refcolor) tk.dna.refcolor = '#188FF5'
	if (!tk.dna.altcolor) tk.dna.altcolor = '#F51818'

	if (!tk.yspace1) tk.yspace1 = 15 // y space between two rows: cov and fpkm

	tk.gecfg = { datatype: 'FPKM' }
	expressionstat.init_config(tk.gecfg)

	if (!tk.fpkm) tk.fpkm = {}
	tk.fpkm.axisg = tk.gleft.append('g')
	tk.fpkm.label = block
		.maketklefthandle(tk)
		.attr('class', null)
		.text('Gene ' + tk.gecfg.datatype)
	if (!tk.fpkm.barh) tk.fpkm.barh = 50

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', event => {
			configPanel(tk, block)
		})

	if (!tk.checkrnabam) tk.checkrnabam = {}
	rnabamtk_initparam(tk.checkrnabam)
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
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseInt(event.target.value)
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
			.on('change', event => {
				tk.rna.coverageauto = event.target.checked
				fixed.style('display', tk.rna.coverageauto ? 'none' : 'inline')
				loadTk(tk, block)
			})
		row.append('label').html('&nbsp;automatic scale').attr('for', id)
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
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseInt(event.target.value)
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
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseInt(event.target.value)
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
			.on('change', event => {
				tk.dna.refcolor = event.target.value
				loadTk(tk, block)
			})
		row.append('span').html('&nbsp;Alt:&nbsp;')
		row
			.append('input')
			.attr('type', 'color')
			.property('value', tk.dna.altcolor)
			.on('change', event => {
				tk.dna.altcolor = event.target.value
				loadTk(tk, block)
			})
	}
	configPanel_rnabam(tk, block, loadTk)
}
