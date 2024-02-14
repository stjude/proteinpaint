import { schemeCategory10 } from 'd3-scale-chromatic'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { axisLeft, axisTop } from 'd3-axis'
import * as client from './client'
import { legend_newrow } from './block.legend'
import { select as d3select } from 'd3-selection'
import { color as d3color } from 'd3-color'
import { bigwigconfigpanel } from './block.tk.bigwig'
import { format as d3format } from 'd3-format'
import { bigwigfromtemplate } from './block.tk.bigwig'
import { dofetch3 } from '../common/dofetch'
import { Menu } from '../dom/menu'
import { make_table_2col } from '../dom/table2col'

/*

profile-gene-value track:
display all member tracks over the view range
for each gene-value track:
	query the gene-value track using the view range to get sample-gene-value pairs
	assign the sample-gene-value to member tracks, by sample name matching
	for member tracks assigned with the gene value, display a bar plot on its right
	gene-value track supports multiple types of values per gene per sample (e.g. phosphorylation sites of a protein)




.tracks[]
	a set of member tracks
	.name must be unique for each track

.genevaluetklst[]
	gene value tracks
	replaces genevaluetrack

.genevaluetrack <TK obj>
	one optional "db" track

.genevaluematchname STR
	each member track may contain a "key" for sample name matching
	if genevaluematchname is defined for the pgv track:
		its value will be used for accessing that key from member tracks
	else:
		.name of member tracks will be used
	this will allow multiple member tracks (each with different name) to map to the same sample,
	thus to be able to show the same gene value for each member track


FIXME bar plot support negative value   -5 ... 0 ... 5

*/

const genevaluexspace = 13 // x spacing between gene value tracks, when multiple
const defaultbarcolor = '#668CFF'
const defaultbarwidth = 150
const gvtkheaderyoff = -2

function makeTk(tk, block) {
	/*
	create dom components
	*/
	const template = tk._template
	delete tk._template
	if (!template.tracks) throw '.tracks[] missing from ' + tk.name + ' track'
	if (template.tracks.length == 0) throw '.tracks[] length 0 from ' + tk.name + ' track'
	tk.tracks = []
	const nameset = new Set()
	for (const t0 of template.tracks) {
		const t = {}
		for (const k in t0) {
			t[k] = t0[k]
		}
		if (!t.name) throw 'no name for member track of ' + tk.name + ': ' + JSON.stringify(t)
		if (nameset.has(t.name)) throw 'duplicating member track name: ' + t.name
		nameset.add(t.name)

		if (!t.type) throw 'no type for member track of ' + tk.name + ': ' + JSON.stringify(t)
		if (!t.file && !t.url) throw 'neither file or url given for member "' + t.name + '" of ' + tk.name

		if (t.type == 'bedj') {
			// pass
		} else if (t.type == 'bigwig') {
			bigwigfromtemplate(t, t0)
		} else {
			throw 'invalid type of member track of ' + tk.name + ': ' + t.type
		}
		t.toppad = t.toppad == undefined ? 4 : t.toppad
		t.bottompad = t.bottompad == undefined ? 4 : t.bottompad
		t.y = 0
		tk.tracks.push(t)
	}

	tk.geneset = new Set()
	// all genes in current view

	if (template.genevaluetrack) {
		// single genevalue track setting is legacy, will be unified to .genevaluetklst[] in makeTk
		if (!template.genevaluetrack.file && template.genevaluetrack.url) throw 'no .file or .url for genevaluetrack'
		tk.genevaluetrack = {
			file: template.genevaluetrack.file,
			url: template.genevaluetrack.url
		}
	}

	if (template.genevaluetklst) {
		if (!Array.isArray(template.genevaluetklst)) throw '.genevaluetklst should be an array'
		if (template.genevaluetklst.length == 0) throw 'zero length of .genevaluetklst'
		tk.genevaluetklst = []
		for (const gvtk of template.genevaluetklst) {
			if (!gvtk.name) throw 'name missing for one genevalue track'
			if (!gvtk.file && !gvtk.url) throw 'no file or url for genevalue track ' + gvtk.name
			const t = {}
			for (const k in gvtk) t[k] = gvtk[k]
			tk.genevaluetklst.push(t)
		}
	}

	if (template.bigwigsetting) {
		// common settings for bigwig member tracks
		tk.bigwigsetting = {}
		if (template.bigwigsetting.scale) {
			if (template.bigwigsetting.scale.max) {
				if (!Number.isFinite(template.bigwigsetting.scale.max)) throw 'invalid max value in bigwigsetting.scale'
				if (!Number.isFinite(template.bigwigsetting.scale.min))
					throw 'invalid or missing min value in bigwigsetting.scale'
				if (template.bigwigsetting.scale.max <= template.bigwigsetting.scale.min)
					throw 'max <= min in bigwigsetting.scale'
				tk.bigwigsetting.scale = { min: template.bigwigsetting.scale.min, max: template.bigwigsetting.scale.max }
			}
		}
		// default settings applied to member bigwig tracks
		for (const t of tk.tracks) {
			if (t.type != 'bigwig') continue
			if (tk.bigwigsetting.scale) {
				if (tk.bigwigsetting.scale.max != undefined) {
					delete t.scale.auto
					t.scale = {
						min: tk.bigwigsetting.scale.min,
						max: tk.bigwigsetting.scale.max
					}
				} else if (tk.bigwigsetting.scale.percentile) {
					delete t.scale.auto
					t.scale.percentile = tk.bigwigsetting.scale.percentile
				}
			}
			if (tk.bigwigsetting.pcolor) t.pcolor = tk.bigwigsetting.pcolor
			if (tk.bigwigsetting.ncolor) t.ncolor = tk.bigwigsetting.ncolor
			if (tk.bigwigsetting.pcolor2) t.pcolor = tk.bigwigsetting.pcolor2
			if (tk.bigwigsetting.ncolor2) t.ncolor = tk.bigwigsetting.ncolor2
		}
	}

	if (tk.genevaluetrack) {
		// old notion of single gene-value track, convert to tklst

		const gvtk = tk.genevaluetrack
		delete tk.genevaluetrack

		gvtk.name = tk.genevaluetype
		delete tk.genevaluetype
		if (tk.genevaluematchname) {
			gvtk.matchname = tk.genevaluematchname
			delete tk.genevaluematchname
		}
		if (tk.genebarcolor) {
			gvtk.barcolor = tk.genebarcolor
			delete tk.genebarcolor
		}
		if (tk.genebarwidth) {
			gvtk.barwidth = tk.genebarwidth
			delete tk.genebarwidth
		}

		if (!tk.genevaluetklst) {
			tk.genevaluetklst = []
		}
		tk.genevaluetklst.push(gvtk)
	}

	if (tk.genevaluetklst) {
		// initialize gvtk

		for (const gvtk of tk.genevaluetklst) {
			gvtk.axisg = tk.gright.append('g')
			gvtk.label = tk.gright
				.append('text')
				.attr('font-size', tk.axisfontsize + 2)
				.attr('font-family', client.font)
				.attr('class', 'sja_clbtext')
				.on('click', () => {
					gvtklabelclick(gvtk, tk, block)
				})
			if (!gvtk.barcolor) gvtk.barcolor = defaultbarcolor
			if (!gvtk.barwidth) gvtk.barwidth = defaultbarwidth
		}

		tk.toppad = tk.genevaluetklst.length == 1 ? 20 : 40

		if (tk.genevaluetklst.length == 1) {
			// just one gvtk, its label will show on left of its axis
			tk.genevaluetklst[0].label.attr('text-anchor', 'end').attr('x', -block.rpad).attr('y', gvtkheaderyoff)
		} else {
			// multiple gvtk, label of each to show on top of axis
			for (const gvtk of tk.genevaluetklst) {
				gvtk.label.attr('y', tk.axisfontsize + 2 - tk.toppad).attr('text-anchor', 'middle')
			}
		}

		tk.sample2gvtk2gene = new Map()

		tk.genelsttip = new Menu({ padding: '5px' })

		setrightwidth(tk, block)

		// has gvtk, so show config handle on left, next to tklabel
		tk.config_handle = block
			.maketklefthandle(tk, -block.labelfontsize + gvtkheaderyoff)
			.text('CONFIG')
			.attr('fill', '#858585')
			.attr('x', 5)
			.attr('text-anchor', 'begin')

		// the change gene label will only show when more than 1 gene
		tk.changegenelabel = tk.gright
			.append('text')
			.attr('text-anchor', 'end')
			.attr('font-size', tk.axisfontsize)
			.attr('font-family', client.font)
			.attr('x', -block.rpad)
			.attr('y', gvtkheaderyoff)
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				listgenes(tk.changegenelabel, tk, block)
			})

		if (tk.genevaluematchname) {
			/* possible
			tk may mix the old and new notion together
			will simply apply it to all member tracks
			*/
			for (const gvtk of tk.genevaluetklst) {
				if (!gvtk.matchname) gvtk.matchname = tk.genevaluematchname
			}
			delete tk.genevaluematchname
		}
	} else {
		// no genevalue tracks

		tk.toppad = 20
		tk.config_handle = block.maketkconfighandle(tk).attr('y', -5)
	}

	tk.config_handle.on('click', () => {
		configPanel(tk, block)
	})

	const collectleftlabw = [tk.tklabel.attr('y', -10).node().getBBox().width]

	// legend
	if (block.legend && block.legend.holder) {
		// stuff to go to legend: image, some gvtk

		let willshowlegend = false
		if (tk.legendimg && tk.legendimg.file) {
			willshowlegend = true
		} else if (tk.categories) {
			willshowlegend = true
		} else if (tk.genevaluetklst) {
			// multi-value gvtk will have legend
			willshowlegend = tk.genevaluetklst.find(i => i.multivaluekey)
		}
		if (willshowlegend) {
			const [tr, td] = legend_newrow(block, tk.name)
			tk.tr_legend = tr
			tk.td_legend = td
			tk.legendtip = new Menu({ padding: '' })
		}

		// if has image, show image, else, may show categories
		if (tk.legendimg && tk.legendimg.file) {
			block.make_legend_img(tk.legendimg, tk.td_legend)
		} else if (tk.categories) {
			// no legend image, but categories
			// so show categories
			client.category2legend(tk.categories, tk.td_legend)
		}

		if (tk.genevaluetklst) {
			// multi-value gvtk will show value types for the gene under focus
			for (const gvtk of tk.genevaluetklst) {
				if (gvtk.multivaluekey) {
					// gene-specific type values, e.g. phosphosite, may declare it explicitly in order to distinguish it from track-wise type values, e.g. categories
					gvtk.legend = {
						div: tk.td_legend.append('div'),
						gene2hiddenkeys: new Map() // gene-specific setting
					}
					gvtk.legend.label_genespecific = gvtk.legend.div
						.append('div')
						.style('display', 'inline-block')
						.style('margin', '5px 10px 10px 0px')
						.style('color', '#858585')
						.style('vertical-align', 'top')
					gvtk.legend.contentdiv = gvtk.legend.div
						.append('div')
						.style('display', 'inline-block')
						.style('margin', '0px 10px 10px 0px')
						.style('vertical-align', 'top')
						.style('width', '800px')
				}
			}
		}
	}

	// member tracks

	for (const t of tk.tracks) {
		t.g = tk.glider.append('g').attr('transform', 'translate(0,0)')
		t.errg = t.g.append('g') // cannot call block.tkerror() so add this adhoc holder to show subtk-specific err msg

		/*
		member track name label, bigwig axis, and gene value bar needs to stay stationary when the browser is panning
		but they are all attached to membertk.g and inside tk.glider
		thus need to put in a separate <g> and shift it to different direction while panning
		*/
		t.immobileg = t.g.append('g').attr('transform', 'translate(0,0)')

		// must do this
		t.tktip = tk.tktip

		t.tklabel = t.immobileg
			.append('text')
			.attr('font-size', tk.axisfontsize)
			.attr('font-family', client.font)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('x', block.tkleftlabel_xshift)
			.attr('y', 0)
			.text(t.name)
			.on('mousedown', event => {
				// drag label and reorder tracks
				event.stopPropagation()
				event.preventDefault()
				movetrack(t, tk, event.clientY)
			})

		if (t.list_description) {
			t.tklabel
				.on('mouseover', event => {
					t.tktip.clear().show(event.clientX, event.clientY)
					make_table_2col(t.tktip.d, t.list_description).style('margin', '')
				})
				.on('mouseout', () => t.tktip.hide())
		}

		collectleftlabw.push(t.tklabel.node().getBBox().width)

		if (tk.genevaluetklst) {
			t.genevg = t.immobileg.append('g') // to hold glyphs of all gvtk
			t.gvtkattr = new Map()
			for (const gvtk of tk.genevaluetklst) {
				const obj = {} // one obj per gvtk, for this member tk

				obj.gvtk_g_xshift = t.genevg.append('g') // contains all glyph from this gvtk, in case of multiple gvtks, will shift x-wise
				obj.hline = obj.gvtk_g_xshift
					.append('line')
					.attr('stroke', '#ccc')
					.attr('stroke-dasharray', '2,3')
					.attr('shape-rendering', 'crispEdges')
				obj.gvtk_g = obj.gvtk_g_xshift.append('g') // contain the actual bar or dots, won't shift

				if (gvtk.multivaluekey) {
					// no bar, multiple values of this gene in this sample will be shown as dots in t.genevg
				} else {
					obj.bar = obj.gvtk_g.append('rect').attr('width', 1)
				}
				t.gvtkattr.set(gvtk.name, obj)
			}
		}

		if (t.type == client.tkt.bedj) {
			t.img = t.g.append('image')
		} else if (t.type == client.tkt.bigwig) {
			t.img = t.g.append('image')
			t.leftaxis = t.immobileg.append('g')
		}
	}

	tk.leftLabelMaxwidth = Math.max(...collectleftlabw)
	// since pgv track is now created async, must update block left label width
	block.setllabel()
}

export async function loadTk(tk, block) {
	if (tk.uninitiated) {
		makeTk(tk, block)
		delete tk.uninitiated
	}

	block.tkcloakon(tk)

	const tasks = []
	for (const t of tk.tracks) {
		t.height = 20
		t.errg.selectAll('*').remove()

		if (t.type == client.tkt.bedj) {
			const arg = block.tkarg_bedj(t)
			if (tk.categories) {
				arg.categories = tk.categories
			}
			const task = dofetch3('tkbedj', { method: 'POST', body: JSON.stringify(arg) })
				.then(data => {
					if (data.error) throw data.error
					t.height = t.toppad + data.height + t.bottompad
					t.img.attr('width', block.width).attr('height', data.height).attr('xlink:href', data.src)
					if (block.pannedpx != undefined) {
						t.img.attr('x', block.pannedpx * -1)
					}
					block.bedj_tooltip(t, data)
				})
				.catch(e => tkerror(t, e.message || e))
			tasks.push(task)
		} else if (t.type == client.tkt.bigwig) {
			const arg = block.tkarg_q(t)
			const task = dofetch3('tkbigwig', {
				method: 'POST',
				body: JSON.stringify(arg)
			})
				.then(data => {
					if (data.error) throw data.error
					t.height = t.toppad + t.barheight + t.bottompad
					t.img.attr('width', block.width).attr('height', t.barheight).attr('xlink:href', data.src)
					if (block.pannedpx != undefined) {
						t.img.attr('x', block.pannedpx * -1)
					}
					if (data.minv != undefined) {
						t.scale.min = data.minv
					}
					if (data.maxv != undefined) {
						t.scale.max = data.maxv
					}
					t.leftaxis.selectAll('*').remove()
					if (data.nodata) {
					} else {
						const scale = scaleLinear().domain([t.scale.min, t.scale.max]).range([t.barheight, 0])
						client.axisstyle({
							axis: t.leftaxis.call(axisLeft().scale(scale).tickValues([t.scale.min, t.scale.max])),
							color: 'black',
							showline: true
						})
					}
				})
				.catch(e => tkerror(t, e.message || e))
			tasks.push(task)
		}
	}

	if (tk.genevaluetklst) {
		tk.sample2gvtk2gene.clear()
		tk.geneset.clear()

		for (const gvtk of tk.genevaluetklst) {
			const arg = block.tkarg_bedj(gvtk)
			arg.getdata = 1
			const task = dofetch3('tkbedj', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
				if (data.error) throw data.error
				if (data.items && data.items.length > 0) {
					for (const i of data.items) {
						if (!i.gene || !i.sample) continue
						tk.geneset.add(i.gene)
						if (!tk.sample2gvtk2gene.has(i.sample)) {
							tk.sample2gvtk2gene.set(i.sample, new Map())
						}
						if (!tk.sample2gvtk2gene.get(i.sample).has(gvtk.name)) {
							tk.sample2gvtk2gene.get(i.sample).set(gvtk.name, new Map())
						}
						if (gvtk.multivaluekey) {
							if (!tk.sample2gvtk2gene.get(i.sample).get(gvtk.name).has(i.gene)) {
								tk.sample2gvtk2gene.get(i.sample).get(gvtk.name).set(i.gene, [])
							}
							tk.sample2gvtk2gene.get(i.sample).get(gvtk.name).get(i.gene).push({
								name: i[gvtk.multivaluekey],
								value: i.value
							})
						} else {
							tk.sample2gvtk2gene.get(i.sample).get(gvtk.name).set(i.gene, i.value)
						}
					}
				}
			})
			tasks.push(task)
		}
	}

	try {
		await Promise.all(tasks)
		render_tk(tk, block)
		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		block.tkcloakoff(tk, { error: e.message || e })
	}

	for (const t of tk.tracks) {
		t.immobileg.attr('transform', 'translate(0,0)')
	}

	block.block_setheight()
}

function render_tk(tk, block) {
	tk.height_main = 0
	for (const t of tk.tracks) {
		t.y = tk.height_main
		t.g.transition().attr('transform', 'translate(0,' + t.y + ')')
		if (t.type == client.tkt.bedj) {
			t.img.attr('x', 0)
			t.tklabel.attr('y', (t.height - t.toppad - t.bottompad) / 2)
		} else if (t.type == client.tkt.bigwig) {
			t.img.attr('x', 0)
			t.tklabel.attr('y', t.barheight / 2)
		}
		tk.height_main += t.height
	}
	tk.height_main += tk.toppad + tk.bottompad // height is set

	if (tk.genevaluetklst) {
		if (tk.geneset.size > 0) {
			// one or more genes with value in view range
			const showgene = [...tk.geneset][0] // use first gene TODO should try to use the gene that takes most of view range
			showgeneplot(tk, block, showgene)
		} else {
			// no genes
			for (const gvtk of tk.genevaluetklst) {
				gvtk.label.text('')
			}
			// fold gene bars
			for (const t of tk.tracks) {
				for (const v of t.gvtkattr.values()) {
					v.hline.transition().attr('x2', 0)
					if (v.bar) {
						v.bar.transition().attr('width', 0)
					} else {
						v.gvtk_g.selectAll('*').remove()
					}
				}
			}
			for (const gvtk of tk.genevaluetklst) {
				gvtk.axisg.selectAll('*').remove()
			}
		}
	}
}

function showgeneplot(tk, block, gene) {
	/*
	bar plot or dot plot
	call this when setting a gene for the track
	may allow different genes for different gvtk?
	*/

	tk.__usegene = gene

	let xoff = 0 // cumulative bar width for gvtk

	for (const gvtk of tk.genevaluetklst) {
		let minv = 0 // FIXME barplot negative value
		let maxv = 0

		// what attr to use for sample name matching
		const samplekey = gvtk.matchname || 'name'

		let colorvend
		if (gvtk.multivaluekey) {
			/* for multi-value gvtk, keys are gene-specific, e.g. phosphorylation sites
			need to collect all keys for this gene, and assign color

			TODO if the keys are predefined and universal for all genes, then no need to collect
			*/
			gvtk.runtimekey2color_genespecific = new Map()
			colorvend = scaleOrdinal(schemeCategory10)
		}

		for (const t of tk.tracks) {
			t.gvtkattr.get(gvtk.name).value = undefined

			const samplename = t[samplekey]
			if (!tk.sample2gvtk2gene.has(samplename)) {
				// this sample not found
				continue
			}
			if (!tk.sample2gvtk2gene.get(samplename).has(gvtk.name)) {
				// sample not found in this gvtk
				continue
			}
			const genev = tk.sample2gvtk2gene.get(samplename).get(gvtk.name).get(gene)
			if (genev == undefined) continue
			t.gvtkattr.get(gvtk.name).value = genev

			if (gvtk.multivaluekey) {
				// multi-value
				for (const v of genev) {
					if (!v.name) {
						// no name of the key in this value??
						continue
					}
					if (!gvtk.runtimekey2color_genespecific.has(v.name)) {
						gvtk.runtimekey2color_genespecific.set(v.name, colorvend(v.name))
					}
					maxv = Math.max(maxv, v.value)
				}
			} else {
				// single-value
				maxv = Math.max(maxv, genev)
			}
		}

		// min/max range of this gvtk are defined over all member tracks, ready to render

		for (const t of tk.tracks) {
			t.genevg.attr('transform', 'translate(' + (block.width + block.rpad) + ',0)')

			const obj = t.gvtkattr.get(gvtk.name)
			/*
			obj.gvtk_g and holders
			if single value: obj.value is float, and obj.bar
			else: obj.value is [ {name, value} ]
			*/

			const glyph_midy = (t.height - t.toppad - t.bottompad) / 2

			obj.gvtk_g_xshift.transition().attr('transform', 'translate(' + xoff + ',0)')
			obj.hline
				.transition()
				.attr('y1', glyph_midy)
				.attr('y2', glyph_midy)
				.attr('x2', obj.value == undefined ? 0 : gvtk.barwidth)

			if (gvtk.multivaluekey) {
				obj.gvtk_g.selectAll('*').remove()
				if (obj.value) {
					// making dots
					const radius = Math.min(8, glyph_midy)

					// may apply gene-specific type filtering
					let showlst = obj.value
					if (gvtk.legend.gene2hiddenkeys.has(tk.__usegene)) {
						showlst = obj.value.filter(i => !gvtk.legend.gene2hiddenkeys.get(tk.__usegene).has(i.name))
					}

					// register dot selection for highlighting purpose
					obj.dotg = obj.gvtk_g
						.selectAll()
						.data(showlst)
						.enter()
						.append('g')
						.attr('transform', d => 'translate(' + (gvtk.barwidth * d.value) / maxv + ',' + glyph_midy + ')')
					obj.dotg
						.append('circle')
						.attr('r', radius)
						.attr('fill', d => gvtk.runtimekey2color_genespecific.get(d.name))
						.attr('fill-opacity', 0.2)
						.attr('stroke', d => gvtk.runtimekey2color_genespecific.get(d.name))
						.on('mouseover', (event, d) => {
							const valuekeyname = d.name
							// highlight this value key in all member tracks
							for (const t of tk.tracks) {
								const obj = t.gvtkattr.get(gvtk.name)
								if (!obj.dotg) continue
								obj.dotg
									.filter(d => d.name == valuekeyname)
									.select('circle')
									.attr('fill-opacity', 1)
							}
							const p = event.target.getBoundingClientRect()
							tk.tktip.clear().show(p.left, p.top)
							const lst = [
								{ k: 'sample', v: t.name },
								{ k: gvtk.multivaluekey, v: d.name },
								{ k: 'value', v: d.value }
							]
							setTimeout(make_table_2col(tk.tktip.d, lst), 500)
						})
						.on('mouseout', (event, d) => {
							const valuekeyname = d.name
							// de-highlight
							for (const t of tk.tracks) {
								const obj = t.gvtkattr.get(gvtk.name)
								if (!obj.dotg) continue
								obj.dotg
									.filter(d => d.name == valuekeyname)
									.select('circle')
									.attr('fill-opacity', 0.2)
							}
							tk.tktip.hide()
						})
				}
			} else {
				// single value
				if (!Number.isFinite(obj.value) || obj.value == 0) {
					obj.bar.transition().attr('width', 0)
				} else {
					obj.bar
						.attr('fill', gvtk.barcolor)
						.attr('height', t.height - t.toppad - t.bottompad)
						.transition()
						.attr('width', Math.max(1, (gvtk.barwidth * obj.value) / maxv))
				}
			}
		}

		if (tk.genevaluetklst.length > 1) {
			// gvtk.label shown on top of axis, reposition in case width changed
			gvtk.label.transition().attr('x', xoff + gvtk.barwidth / 2)
		}
		gvtk.label.text(gene + ' ' + gvtk.name)

		{
			const axis = axisTop()
				.ticks(3)
				.scale(scaleLinear().domain([minv, maxv]).range([0, gvtk.barwidth]))
			if (gvtk.axistickformat) {
				axis.tickFormat(d3format(gvtk.axistickformat))
			}
			client.axisstyle({
				axis: gvtk.axisg
					.transition()
					.attr('transform', 'translate(' + xoff + ',' + gvtkheaderyoff + ')')
					.call(axis),
				color: 'black',
				showline: true
			})
		}

		xoff += gvtk.barwidth + genevaluexspace
	}
	if (tk.geneset.size == 1) {
		tk.changegenelabel.text('')
	} else {
		tk.changegenelabel.text('CHANGE GENE')
		if (tk.genevaluetklst.length == 1) {
			// only one gvtk, gvtk.label shown on left of axis, and change gene label shown on left of it
			const w = tk.genevaluetklst[0].label.node().getBBox().width
			tk.changegenelabel.attr('x', -block.rpad - w - 10)
		}
	}
	showlegend_gvtk(tk, block)
}

function showlegend_gvtk(tk, block) {
	// for gvtk with multi-value, show value type/color in legend
	if (!tk.genevaluetklst || !tk.tr_legend) return
	for (const gvtk of tk.genevaluetklst) {
		if (gvtk.runtimekey2color_genespecific) {
			// gene-specific types

			gvtk.legend.label_genespecific.text(tk.__usegene + ' ' + gvtk.name + ' ' + gvtk.multivaluekey)
			gvtk.legend.contentdiv.selectAll('*').remove()
			const lst = []
			for (const [name, color] of gvtk.runtimekey2color_genespecific.entries()) {
				lst.push({ name: name, color: color })
			}
			if (gvtk.sitekeytrickysort) {
				// hardcoded for sorting phosphosite
				lst.sort((a, b) => Number.parseInt(a.name.substr(1)) - Number.parseInt(b.name.substr(1)))
			}
			for (const { name, color } of lst) {
				const cell = gvtk.legend.contentdiv
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_clb')
					.on('click', () => {
						tk.legendtip.clear().showunder(cell.node())
						if (
							gvtk.legend.gene2hiddenkeys.has(tk.__usegene) &&
							gvtk.legend.gene2hiddenkeys.get(tk.__usegene).has(name)
						) {
							// hidden
							tk.legendtip.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Show')
								.on('click', () => {
									tk.legendtip.hide()
									gvtk.legend.gene2hiddenkeys.get(tk.__usegene).delete(name)
									showgeneplot(tk, block, tk.__usegene)
								})
						} else {
							// shown
							tk.legendtip.d
								.append('div')
								.attr('class', 'sja_menuoption')
								.text('Hide')
								.on('click', () => {
									tk.legendtip.hide()
									if (!gvtk.legend.gene2hiddenkeys.has(tk.__usegene))
										gvtk.legend.gene2hiddenkeys.set(tk.__usegene, new Set())
									gvtk.legend.gene2hiddenkeys.get(tk.__usegene).add(name)
									showgeneplot(tk, block, tk.__usegene)
								})
						}
						tk.legendtip.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.text('Show only')
							.on('click', () => {
								tk.legendtip.hide()
								if (!gvtk.legend.gene2hiddenkeys.has(tk.__usegene))
									gvtk.legend.gene2hiddenkeys.set(tk.__usegene, new Set())
								gvtk.legend.gene2hiddenkeys.get(tk.__usegene).clear()
								for (const name2 of gvtk.runtimekey2color_genespecific.keys()) {
									if (name2 != name) gvtk.legend.gene2hiddenkeys.get(tk.__usegene).add(name2)
								}
								showgeneplot(tk, block, tk.__usegene)
							})
						tk.legendtip.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.text('Show all')
							.on('click', () => {
								tk.legendtip.hide()
								if (!gvtk.legend.gene2hiddenkeys.has(tk.__usegene)) return
								gvtk.legend.gene2hiddenkeys.get(tk.__usegene).clear()
								showgeneplot(tk, block, tk.__usegene)
							})
					})
				if (gvtk.legend.gene2hiddenkeys.has(tk.__usegene) && gvtk.legend.gene2hiddenkeys.get(tk.__usegene).has(name)) {
					// this type name is hidden, do not show color dot
					cell.append('span').style('color', '#858585').style('text-decoration', 'line-through').text(name)
				} else {
					// this type is not hidden
					cell
						.append('span')
						.attr('class', 'sja_mcdot')
						.style('background-color', color)
						.style('margin-left', '3px')
						.html('&nbsp;&nbsp;')
					cell.append('span').text(name)
				}
			}
		}
	}
}

function listgenes(label, tk, block) {
	tk.tkconfigtip.clear().showunder(label.node())

	const name = Math.random().toString()

	for (const gene of tk.geneset) {
		const row = tk.tkconfigtip.d.append('div').style('padding-bottom', '3px')
		const id = Math.random().toString()
		const radio = row
			.append('input')
			.attr('type', 'radio')
			.attr('id', id)
			.attr('name', name)
			.on('change', () => {
				showgeneplot(tk, block, gene)
			})
		if (gene == tk.__usegene) {
			radio.attr('checked', 1)
		}
		row
			.append('label')
			.attr('for', id)
			.html('&nbsp;' + gene)
	}
}

function samplegenematrix(tk, block) {
	// not in use

	tk.genelsttip.clear()
	tk.genelsttip.d
		.append('div')
		.style('margin', '5px')
		.style('color', '#858585')
		.style('font-size', '.7em')
		.text('Click on a gene to select')
	const genelst = [...tk.geneset]
	const showcount = genelst.length > 20 ? 15 : genelst.length
	if (showcount < genelst.length) {
		tk.genelsttip.d
			.append('div')
			.style('margin', '5px')
			.style('color', '#858585')
			.style('font-size', '.7em')
			.text('Showing ' + showcount + ' genes at maximum')
	}
	let maxvalue = 0
	const samplekey = tk.genevaluematchname || 'name'
	for (const t of tk.tracks) {
		const samplename = t[samplekey]
		if (tk.sample2gene.has(samplename)) {
			for (let i = 0; i < showcount; i++) {
				const v = tk.sample2gene.get(samplename).get(genelst[i])
				if (v != undefined) {
					maxvalue = Math.max(maxvalue, v)
				}
			}
		}
	}
	const table = tk.genelsttip.d.append('table')
	const tr = table.append('tr')
	tr.append('td')
	const columnwidth = '25px'
	let maxnamelen = 0
	for (let i = 0; i < showcount; i++) {
		const gene = genelst[i]
		maxnamelen = Math.max(maxnamelen, gene.length)
		const box = tr
			.append('td')
			.append('div')
			.text(gene)
			.style('font-family', 'Courier')
			.style('font-weight', 'bold')
			.attr('class', 'sja_clbtext')
			.style('transform', 'rotate(-90deg)')
			.style('width', columnwidth)
			.style('white-space', 'nowrap')
			.on('click', () => {
				showgeneplot(tk, block, gene)
				tk.genelsttip.hide()
			})
	}

	table.style('margin-top', maxnamelen * 8 + 'px')

	const color = d3color(tk.genebarcolor)

	for (const t of tk.tracks) {
		const samplename = t[samplekey]

		const tr = table.append('tr')
		tr.append('td').text(samplename)
		for (let i = 0; i < showcount; i++) {
			const td = tr.append('td').style('width', columnwidth)
			if (!tk.sample2gene.has(samplename)) {
				continue
			}
			const v = tk.sample2gene.get(samplename).get(genelst[i])
			if (v == undefined) {
				continue
			}
			td.style('background-color', 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + v / maxvalue + ')')
			if (v >= maxvalue) {
				td.style('color', 'white').style('font-size', '.7em').style('text-align', 'center').text(Math.ceil(v))
			}
		}
	}
	tk.genelsttip.showunder(tk.genevaluelabel.node())
}

function movetrack(t, tk, y0) {
	/*
	moving member tracks require matching tracks by .name
	*/
	const body = d3select(document.body)
	body.on('mousemove', event => {
		const dy = event.clientY - y0
		t.g.attr('transform', 'translate(0,' + (t.y + dy) + ')')
		let tkidx = 0
		for (let i = 0; i < tk.tracks.length; i++) {
			if (tk.tracks[i].name == t.name) {
				tkidx = i
				break
			}
		}
		if (dy < 0 && tkidx > 0) {
			let t2idx = tkidx - 1,
				t2 = tk.tracks[t2idx]
			while (t2.hidden) {
				t2idx--
				if (t2idx < 0) {
					return
				}
				t2 = tk.tracks[t2idx]
			}
			if (!t2) {
				return
			}
			if (-dy >= t2.height) {
				tk.tracks[t2idx] = t
				tk.tracks[tkidx] = t2
				t.y = t2.y
				t2.y += t.height
				t2.g.transition().attr('transform', 'translate(0,' + t2.y + ')')
				y0 = event.clientY
			}
		} else if (dy > 0 && tkidx < tk.tracks.length - 1) {
			let t2idx = tkidx + 1,
				t2 = tk.tracks[t2idx]
			while (t2.hidden) {
				t2idx++
				if (t2idx >= tk.tracks.length) {
					return
				}
				t2 = tk.tracks[t2idx]
			}
			if (!t2) {
				return
			}
			if (dy >= t2.height) {
				// swap
				tk.tracks[t2idx] = t
				tk.tracks[tkidx] = t2
				t2.y = t.y
				t.y += t2.height
				t2.g.transition().attr('transform', 'translate(0,' + t2.y + ')')
				y0 = event.clientY
			}
		}
	})
	body.on('mouseup', () => {
		t.g.transition().attr('transform', 'translate(0,' + t.y + ')')
		body.on('mousemove', null).on('mouseup', null)
	})
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())

	const d = tk.tkconfigtip.d

	// any bigwig tracks
	{
		const hasbw = tk.tracks.find(t => t.type == client.tkt.bigwig)
		if (hasbw) {
			// common bigwig setting
			d.append('div')
				.append('div')
				.style('margin-bottom', '15px')
				.style('display', 'inline-block')
				.attr('class', 'sja_menuoption')
				.text('Common settings for all bigWig member tracks')
				.on('click', () => {
					configPanel_bwcommon(tk, block)
				})
		}
	}

	configPanel_uniformheight(d, tk, block)

	configPanel_tkheights(d, tk, block)

	d.append('div')
		.style('margin-top', '5px')
		.style('color', '#858585')
		.text('To reorder member tracks, drag on track name on the left of track display.')
}

function setrightwidth(tk, block) {
	tk.rightheadw_tk = 30

	if (tk.genevaluetklst) {
		for (const t of tk.genevaluetklst) {
			tk.rightheadw_tk += t.barwidth
		}
		tk.rightheadw_tk += genevaluexspace * (tk.genevaluetklst.length - 1)
	}

	block.rightheadw = 0
	for (const t of block.tklst) {
		block.rightheadw = Math.max(block.rightheadw, t.rightheadw_tk)
	}

	block.blocksetw()
}

function configPanel_bwcommon(tk, block) {
	// common setting on bw tracks
	tk.tkconfigtip.clear()

	const mock = {
		scale: { auto: 1 },
		normalize: { disable: 1 }
	}

	if (tk.bigwigsetting) {
		for (const k in tk.bigwigsetting) {
			mock[k] = tk.bigwigsetting[k]
		}
		if (tk.bigwigsetting.scale) {
			delete mock.scale.auto
			for (const k in tk.bigwigsetting.scale) mock.scale[k] = tk.bigwigsetting.scale[k]
		}
	}
	// fill up missing things by setting of first bw track
	{
		const t1 = tk.tracks.find(t => t.type == client.tkt.bigwig)
		if (!mock.pcolor) mock.pcolor = t1.pcolor
		if (!mock.pcolor2) mock.pcolor2 = t1.pcolor2
		if (!mock.ncolor) mock.ncolor = t1.ncolor
		if (!mock.ncolor2) mock.ncolor2 = t1.ncolor2
		if (!mock.barheight) mock.barheight = t1.barheight
	}

	bigwigconfigpanel(mock, block, tk.tkconfigtip.d, code => {
		if (!tk.bigwigsetting) tk.bigwigsetting = {}
		if (!tk.bigwigsetting.scale) tk.bigwigsetting.scale = {}

		switch (code) {
			case client.bwSetting.height:
				tk.bigwigsetting.barheight = mock.barheight
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.barheight = mock.barheight
				})
				break
			case client.bwSetting.pcolor:
				tk.bigwigsetting.pcolor = mock.pcolor
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.pcolor = mock.pcolor
				})
				break
			case client.bwSetting.ncolor:
				tk.bigwigsetting.ncolor = mock.ncolor
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.ncolor = mock.ncolor
				})
				break
			case client.bwSetting.pcolor2:
				tk.bigwigsetting.pcolor2 = mock.pcolor2
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.pcolor2 = mock.pcolor2
				})
				break
			case client.bwSetting.ncolor2:
				tk.bigwigsetting.ncolor2 = mock.ncolor2
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.ncolor2 = mock.ncolor2
				})
				break
			case client.bwSetting.autoscale:
				tk.bigwigsetting.scale.auto = 1
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.scale.auto = 1
				})
				break
			case client.bwSetting.fixedscale:
				delete tk.bigwigsetting.scale.auto
				tk.bigwigsetting.scale.min = mock.scale.min
				tk.bigwigsetting.scale.max = mock.scale.max
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) {
						delete t.scale.auto
						t.scale.min = mock.scale.min
						t.scale.max = mock.scale.max
					}
				})
				break
			case client.bwSetting.percentilescale:
				delete tk.bigwigsetting.scale.auto
				tk.bigwigsetting.scale.percentile = mock.scale.percentile
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) {
						delete t.scale.auto
						t.scale.percentile = mock.scale.percentile
					}
				})
				break
			case client.bwSetting.nodotplot:
				delete tk.bigwigsetting.dotplotfactor
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) delete t.dotplotfactor
				})
				break
			case client.bwSetting.usedotplot:
				tk.bigwigsetting.dotplotfactor = mock.dotplotfactor
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.dotplotfactor = mock.dotplotfactor
				})
				break
			case client.bwSetting.usedividefactor:
				delete tk.bigwigsetting.normalize.disable
				tk.bigwigsetting.normalize.dividefactor = mock.normalize.dividefactor
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) {
						delete t.normalize.disable
						t.normalize.dividefactor = mock.normalize.dividefactor
					}
				})
				break
			case client.bwSetting.nodividefactor:
				tk.bigwigsetting.normalize.disable = 1
				tk.tracks.forEach(t => {
					if (t.type == client.tkt.bigwig) t.normalize.disable = 1
				})
				break
		}
		loadTk(tk, block)
	})
}

function configPanel_uniformheight(d, tk, block) {
	const row = d.append('div').style('margin-bottom', '10px')
	row.append('span').style('color', '#858585').html('Set uniform height to all member tracks&nbsp;')
	let maxheight = 0
	for (const t of tk.tracks) {
		switch (t.type) {
			case client.tkt.bigwig:
				maxheight = Math.max(maxheight, t.barheight)
				break
			case client.tkt.bedj:
				maxheight = Math.max(maxheight, t.stackheight)
				break
		}
	}
	row
		.append('input')
		.attr('type', 'number')
		.property('value', maxheight)
		.attr('min', 5)
		.style('width', '80px')
		.on('keyup', event => {
			if (event.code != 'Enter') return
			const v = Number.parseInt(event.target.value)
			for (const t of tk.tracks) {
				switch (t.type) {
					case client.tkt.bigwig:
						t.barheight = v
						break
					case client.tkt.bedj:
						t.stackheight = v
						break
				}
			}
			block.tk_load(tk)
		})
}

function configPanel_tkheights(d, tk, block) {
	d.append('div').style('margin-bottom', '5px').style('color', '#858585').text('Set height for each track:')
	let scrollholder = d
	if (tk.tracks.length > 8) {
		scrollholder = d
			.append('div')
			.style('display', 'inline-block')
			.style('height', '200px')
			.style('resize', 'vertical')
			.style('overflow-y', 'scroll')
	}
	const table = scrollholder.append('table').style('margin-left', '20px')
	for (const t of tk.tracks) {
		const tr = table.append('tr')
		tr.append('td').text(t.name).style('vertical-align', 'top')
		const td = tr.append('td')
		let v
		switch (t.type) {
			case client.tkt.bigwig:
				v = t.barheight
				break
			case client.tkt.bedj:
				v = t.stackheight
				break
		}
		td.append('input')
			.attr('type', 'number')
			.property('value', v)
			.attr('min', 5)
			.style('width', '80px')
			.on('keyup', event => {
				if (event.code != 'Enter') return
				const v = Number.parseInt(event.target.value)
				switch (t.type) {
					case client.tkt.bigwig:
						t.barheight = v
						break
					case client.tkt.bedj:
						t.stackheight = v
						break
				}
				block.tk_load(tk)
			})
	}
}

function gvtklabelclick(gvtk, tk, block) {
	/*
	show menu for a gvtk
	config
	*/
	tk.tkconfigtip.clear().showunder(gvtk.label.node())
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '10px').style('color', '#858585')
		row.append('span').text(gvtk.name)
		row.append('span').html('&nbsp;CONFIG').style('font-size', '.7em')
	}

	const table = tk.tkconfigtip.d.append('table')
	// bar width
	{
		const tr = table.append('tr')
		tr.append('td').text('Max bar width')
		tr.append('td')
			.append('input')
			.attr('type', 'number')
			.property('value', gvtk.barwidth)
			.attr('min', 50)
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				const w = Number.parseInt(event.target.value)
				if (Number.isNaN(w) || w < 50) return
				gvtk.barwidth = w
				setrightwidth(tk, block)
				showgeneplot(tk, block, tk.__usegene)
			})
	}
	if (!gvtk.multivaluekey) {
		// single value, show bar color
		const tr = table.append('tr')
		tr.append('td').text('Bar color')
		tr.append('td')
			.append('input')
			.attr('type', 'color')
			.property('value', gvtk.barcolor)
			.on('change', event => {
				gvtk.barcolor = event.target.value
				if (gvtk.multivaluekey) {
					// do not set?
				} else {
					for (const t of tk.tracks) {
						t.gvtkattr.get(gvtk.name).bar.attr('fill', gvtk.barcolor)
					}
				}
			})

		// sort function; only for single value for now
		table
			.append('tr')
			.append('td')
			.attr('colspan', 2)
			.append('button')
			.text('Sort samples')
			.on('click', () => {
				tk.tracks.sort((a, b) => {
					const va = a.gvtkattr.get(gvtk.name).value
					const vb = b.gvtkattr.get(gvtk.name).value
					if (vb == undefined) {
						if (va == undefined) return 0
						return -1
					}
					if (va == undefined) return 1
					return vb - va
				})
				/* poor fix
				after having changed gene, then sort tracks on the new gene,
				calling render_tk() will cause the tk.__usegene to change to first gene in tk.geneset
				so must record current gene
				and call render_tk() again to revert the change
				*/
				const currentgene = tk.__usegene
				render_tk(tk, block)
				showgeneplot(tk, block, currentgene)
				tk.tkconfigtip.hide()
			})
	}

	if (gvtk.multivaluekey) {
		// to show sample by value type matrix?
	}
}

function tkerror(t, msg) {
	// show err on subtk
	t.errg.append('text').text(msg).attr('font-size', 12).attr('y', 14)
}
