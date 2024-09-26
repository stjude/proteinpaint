import * as client from './client'
import { axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from '#shared/common.js'
import * as expressionstat from './block.mds.expressionstat'
import { may_add_sampleannotation } from './block.mds.svcnv.clickitem'
import { createbutton_addfeature } from './block.mds.svcnv.samplematrix'
import { gene_searchbox } from './gene'
import {
	focus_singlesample,
	coverbarcolor_silent,
	multi_sample_addhighlight,
	multi_sample_removehighlight,
	multi_expressionstatus_ase_outlier,
	rnabamtk_copyparam
} from './block.mds.svcnv'

/*

********************** EXPORTED
render_multi_genebar
	genebarconfig_fixed

********************** INTERNAL
multi_show_geneboxplot
genebar_printtooltip
addcolumn_autogene
addcolumn_fixedgene
	genebarconfig_auto
		findgene4fix
addcolumn_attr
mayadd_survivaloption


add columns
column could be gene expression rank and sample attribute

*/

export function render_multi_genebar(tk, block) {
	/*
	multi-sample
	native or custom
	dense or full

	*/

	// it may have been cleared in trunk, but local func could still call to re-render
	tk.cnvrightg.selectAll('*').remove()

	const attrlst = [] // list of sample attributes to show alongside expression

	// TODO support categorical attributes

	if (tk.sampleAttribute && tk.sampleAttribute.attributes && tk.sampleAttribute.samples) {
		for (const attrkey in tk.sampleAttribute.attributes) {
			const attr = tk.sampleAttribute.attributes[attrkey]
			if (!attr.showintrack) continue

			const attrobj = {
				key: attrkey,
				label: attr.label,
				min: null,
				max: null
			}
			// determine min/max
			for (const g of tk.samplegroups) {
				for (const s of g.samples) {
					const v0 = tk.sampleAttribute.samples[s.samplename]
					if (!v0) continue
					const v = v0[attrkey]
					if (Number.isNaN(v)) continue
					if (attrobj.min == null) {
						attrobj.min = attrobj.max = v
					} else {
						attrobj.min = Math.min(attrobj.min, v)
						attrobj.max = Math.max(attrobj.max, v)
					}
				}
			}
			attrlst.push(attrobj)
		}
	}

	/*
	three types of columns
	1. auto gene, single, changes as you scroll
	2. fixed genes, 0-multi
	3. sample attr
	*/

	const genes_auto = new Set() // names of auto gene, will choose one

	if (tk._data) {
		for (const g of tk._data) {
			if (!g.samples) continue
			for (const s of g.samples) {
				if (!s.expressionrank) continue

				for (const gene in s.expressionrank) {
					genes_auto.add(gene)
				}
			}
		}
	}
	if (tk.checkrnabam) {
		for (const s in tk.checkrnabam.samples) {
			const sbam = tk.checkrnabam.samples[s]
			if (sbam.genes) {
				for (const g of sbam.genes) {
					genes_auto.add(g.gene)
				}
			}
		}
	}

	const genes_fixed = tk.gecfg ? tk.gecfg.fixed : []

	let autogenename
	if (tk.selectedgene && genes_auto.has(tk.selectedgene)) {
		autogenename = tk.selectedgene
	} else {
		autogenename = [...genes_auto][0]
	}

	if (autogenename) {
		// has got one name, check if it is in fixed
		for (const gf of genes_fixed) {
			if (autogenename == gf.gene) {
				// same, won't show auto
				autogenename = undefined
				break
			}
		}
	}

	/*
	quick fix
	expose the name of first showing gene to smat task in Matrix view
	*/
	if (autogenename) {
		tk.showinggene = autogenename
	} else if (genes_fixed[0]) {
		tk.showinggene = genes_fixed[0].name
	}

	// any gene has ase info? if so, tooltip will show 'no info' for those missing
	// otherwise won't indicate ase status
	let anygenehasase = false
	for (const g of tk.samplegroups) {
		for (const s of g.samples) {
			if (s.expressionrank) {
				for (const n in s.expressionrank) {
					if (s.expressionrank[n].ase) {
						anygenehasase = true
					}
				}
			}
		}
	}
	if (tk.checkrnabam) {
		for (const s in tk.checkrnabam.samples) {
			const sbam = tk.checkrnabam.samples[s]
			if (sbam.genes && sbam.genes.find(i => i.gene == autogenename)) {
				anygenehasase = true
			}
		}
	}

	// initiate columnbars holder
	for (const g of tk.samplegroups) {
		for (const s of g.samples) {
			s.columnbars = []
		}
	}

	let column_xoff = 0

	column_xoff += addcolumn_autogene(autogenename, genes_auto, tk, block)

	for (const fixedgene of genes_fixed) {
		/***********
		one column for each fixed gene
		.gene str
		.sample2rank{}
		*/

		column_xoff += addcolumn_fixedgene(fixedgene, tk, block, column_xoff)
	}

	// one column for each sample attribute
	for (const attr of attrlst) {
		column_xoff += addcolumn_attr(attr, tk, block, column_xoff)
	}

	/* sloppy
	should await for data to be loaded for all fixed genes
	*/
	if (tk.gecfg && tk.gecfg.fixed_pend) {
		const i = tk.gecfg.fixed_pend.shift()
		if (tk.gecfg.fixed_pend.length == 0) {
			delete tk.gecfg.fixed_pend
		}
		// not using predefined position
		findgene4fix(i.gene, tk, block)
	}

	// adjust block right width
	tk.rightheadw_tk = column_xoff
	block.rightheadw = 0
	for (const t of block.tklst) {
		block.rightheadw = Math.max(block.rightheadw, t.rightheadw_tk)
	}
	block.blocksetw()

	const axispad = 0
	const labelpad = 3
	const ticksize = 5
	const fontsize = 12

	return fontsize + fontsize + labelpad + ticksize + axispad
}

function multi_show_geneboxplot(arg) {
	/*
	multi-sample
	for a given gene, show expression across all samples
	if the gecfg are configured to group samples by attribute, will show boxplot for each group
	*/

	const { gene, samplename, value, tk, block } = arg

	const pane = client.newpane({ x: window.innerWidth / 2, y: 100 })
	pane.header.text(gene + ' ' + tk.gecfg.datatype + ' from ' + tk.name)
	const c = tk.gene2coord[gene]
	if (!c) {
		pane.body.text('No coordinate for ' + gene)
		return
	}

	const p = {
		gene: gene,
		chr: c.chr,
		start: c.start,
		stop: c.stop,
		holder: pane.body,
		block: block,
		genome: block.genome,
		//jwt: block.jwt,
		//hostURL: block.hostURL,
		sample: samplename ? { name: samplename, value: value } : null,
		// if sampleset is defined for custom dataset, allow to show boxplot at exp panel
		sampleset: tk.sampleset
	}

	// expression
	if (tk.iscustom) {
		for (const k in tk.checkexpressionrank) {
			p[k] = tk.checkexpressionrank[k]
		}
	} else {
		const e = tk.mds.queries[tk.querykey].checkexpressionrank
		p.dslabel = tk.mds.label
		p.querykey = e.querykey
		p.boxplotgroupers = e.boxplotgroupers
	}
	// svcnv
	p.color = {
		cnvgain: tk.cnvcolor.gain.str,
		cnvloss: tk.cnvcolor.loss.str,
		sv: 'black'
	}
	if (tk.iscustom) {
		p.svcnv = {
			iscustom: 1,
			file: tk.file,
			url: tk.url,
			indexURL: tk.indexURL
		}
	} else {
		p.svcnv = {
			dslabel: tk.mds.label,
			querykey: tk.querykey
		}
	}
	p.svcnv.valueCutoff = tk.valueCutoff
	p.svcnv.bplengthUpperLimit = tk.bplengthUpperLimit

	p.clicksample = (thissample, group, plot) => {
		// click outlier sample to launch browser and show sv/cnv+expression rank for single sample
		const sample = {
			samplename: thissample.sample
		}

		let samplegroup
		if (group) {
			samplegroup = {
				attributes: group.attributes
			}
		}

		const tk2 = {} // build a svcnv track

		for (const k in plot.svcnv) {
			tk2[k] = plot.svcnv[k]
		}

		if (plot.svcnv.iscustom) {
			tk2.checkexpressionrank = {
				file: plot.file,
				url: plot.url,
				indexURL: plot.indexURL,
				datatype: plot.gecfg.datatype
			}
		} else {
			tk2.mds = plot.block.genome.datasets[plot.svcnv.dslabel]
		}
		focus_singlesample({
			m: {
				dt: common.dtcnv,
				chr: plot.chr,
				start: plot.start,
				stop: plot.stop
			},
			sample: sample,
			samplegroup: samplegroup,
			tk: tk2,
			block: plot.block
		})
	}
	import('./block.mds.geneboxplot').then(_ => {
		_.init(p)
	})
}

function addcolumn_autogene(autogenename, genes_auto, tk, block) {
	/*
	return width of column to indicate whether a column is drawn or not
	*/

	// TODO enable column-specific width config

	// hardcoded bar width for expression rank
	const expbarwidth = 80
	// hardcoded bar width for numeric attribute
	const numattrbarwidth = 80
	const xspace = 15

	// axis label
	const axispad = 0
	const labelpad = 3
	const ticksize = 5
	const fontsize = 12

	////// column 1 is for auto gene
	if (autogenename) {
		let minvalue = 0
		let maxvalue = 100 // hardcoded rank

		if (tk.checkrnabam) {
			// fpkm from a different source
			maxvalue = 0
			for (const s in tk.checkrnabam.samples) {
				const sbam = tk.checkrnabam.samples[s]
				if (sbam.genes) {
					const g = sbam.genes.find(i => i.gene == autogenename)
					if (g) {
						maxvalue = Math.max(maxvalue, g.fpkm)
					}
				}
			}
		}

		for (const g of tk.samplegroups) {
			let y = g.y

			for (const s of g.samples) {
				const row = tk.cnvrightg.append('g').attr('transform', 'translate(0,' + y + ')')

				if (s.expressionrank) {
					const v = s.expressionrank[autogenename]
					if (v != undefined) {
						const bar = row
							.append('rect')
							.attr('fill', expressionstat.ase_color(v, tk.gecfg)) // bar color set by ase status
							.attr('width', (expbarwidth * v.rank) / maxvalue)
							.attr('height', s.height)
							.attr('shape-rendering', 'crispEdges')

						if (0 && tk.isfull && v.estat) {
							// only show dots for outlier status in full, not dense
							if (v.estat.outlier) {
								row
									.append('circle')
									.attr('cx', expbarwidth)
									.attr('cy', s.height / 2)
									.attr('r', s.height / 2)
									.attr('fill', tk.gecfg.outlier.color_outlier)
							} else if (v.estat.outlier_asehigh) {
								row
									.append('circle')
									.attr('cx', expbarwidth)
									.attr('cy', s.height / 2)
									.attr('r', s.height / 2)
									.attr('fill', tk.gecfg.outlier.color_outlier_asehigh)
							}
						}

						const cover = row
							.append('rect')
							.attr('fill', coverbarcolor_silent)
							.attr('fill-opacity', 0.1)
							.attr('width', expbarwidth)
							.attr('height', s.height)

						if (tk.isfull) {
							s.columnbars.push(cover)
						}

						cover
							.on('mouseover', event => {
								tk.tktip.clear()

								genebar_printtooltip(autogenename, v, s, tk.tktip.d, tk)

								tk.tktip.show(event.clientX, event.clientY)

								multi_sample_addhighlight(s)
							})
							.on('mouseout', () => {
								tk.tktip.hide()
								multi_sample_removehighlight(s)
							})
							.on('click', () => {
								multi_show_geneboxplot({
									gene: autogenename,
									samplename: s.samplename,
									value: v.value,
									tk: tk,
									block: block
								})
							})
					}
				} else if (tk.checkrnabam) {
					const sbam = tk.checkrnabam.samples[s.samplename]
					if (sbam && sbam.genes) {
						const gene = sbam.genes.find(i => i.gene == autogenename)
						if (gene) {
							// draw bar for gene fpkm & ase from rna bam
							drawgenebar_rnabam(expbarwidth, maxvalue, row, gene, s, tk, block)
						}
					}
				}

				// done this sample
				y += s.height + tk.rowspace
			}

			// done this group
		}

		const headg = tk.cnvrightg.append('g').attr('transform', 'translate(0,-' + axispad + ')')

		client.axisstyle({
			axis: headg.append('g').call(
				axisTop()
					.scale(scaleLinear().domain([minvalue, maxvalue]).range([0, expbarwidth]))
					.tickValues([0, maxvalue])
					.tickSize(ticksize)
			),
			fontsize: fontsize,
			showline: 1
		})

		headg
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('x', expbarwidth / 2)
			.attr('y', -(fontsize + labelpad + ticksize + axispad))
			.attr('font-family', client.font)
			.attr('font-size', fontsize)
			.text(autogenename + ' ' + (tk.checkrnabam ? tk.gecfg.datatype : 'rank'))
			.attr('class', 'sja_clbtext2')
			.on('click', () => {
				genebarconfig_auto(autogenename, genes_auto, tk, block)
			})

		// done column for auto gene
		return expbarwidth + xspace
	}

	/* no auto gene name
	1. no expression track
	2. no gene in view range
	3. view range beyond limit
	*/

	if (tk.gecfg) {
		// indeed has expression track
		// here should show button for querying gene

		const g = tk.cnvrightg

		g.append('text')
			.attr('class', 'sja_clbtext2')
			.attr('font-family', client.font)
			.attr('font-size', 14)
			.text('ADD GENE')
			.on('click', event => {
				findgene4fix_searchui(tk.tkconfigtip.clear().d, tk, block)
				tk.tkconfigtip.showunder(event.target)
			})

		if (tk.expressionrangelimit) {
			// too big to do it
			const h = 15
			let y = 20
			g.append('text').text('Zoom in').attr('y', y).attr('font-size', 12)
			y += h
			g.append('text').text('under').attr('y', y).attr('font-size', 12)
			y += h
			g.append('text').text(common.bplen(tk.expressionrangelimit)).attr('y', y).attr('font-size', 12)
			y += h
			g.append('text').text('to show').attr('y', y).attr('font-size', 12)
			y += h
			g.append('text').text('gene exp').attr('y', y).attr('font-size', 12)
			/*
			y+=h
			g.append('text').text('automatically').attr('y',y).attr('font-size',12)
			*/
		}

		return expbarwidth + xspace
	}

	// no expression track, won't draw column
	return 0
}

function addcolumn_fixedgene(fixedgene, tk, block, column_xoff) {
	/*
	 */

	// surely the coord of this fixed gene is not in cache
	if (!tk.gene2coord) tk.gene2coord = {}
	tk.gene2coord[fixedgene.gene] = {
		chr: fixedgene.chr,
		start: fixedgene.start,
		stop: fixedgene.stop
	}

	// TODO enable column-specific width config

	// hardcoded bar width for expression rank
	const expbarwidth = 80
	// hardcoded bar width for numeric attribute
	const numattrbarwidth = 80
	const xspace = 15

	// axis label
	const axispad = 0
	const labelpad = 3
	const ticksize = 5
	const fontsize = 12

	let minvalue = 0,
		maxvalue = 100 // still rank
	if (fixedgene.sample2rnabam) {
		// use fpkm instead
		maxvalue = 0
		for (const s in fixedgene.sample2rnabam) {
			maxvalue = Math.max(maxvalue, fixedgene.sample2rnabam[s].fpkm)
		}
	}

	for (const g of tk.samplegroups) {
		let y = g.y

		for (const s of g.samples) {
			const row = tk.cnvrightg.append('g').attr('transform', 'translate(' + column_xoff + ',' + y + ')')

			if (fixedgene.sample2rnabam) {
				const gene = fixedgene.sample2rnabam[s.samplename]
				if (gene) {
					drawgenebar_rnabam(expbarwidth, maxvalue, row, gene, s, tk, block)
				}
			} else {
				const v = fixedgene.sample2rank[s.samplename]
				if (v) {
					const bar = row
						.append('rect')
						.attr('fill', expressionstat.ase_color(v, tk.gecfg)) // bar color set by ase status
						.attr('width', (expbarwidth * v.rank) / maxvalue)
						.attr('height', s.height)
						.attr('shape-rendering', 'crispEdges')

					if (tk.isfull && v.estat) {
						// only show dots for outlier status in full, not dense
						if (v.estat.outlier) {
							row
								.append('circle')
								.attr('cx', expbarwidth)
								.attr('cy', s.height / 2)
								.attr('r', s.height / 2)
								.attr('fill', tk.gecfg.outlier.color_outlier)
						} else if (v.estat.outlier_asehigh) {
							row
								.append('circle')
								.attr('cx', expbarwidth)
								.attr('cy', s.height / 2)
								.attr('r', s.height / 2)
								.attr('fill', tk.gecfg.outlier.color_outlier_asehigh)
						}
					}

					const cover = row
						.append('rect')
						.attr('fill', coverbarcolor_silent)
						.attr('fill-opacity', 0.1)
						.attr('width', expbarwidth)
						.attr('height', s.height)

					if (tk.isfull) {
						s.columnbars.push(cover)
					}

					cover
						.on('mouseover', event => {
							tk.tktip.clear()

							const lst = [{ k: 'Sample', v: s.samplename }]
							may_add_sampleannotation(s.samplename, tk, lst)

							lst.push({
								k: fixedgene.gene + ' rank',
								v: client.ranksays(v.rank)
							})
							lst.push({
								k: fixedgene.gene + ' ' + tk.gecfg.datatype,
								v: v.value
							})

							const table = client.make_table_2col(tk.tktip.d, lst)

							expressionstat.showsingleitem_table(v, tk.gecfg, table)

							tk.tktip.show(event.clientX, event.clientY)

							multi_sample_addhighlight(s)
						})
						.on('mouseout', () => {
							tk.tktip.hide()
							multi_sample_removehighlight(s)
						})
						.on('click', () => {
							multi_show_geneboxplot({
								gene: fixedgene.gene,
								samplename: s.samplename,
								value: v.value,
								tk: tk,
								block: block
							})
						})
				}
			}

			// done this sample
			y += s.height + tk.rowspace
		}
		// done this group
	}

	const headg = tk.cnvrightg.append('g').attr('transform', 'translate(' + column_xoff + ',-' + axispad + ')')

	client.axisstyle({
		axis: headg.append('g').call(
			axisTop()
				.scale(scaleLinear().domain([minvalue, maxvalue]).range([0, expbarwidth]))
				.tickValues([minvalue, maxvalue])
				.tickSize(ticksize)
		),
		fontsize: fontsize,
		showline: 1
	})

	// special looking header compared to auto genes

	headg
		.append('text')
		.attr('text-anchor', 'middle')
		.attr('x', expbarwidth / 2)
		.attr('y', -(fontsize + labelpad + ticksize + axispad))
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.attr('fill', 'black')
		.attr('class', 'sja_clbtext2')
		.text(fixedgene.gene + ' rank')
		.on('click', event => {
			genebarconfig_fixed(fixedgene, tk, block)
			tk.tkconfigtip.showunder(event.target)
		})

	return expbarwidth + xspace
}

function addcolumn_attr(attr, tk, block, column_xoff) {
	// TODO enable column-specific width config

	// hardcoded bar width for expression rank
	const expbarwidth = 80
	// hardcoded bar width for numeric attribute
	const numattrbarwidth = 80
	const xspace = 15

	// axis label
	const axispad = 0
	const labelpad = 3
	const ticksize = 5
	const fontsize = 12

	for (const g of tk.samplegroups) {
		let y = g.y

		for (const s of g.samples) {
			const row = tk.cnvrightg.append('g').attr('transform', 'translate(' + column_xoff + ',' + y + ')')

			// TODO support categorical attr and detect type

			const v0 = tk.sampleAttribute.samples[s.samplename]
			if (v0) {
				const v = v0[attr.key]
				if (!Number.isNaN(v)) {
					row
						.append('rect')
						.attr('x', 0)
						.attr('width', Math.max(1, (numattrbarwidth * (v - attr.min)) / (attr.max - attr.min)))
						.attr('height', s.height)
						.attr('fill', '#858585')
						.attr('shape-rendering', 'crispEdges')
					row
						.append('rect')
						.attr('x', 0)
						.attr('width', numattrbarwidth)
						.attr('height', s.height)
						.attr('fill', '#858585')
						.attr('fill-opacity', 0.1)
					const cover = row
						.append('rect')
						.attr('fill', coverbarcolor_silent)
						.attr('fill-opacity', 0.1)
						.attr('width', numattrbarwidth)
						.attr('height', s.height)

					s.columnbars.push(cover)

					cover
						.on('mouseover', event => {
							tk.tktip.clear()

							const lst = [{ k: 'Sample', v: s.samplename }]
							may_add_sampleannotation(s.samplename, tk, lst)
							client.make_table_2col(tk.tktip.d, lst)

							tk.tktip.show(event.clientX, event.clientY)

							multi_sample_addhighlight(s)
						})
						.on('mouseout', () => {
							tk.tktip.hide()
							multi_sample_removehighlight(s)
						})
				}
			}

			// done this sample
			y += s.height + tk.rowspace
		}

		// done this group
	}

	const headg = tk.cnvrightg.append('g').attr('transform', 'translate(' + column_xoff + ',-' + axispad + ')')

	// if is numeric type
	client.axisstyle({
		axis: headg
			.append('g')
			.attr('transform', 'translate(0,0)')
			.call(
				axisTop()
					.scale(scaleLinear().domain([attr.min, attr.max]).range([0, numattrbarwidth]))
					.ticks(3)
			),
		fontsize: fontsize,
		showline: 1
	})

	const text = headg
		.append('text')
		.attr('x', numattrbarwidth / 2)
		.attr('text-anchor', 'middle')
		.attr('y', -(fontsize + labelpad + ticksize + axispad))
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.text(attr.label)

	// TODO click for menu

	return expbarwidth + xspace
}

function genebarconfig_auto(usegene, genes, tk, block) {
	/*
	for auto gene
	usegene: str
	genes:
	*/

	tk.tkconfigtip.clear()

	const holder = tk.tkconfigtip.d
	/*
	createbutton_addfeature({
		m: {
			dt: common.dtgeneexpression,
			genename: usegene,
		},
		holder: holder.append('div').style('margin-bottom','10px'),
		tk: tk,
		block: block
	})
	*/

	findgene4fix_searchui(holder, tk, block)

	if (genes.size > 1) {
		// more than one gene
		const scrollholder = holder.append('div').style('margin-bottom', '15px')
		if (genes.size > 8) {
			scrollholder
				.style('height', '200px')
				.style('padding', '15px')
				.style('overflow-y', 'scroll')
				.style('resize', 'vertical')
		}
		const id0 = Math.random().toString()
		for (const gene of genes) {
			const row = scrollholder.append('div')
			const id = Math.random().toString()
			const r = row
				.append('input')
				.attr('type', 'radio')
				.attr('id', id)
				.attr('name', id0)
				.on('change', () => {
					tk.tkconfigtip.hide()
					tk.selectedgene = gene
					render_multi_genebar(tk, block)
				})
			if (gene == usegene) r.attr('checked', 1)
			row
				.append('label')
				.attr('for', id)
				.attr('class', 'sja_clbtext')
				.html('&nbsp;' + gene)
		}
	}

	mayadd_boxplotbutton(holder, usegene, tk, block)

	if (tk.mds) {
		/*
		rnabam mode will not have .mds
		auto gene should be in tk.gene2coord
		*/
		mayadd_survivaloption(
			holder,
			{
				gene: usegene,
				chr: tk.gene2coord[usegene].chr,
				start: tk.gene2coord[usegene].start,
				stop: tk.gene2coord[usegene].stop
			},
			tk,
			block
		)
	}

	mayadd_aseohe(holder, tk, block)

	tk.tkconfigtip.showunder(event.target)
}

export function genebarconfig_fixed(fixedgene, tk, block) {
	tk.tkconfigtip.clear()

	mayadd_boxplotbutton(tk.tkconfigtip.d, fixedgene.gene, tk, block)

	mayadd_survivaloption(tk.tkconfigtip.d, fixedgene, tk, block)

	tk.tkconfigtip.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Remove')
		.on('click', () => {
			tk.tkconfigtip.hide()

			const idx = tk.gecfg.fixed.findIndex(i => i.gene == fixedgene.gene)
			if (idx == -1) {
				/*
				this gene is not found as a fixed gene
				remove function should not do anything
				this because fixed gene config is hijacked by cases
				such as when there's no mutation data for a gene in view range
				still allows to show this menu for that gene
				*/
				return
			}
			tk.gecfg.fixed.splice(idx, 1)
			render_multi_genebar(tk, block)
		})
}

function mayadd_aseohe(holder, tk, block) {
	if (!tk.gecfg || tk.gecfg.no_ase) return
	holder
		.append('div')
		.text('Customize ASE parameters')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			holder.selectAll('*').remove()
			expressionstat.ui_config(holder, tk.gecfg, tk, () => {
				tk.tkconfigtip.hide()
				multi_expressionstatus_ase_outlier(tk)
				render_multi_genebar(tk, block)
			})
		})
}

function mayadd_survivaloption(holder, gene, tk, block) {
	if (!tk.mds || !tk.mds.survivalplot) return
	holder
		.append('div')
		.text('Survival plot by ' + gene.gene + ' ' + tk.gecfg.datatype)
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			tk.tkconfigtip.hide()

			const pane = client.newpane({ x: 100, y: 100 })
			pane.header.text('Survival plot by ' + gene.gene + ' ' + tk.gecfg.datatype)
			const arg = {
				genome: block.genome,
				mds: tk.mds,
				plotlist: [
					{
						renderplot: 1,
						samplerule: {
							set: {
								geneexpression: 1,
								bymedian: 1,
								gene: gene.gene,
								chr: gene.chr,
								start: gene.start,
								stop: gene.stop
							}
						}
					}
				]
			}

			import('./mds.survivalplot').then(_ => {
				_.init(arg, pane.body, block.debugmode)
			})
		})
}

////////////// find a gene and use as fixed

function findgene4fix_searchui(holder, tk, block) {
	// for auto gene column, show
	gene_searchbox({
		div: holder,
		genome: block.genome.name,
		tip: tk.tip2,
		callback: genename => {
			findgene4fix(genename, tk, block)
		}
	})
}

async function findgene4fix(name, tk, block, norender) {
	tk.tkconfigtip.clear()

	const wait = tk.tkconfigtip.d.append('div').text('Searching for ' + name + ' ...')

	try {
		const data1 = await client.dofetch3('genelookup', { body: { genome: block.genome.name, input: name, deep: 1 } })

		if (data1.error) throw data1.error
		if (!data1.gmlst) throw '.gmlst[] missing'

		// simply use first gm for coordinate...
		const gm = data1.gmlst[0]

		wait.text('Loading ' + tk.gecfg.datatype + ' for ' + gm.name + ' ...')

		const data2 = await findgene4fix_getsamplevalue(gm, tk, block)

		if (data2.error) throw data2.error

		const fixedgene = {
			gene: name,
			chr: gm.chr,
			start: gm.start,
			stop: gm.stop
		}

		if (data2.sample2rnabam) {
			// rna bam mode
			for (const samplename in data2.sample2rnabam) {
				expressionstat.measure(data2.sample2rnabam[samplename], tk.gecfg)
			}
			fixedgene.sample2rnabam = data2.sample2rnabam
		} else {
			if (!data2.sample2rank) throw '.sample2rank{} missing'
			for (const sample in data2.sample2rank) {
				expressionstat.measure(data2.sample2rank[sample], tk.gecfg)
			}
			fixedgene.sample2rank = data2.sample2rank
		}

		tk.gecfg.fixed.push(fixedgene)

		tk.tkconfigtip.hide()

		if (norender) {
			// upon init and add genes from custom param, won't render until exp data is loaded for each pending fixed gene then render just once
		} else {
			render_multi_genebar(tk, block)
		}
	} catch (err) {
		if (err.stack) console.log(err.stack)
		wait.text('Error: ' + (err.message ? err.message : err))
	}
}

function findgene4fix_getsamplevalue(gm, tk, block) {
	const arg = {
		genome: block.genome.name,
		getexpression4gene: {
			chr: gm.chr,
			start: gm.start,
			stop: gm.stop,
			name: gm.name
		}
	}

	if (tk.iscustom) {
		arg.iscustom = 1
		const c = tk.checkexpressionrank
		if (c) {
			arg.checkexpressionrank = {
				file: c.file,
				url: c.url,
				indexURL: c.indexURL
			}
		}

		if (tk.checkvcf) {
			arg.checkvcf = tk.checkvcf.stringifiedObj
		}

		if (tk.checkrnabam) {
			rnabamtk_copyparam(tk, arg, true)
		}
	} else {
		arg.dslabel = tk.mds.label
		arg.querykey = tk.querykey
	}

	return client.dofetch('mdssvcnv', arg)
}

function genebar_printtooltip(genename, v, s, holder, tk) {
	const lst = [{ k: 'Sample', v: s.samplename }]
	may_add_sampleannotation(s.samplename, tk, lst)

	if (tk.checkrnabam) {
		lst.push({
			k: genename + ' ' + tk.gecfg.datatype,
			v: v.fpkm
		})
	} else {
		lst.push({
			k: genename + ' rank',
			v: client.ranksays(v.rank)
		})
		lst.push({
			k: genename + ' ' + tk.gecfg.datatype,
			v: v.value
		})
	}
	const table = client.make_table_2col(holder, lst)
	expressionstat.showsingleitem_table(v, tk.gecfg, table)
}

function rnabam_click_genebar(gene, sample, tk, block) {
	/*
	in rna bam mode,
	clicking on a gene bar to launch new panel
	showing the ase track of this sample at this gene,
	and gene ase snp details

	gene: obj of checkrnabam.samples[].genes[]
	sample: obj of .samplegroups[].samples[]

	*/
	const pane = client.newpane({ x: window.innerWidth / 2, y: 100 })
	pane.header.text(gene.gene + ' in ' + sample.samplename)

	const div = pane.body.append('div').style('margin', '10px 0px 20px 0px')

	if (tk.checkrnabam && tk.checkvcf) {
		const sbam = tk.checkrnabam.samples[sample.samplename]

		if (sbam) {
			const asetk = {
				type: common.tkt.ase,
				name: sample.samplename + ' ASE',
				samplename: sample.samplename,
				rnabamfile: sbam.file,
				rnabamurl: sbam.url,
				rnabamindexURL: sbam.indexURL,
				rnabamtotalreads: sbam.totalreads,
				rnabamispairedend: sbam.pairedend,
				vcffile: tk.checkvcf.file,
				vcfurl: tk.checkvcf.url,
				vcfindexURL: tk.checkvcf.indexURL
			}
			rnabamtk_copyparam(tk, asetk, false)

			const arg = {
				style: { margin: '0px' },
				tklst: [asetk],
				holder: div,
				chr: gene.chr,
				start: gene.start,
				stop: gene.stop
			}

			client.first_genetrack_tolist(block.genome, arg.tklst)

			const b = block.newblock(arg)
			if (block.debugmode) {
				window.bbb = b
			}
		} else {
			div.text('sbam missing')
		}
	} else {
		div.text('checkrnabam or checkvcf missing')
	}

	genebar_printtooltip(gene.gene, gene, sample, pane.body, tk)
}

function drawgenebar_rnabam(expbarwidth, maxvalue, row, gene, s, tk, block) {
	/*
	row: <g>
	genename: str
	gene: {}
		.gene
		.chr start stop
		.fpkm
		.estat{}
		.snps[]
	s: sample obj from .samplegroups[]

	*/
	const bar = row
		.append('rect')
		.attr('fill', expressionstat.ase_color(gene, tk.gecfg)) // bar color set by ase status
		.attr('width', (expbarwidth * gene.fpkm) / maxvalue)
		.attr('height', s.height)
		.attr('shape-rendering', 'crispEdges')
	const cover = row
		.append('rect')
		.attr('fill', coverbarcolor_silent)
		.attr('fill-opacity', 0.1)
		.attr('width', expbarwidth)
		.attr('height', s.height)

	if (tk.isfull) {
		s.columnbars.push(cover)
	}

	cover
		.on('mouseover', event => {
			tk.tktip.clear()

			genebar_printtooltip(gene.gene, gene, s, tk.tktip.d, tk)

			tk.tktip.show(event.clientX, event.clientY)

			multi_sample_addhighlight(s)
		})
		.on('mouseout', () => {
			tk.tktip.hide()
			multi_sample_removehighlight(s)
		})
		.on('click', () => {
			rnabam_click_genebar(gene, s, tk, block)
		})
}

function mayadd_boxplotbutton(holder, usegene, tk, block) {
	// dedicated button for boxplot, for non rna-bam mode
	if (tk.checkrnabam) return

	holder
		.append('div')
		.text(usegene + ' ' + tk.gecfg.datatype + ' boxplot')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			tk.tkconfigtip.hide()
			multi_show_geneboxplot({
				gene: usegene,
				tk: tk,
				block: block
			})
		})
}
