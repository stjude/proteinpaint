import { select as d3select } from 'd3-selection'
import {
	itemtable,
	runtimeattr_sv,
	runtimeattr_itd,
	runtimeattr_del,
	runtimeattr_trunc,
	runtimeattr_snvindel
} from './block.ds.itemtable'
import * as client from './client'
import * as common from '#shared/common.js'
import may_sunburst from './block.sunburst'
import { stratinput } from '#shared/tree.js'
import { stratify } from 'd3-hierarchy'
import * as blockds from './block.ds'
import { legend_newrow } from './block.legend'
import { dstkrender } from './block.ds'

/*
create tk labels
legend that belongs to this tk, contains options

************************ EXPORTED

dsmaketk()



************************ INTERNAL

label_mcount_fillpane()
label_strat_fillpane()

mlstfilter() 

ctrlui_populationfrequency
ctrlui_vcfinfofilter
ctrlui_sampleattribute


*/

const hotcolor = '#FFE5E5'

export default function dsmaketk(tk, block) {
	/*
	make:
	svg holders
	left labels and controllers, and menu
	legend

	*/

	tk.labyspace = 5 // must kept with tk: will be used by ds.numericmode

	tk.leftaxis = tk.gleft.append('g')

	if (!tk.itemlabelname) {
		tk.itemlabelname = 'mutation'
	}

	let laby = tk.labyspace + block.labelfontsize

	// controller - # mutations
	const thistip = new client.Menu({ padding: 'none' })
	tk.label_mcount = block.maketklefthandle(tk, laby).on('click', () => {
		label_mcount_fillpane(tk, block, tk.label_mcount, thistip)
	})

	laby += tk.labyspace + block.labelfontsize

	// assume that stratify directives are available at time of making tk
	if (tk.ds.stratify) {
		tk.label_stratify = []
		const thistip = new client.Menu()
		for (const s of tk.ds.stratify) {
			const strat = JSON.parse(JSON.stringify(s))
			tk.label_stratify.push(strat)

			strat.svglabel = block.maketklefthandle(tk, laby).on('click', () => {
				label_strat_fillpane(tk, block, strat, thistip)
			})

			laby += tk.labyspace + block.labelfontsize
		}
	}

	if (tk.ds.iscustom) {
		// close button for all custom, no matter if official.children or not
		// register the label, when making svg will hide this label
		tk.label_close = block
			.maketklefthandle(tk, laby)
			.text('Close')
			.on('mousedown', event => {
				event.stopPropagation()
				event.preventDefault()
			})
			.on('click', () => {
				block.deletecustomdsbyname(tk.ds.label)
			})
		laby += tk.labyspace + block.labelfontsize
	}

	block.setllabel(tk)

	// attributes from official ds, move to tk level
	if (tk.ds.vcfinfofilter) {
		tk.vcfinfofilter = tk.ds.vcfinfofilter
	}
	if (tk.ds.info2table) {
		tk.info2table = tk.ds.info2table
	}
	if (tk.ds.info2singletable) {
		tk.info2singletable = tk.ds.info2singletable
	}
	if (tk.ds.itemlabelname) {
		tk.itemlabelname = tk.ds.itemlabelname
	}
	if (tk.ds.url4variant) {
		tk.url4variant = tk.ds.url4variant
	}

	if (block.legend && block.legend.holder) {
		/*
		may make legend given following conditions
		*/

		let showlegend = false
		if (tk.populationfrequencyfilter) {
			showlegend = true
		}
		if (tk.vcfinfofilter) {
			showlegend = true
		}
		if (tk.ds.cohort && tk.ds.cohort.sampleattribute) {
			showlegend = true
		}

		if (showlegend) {
			const [tr, td] = legend_newrow(block, tk.name)
			tk.tr_legend = tr
			tk.td_legend = td

			if (tk.vcfinfofilter) {
				const err = ctrlui_vcfinfofilter(tk, block)
				if (err) {
					delete tk.vcfinfofilter
					block.error(tk.name + ': ' + err)
				}
				const row = td.append('div').style('margin', '10px').style('display', 'none')
				tk.genotype2color = {
					rr: '#ccc',
					ra: 'blue',
					aa: 'red',
					legend: row
				}
				row.append('span').text('Genotype').style('color', '#858585')
				let s = row.append('span').style('padding-left', '10px')
				s.append('div').style('display', 'inline-block').style('background', tk.genotype2color.rr).html('&nbsp;&nbsp;')
				s.append('span').html('&nbsp;Ref/Ref')
				s = row.append('span').style('padding-left', '10px')
				s.append('div').style('display', 'inline-block').style('background', tk.genotype2color.ra).html('&nbsp;&nbsp;')
				s.append('span').html('&nbsp;Ref/Alt')
				s = row.append('span').style('padding-left', '10px')
				s.append('div').style('display', 'inline-block').style('background', tk.genotype2color.aa).html('&nbsp;&nbsp;')
				s.append('span').html('&nbsp;Alt/Alt')
			}

			if (tk.populationfrequencyfilter) {
				const err = ctrlui_populationfrequency(tk, block)
				if (err) {
					delete tk.populationfrequencyfilter
					block.error(tk.name + ': ' + err)
				}
			}

			if (tk.ds.cohort && tk.ds.cohort.sampleattribute) {
				const err = ctrlui_sampleattribute(tk, block)
				if (err) {
					delete tk.ds.cohort.sampleattribute
					block.error(tk.name + ': ' + err)
				}
			}
		}
	}
}

function mlstfilter(tk, block) {
	const lst = []
	for (const m of tk.mlst) {
		if (block.legend) {
			if (block.legend.mclasses.has(m.class) && block.legend.mclasses.get(m.class).hidden) continue
			if (block.legend.morigins.has(m.origin) && block.legend.morigins.get(m.origin).hidden) continue
		}
		lst.push(m)
	}
	return lst
}

function downloadmlst(tk, block) {
	const mlst = mlstfilter(tk, block)
	const exported = []
	if (tk.ds.id2vcf) {
		// is vcf file(s)
		const txt = []
		for (const vcfid in tk.ds.id2vcf) {
			const lst2 = []
			for (const m of mlst) {
				if (m.vcfid == vcfid) lst2.push(m)
			}
			if (lst2.length == 0) continue
			const vcf = tk.ds.id2vcf[vcfid]
			txt.push('CHROM\tPOS\tREF\tALT\tINFO-locus\tINFO-altAllele\tclass\tname')
			for (const m of lst2) {
				const info = []
				if (m.info) {
					for (const k in m.info) info.push(k + '=' + m.info[k])
				}
				const altinfo = []
				if (m.altinfo) {
					for (const k in m.altinfo) altinfo.push(k + '=' + m.altinfo[k])
				}
				txt.push(
					`${m.chr}\t${m.pos}\t${m.ref}\t${m.alt}\t${info.join(';')}\t${altinfo.join(';')}\t${
						common.mclass[m.class].label
					}\t${m.mname}`
				)
			}
		}
		exported.push({ text: txt.join('\n') })
	} else {
		// regular ds
		const dt2lst = new Map()
		for (const m of mlst) {
			if (!dt2lst.has(m.dt)) {
				dt2lst.set(m.dt, [])
			}
			dt2lst.get(m.dt).push(m)
		}
		for (const [dt, mlst2] of dt2lst) {
			let atlst = null
			switch (dt) {
				case common.dtsnvindel:
					if (!tk.snvindelattr) {
						runtimeattr_snvindel(tk, mlst2)
					}
					atlst = tk.snvindelattr
					break
				case common.dtsv:
				case common.dtfusionrna:
					if (!tk.svattr) {
						runtimeattr_sv(tk, mlst2)
					}
					atlst = tk.svattr
					break
				case common.dtitd:
					if (!tk.itdattr) {
						runtimeattr_itd(tk, mlst2)
					}
					atlst = tk.itdattr
					break
				case common.dtnloss:
				case common.dtcloss:
					if (!tk.truncattr) {
						runtimeattr_trunc(tk, mlst2)
					}
					atlst = tk.truncattr
					break
				case common.dtdel:
					if (!tk.delattr) {
						runtimeattr_del(tk, mlst2)
					}
					atlst = tk.delattr
					break
				case common.dtcnv:
					break
			}
			if (!atlst) {
				continue
			}
			const head = []
			for (const a of atlst) {
				if (a.lst) {
					for (const b of a.lst) {
						if (b.ismaf) {
							head.push(b.label + ' mutant allele fraction')
						} else {
							head.push(b.label)
						}
					}
				} else {
					if (a.ismaf) {
						head.push(a.label + ' mutant allele fraction')
					} else {
						head.push(a.label)
					}
				}
			}
			const content = [head.join('\t')]
			for (const m of mlst2) {
				const lst = []
				for (const a of atlst) {
					if (a.lst) {
						for (const b of a.lst) {
							if (b.ismaf) {
								const v = b.get(m)
								if (v && Number.isFinite(v.f)) {
									lst.push(v.f.toFixed(2))
								} else {
									lst.push('n/a')
								}
							} else {
								lst.push(b.get(m))
							}
						}
					} else {
						if (a.ismaf) {
							const v = a.get(m)
							if (v && Number.isFinite(v.f)) {
								lst.push(v.f.toFixed(2))
							} else {
								lst.push('n/a')
							}
						} else {
							lst.push(a.get(m))
						}
					}
				}
				content.push(lst.join('\t'))
			}
			exported.push({
				label: common.dt2label[dt],
				text: content.join('\n')
			})
		}
	}
	client.export_data(tk.ds.label, exported)
}

function getmlstattrnames(tk) {
	const skip = new Set([
		'__x',
		'isrim1',
		'isrim2',
		'aapos',
		'alt',
		'chr',
		'class',
		'dt',
		'isoform',
		'mname',
		'origin',
		'pos',
		'ref',
		'rnapos',
		'rnaposition',
		'gene',
		'rnaduplength',
		'rnadellength'
	])
	if (tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			skip.add(l.k)
			if (l.full) {
				skip.add(l.full)
			}
		}
	}
	const attrnames = new Set()
	for (const m of tk.mlst) {
		for (const k in m) {
			if (skip.has(k)) continue
			const v = m[k]
			if (typeof v == 'object') {
				// skip things like maf_dna, fusion.pairlst, truncation.partner, itd.a, itd.b
				continue
			}
			attrnames.add(k)
		}
	}
	const low2name = new Map() // tidy for identify
	for (const i of attrnames) {
		low2name.set(i.toLowerCase(), i)
	}
	const lst = []
	// try to put sample name as the first of list to show as default
	if (low2name.has('sample')) lst.push(low2name.get('sample'))
	if (low2name.has('samplename')) lst.push(low2name.get('samplename'))
	if (low2name.has('patient')) lst.push(low2name.get('patient'))
	if (low2name.has('patientname')) lst.push(low2name.get('patientname'))
	if (low2name.has('sampletype')) lst.push(low2name.get('sampletype'))
	if (low2name.has('person')) lst.push(low2name.get('person'))
	if (low2name.has('individual')) lst.push(low2name.get('individual'))
	for (const [i, j] of low2name) {
		if (lst.indexOf(j) == -1) {
			lst.push(j)
		}
	}
	return lst
}

function mlststratifyui(tk, holder, block) {
	const div = holder.append('div').style('margin', '20px')

	const row1 = div.append('div').style('margin-bottom', '5px')
	row1.append('span').style('font-size', '.7em').html('Stratify by&nbsp;&nbsp;')
	const attrnames = getmlstattrnames(tk)
	const select = row1.append('select').on('change', () => {
		const sn = select.node()
		const k = sn.options[sn.selectedIndex].innerHTML
		freestratify(k, tk, block, resultdiv)
	})

	const resultdiv = div.append('div')
	for (const attrname of attrnames) {
		select.append('option').text(attrname)
	}
	if (attrnames[0]) {
		freestratify(attrnames[0], tk, block, resultdiv)
	}
}

function freestratify(key, tk, block, div) {
	const map = new Map()
	for (const m of tk.mlst) {
		let v = m[key]
		if (v == undefined) {
			continue
		}
		if (typeof v == 'boolean') {
			if (v) {
				v = 'true'
			} else {
				v = 'false'
			}
		}
		if (map.has(v)) {
			map.get(v).push(m)
		} else {
			map.set(v, [m])
		}
	}
	const resultlst = [...map]
	resultlst.sort((a, b) => b[1].length - a[1].length)

	div.selectAll('*').remove()
	if (map.size > 10) {
		div.style('height', '200px').style('overflow-y', 'scroll').style('resize', 'vertical').style('padding', '5px')
	}
	const table = div
		.append('table')
		.style('border-spacing', '1px')
		.style('border-collapse', 'separate')
		.style('font-size', '.8em')

	for (const [v, mlst] of resultlst) {
		const tr = table.append('tr')
		// td 1
		tr.append('td').text(mlst.length).style('text-align', 'right')
		// td 2
		const td = tr.append('td').classed('sja_menuoption', true)
		td.text(v)
		td.on('click', () => {
			const thisdsname = tk.ds.label + ' - ' + key + ' - ' + v
			if (block.ownds[thisdsname]) {
				block.deletecustomdsbyname(thisdsname)
			} else {
				// create child tk
				const _ds = {
					label: thisdsname,
					bulkdata: {},
					parentname: tk.ds.label,
					iscustom: true,
					sampleselectable: tk.ds.sampleselectable
				}
				_ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
				block.addchilddsnoload(_ds)
				const childtk = block.block_addtk_template({ type: client.tkt.ds, ds: _ds })
				blockds.dstkload(childtk, block)
			}
		})
		// td 3
		const td3 = tr.append('td')
		summarizemclass(mlst, td3)
	}
}

function summarizemclass(mlst, holder) {
	const map = new Map()
	for (const m of mlst) {
		if (map.has(m.class)) {
			map.set(m.class, map.get(m.class) + 1)
		} else {
			map.set(m.class, 1)
		}
	}
	const lst = [...map]
	lst.sort((a, b) => b[1] - a[1])
	for (const c of lst) {
		holder
			.append('span')
			.html(c[1] == 1 ? '&nbsp;' : c[1])
			.style('background-color', common.mclass[c[0]].color)
			.classed('sja_mcdot', true)
	}
}

function label_mcount_fillpane(tk, block, handle, tip) {
	tip.clear()
	const holder = tip.d

	if (!tk.mlst) {
		console.error('.mlst missing for ' + tk.name)
		return
	}
	if (tk.mlst.length == 0) {
		// when mlst is empty this controller should not be clickable
		return
	}

	// 1. free stratify
	if (tk.ds.id2vcf) {
		// TODO support vcf meta for stratifying
	} else {
		if (tk.mlst.length < 1000) {
			// too many
			mlststratifyui(tk, holder, block)
		} else {
			holder
				.append('div')
				.text('Stratify ' + tk.mlst.length + ' variants')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					holder.selectAll('*').remove()
					mlststratifyui(tk, holder, block)
				})
		}
	}

	if (block.samplecart && tk.ds && tk.ds.sampleselectable) {
		// select sample API
		// allow samples to be selected
		const sampleset = new Set()
		for (const m of tk.mlst) {
			if (m.sample) {
				// FIXME hardcoded sample attribute
				sampleset.add(m.sample)
			}
		}

		block.samplecart.setBtns({
			samplelst: [...sampleset],
			id: block.usegm ? block.usegm.name : '',
			basket: 'Gene Mutation',
			container: holder.append('div')
		})
	}

	if (tk.numericmode) {
	} else {
		// not in numeric mode
		// 2. expand / fold skewers
		let hasshown = false
		for (const i of tk.data) {
			if (i.showmode == 1) {
				hasshown = true
				break
			}
		}
		if (hasshown) {
			holder
				.append('div')
				.text('Fold')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					tip.hide()
					blockds.fold_glyph(tk.data, tk)
				})
		} else {
			holder
				.append('div')
				.text('Expand')
				.classed('sja_menuoption', true)
				.on('click', () => {
					tip.hide()
					blockds.settle_glyph(tk, block)
				})
		}
	}

	// 3. sunburst
	if (tk.ds.cohort) {
		holder
			.append('div')
			.text('To sunburst')
			.classed('sja_menuoption', true)
			.on('click', async () => {
				tip.hide()
				const mlst = mlstfilter(tk, block)
				await may_sunburst(mlst.length, mlst, 100, tk.height_main / 2, tk, block)
			})
	}
	// 4.
	holder
		.append('div')
		.text('To table')
		.classed('sja_menuoption', true)
		.on('click', () => {
			const p = holder.node().getBoundingClientRect()
			tip.hide()
			const mlst = mlstfilter(tk, block)
			itemtable({
				mlst: mlst,
				pane: true,
				x: p.left,
				y: p.top,
				tk: tk,
				block: block
			})
		})
	// 5.
	holder
		.append('div')
		.text('Download')
		.classed('sja_menuoption', true)
		.on('click', () => {
			tip.hide()
			downloadmlst(tk, block)
		})
	tip.showunder(handle.node())
}

function label_strat_fillpane(tk, block, strat, tip) {
	tip.clear()

	// compute stratification on client

	const mlst = mlstfilter(tk, block)

	let levels = []
	if (strat.bycohort) {
		if (!tk.ds || !tk.ds.cohort || !tk.ds.cohort.levels) {
			console.error('some part is missing: tk.ds.cohort.levels')
			return
		}
		levels = tk.ds.cohort.levels
	} else {
		if (strat.attr1) {
			levels.push({ label: strat.attr1.label, k: strat.attr1.k })
		}
		if (strat.attr2) {
			levels.push({ label: strat.attr2.label, k: strat.attr2.k })
		}
		if (strat.attr3) {
			levels.push({ label: strat.attr3.label, k: strat.attr3.k })
		}
	}
	const root = stratify()(stratinput(mlst, levels))
	root.sum(i => i.value)
	const table = tip.d.append('table')
	const tr = table.append('tr').style('font-size', '.9em').style('color', '#858585')
	tr.append('td').text(strat.label.toUpperCase())
	if (strat.bycohort && tk.ds.cohort.root) {
		tr.append('td').text('% TUMOR')
	}
	tr.append('td')
	tr.append('td').text('MUTATIONS')
	root.eachBefore(n => {
		if (!n.parent) return
		const thisdsname = tk.ds.label + ' - ' + n.data.name
		const tr = table.append('tr').classed('sja_clb', true)
		if (block.ownds[thisdsname]) {
			tr.style('background-color', hotcolor)
		}
		// td1
		tr.append('td')
			.style('padding-left', (n.depth - 1) * 15 + 'px')
			.html(
				n.data.name + (n.data.full ? '&nbsp;<span style="font-size:.7em;color:#858585">' + n.data.full + '</span>' : '')
			)
		// td2
		if (strat.bycohort && tk.ds.cohort.root) {
			const td2 = tr.append('td')
			let cohortsize = 0
			tk.ds.cohort.root.each(i => {
				if (i.id == n.id) {
					cohortsize = i.value
				}
			})
			if (cohortsize == 0) {
				td2.text('not found').style('font-size', '.7em')
			} else {
				client.fillbar(
					td2,
					{ f: n.value / cohortsize, v1: n.value, v2: cohortsize },
					{ fillbg: tk.ds.cohort.fbarbg, fill: tk.ds.cohort.fbarfg }
				)
			}
		}
		// td3
		tr.append('td').style('text-align', 'right').style('font-size', '.8em').text(n.value)
		// td4
		const td4 = tr.append('td')
		summarizemclass(n.data.lst, td4)
		tr.on('click', () => {
			if (block.ownds[thisdsname]) {
				block.deletecustomdsbyname(thisdsname)
				tr.style('background-color', 'transparent')
			} else {
				tr.style('background-color', hotcolor)
				// create child tk
				const _ds = {
					label: thisdsname,
					bulkdata: {},
					parentname: tk.ds.label,
					iscustom: true,
					sampleselectable: tk.ds.sampleselectable
				}
				_ds.bulkdata[block.usegm.name.toUpperCase()] = n.data.lst
				block.addchilddsnoload(_ds)
				const childtk = block.block_addtk_template({ type: client.tkt.ds, ds: _ds })
				blockds.dstkload(childtk, block)
			}
		})
	})
	tip.showunder(strat.svglabel.node())
}

function ctrlui_vcfinfofilter(tk, block) {
	/*
	from m.info or m.altinfo, of a vcf track
	in legend, each term shown in one row
	term name clickable to select and apply to the track

	categorical:
		has the .categories{} attribute
		if autocategory is set, .categories{} will be dynamically filled with color roster each time data is loaded

	numerical:
		does not have .categories{}

	contents for each term to be filled up at runtime
	*/

	const err = common.validate_vcfinfofilter(tk.vcfinfofilter)
	if (err) return err

	const obj = tk.vcfinfofilter

	obj.tip = new client.Menu({ padding: '0px' })

	if (obj.setidx4mclass != undefined) {
		// given setidx4mclass
		if (!Number.isInteger(obj.setidx4mclass)) return '.setidx4mclass value should be array index (non-negative integer)'
		const set = obj.lst[obj.setidx4mclass]
		if (!set) return '.setidx4mclass value out of bound'
		if (!set.autocategory) {
			if (!set.categories) return '.setidx4mclass does not point to a categorical set'
		}
	}

	if (obj.setidx4numeric != undefined) {
		// given setidx4mclass
		if (!Number.isInteger(obj.setidx4numeric))
			return '.setidx4numeric value should be array index (non-negative integer)'
		const set = obj.lst[obj.setidx4numeric]
		if (!set) return '.setidx4numeric value out of bound'
		if (set.categories) return '.setidx4numeric does not point to a numeric set'
	}

	// validated

	obj.holder = tk.td_legend.append('table').style('border-spacing', '5px')

	// display holder for each set
	for (let i = 0; i < obj.lst.length; i++) {
		const set = obj.lst[i]

		const row = obj.holder.append('tr')

		set.namebutton = row
			.append('td')
			.text(set.name)
			.attr('class', 'sja_clb')
			.style('text-align', 'right')
			.on('click', () => {
				let usethisset = true
				if (set.categories) {
					// wash out categorical sets, leave out numeric sets
					for (const s2 of obj.lst) {
						if (s2.categories) {
							s2.namebutton.style('background-color', null).style('border-bottom', null)
						}
					}
					if (i == obj.setidx4mclass) {
						delete obj.setidx4mclass
						usethisset = false
					} else {
						obj.setidx4mclass = i
					}
				} else {
					// wash out numeric sets, leave out categorical sets
					for (const s2 of obj.lst) {
						if (!s2.categories) {
							s2.namebutton.style('background-color', null).style('border-bottom', null)
						}
					}
					if (i == obj.setidx4numeric) {
						delete obj.setidx4numeric
						usethisset = false
					} else {
						obj.setidx4numeric = i
					}
				}
				if (usethisset) {
					set.namebutton.style('background-color', '#f1f1f1').style('border-bottom', 'solid 2px #ccc')
				}
				dstkrender(tk, block)
			})

		if (i == obj.setidx4mclass || i == obj.setidx4numeric) {
			set.namebutton.style('background-color', '#f1f1f1').style('border-bottom', 'solid 2px #ccc')
		}
		// for on-the-fly fill
		set.holder = row.append('td')
	}
	return null
}

function ctrlui_populationfrequency(tk, block) {
	/*
	filter variants by population frequency
	for multi-sample vcf
	legend filled on the fly
	*/

	if (!tk.populationfrequencyfilter.lst) return '.lst[] missing for .populationfrequencyfilter'

	// swap lst
	const lst = []
	for (const v of tk.populationfrequencyfilter.lst) {
		if (typeof v == 'number') {
			lst.push({ value: v })
			continue
		}
		if (v.value == undefined || typeof v.value != 'number') {
			return '.populationfrequencyfilter.lst[].value is not a number'
		}
		lst.push({ value: v.value })
	}
	tk.populationfrequencyfilter.lst = lst

	const div = tk.td_legend.append('div')
	if (tk.populationfrequencyfilter.name) {
		div
			.append('div')
			.text(tk.populationfrequencyfilter.name)
			.style('display', 'inline-block')
			.style('color', '#858585')
			.style('margin-right', '10px')
	}
	tk.populationfrequencyfilter.holder = div.append('div').style('display', 'inline-block')
}

function ctrlui_sampleattribute(tk, block) {
	/*
	for multi-sample vcf, filter variants by sample annotation
	legend filled on the fly
	challenge for variant-cohort composite track
	*/

	const smat = tk.ds.cohort.sampleattribute
	if (!smat.lst) return '.lst[] missing for .cohort.sampleattribute'
	const div = tk.td_legend.append('div')
	smat.holder = div
	smat.tip = new client.Menu({ padding: '0px' })
}
