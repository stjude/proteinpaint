import * as client from './client'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import { stratify } from 'd3-hierarchy'

/*

********************** EXPORTED

itemtable()
runtimeattr_snvindel()
runtimeattr_sv()
runtimeattr_itd()
runtimeattr_del()
runtimeattr_trunc()

query_vcfcohorttrack()


********************** INTERNAL

table_snvindel
table_sv
table_itd
table_truncation
table_del
table_sort

vcfmdetail
mayshowcovmafplot
mayshowgermline2dvaf
mayshowgenotype2boxplot

vcfvepbutton
vcfannbutton

may_info2singletable
may_info2table
info2table_value
*/

const separatorvp = '__'

export function itemtable(arg) {
	/*
	.mlst
	.block
	.tk
	.pane
	.holder
	*/

	const { mlst, tk, block } = arg
	if (!mlst || mlst.length == 0) return
	let holder
	if (arg.pane) {
		const pane = client.newpane({ x: arg.x, y: arg.y })
		pane.header.html(mlst2headerhtml(mlst))
		holder = pane.body
	} else {
		holder = arg.holder
	}
	if (!holder) {
		console.error('no holder provided for showing table')
		return
	}

	/*
	mlst can be a mixture of dt
	show separate table for each datatype
	following incrementally adds components to the mlst panel
	*/
	const dt2mlst = new Map()
	for (const m of mlst) {
		if (!dt2mlst.has(m.dt)) {
			dt2mlst.set(m.dt, [])
		}
		dt2mlst.get(m.dt).push(m)
	}

	/**** a very quick fix!
	in any type of variant, only set this when mlst is just one variant with occurrence=1
	so that variant2samples can append rows to it (not in use)
	*/
	delete tk.__singlevariant_table

	for (const [dt, lst] of dt2mlst) {
		const div = holder.append('div').style('margin', '10px')
		if (dt2mlst.size > 1) {
			div.append('p').text(common.dt2label[dt]).style('color', '#858585')
		}
		switch (dt) {
			case common.dtsnvindel:
				table_snvindel(lst, div, tk, block)
				break
			case common.dtsv:
			case common.dtfusionrna:
				table_sv(lst, div, tk, block)
				break
			case common.dtitd:
				table_itd(lst, div, tk, block.genome)
				break
			case common.dtnloss:
			case common.dtcloss:
				table_truncation(lst, div, tk, block.genome)
				break
			case common.dtdel:
				table_del(lst, div, tk, block.genome)
				break
			case common.dtcnv:
				div.append('p').text('cnv not supported yet')
				break
			default:
				div.append('p').text('unknown dt: ' + dt)
		}
	}

	handle_samplecart(mlst, holder, tk, block)
}

function mlst2headerhtml(mlst) {
	if (mlst.length == 1) {
		const m = mlst[0]
		const c = common.mclass[m.class]
		if (m.dt == common.dtsnvindel) {
			return (
				'<span style="font-weight:bold;color:' +
				c.color +
				'">' +
				(m.mname ? m.mname : m.pos ? m.chr + ':' + (m.pos + 1) : '') +
				'</span> <span style="font-size:80%">' +
				c.label +
				'</span>'
			)
		}
		if (m.dt == common.dtsv || m.dt == common.dtfusionrna) {
			const names = []
			for (let i = 0; i < m.pairlst.length; i++) {
				if (i == 0) names.push(m.pairlst[i].a.name ? m.pairlst[i].a.name : m.pairlst[i].a.chr)
				names.push(m.pairlst[i].b.name ? m.pairlst[i].b.name : m.pairlst[i].b.chr)
			}
			return names.join(' - ') + '&nbsp;&nbsp;<span style="font-size:80%">' + c.label + '</span>'
		}
		if (
			m.dt == common.dtnloss ||
			m.dt == common.dtcloss ||
			m.dt == common.dtitd ||
			m.dt == common.dtdel ||
			m.dt == common.dtcnv
		) {
			return '<span style="font-size:80%">' + c.label + '</span>'
		}
		return 'unknown dt ' + m.dt
	}
	const set = new Set()
	for (const m of mlst) {
		set.add(m.dt)
	}
	if (set.size == 1) {
		const dt = [...set][0]
		return mlst.length + ' ' + common.dt2label[dt]
	}
	return mlst.length + ' mutations'
}

function table_snvindel(mlst, holder, tk, block) {
	if (tk.ds && tk.ds.id2vcf) {
		if (mlst.length == 1) {
			const vcfobj = tk.ds.id2vcf[mlst[0].vcfid]
			if (!vcfobj) {
				holder.append('p').text('No vcf config file (id: ' + mlst[0].vcfid + ')')
				return
			}
			vcfmdetail(mlst[0], vcfobj, holder, tk, block)
			return
		}
		// vcf item is only shown one at a time, but not in a table
		for (const m of mlst) {
			const vcfobj = tk.ds.id2vcf[m.vcfid]
			if (!vcfobj) {
				holder.append('p').text('No vcf config file (id: ' + m.vcfid + ')')
				continue
			}
			const d = holder
				.append('div')
				.attr('class', 'sja_menuoption')
				.on('click', event => {
					const pane = client.newpane({ x: event.clientX + 100, y: Math.max(100, event.clientY - 100) })
					vcfmdetail(m, vcfobj, pane.body, tk, block)
				})
			if (m.mname) {
				d.append('span').html(
					m.mname + '\t<span style="font-size:80%;color:#858585">' + common.mclass[m.class].label + '</span>'
				)
			} else if (m.csq) {
				d.append('span').html(
					m.csq[0]._mname + '\t<span style="font-size:80%;color:#858585">' + m.csq[0].Consequence + '</span>'
				)
			}
			d.append('span').html(
				'&nbsp;&nbsp;' +
					m.chr +
					':' +
					(m.pos + 1) +
					' <span style="font-size:70%">REF</span> ' +
					m.ref +
					' <span style="font-size:70%">ALT</span> ' +
					m.alt
			)
		}
		return
	}
	const hasSNP = block.genome.hasSNP
	const snpfind = {
		chr: null,
		bprange: [], // {start/stop}
		holder: null,
		says: null
	}
	const variantpage = {
		set: new Map(),
		// k: chr SEP pos SEP ref SEP mut
		// v: {mname, class}
		butholder: null
	}
	for (const m of mlst) {
		if (hasSNP && m.chr && m.pos) {
			snpfind.chr = m.chr
			let nf = true
			for (const r of snpfind.bprange) {
				if (r.start <= m.pos && r.stop >= m.pos) {
					nf = false
					break
				}
			}
			if (nf) {
				snpfind.bprange.push({ start: m.pos, stop: m.pos + 1 })
			}
		}
	}
	if (!tk.snvindelattr) {
		runtimeattr_snvindel(tk, mlst)
	}

	if (block.variantPageCall_snv) {
		// variant page button moved to panel top, per jinghui 1/25/2023
		variantpage.butholder = holder.append('div').style('margin', '10px')
	}

	if (mlst.length == 1) {
		const m = mlst[0]
		snpfind.alleleLst = [m.ref, m.alt]
		if (block.variantPageCall_snv) {
			if (m.chr != undefined && m.pos != undefined && m.ref != undefined && m.alt != undefined) {
				variantpage.set.set(m.chr + separatorvp + m.pos + separatorvp + m.ref + separatorvp + m.alt, {
					mname: m.mname,
					class: m.class
				})
			}
		}
		const data = []
		for (const atr of tk.snvindelattr) {
			if (atr.lst) {
				const kvlst = []
				for (const at of atr.lst) {
					if (at.ismaf) {
						const v = at.get(m)
						kvlst.push({
							k: at.label,
							v: v
								? Number.isFinite(v.f)
									? '<span style="color:' +
									  at.fill +
									  '">' +
									  (v.f * 100).toFixed(0) +
									  '% (' +
									  v.v1 +
									  '/' +
									  v.v2 +
									  ')</span>'
									: 'n/a'
								: ''
						})
					} else {
						kvlst.push({ k: at.label, v: at.get(m) })
					}
				}
				if (kvlst.length) {
					data.push({ k: atr.label, kvlst: kvlst })
				}
			} else if (atr.ismaf) {
				const v = atr.get(m)
				data.push({
					k: atr.label,
					v: v
						? Number.isFinite(v.f)
							? '<span style="color:' +
							  atr.fill +
							  '">' +
							  (v.f * 100).toFixed(0) +
							  '% (' +
							  v.v1 +
							  '/' +
							  v.v2 +
							  ')</span>'
							: 'n/a'
						: ''
				})
			} else {
				let v = atr.get(m)
				if (atr.hover) {
					const hs = atr.hover(m)
					if (hs) {
						v += ' <span style="color:#aaa;font-size:80%">' + hs + '</span>'
					}
				}
				data.push({ k: atr.label, v: v })
			}
		}
		const table = client.make_table_2col(holder, data)
		if (hasSNP) {
			const tr = table.append('tr')
			tr.append('td').attr('colspan', 2).style('color', '#9e9e9e').text('dbSNP')
			snpfind.says = tr.append('td').text('loading...')
		}
		// a row of possible buttons
		// - highlight samples in epaint
		// - legend
		const buttonrow = holder.append('div').style('margin-top', '10px')
		if (tk.eplst) {
			for (const ep of tk.eplst) {
				mayephl_butt(ep, buttonrow, mlst)
			}
		}
		if (tk.ds && tk.ds.snvindel_legend) {
			buttonrow
				.append('button')
				.text('Legend')
				.on('click', () => {
					if (legenddiv.style('display') == 'none') {
						client.appear(legenddiv)
					} else {
						client.disappear(legenddiv)
					}
				})
			const legenddiv = buttonrow
				.append('div')
				.style('display', 'none')
				.style('margin', '10px')
				.style('width', '400px')
				.html(tk.ds.snvindel_legend)
		}
	} else {
		// many m
		if (block.variantPageCall_snv) {
			for (const m of mlst) {
				if (m.chr != undefined && m.pos != undefined && m.ref != undefined && m.alt != undefined) {
					variantpage.set.set(m.chr + separatorvp + m.pos + separatorvp + m.ref + separatorvp + m.alt, {
						mname: m.mname,
						class: m.class
					})
				}
			}
		}
		const table = holder
			.append('table')
			.style('border-spacing', '3px')
			.style('border-collapse', 'separate')
			.style('margin', '0px 7px 7px 0px')
			.style('font-size', '90%')
			.style('color', 'black')
			.style('background-color', 'white')
		table_sort(mlst, table, tk.snvindelattr, tk)
		// button rows, bottom
		const buttrow = holder.append('div').style('margin', '10px 5px')
		/*
		if (block.variantPageCall_snv) {
			variantpage.butholder = buttrow.append('span')
		}
		*/
		let h_col, h_snp, h_exp, h_leg
		buttrow
			.append('button')
			.text('Table columns')
			.on('click', function () {
				if (h_col.style('display') == 'block') {
					this.style.color = 'black'
					client.disappear(h_col)
				} else {
					this.style.color = 'red'
					client.appear(h_col)
				}
			})
		if (hasSNP && snpfind.bprange.length) {
			snpfind.button = buttrow
				.append('button')
				.text('loading...')
				.on('click', function () {
					if (h_snp.style('display') == 'block') {
						this.style.color = 'black'
						client.disappear(h_snp)
					} else {
						this.style.color = 'red'
						client.appear(h_snp)
					}
				})
		}
		if (tk.eplst) {
			for (const ep of tk.eplst) {
				mayephl_butt(ep, buttrow, mlst)
			}
		}
		if (tk.ds && tk.ds.snvindel_legend) {
			buttrow
				.append('button')
				.text('Legend')
				.on('click', function () {
					if (h_leg.style('display') == 'block') {
						this.style.color = 'black'
						client.disappear(h_leg)
					} else {
						this.style.color = 'red'
						client.appear(h_leg)
					}
				})
		}
		h_col = holder.append('div').style('margin', '10px').style('display', 'none')
		for (const at of tk.snvindelattr) {
			const id = Math.random()
			const check = h_col.append('input').attr('type', 'checkbox').attr('id', id)
			if (!at.hide) check.attr('checked', true)
			check.on('change', () => {
				at.hide = !check.node().checked
				table_sort(mlst, table, tk.snvindelattr, tk)
			})
			h_col.append('label').attr('for', id).text(at.label)
			h_col.append('br')
		}
		if (hasSNP) {
			h_snp = holder.append('div').style('margin', '10px').style('display', 'none')
			snpfind.holder = h_snp
			snpfind.says = h_snp
		}
		if (tk.ds && tk.ds.snvindel_legend) {
			h_leg = holder.append('div').style('display', 'none').style('width', '300px').html(tk.ds.snvindel_legend)
		}
	}

	if (hasSNP && snpfind.bprange.length) {
		client
			.may_findmatchingsnp(snpfind.chr, snpfind.bprange, block.genome, snpfind.alleleLst)
			.then(hits => {
				if (!hits || hits.length == 0) throw { message: 'no SNP' }
				snpfind.says.text('')
				if (snpfind.button) {
					snpfind.button.text(hits.length + ' SNP' + (hits.length > 1 ? 's' : ''))
				}
				for (const item of hits) {
					const d = snpfind.says.append('div')
					client.snp_printhtml(item, d)
				}
			})
			.catch(err => {
				snpfind.says.text(err.message)
				if (snpfind.button) {
					snpfind.button.attr('disabled', true)
				}
				if (err.stack) console.log(err.stack)
			})
	}
	if (block.variantPageCall_snv) {
		// call variant page button generator
		const vlst = []
		for (const [what, m] of variantpage.set) {
			const l = what.split(separatorvp)
			vlst.push({
				chr: l[0],
				position: Number.parseInt(l[1]) + 1,
				refallele: l[2],
				altallele: l[3],
				class: m.class,
				aachange: m.mname
			})
		}
		if (vlst.length == 1) {
			// only one variant, call to generate button
			const variant = vlst[0]
			variant.container = variantpage.butholder
			block.variantPageCall_snv(variant)
		} else if (vlst.length > 1) {
			// 2 or more variants
			variantpage.butholder
				.append('div')
				.classed('sja_variantpagesnv', true)
				.text('Variant Page')
				.on('click', event => {
					const table = tk.tktip.clear().showunder(event.target).d.append('table')
					for (const variant of vlst) {
						const tr = table.append('tr')
						// aa change
						tr.append('td').text(variant.aachange)
						// class
						tr.append('td')
							.text(common.mclass[variant.class].label)
							.style('font-size', '.7em')
							.style('color', common.mclass[variant.class].color)
						// genomic change
						tr.append('td')
							.text(variant.chr + ':' + variant.position + ' ' + variant.refallele + '>' + variant.altallele)
							.attr('font-size', '.7em')
						// vp button
						variant.container = tr.append('td')
						block.variantPageCall_snv(variant)
					}
				})
		}
	}
}

function table_sort(mlst, table, attrlst, tk, trclick) {
	table.selectAll('*').remove()
	let sortkey = null
	for (const a1 of attrlst) {
		if (a1.lst) {
			for (const a2 of a1.lst) {
				if (a2.sort) sortkey = a2
			}
		} else if (a1.sort) sortkey = a1
	}
	if (sortkey) {
		mlst.sort((x, y) => {
			const a = sortkey.get(x)
			const b = sortkey.get(y)
			if (sortkey.ismaf) {
				if (a == undefined) {
					if (b == undefined) return 0
					return 1
				} else {
					if (b == undefined) return -1
					return sortkey.descend ? b.f - a.f : a.f - b.f
				}
			}
			if (a == undefined || a === '') {
				if (b == undefined || b === '') return 0
				return 1
			}
			if (b == undefined || b === '') return -1
			if (typeof a == 'string') {
				if (a < b) return sortkey.descend ? 1 : -1
				if (a > b) return sortkey.descend ? -1 : 1
			}
			if (typeof a == 'number') return sortkey.descend ? b - a : a - b
			return 0
		})
	}
	// header row 1
	const headtr = table.append('tr')
	// header row 2
	const headtr2 = table.append('tr')
	// column 1, numerator
	headtr.append('td').attr('rowspan', 2)
	for (const atr of attrlst) {
		if (atr.hide) continue
		if (atr.lst) {
			headtr
				.append('td')
				.attr('colspan', atr.lst.length)
				.style('color', '#aaa')
				.style('border-bottom', 'solid 1px #ccc')
				.style('text-align', 'center')
				.html(atr.label)
			for (const at of atr.lst) {
				headtr2
					.append('td')
					.attr('class', 'sja_clbtext')
					.html(at.label + (at.sort ? (at.descend ? ' &#9660;' : ' &#9650;') : ''))
					.on('click', () => {
						if (at.sort) {
							// already sorting on this one
							at.descend = !at.descend
						}
						for (const a1 of attrlst) {
							if (a1.lst) {
								for (const a2 of a1.lst) a2.sort = false
							} else {
								a1.sort = false
							}
						}
						at.sort = true
						table_sort(mlst, table, attrlst, tk, trclick)
					})
			}
		} else {
			headtr
				.append('td')
				.attr('rowspan', 2)
				.attr('class', 'sja_clbtext')
				.html(atr.label + (atr.sort ? (atr.descend ? ' &#9660;' : ' &#9650;') : ''))
				.on('click', () => {
					if (atr.sort) {
						// already sorting on this one
						atr.descend = !atr.descend
					}
					for (const a1 of attrlst) {
						if (a1.lst) {
							for (const a2 of a1.lst) a2.sort = false
						} else {
							a1.sort = false
						}
					}
					atr.sort = true
					table_sort(mlst, table, attrlst, tk, trclick)
				})
		}
	}
	const showcount = mlst.length > 1000 ? 900 : mlst.length
	for (let i = 0; i < showcount; i++) {
		const s = mlst[i]
		const tr = table.append('tr').attr('class', 'sja_tr')
		if (trclick) {
			tr.on('click', () => trclick(s))
		}
		if (tk.eplst) {
			tr.on('mouseover', (event, m) => {
				for (const ep of tk.eplst) ep.may_hl([s], true)
			}).on('mouseout', (event, m) => {
				for (const ep of tk.eplst) ep.may_hl([s], false)
			})
		}
		tr.append('td')
			.style('font-size', '.8em')
			.text(i + 1)
		for (const atr of attrlst) {
			if (atr.hide) continue
			if (atr.lst) {
				for (const at of atr.lst) {
					const td = tr.append('td')
					if (at.ismaf) {
						// scattered maf fields
						const v = at.get(s)
						if (v && typeof v == 'object') {
							// FIXME ep.p.maf returns data for both snv and fusion, but !!!
							if (v.v2 == 0) {
								td.text('0/0')
								td.attr('aria-label', 'No coverage')
							} else {
								client.fillbar(td, v, at)
							}
						}
					} else {
						td.html(at.get(s))
					}
				}
			} else {
				const td = tr.append('td')
				if (atr.hover) {
					const hs = atr.hover(s)
					if (hs != undefined) {
						td.attr('aria-label', hs)
					}
				}
				if (atr.tablecellwidth) {
					td.style('width', atr.tablecellwidth).style('word-break', 'break-all')
				}
				if (atr.ismaf) {
					// scattered maf fields
					const v = atr.get(s)
					if (v) {
						if (v.v2 == 0) {
							td.text('0/0')
							td.attr('aria-label', 'No coverage')
						} else {
							client.fillbar(td, v, atr)
						}
					}
				} else {
					td.html(atr.get(s))
				}
			}
		}
	}
}

function tinylab(t) {
	return '<span style="font-size:70%;color:#858585">' + t + '</span>'
}

function vcfmdetail(m, vcfobj, holder, tk, block) {
	/*
	for a single variant from vcf
	can be from a single vcf, or multiple vcf
	the variant can have .sampledata[]
	if 
	*/

	if (!vcfobj) {
		holder.append('p').text('vcfobj config object missing')
		return
	}

	// first row of buttons

	const row1 = holder.append('div').style('margin-top', '10px')
	row1.append('span').text(m.type).style('padding-right', '10px')
	row1
		.append('span')
		.text(m.chr + ':' + (m.pos + 1))
		.style('padding-right', '10px')

	if (m.dt == common.dtsnvindel) {
		// alleles
		row1
			.append('span')
			.style('padding-right', '10px')
			.html(tinylab('REF') + ' ' + m.ref + ' ' + tinylab('ALT') + ' ' + m.alt)
		if (block.variantPageCall_snv) {
			const variant = {
				chr: m.chr,
				position: m.pos + 1,
				refallele: m.ref,
				altallele: m.alt,
				container: row1.append('span').style('padding-left', '20px')
			}
			block.variantPageCall_snv(variant)
		}

		if (tk.button4variant) {
			make_button4variant(row1, m, tk.button4variant)
		}
		if (tk.url4variant) {
			make_url4variant(row1, m, tk.url4variant)
		}
	}

	if (vcfobj.info && vcfobj.info.CSQ && vcfobj.info.CSQ.csqheader && m.csq) {
		// has VEP
		vcfvepbutton(m.csq, row1, tk, vcfobj.info.CSQ.csqheader)
	}

	if (vcfobj.info && vcfobj.info.ANN && vcfobj.info.ANN.annheader && m.ann) {
		// has ANN
		vcfannbutton(m.ann, row1, tk, vcfobj.info.ANN.annheader)
	}

	if (tk.variant2img) {
		variant2imgbutton(m, row1, holder.append('div'), tk, block)
	}

	// if the variant has sample-level data
	// condition testingdoesn't make sense that .sampledata[] is there for all

	const div = holder.append('div')
	if (mayshowgenotype2boxplot(m, tk, div)) {
		// boxplot shown
		div.style('margin-top', '10px')
	} else if (m.sampledata) {
		const wait = div.append('div')

		Promise.resolve()
			.then(() => {
				if (m.sampledata.length == 0 && tk.ds.vcfcohorttrack) {
					// query cohort vcfobj file for sample info about this variant
					wait.text('Loading ...')

					return query_vcfcohorttrack(m, tk, block).then(m2 => {
						if (!m2) {
							// no hit
							return
						}
						m.sampledata = m2.sampledata
						return
					})
				}
				return
			})
			.then(() => {
				wait.remove()
				if (m.sampledata.length == 0) {
					// no sample
					return
				}

				if (m.sampledata.length == 1) {
					// single sample
					singleSample2table(m, tk, div)
					return
				}

				/*
			multiple samples
			may show some kind of plots
			*/

				if (mayshowgermline2dvaf(m, tk, div)) {
					div.style('margin-top', '10px')
				} else if (mayshowcovmafplot(m, tk, div)) {
					div.style('margin-top', '10px')
				} else if (mayshowgenotype2boxplot(m, tk, div)) {
					div.style('margin-top', '10px')
				} else {
					vcfsamplelistbutton(m, row1, tk)
				}
			})
			.catch(err => {
				wait.text(err)
			})
	}

	if (vcfobj.infopipejoin) {
		// for allele info only!
		// designed for old clinvar vcf, no longer used
		const lst0 = []
		if (m.altinfo) {
			for (const k of vcfobj.infopipejoin) {
				const tmp = m.altinfo[k.key]
				if (tmp) {
					if (Array.isArray(tmp)) {
						lst0.push(tmp)
					} else {
						lst0.push(tmp.split(/[,|]/))
					}
				} else {
					lst0.push([])
				}
			}
		}
		if (lst0.length) {
			const row2 = holder.append('div')
			for (let i = 0; i < lst0[0].length; i++) {
				const lst = []
				for (let j = 0; j < vcfobj.infopipejoin.length; j++) {
					const k = vcfobj.infopipejoin[j]
					lst.push({
						k: k.label,
						v: k.values ? k.values[lst0[j][i]] : lst0[j][i]
					})
				}
				client
					.make_table_2col(row2, lst)
					.style('display', 'inline-block')
					.style('border', 'solid 1px black')
					.style('margin', '20px')
			}
		}
	}

	may_info2singletable(m, holder, tk)
	may_info2table(m, holder, tk)

	const altkey2category = {} // alt allele
	const lockey2category = {} // locus
	if (tk.vcfinfofilter) {
		for (const mcset of tk.vcfinfofilter.lst) {
			if (mcset.categories) {
				if (mcset.altalleleinfo) {
					altkey2category[mcset.altalleleinfo.key] = mcset.categories
				} else if (mcset.locusinfo) {
					lockey2category[mcset.locusinfo.key] = mcset.categories
				}
			}
		}
	}

	{
		// alt allele info
		const lst = []
		for (const k in m.altinfo) {
			// value from altinfo maybe array
			const infovalue = Array.isArray(m.altinfo[k]) ? m.altinfo[k] : [m.altinfo[k]]
			let showvalue
			if (altkey2category[k]) {
				showvalue = infovalue.map(i => {
					const cat = altkey2category[k][i]
					if (cat) {
						return (
							'<span style="padding:1px 3px;background:' +
							cat.color +
							';color:' +
							(cat.textcolor || 'black') +
							';">' +
							i +
							'</span>'
						)
					}
					return i
				})
			} else {
				showvalue = infovalue
			}
			lst.push({
				k: k,
				v:
					showvalue.join(', ') +
					(vcfobj.info && vcfobj.info[k]
						? ' <span style="font-size:70%;color:#858585">' + vcfobj.info[k].Description + '</span>'
						: '')
			})
		}
		if (lst.length) {
			holder.append('h3').text('Alternative allele:')
			client.make_table_2col(holder, lst)
		}
	}

	{
		// locus info
		const lst = []
		for (const k in m.info) {
			if (tk.info2table && tk.info2table[k]) {
				// already shown in previous section
				continue
			}
			const infovalue = Array.isArray(m.info[k]) ? m.info[k] : [m.info[k]]
			let showvalue
			if (lockey2category[k]) {
				showvalue = infovalue.map(i => {
					const cat = lockey2category[k][i]
					if (cat) {
						return (
							'<span style="padding:1px 3px;background:' +
							cat.color +
							';color:' +
							(cat.textcolor || 'black') +
							';">' +
							i +
							'</span>'
						)
					}
					return i
				})
			} else {
				showvalue = infovalue
			}
			lst.push({
				k: k,
				v:
					showvalue.join(', ') +
					(vcfobj.info && vcfobj.info[k]
						? ' <span style="font-size:70%;color:#858585">' + vcfobj.info[k].Description + '</span>'
						: '')
			})
		}
		if (lst.length) {
			holder.append('h3').text('This locus:')
			client.make_table_2col(holder, lst)
		}
	}
}

function may_info2singletable(m, holder, tk) {
	// from a csq-like field, only show first item as a vertical table with each row as a field of icfg.fields[]
	if (!tk.info2singletable) return
	for (const infokey in tk.info2singletable) {
		const icfg = tk.info2singletable[infokey]
		const rawvaluelst = m.info[infokey]
		if (!rawvaluelst || !rawvaluelst[0]) continue
		const table = []
		const lst = rawvaluelst[0].split(icfg.col_separator)
		for (let i = 0; i < icfg.fields.length; i++) {
			if (icfg.fields[i].hide) continue
			table.push({
				k: icfg.fields[i].name,
				v: info2table_value(icfg, lst, i)
			})
		}
		client.make_table_2col(holder, table)
	}
}

function may_info2table(m, holder, tk) {
	if (!tk.info2table) return
	for (const infokey in tk.info2table) {
		const icfg = tk.info2table[infokey]
		const rawvaluelst = m.info[infokey]
		if (!rawvaluelst) continue

		if (icfg.separate_tables) {
			const tables = JSON.parse(JSON.stringify(icfg.separate_tables))
			tables.forEach(i => (i.rows = []))
			for (const row of rawvaluelst) {
				const lst = row.split(icfg.col_separator)
				const field2value = new Map()
				for (let i = 0; i < icfg.fields.length; i++) {
					field2value.set(icfg.fields[i].name, lst[i])
				}
				for (const t of tables) {
					if (t.groupers.reduce((i, j) => (field2value.get(j.field) == j.value ? i : false), true)) {
						t.rows.push(field2value)
					}
				}
			}
			for (const t of tables) {
				if (t.rows.length == 0) continue
				holder.append('h3').html(t.headhtml)
				const table = holder
					.append('table')
					.style('border-spacing', '2px')
					.style('border-collapse', 'separate')
					.style('font-size', '90%')
				const tr = table.append('tr')
				for (const field of icfg.fields) {
					if (field.hide) continue
					tr.append('td').text(field.name)
				}
				for (const row of t.rows) {
					const tr = table.append('tr').attr('class', 'sja_tr')
					const lst = icfg.fields.map(i => row.get(i.name))
					for (let i = 0; i < icfg.fields.length; i++) {
						if (icfg.fields[i].hide) continue
						const td = tr.append('td')
						td.html(info2table_value(icfg, lst, i))
					}
				}
			}
			continue
		}

		const table = holder
			.append('table')
			.style('border-spacing', '2px')
			.style('border-collapse', 'separate')
			.style('font-size', '90%')
		const tr = table.append('tr')
		for (const field of icfg.fields) {
			if (field.hide) continue
			tr.append('td').text(field.name)
		}
		for (const row of rawvaluelst) {
			const tr = table.append('tr').attr('class', 'sja_tr')
			const lst = row.split(icfg.col_separator)
			for (let i = 0; i < icfg.fields.length; i++) {
				if (icfg.fields[i].hide) continue
				const td = tr.append('td')
				td.html(info2table_value(icfg, lst, i))
			}
		}
	}
}

/*
at index i, to match field config "icfg.fields[i]" with raw value "lst[i]" to produce a display value

icfg: dataset.info2table
lst: array of fields of a variant
i: array index of both icfg.fields[] and lst[]
*/
function info2table_value(icfg, lst, i) {
	const field = icfg.fields[i]
	if (field.hide) return
	let value = lst[i]
	if (value == undefined) return
	// field config attributes are processed based on order of precedence
	if (field.eval) {
		// somehow decodeURIComponent() won't work here!!
		// TODO: use a more specific string-to-code conversion
		// per https://esbuild.github.io/content-types/#direct-eval
		value = (0, eval)('"' + value + '"')
	}
	if (field.isurl) return '<a href=' + value + ' target=_blank>' + value + '</a>'
	if (field.appendUrl) {
		if (field.separator) {
			return value
				.split(field.separator)
				.map(v => '<a href=' + field.appendUrl + v + ' target=_blank>' + v + '</a>')
				.join(', ')
		}
		return '<a href=' + field.appendUrl + value + ' target=_blank>' + value + '</a>'
	}
	if (field.insert2url) {
		return '<a href=' + field.insert2url.left + value + field.insert2url.right + ' target=_blank>' + value + '</a>'
	}
	if (field.ampersand2br) return value.replace(/&/g, '<br>')
	if (field.urlMatchLst) {
		// 31566309_(PubMed), or 168986_(ASCO)
		const lowervalue = value.toLowerCase()
		const id = lowervalue.split(field.urlMatchLst.separator)[field.urlMatchLst.idIndex]
		if (id) {
			for (const type of field.urlMatchLst.types) {
				if (lowervalue.indexOf(type.type) != -1) {
					if (type.appendUrl) {
						return (
							'<span style="font-size:.7em">' +
							type.type.toUpperCase() +
							'</span> <a href=' +
							type.appendUrl +
							id +
							' target=_blank>' +
							id +
							'</a>'
						)
					}
				}
			}
		}
	}
	return value
}

function mayephl_butt(ep, holder, mlst) {
	let notfound = true
	for (const m of mlst) {
		if (m[ep.p.sampletype] in ep.sampletype2value) {
			notfound = false
			break
		}
	}
	if (notfound) {
		return
		/*
		holder
			.append('button')
			.text(ep.p.sampletype + ' not in ' + ep.p.name)
			.attr('disabled', 1)
			*/
	}
	let hl = false
	holder
		.append('button')
		.text('Highlight in ' + ep.p.name)
		.on('click', () => {
			hl = !hl
			ep.may_hl(mlst, hl)
		})
}

function table_sv(mlst, holder, tk, block) {
	const graphholder = holder.append('div').style('margin-bottom', '10px')
	tosvgraph(mlst[0].pairlst, block, graphholder)
	if (!tk.svattr) {
		runtimeattr_sv(tk, mlst)
	}
	if (mlst.length == 1) {
		const m = mlst[0]
		const data = []
		for (const at of tk.svattr) {
			data.push({ k: at.label, v: at.get(m) })
		}
		const table = client.make_table_2col(holder, data)
		if (tk.eplst) {
			const butrow = holder.append('div').style('margin-top', '10px')
			for (const ep of tk.eplst) {
				mayephl_butt(ep, butrow, mlst)
			}
		}
		return
	}
	const table = holder
		.append('table')
		.style('font-size', '90%')
		.style('border-spacing', '2px')
		.style('border-collapse', 'separate')
	const tr = table.append('tr')
	for (const at of tk.svattr) {
		tr.append('td').text(at.label)
	}
	table_sort(mlst, table, tk.svattr, tk, m => {
		graphholder.selectAll('*').remove()
		tosvgraph(m.pairlst, block, graphholder)
	})
	if (tk.eplst) {
		const butrow = holder.append('div').style('margin-top', '5px')
		for (const ep of tk.eplst) {
			mayephl_butt(ep, butrow, mlst)
		}
	}
}

function tosvgraph(pairlst, block, holder) {
	for (const p of pairlst) {
		if (p.a.isoform) {
			p.a.gm = { isoform: p.a.isoform }
		}
		if (p.b.isoform) {
			p.b.gm = { isoform: p.b.isoform }
		}
	}
	const svarg = {
		jwt: block.jwt,
		hostURL: block.hostURL,
		pairlst: pairlst,
		genome: block.genome,
		holder: holder
	}
	import('./svgraph').then(p => {
		p.default(svarg)
	})
}

function table_itd(mlst, holder, tk, genome) {
	if (!tk.itdattr) {
		runtimeattr_itd(tk, mlst)
	}
	if (mlst.length == 1) {
		const m = mlst[0]
		const data = []
		for (const at of tk.itdattr) {
			data.push({ k: at.label, v: at.get(m) })
		}
		const table = client.make_table_2col(holder, data)
		if (tk.eplst) {
			const butrow = holder.append('div').style('margin-top', '10px')
			for (const ep of tk.eplst) {
				mayephl_butt(ep, butrow, mlst)
			}
		}
		return
	}
	const table = holder
		.append('table')
		.style('font-size', '90%')
		.style('border-spacing', '2px')
		.style('border-collapse', 'separate')
	const tr = table.append('tr')
	for (const at of tk.itdattr) {
		tr.append('td').text(at.label)
	}
	table_sort(mlst, table, tk.itdattr, tk)
	if (tk.eplst) {
		const butrow = holder.append('div').style('margin-top', '5px')
		for (const ep of tk.eplst) {
			mayephl_butt(ep, butrow, mlst)
		}
	}
}

function table_del(mlst, holder, tk, genome) {
	if (!tk.delattr) {
		runtimeattr_del(tk, mlst)
	}
	if (mlst.length == 1) {
		const m = mlst[0]
		const data = []
		for (const at of tk.delattr) {
			data.push({ k: at.label, v: at.get(m) })
		}
		const table = client.make_table_2col(holder, data)
		if (tk.eplst) {
			const butrow = holder.append('div').style('margin-top', '10px')
			for (const ep of tk.eplst) {
				mayephl_butt(ep, butrow, mlst)
			}
		}
		return
	}
	const table = holder
		.append('table')
		.style('font-size', '90%')
		.style('border-spacing', '2px')
		.style('border-collapse', 'separate')
	const tr = table.append('tr')
	for (const at of tk.delattr) {
		tr.append('td').text(at.label)
	}
	table_sort(mlst, table, tk.delattr, tk)
	if (tk.eplst) {
		const butrow = holder.append('div').style('margin-top', '5px')
		for (const ep of tk.eplst) {
			mayephl_butt(ep, butrow, mlst)
		}
	}
}

function table_truncation(mlst, holder, tk, genome) {
	if (!tk.truncattr) {
		runtimeattr_trunc(tk, mlst)
	}
	if (mlst.length == 1) {
		const m = mlst[0]
		const data = []
		for (const at of tk.truncattr) {
			data.push({ k: at.label, v: at.get(m) })
		}
		const table = client.make_table_2col(holder, data)
		if (tk.eplst) {
			const butrow = holder.append('div').style('margin-top', '10px')
			for (const ep of tk.eplst) {
				mayephl_butt(ep, butrow, mlst)
			}
		}
		return
	}
	const table = holder
		.append('table')
		.style('font-size', '90%')
		.style('border-spacing', '2px')
		.style('border-collapse', 'separate')
	const tr = table.append('tr')
	for (const at of tk.truncattr) {
		tr.append('td').text(at.label)
	}
	table_sort(mlst, table, tk.truncattr, tk)
	if (tk.eplst) {
		const butrow = holder.append('div').style('margin-top', '5px')
		for (const ep of tk.eplst) {
			mayephl_butt(ep, butrow, mlst)
		}
	}
}

export function runtimeattr_snvindel(tk, mlst) {
	tk.snvindelattr = []
	if (tk.ds && tk.ds.snvindel_attributes) {
		// use predefined
		for (const a of tk.ds.snvindel_attributes) {
			tk.snvindelattr.push(a)
		}
	} else {
		// ds-free or nothing available from ds, figure out from data
		const nouse = new Set(['pos', 'aapos', 'rnapos', 'dt', 'vcfid', 'isrim1', 'isrim2', 'alt', '__x'])
		if (tk.ds.cohort && tk.ds.cohort.levels) {
			for (const l of tk.ds.cohort.levels) {
				nouse.add(l.k)
			}
		}
		const lst = []
		for (const k in mlst[0]) {
			if (nouse.has(k)) continue
			switch (k) {
				case 'chr':
					lst.push({ label: 'Genome pos.', get: m => m.chr + ':' + (m.pos + 1) })
					break
				case 'class':
					lst.push({ label: 'Class', get: m => common.mclass[m.class].label })
					break
				case 'mname':
					lst.push({ label: 'Mutation', get: m => m.mname })
					break
				case 'ref':
					lst.push({
						label: 'Allele',
						lst: [
							{ label: 'Ref', get: m => m.ref },
							{ label: 'Alt', get: m => m.alt }
						]
					})
					break
				case 'pmid':
					lst.push(caller_pmid())
					break
				case 'maf_tumor':
					lst.push({
						get: m => m.maf_tumor,
						ismaf: true,
						width: 40,
						height: 12,
						label: 'Tumor MAF',
						fill: '#ff4d4d',
						fillbg: '#ffcccc'
					})
					break
				case 'maf_normal':
					lst.push({
						get: m => m.maf_normal,
						ismaf: true,
						width: 40,
						height: 12,
						label: 'Germline MAF',
						fill: '#4d4dff',
						fillbg: '#ccccff'
					})
					break
				default:
					lst.push({ label: k, get: m => m[k] })
			}
		}
		tk.snvindelattr = lst
	}
	if (tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			tk.snvindelattr.push({
				label: l.label || l.k,
				hide: l.hide,
				get: m => {
					if (m[l.k])
						return (
							m[l.k] +
							(l.full ? (m[l.full] ? ' <span style="font-size:.8em;color:#858585">' + m[l.full] + '</span>' : '') : '')
						)
					return ''
				}
			})
		}
	}
	if (tk.eplst) {
		for (const ep of tk.eplst) {
			if (!ep.p) {
				console.error('no config object for epaint')
				continue
			}
			if (ep.p.maf) {
				// both maf and expression value
				tk.snvindelattr.push({
					label: ep.p.name,
					lst: [
						{
							label: ep.p.datatype,
							get: m => {
								const s = m[ep.p.sampletype]
								if (!s) return ''
								return ep.sampletype2value[s]
							}
						},
						{
							label: ep.p.maf.label,
							width: 40,
							height: 12,
							fill: ep.p.hlcolor,
							fillbg: ep.p.hlcolor2,
							get: ep.p.maf.get,
							readcountcredible: ep.p.maf.readcountcredible,
							ismaf: true
						}
					]
				})
			} else {
				// only expression value
				tk.snvindelattr.push({
					label: ep.p.name + ' ' + ep.p.datatype,
					get: m => {
						const s = m[ep.p.sampletype]
						if (!s) return ''
						return ep.sampletype2value[s]
					}
				})
			}
		}
	}
}

export function runtimeattr_trunc(tk, mlst) {
	const skipset = new Set([
		'__x',
		'mname',
		'gene',
		'strand',
		'isoform',
		'aapos',
		'rnapos',
		'chr',
		'pos',
		'class',
		'dt',
		'rnaposition',
		'partner'
	])
	tk.truncattr = []
	for (const m of mlst) {
		if (m.sample) {
			tk.truncattr.push({ label: 'Sample', get: m => m.sample })
			skipset.add('sample')
			break
		}
	}
	tk.truncattr.push({
		label: 'Position',
		get: m => m.chr + ':' + m.pos
	})
	const dtset = new Set()
	for (const m of mlst) {
		dtset.add(m.dt)
	}
	if (dtset.size > 1) {
		tk.truncattr.push({
			label: 'Truncated',
			get: m => (m.dt == common.dtnloss ? 'N-term' : 'C-term')
		})
	}
	for (const m of mlst) {
		if (m.pmid) {
			tk.truncattr.push(caller_pmid())
			skipset.add('pmid')
			break
		}
	}
	for (const m of mlst) {
		if (m.partner) {
			// cicero exports
			tk.truncattr.push({
				get: m => {
					const lst = []
					for (const k in m.partner) {
						lst.push(k + ': ' + m.partner[k])
					}
					return lst.join('&nbsp;&nbsp;')
				},
				label: 'Translocation'
			})
			break
		}
	}
	if (tk.ds && tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			skipset.add(l.k)
			skipset.add(l.full)
			tk.truncattr.push({
				label: l.label || l.k,
				//hide:l.hide,
				get: m =>
					m[l.k] ? m[l.k] + (l.full ? ' <span style="color:#858585;font-size:.8em">' + m[l.full] + '</span>' : '') : ''
			})
		}
	}
	for (const k in mlst[0]) {
		if (skipset.has(k)) continue
		tk.truncattr.push({ label: k, get: m => m[k] })
	}
}

export function runtimeattr_del(tk, mlst) {
	const skipset = new Set([
		'__x',
		'mname',
		'isoform',
		'aapos',
		'rnapos',
		'chr',
		'pos',
		'class',
		'dt',
		'rnaposition',
		'rnadellength',
		'a',
		'b'
	])
	tk.delattr = []
	for (const m of mlst) {
		if (m.sample) {
			tk.delattr.push({ label: 'Sample', get: m => m.sample })
			skipset.add('sample')
			break
		}
	}
	tk.delattr.push({
		label: 'Position',
		get: m => m.chr + ':' + m.pos
	})
	tk.delattr.push({
		label: 'Del. length',
		get: m => m.rnadellength + ' bp'
	})
	for (const m of mlst) {
		if (m.pmid) {
			tk.delattr.push(caller_pmid())
			skipset.add('pmid')
			break
		}
	}
	if (tk.ds && tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			skipset.add(l.k)
			skipset.add(l.full)
			tk.delattr.push({
				label: l.label || l.k,
				//hide:l.hide,
				get: m =>
					m[l.k] ? m[l.k] + (l.full ? ' <span style="color:#858585;font-size:.8em">' + m[l.full] + '</span>' : '') : ''
			})
		}
	}
	for (const k in mlst[0]) {
		if (skipset.has(k)) continue
		tk.delattr.push({ label: k, get: m => m[k] })
	}
}

export function runtimeattr_itd(tk, mlst) {
	const skipset = new Set([
		'__x',
		'mname',
		'isoform',
		'aapos',
		'rnapos',
		'chr',
		'pos',
		'class',
		'dt',
		'rnaposition',
		'rnaduplength',
		'a',
		'b'
	])
	tk.itdattr = []
	for (const m of mlst) {
		if (m.sample) {
			tk.itdattr.push({ label: 'Sample', get: m => m.sample })
			skipset.add('sample')
			break
		}
	}
	tk.itdattr.push({
		label: 'Position',
		get: m => m.chr + ':' + m.pos
	})
	tk.itdattr.push({
		label: 'Dup. length',
		get: m => m.rnaduplength + ' bp'
	})
	for (const m of mlst) {
		if (m.pmid) {
			tk.itdattr.push(caller_pmid())
			skipset.add('pmid')
			break
		}
	}
	if (tk.ds && tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			skipset.add(l.k)
			skipset.add(l.full)
			tk.itdattr.push({
				label: l.label || l.k,
				//hide:l.hide,
				get: m =>
					m[l.k] ? m[l.k] + (l.full ? ' <span style="color:#858585;font-size:.8em">' + m[l.full] + '</span>' : '') : ''
			})
		}
	}
	for (const k in mlst[0]) {
		if (skipset.has(k)) continue
		tk.itdattr.push({ label: k, get: m => m[k] })
	}
}

export function runtimeattr_sv(tk, mlst) {
	const skipset = new Set([
		'__x',
		'mname',
		'aapos',
		'chr',
		'class',
		'dt',
		'inframe',
		'origin',
		'pos',
		'rnapos',
		'strand',
		'useNterm',
		'pairlst'
	])
	tk.svattr = []
	for (const m of mlst) {
		if (m.sample) {
			tk.svattr.push({ label: 'Sample', get: m => m.sample })
			skipset.add('sample')
			break
		}
	}
	tk.svattr.push({
		label: 'Genomic breakpoint',
		get: m => {
			if (!m.pairlst) return 'no pairlst'
			const lst = m.pairlst.map(
				p =>
					(p.a.name ? '<strong>' + p.a.name + '</strong> ' : '') +
					(p.a.chr
						? '<span style="color:#858585">' +
						  p.a.chr +
						  ':' +
						  (p.a.position + 1) +
						  ' ' +
						  (p.a.strand == '+' ? 'forward' : 'reverse') +
						  '</span> &#10140; '
						: '') +
					(p.b.name ? '<strong>' + p.b.name + '</strong> ' : '') +
					(p.b.chr
						? '<span style="color:#858585">' +
						  p.b.chr +
						  ':' +
						  (p.b.position + 1) +
						  ' ' +
						  (p.b.strand == '+' ? 'forward' : 'reverse') +
						  '</span>'
						: '')
			)
			return lst.join('<br>')
		}
	})
	for (const m of mlst) {
		if (m.pairlst[0].a.rnaposition != undefined) {
			tk.svattr.push({
				label: 'RNA breakpoint',
				get: m => {
					if (!m.pairlst) return 'no pairlst'
					const lst = m.pairlst.map(
						p =>
							(p.a.name ? '<strong>' + p.a.name + '</strong> ' : '') +
							'<span style="color:#858585">r.' +
							(p.a.rnaposition + 1) +
							'</span> &#10140; ' +
							(p.b.name ? '<strong>' + p.b.name + '</strong> ' : '') +
							'<span style="color:#858585">r.' +
							(p.b.rnaposition + 1) +
							'</span>'
					)
					return lst.join('<br>')
				}
			})
			break
		}
	}
	for (const m of mlst) {
		if (m.pmid) {
			tk.svattr.push(caller_pmid())
			skipset.add('pmid')
			break
		}
	}
	// cosmic attr
	let hastn = false
	for (const m of mlst) {
		if (hastn) break
		for (const p of m.pairlst) {
			if (p.translocationname) {
				tk.svattr.push({
					get: m => m.pairlst.map(i => (i.translocationname ? i.translocationname : '')).join('_'),
					label: 'Translocation name'
				})
				hastn = true
				break
			}
		}
	}
	if (mlst[0].pairlst[0].a.ratio != undefined) {
		tk.svattr.push({
			label: 'Chimeric reads ratio',
			get: m => {
				const lst = []
				const w = 40,
					h = 12,
					fill = '#FF850A',
					fillbg = '#FFCF9E'
				for (const i of m.pairlst) {
					lst.push(
						(i.a.name ? i.a.name : i.a.chr) +
							' <svg width=' +
							w +
							' height=' +
							h +
							'><g><title>' +
							i.a.ratio +
							'</title><rect width=' +
							w +
							' height=' +
							h +
							' fill="' +
							fillbg +
							'"></rect>' +
							'<rect width=' +
							w * i.a.ratio +
							' height=' +
							h +
							' fill="' +
							fill +
							'"></rect>' +
							'</g></svg>' +
							'&nbsp;&nbsp;' +
							(i.b.name ? i.b.name : i.b.chr) +
							' <svg width=' +
							w +
							' height=' +
							h +
							'><g><title>' +
							i.b.ratio +
							'</title><rect width=' +
							w +
							' height=' +
							h +
							' fill="' +
							fillbg +
							'"></rect>' +
							'<rect width=' +
							w * i.b.ratio +
							' height=' +
							h +
							' fill="' +
							fill +
							'"></rect>' +
							'</g></svg>'
					)
				}
				return lst.join('<br>')
			}
		})
	}
	tk.svattr.push({
		label: 'Frame',
		get: m => {
			function label(f) {
				if (f == 0)
					return (
						'<span style="white-space:nowrap;background-color:' +
						client.coloroutframe +
						';font-size:80%;color:white;padding:1px 3px">OUT of frame</span>'
					)
				if (f == 1)
					return (
						'<span style="white-space:nowrap;background-color:' +
						client.colorinframe +
						';font-size:80%;color:white;padding:1px 3px">IN frame</span>'
					)
				if (f == 2)
					return (
						'<span style="white-space:nowrap;background-color:' +
						client.colorinframe +
						';font-size:80%;color:white;padding:1px 3px">IN frame</span> <span style="font-size:80%;color:#858585">promoter fusion</span>'
					)
				if (f == 3)
					return (
						'<span style="white-space:nowrap;background-color:' +
						client.colorinframe +
						';font-size:80%;color:white;padding:1px 3px">IN frame</span> <span style="font-size:80%;color:#858585">alternative promoter</span>'
					)
				return 'err (' + f + ')'
			}
			const lst = []
			for (const p of m.pairlst) {
				if (p.frame != undefined) {
					lst.push({
						frame: p.frame,
						a: p.a.name ? p.a.name : p.a.chr,
						b: p.b.name ? p.b.name : p.b.chr
					})
				}
			}
			if (lst.length == 1) return label(lst[0].frame)
			return lst.map(l => l.a + '-' + l.b + ': ' + label(l.frame)).join('<br>')
		}
	})
	if (tk.ds && tk.ds.cohort && tk.ds.cohort.levels) {
		for (const l of tk.ds.cohort.levels) {
			skipset.add(l.k)
			skipset.add(l.full)
			tk.svattr.push({
				label: l.label || l.k,
				hide: l.hide,
				get: m =>
					m[l.k] ? m[l.k] + (l.full ? ' <span style="color:#858585;font-size:.8em">' + m[l.full] + '</span>' : '') : ''
			})
		}
	}
	for (const k in mlst[0]) {
		if (skipset.has(k)) continue
		tk.svattr.push({ label: k, get: m => m[k] })
	}
}

function caller_pmid(m) {
	return {
		get: m => {
			if (!m.pmid) {
				return ''
			}
			if (typeof m.pmid == 'number') {
				return '<a target=_blank href=https://pubmed.ncbi.nlm.nih.gov/' + m.pmid + '>' + m.pmid + '</a>'
			}
			const lst = m.pmid.split(',')
			const out = []
			for (const i of lst) {
				if (i == '') continue
				const j = Number.parseInt(i)
				if (Number.isNaN(j)) {
					out.push(i)
				} else {
					out.push('<a target=_blank href=https://pubmed.ncbi.nlm.nih.gov/' + i + '>' + i + '</a>')
				}
			}
			return out.join(' ')
		},
		label: 'PubMed'
	}
}

function vcfsamplelistbutton(m, holder, tk) {
	/*
	for sample objects about this variant loaded from cohort vcf
	at header of itemtable
	make a sample button
	click to list samples

	the variant is present is because at least 1 of the sample passed sample annotation filter
	so don't show samples that are filtered!
	*/

	let samplelst = m.sampledata
	// check against annotation filter

	if (
		tk.ds &&
		tk.ds.cohort &&
		tk.ds.cohort.annotation &&
		tk.ds.cohort.key4annotation &&
		tk.ds.cohort.sampleattribute &&
		tk.ds.cohort.sampleattribute.runtimelst
	) {
		samplelst = []
		for (const s0 of m.sampledata) {
			const s0name = s0.sampleobj[tk.ds.cohort.key4annotation]
			if (!s0name) continue

			const av = tk.ds.cohort.annotation[s0name]
			if (av) {
				let hidden = false
				for (const attr of tk.ds.cohort.sampleattribute.runtimelst) {
					if (attr.key && attr.key.k && attr.key.hiddenvalues && attr.key.hiddenvalues.size) {
						const v = av[attr.key.k]
						if (attr.key.hiddenvalues.has(v)) {
							hidden = true
							break
						}
					}
				}
				if (hidden) continue
			}
			samplelst.push(s0)
		}
	}

	holder
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('margin-right', '10px')
		.text(samplelst.length + ' sample' + (samplelst.length > 1 ? 's' : ''))
		.on('click', event => {
			tk.tktip.showunder(event.target).clear()
			const table = tk.tktip.d.append('table')
			const tr = table.append('tr').style('font-size', '.8em').style('color', '#858585')
			tr.append('td').text('Name')
			tr.append('td').text('Genotype')

			let hasgt = false
			if (samplelst[0].DP != undefined) {
				tr.append('td').text('Read depth')
				hasgt = true
			}
			let hascount = false
			if (samplelst[0].allele2readcount) {
				tr.append('td').text('Allele read count')
				hascount = true
			}
			for (const s of samplelst) {
				const tr = table.append('tr')
				tr.append('td').text(s.sampleobj.name)
				tr.append('td').style('padding-left', '10px').text(s.genotype)
				if (hasgt) {
					tr.append('td')
						.style('padding-left', '10px')
						.text(s.DP || '')
				}
				if (hascount) {
					const lst = []
					for (const a in s.allele2readcount) {
						lst.push(a + ':' + s.allele2readcount[a])
					}
					tr.append('td').style('padding-left', '10px').text(lst.join(', '))
				}
			}
		})
}

function vcfvepbutton(csqlst, holder, tk, headers) {
	holder
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('margin-right', '10px')
		.text('VEP annotation')
		.on('click', event => {
			tk.tktip.clear()
			tk.tktip.showunder(event.target)
			for (const item of csqlst) {
				let blown = false
				let thislabel
				{
					const lst = []
					if (item.HGVSp) {
						lst.push('<span style="font-size:.7em;color:#858585">HGVSp</span> ' + item.HGVSp)
					} else if (item.HGVSc) {
						lst.push('<span style="font-size:.7em;color:#858585">HGVSc</span> ' + item.HGVSc)
					} else {
						lst.push('no_HGVS')
					}
					if (item.Consequence) {
						lst.push('<span style="font-size:.7em;color:#858585">CONSEQUENCE</span> ' + item.Consequence)
					} else {
						lst.push('no_consequence')
					}
					thislabel = lst.join(' ')
				}
				const box = tk.tktip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.style('margin', '5px')
					.html(thislabel)
					.on('click', () => {
						if (blown) {
							blown = false
							box.html(thislabel)
						} else {
							blown = true
							box.text('')
							const lst = []
							for (const h of headers) {
								const v = item[h.name]
								if (v) {
									lst.push({ k: h.name, v: v })
								}
							}
							client.make_table_2col(box, lst)
						}
					})
			}
			/*
		// show controls
		const div=tk.tktip.d.append('div').style('margin-top','10px')
		for(const h of headers) {
			const row=div.append('div')
			const id=Math.random()
			const input=row.append('input')
				.attr('type','checkbox')
				.style('margin-right','5px')
				.attr('id',id)
				.on('change',(event)=>{
					h.hidden = !event.target.checked
					showtable()
				})
			if(!h.hidden) {
				input.attr('checked',1)
			}
			row.append('label')
				.text(h.name)
				.attr('for',id)
		}
		*/
		})
}

function vcfannbutton(annolst, holder, tk, headers) {
	holder
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('margin-right', '10px')
		.text('Annotation')
		.on('click', event => {
			tk.tktip.clear()
			tk.tktip.showunder(event.target)
			for (const item of annolst) {
				let blown = false
				let thislabel
				{
					const lst = []
					if (item['HGVS.p']) {
						lst.push('<span style="font-size:.7em;color:#858585">HGVS.p</span> ' + item['HGVS.p'])
					} else if (item['HGVS.c']) {
						lst.push('<span style="font-size:.7em;color:#858585">HGVS.c</span> ' + item['HGVS.c'])
					} else {
						lst.push('no_HGVS')
					}
					if (item.Annotation) {
						lst.push('<span style="font-size:.7em;color:#858585">Annotation</span> ' + item.Annotation)
					} else {
						lst.push('no_annotation')
					}
					thislabel = lst.join(' ')
				}
				const box = tk.tktip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.style('margin', '5px')
					.html(thislabel)
					.on('click', () => {
						if (blown) {
							blown = false
							box.html(thislabel)
						} else {
							blown = true
							box.text('')
							const lst = []
							for (const h of headers) {
								const v = item[h.name]
								if (v) {
									lst.push({ k: h.name, v: v })
								}
							}
							client.make_table_2col(box, lst)
						}
					})
			}
		})
}

function variant2imgbutton(m, buttonrow, imgholder, tk, block) {
	let loaded = false

	buttonrow
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('display', 'inline-block')
		.style('margin-right', '10px')
		.text('Image')
		.on('click', async () => {
			if (loaded) return
			loaded = true
			const wait = imgholder.append('div').style('margin', '20px').text('Loading...')
			try {
				const data = await client.dofetch('img', {
					file: [
						tk.variant2img.path,
						m.chr + '.' + (m.pos + 1) + '.' + m.ref + '.' + m.alt + '.' + tk.variant2img.ext
					].join('/')
				})
				if (data.error) throw data.error
				wait.remove()
				imgholder
					.append('img')
					.attr('src', data.src)
					.style('width', data.size.width + 'px')
					.style('height', data.size.height + 'px')
			} catch (e) {
				wait.text('Error loading image')
			}
		})
}

function mayshowcovmafplot(m, tk, holder) {
	if (!tk.ds.vaf2coverageplot) {
		return false
	}
	if (!m.sampledata) {
		return false
	}

	/*
	may show cov-maf plot for samples from a vcf variant
	plottable samples should have .DP and valid read count for this allele

	m.sampledata[ {} ]
		.sampleobj
			.<k4a>
		.DP
		.allele2readcount

	divide samples to groups by sampletype, make separate plot for each group
	*/

	const nostlst = []
	/*
	samples without sampletype, or vaf2coverageplot.samplegroupkey is not set
	*/

	const st2lst = {}
	/*
	k: sampletype
	v: list of samples
	will not use if no vaf2coverageplot.samplegroupkey
	*/

	const categorycount = new Map() // use then vaf2coverageplot.categories is set

	let err = 0
	for (const s of m.sampledata) {
		if (!s.allele2readcount) {
			// this is required
			err++
			continue
		}

		if (s.DP == undefined) {
			s.DP = 0
			for (const k in s.allele2readcount) {
				s.DP += s.allele2readcount[k]
			}
		}

		/*
		if alt allele is missing from the hash
		treat the coverage of it as zero
		*/
		const altv = s.allele2readcount[m.alt] || 0

		if (altv > s.DP) {
			console.log('alt coverage > DP: ' + altv + ' ' + s.DP)
			continue
		}

		// is a plottable sample
		// ss is object to go to plotter
		const ss = {
			sampleobj: {},
			mut: altv,
			total: s.DP,
			maf: s.DP == 0 ? 0 : altv / s.DP,
			genotype: s.genotype
		}

		// transfer metadata
		if (s.sampleobj) {
			if (tk.ds.cohort && tk.ds.cohort.annotation && tk.ds.cohort.key4annotation) {
				const k4a = s.sampleobj[tk.ds.cohort.key4annotation]
				if (k4a) {
					const n = tk.ds.cohort.annotation[k4a]
					if (n) {
						if (tk.ds.cohort.levels) {
							for (const l of tk.ds.cohort.levels) {
								if (!n[l.k]) continue
								ss.sampleobj[l.label || l.k] =
									n[l.k] +
									(l.full && n[l.full] ? ' <span style="font-size:.8em;color:#858585">' + n[l.full] + '</span>' : '')
							}
							// also add k4a
							ss.sampleobj[tk.ds.cohort.key4annotation] = k4a
						} else {
							for (const k in n) {
								ss.sampleobj[k] = n[k]
							}
						}
					}
				}
			} else {
				for (const k in s.sampleobj) {
					ss.sampleobj[k] = s.sampleobj[k]
				}
			}
		}

		if (tk.ds.vaf2coverageplot.categorykey && tk.ds.vaf2coverageplot.categories) {
			/*
			try to assign color to this sample by category
			hardcoded: .categorykey only found in .sampleobj but not ds.cohort.annotation
			*/
			const k = ss.sampleobj[tk.ds.vaf2coverageplot.categorykey]
			if (k && tk.ds.vaf2coverageplot.categories[k]) {
				// is valid category, assign color
				ss.color = tk.ds.vaf2coverageplot.categories[k].color
				// count 4 legend
				if (!categorycount.has(k)) {
					categorycount.set(k, 0)
				}
				categorycount.set(k, categorycount.get(k) + 1)

				// will swap the attribute
				delete ss.sampleobj[tk.ds.vaf2coverageplot.categorykey]
				ss.sampleobj[tk.ds.vaf2coverageplot.categorylabel] = k
			}
		}

		if (tk.ds.vaf2coverageplot.samplegroupkey) {
			// will try to group samples
			/*
			hardcoded
			samplegroupkey will only be taken from ss.sampleobj
			but not ds.cohort.annotation
			*/
			if (ss.sampleobj && ss.sampleobj[tk.ds.vaf2coverageplot.samplegroupkey]) {
				const k = ss.sampleobj[tk.ds.vaf2coverageplot.samplegroupkey]
				if (!st2lst[k]) {
					st2lst[k] = []
				}
				st2lst[k].push(ss)
			} else {
				// no sampletype
				nostlst.push(ss)
			}
		} else {
			// not to group samples
			nostlst.push(ss)
		}
	}

	if (err) {
		console.log('skipped ' + err + ' items')
	}

	// group to be plotted
	const plotgroups = []

	if (nostlst.length) {
		plotgroups.push({
			name: 'no ' + (tk.ds.vaf2coverageplot.samplegroupkey || 'sampletype'),
			lst: nostlst
		})
	}
	for (const k in st2lst) {
		plotgroups.push({
			name: k,
			lst: st2lst[k]
		})
	}

	if (plotgroups.length == 0) {
		return false
	}

	if (categorycount.size > 0) {
		// will show legend for counts per category
		const div = holder.append('div').style('margin', '20px 20px 0px 20px')
		for (const [k, count] of categorycount) {
			const c = tk.ds.vaf2coverageplot.categories[k]
			const row = div.append('div').style('margin-bottom', '3px')
			row
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('padding', '1px 5px')
				.style('margin-right', '5px')
				.style('background-color', c.color)
				.html('&nbsp;&nbsp;')
			// stop showing #sample as people may confuse with #patient
			//.text(count)
			row
				.append('span')
				.style('color', c.color)
				.text(c.label || k)
		}
	}

	const row = holder.append('div').style('margin-bottom', '10px')

	import('./old/plot.vaf2cov').then(plotter => {
		/*
		import plotter, then plot all groups
		each plot will return data point -> svg cross,
		so to enable mouse over a sample in one plot, and highlight samples from other plots of the same patient
		*/

		const name2sgp = {}

		for (const g of plotgroups) {
			let div = row.append('div').style('display', 'inline-block').style('vertical-align', 'top')

			if (plotgroups.length > 1) {
				// more than 1 group, emphasis
				div
					.style('margin-right', '30px')
					.append('div')
					.style('margin-top', '10px')
					.style('padding', '3px 10px')
					.style('background-color', '#aaa')
					.style('color', 'white')
					.style('display', 'inline-block')
					.style('font-size', '.8em')
					.style('font-weight', 'bold')
					.text(g.name.toUpperCase())
				div = div.append('div').style('border', 'solid 1px #aaa')
			}

			const arg = {
				holder: div,
				data: g.lst,
				name: g.name,
				tip: tk.tktip,
				automax: true,
				mouseover: d => {
					if (!d.sampleobj) return
					for (const groupname in name2sgp) {
						if (groupname == g.name) continue
						name2sgp[groupname]
							.filter(d2 => {
								return d2.sampleobj.patient == d.sampleobj.patient
							})
							.each(d2 => {
								d2.crosshair1.attr('transform', 'scale(2.5)')
								d2.crosshair2.attr('transform', 'scale(2.5)')
							})
					}
				},
				mouseout: d => {
					if (!d.sampleobj) return
					for (const groupname in name2sgp) {
						if (groupname == g.name) continue
						name2sgp[groupname]
							.filter(d2 => {
								return d2.sampleobj.patient == d.sampleobj.patient
							})
							.each(d2 => {
								d2.crosshair1.attr('transform', 'scale(1)')
								d2.crosshair2.attr('transform', 'scale(1)')
							})
					}
				}
			}

			name2sgp[g.name] = plotter.default(arg)
		}
	})
	return true
}

export function query_vcfcohorttrack(m, tk, block) {
	/*
	query shadow track to get sample data for cov-vaf plot
	*/

	const vobj = tk.ds.vcfcohorttrack

	return Promise.resolve()
		.then(() => {
			if (vobj.info) {
				// info already loaded for cohort vcf file, next
				return null
			}

			const par = {
				jwt: block.jwt,
				file: vobj.file,
				url: vobj.url,
				indexURL: vobj.indexURL,
				header: 1
			}

			// info not loaded for cohort vcf
			return fetch(
				new Request(block.hostURL + '/vcf', {
					method: 'POST',
					body: JSON.stringify(par)
				})
			).then(data => {
				return data.json()
			})
		})
		.then(data => {
			if (data == null) return
			// parse meta lines
			if (!data.metastr) throw { message: 'no meta lines for the cohort vcf file ' }
			if (!data.chrstr) throw { message: 'no chromosome names found for the cohort vcf file' }
			const [info, format, samples, errs] = vcf.vcfparsemeta(data.metastr.split('\n'))
			if (errs) throw { message: 'vcf meta error for the cohort vcf file: ' + errs.join('; ') }
			vobj.info = info
			vobj.format = format

			if (vobj.samplenamemap) {
				vobj.samples = samples.map(vobj.samplenamemap)
			} else {
				vobj.samples = samples
			}

			vobj.nochr = common.contigNameNoChr(block.genome, data.chrstr.split('\n'))

			return
		})
		.then(() => {
			// fetch sample data from cohort vcf
			const par = {
				jwt: block.jwt,
				file: vobj.file,
				url: vobj.url,
				indexURL: vobj.indexURL,
				rglst: [
					{
						chr: vobj.nochr ? m.chr.replace('chr', '') : m.chr,
						start: m.pos + 1,
						stop: m.pos + 1
					}
				]
			}
			return fetch(
				new Request(block.hostURL + '/vcf', {
					method: 'POST',
					body: JSON.stringify(par)
				})
			)
				.then(data => {
					return data.json()
				})
				.then(data => {
					if (data.error) throw { message: 'Error querying vcf file: ' + data.error }
					const lines = data.linestr ? data.linestr.trim().split('\n') : []
					for (const line of lines) {
						const [err, mlst, altinvalid] = vcf.vcfparseline(line, vobj)
						for (const m2 of mlst) {
							if (m2.pos == m.pos && m2.ref == m.ref && m2.alt == m.alt) {
								return m2
							}
						}
					}
					return null
				})
		})
}

function make_url4variant(holder, m, items) {
	for (const item of items) {
		if (!item.makeurl) continue
		const url = item.makeurl(m)
		if (!url) {
			// somehow this variant cannot yield a url, ignore
			continue
		}
		holder
			.append('a')
			.attr('href', url)
			.attr('target', '_blank')
			.text(item.makelabel ? item.makelabel(m) : item.label || 'link')
			.style('margin-right', '10px')
	}
}

function make_button4variant(holder, m, lst) {
	lst.forEach(item => {
		if (!item.makebutton) return
		const div = holder.append('div').style('display', 'inline-block').style('margin', '0px 10px 2px 3px')
		item.makebutton(m, div.node())
	})
}

function mayshowgermline2dvaf(m, tk, holder) {
	const cfg = tk.ds.germline2dvafplot
	if (!cfg) return false

	const ik = cfg.individualkey

	const individualset = new Map()

	let err = 0
	for (const s of m.sampledata) {
		if (s.DP == undefined || !s.allele2readcount) {
			err++
			continue
		}
		/*
		if alt allele is missing from the hash
		treat the coverage of it as zero
		*/
		const altv = s.allele2readcount[m.alt] || 0
		if (altv > s.DP) {
			console.log('alt coverage > DP: ' + altv + ' ' + s.DP)
			continue
		}

		const individual = s.sampleobj[ik]
		if (!individual) {
			continue
		}
		const sampletype = s.sampleobj[cfg.sampletypekey]
		if (!sampletype) {
			continue
		}
		if (!individualset.has(individual)) {
			const obj = {
				sampletypes: {}
			}
			for (const k in s.sampleobj) {
				obj[k] = s.sampleobj[k]
			}

			individualset.set(individual, obj)
		}
		individualset.get(individual).sampletypes[sampletype] = {
			total: s.DP,
			vaf: s.DP == 0 ? 0 : altv / s.DP
		}
	}

	if (err) {
		console.log(err + ' samples has no valid DP/allele2readcount')
	}

	// for yleftsampletype and yrightsampletype, each add a new datapoint
	const data = []
	for (const [k, obj] of individualset) {
		if (!obj.sampletypes[cfg.xsampletype]) {
			continue
		}

		if (obj.sampletypes[cfg.yleftsampletype]) {
			const n = {}
			for (const k in obj) {
				n[k] = obj[k]
			}
			n.sampletypes = {}
			n.sampletypes[cfg.xsampletype] = obj.sampletypes[cfg.xsampletype]
			n.sampletypes[cfg.yleftsampletype] = obj.sampletypes[cfg.yleftsampletype]
			data.push(n)
		}

		if (cfg.yrightsampletype && obj.sampletypes[cfg.yrightsampletype]) {
			const n = {}
			for (const k in obj) {
				n[k] = obj[k]
			}
			n.sampletypes = {}
			n.sampletypes[cfg.xsampletype] = obj.sampletypes[cfg.xsampletype]
			n.sampletypes[cfg.yrightsampletype] = obj.sampletypes[cfg.yrightsampletype]
			data.push(n)
		}
	}
	if (data.length) {
		const div = holder.append('div').style('display', 'inline-block')
		import('./old/plot.2dvaf').then(p => {
			p.default(data, cfg, div)
		})
		return true
	}
	return false
}

function mayshowgenotype2boxplot(m, tk, holder) {
	const cfg = tk.ds.genotype2boxplot
	if (!cfg) return false

	if (cfg.boxplotvaluekey) {
		const v = m.info[cfg.boxplotvaluekey]
		if (!v) return false
		const tmp = v.split('|')
		const plots = []
		for (const s of tmp) {
			const x = s.split('/')

			const p1 = Number.parseFloat(x[1])
			const p2 = Number.parseFloat(x[2])
			const p3 = Number.parseFloat(x[3])
			const p4 = Number.parseFloat(x[4])
			const p5 = Number.parseFloat(x[5])
			if (Number.isNaN(p1) || Number.isNaN(p2) || Number.isNaN(p3) || Number.isNaN(p4) || Number.isNaN(p5)) {
				continue
			}

			plots.push({
				label: x[0],
				color: '#4F8F38',
				minvalue: p1,
				maxvalue: p5,
				percentile: {
					p05: p1,
					p25: p2,
					p50: p3,
					p75: p4,
					p95: p5
				}
			})
		}
		const div = holder.append('div').style('display', 'inline-block')
		import('./old/plot.boxplot').then(p => {
			const err = p.default({
				holder: div,
				axislabel: cfg.axislabel,
				list: plots
			})
			if (err) {
				client.sayerror(div, 'Boxplot: ' + err)
			}
		})
		return true
	}

	if (!tk.ds.cohort || !tk.ds.cohort.annotation || !tk.ds.cohort.key4annotation) {
		console.log('genotype2boxplot but ds.cohort is incomplete')
		return false
	}

	const gt2samples = new Map()
	m.sampledata.forEach(s => {
		if (!s.genotype) return
		const k4a = s.sampleobj[tk.ds.cohort.key4annotation]
		if (!k4a) return
		const n = tk.ds.cohort.annotation[k4a]
		if (!n) return
		const value = n[cfg.sampleannotationkey]
		if (!Number.isFinite(value)) return
		if (!gt2samples.has(s.genotype)) {
			gt2samples.set(s.genotype, [])
		}
		gt2samples.get(s.genotype).push({
			value: value,
			key: k4a
		})
	})

	if (gt2samples.size == 0) {
		return false
	}

	const groups = []
	for (const [genotype, samples] of gt2samples) {
		groups.push({
			label: genotype,
			color: '#4F8F38',
			samples: samples
		})
	}
	const div = holder.append('div').style('display', 'inline-block')
	import('./old/plot.boxplot').then(p => {
		const err = p.default({
			holder: div,
			axislabel: cfg.axislabel,
			list: groups
		})
		if (err) {
			client.sayerror(div, 'Boxplot: ' + err)
		}
	})
	return true
}

function singleSample2table(m, tk, holder) {
	// only 1 sample
	const s = m.sampledata[0]
	const lst = []
	if (s.genotype) {
		lst.push({ k: 'genotype', v: s.genotype })
	}
	if (s.DP != undefined) {
		lst.push({ k: 'total reads', v: s.DP })
	}
	if (s.allele2readcount && s.allele2readcount[m.alt] != undefined) {
		lst.push({ k: 'alt reads', v: s.allele2readcount[m.alt] })
	} else {
		may_addformat_singlesample(lst, m, tk)
	}
	if (s.sampleobj) {
		if (tk.ds.cohort && tk.ds.cohort.annotation && tk.ds.cohort.key4annotation) {
			const k4a = s.sampleobj[tk.ds.cohort.key4annotation]
			if (k4a) {
				// has valid key

				lst.push({ k: tk.ds.cohort.key4annotation, v: k4a })

				const na = tk.ds.cohort.annotation[k4a]

				if (na) {
					// can find annotation

					if (tk.ds.cohort.levels) {
						for (const l of tk.ds.cohort.levels) {
							if (!na[l.k]) continue

							lst.push({
								k: l.label || l.k,
								v:
									na[l.k] +
									(l.full && na[l.full] ? ' <span style="font-size:.8em;color:#858585">' + na[l.full] + '</span>' : '')
							})
						}
					} else {
						// no levels, show all from annotation
						for (const k in na) {
							if (k == 'color') continue
							lst.push({ k: k, v: na[k] })
						}
					}
				}
			}
		} else if (s.sampleobj.name) {
			lst.push({ k: 'name', v: s.sampleobj.name })
		}
	}
	client.make_table_2col(holder, lst)
}

function may_addformat_singlesample(lst, m, tk) {
	// quick fix: may add format
	let vcfobj
	if (m.vcfid && tk.ds && tk.ds.id2vcf) vcfobj = tk.ds.id2vcf[m.vcfid]
	if (!vcfobj) return
	if (!vcfobj.format) return
	const s = m.sampledata[0]
	for (const formatfield in vcfobj.format) {
		const formatdesc = vcfobj.format[formatfield]
		if (!(formatfield in s)) continue
		/* following are duplicated from block.mds.svcnv.clickitem.js, lines 1629
		 */
		// if the FORMAT has per-allele value, like AD in vcf 4.2+
		let isperallelevalue = formatdesc.Number == 'R' || formatdesc.Number == 'A'
		if (!isperallelevalue) {
			if (formatfield == 'AD') {
				// vcf 4.1 has AD as '.'
				isperallelevalue = true
			}
		}

		if (isperallelevalue) {
			// per allele value

			const alleles = []
			const values = []
			let altvalue

			// add alt first
			for (const ale in s[formatfield]) {
				if (ale == m.ref) continue
				alleles.push(ale)
				altvalue = s[formatfield][ale]
				values.push(altvalue)
			}

			// add ref after alt
			const refvalue = s[formatfield][m.ref]
			if (refvalue != undefined) {
				alleles.push(m.ref)
				values.push(refvalue)
			}

			let barsvg
			if (refvalue + altvalue > 0) {
				barsvg = client.fillbar(null, { f: altvalue / (altvalue + refvalue) })
			}

			lst.push({
				k: formatfield,
				v:
					(barsvg ? barsvg + ' ' : '') +
					'<span style="font-size:.8em;opacity:.5">' +
					alleles.join(' / ') +
					'</span> ' +
					values.join(' / ') +
					(formatdesc.Description
						? ' <span style="font-size:.7em;opacity:.5">' + formatdesc.Description + '</span>'
						: '')
			})
		} else {
			lst.push({
				k: formatfield,
				v: s[formatfield]
			})
		}
	}
}

function handle_samplecart(mlst, holder, tk, block) {
	if (!block.samplecart || !tk.ds || !tk.ds.sampleselectable) return
	/* select sample API applicable to this track
	will make one single button for selecting sample, independent of how many datatypes
	*/
	const sampleset = new Set()
	for (const m of mlst) {
		if (m.sample) {
			// FIXME hardcoded attribute
			sampleset.add(m.sample)
		}
	}
	if (sampleset.size == 0) {
		// no samples
		return
	}
	// note for selection, try to use mname
	const nameset = new Set()
	for (const m of mlst) {
		const classlab = common.mclass[m.class].label
		let thisnote
		if (m.dt == common.dtfusionrna || m.dt == common.dtsv) {
			if (m.mname) {
				if (m.useNterm) {
					thisnote = (block.usegm ? block.usegm.name + '-' : '') + m.mname + ' ' + classlab
				} else {
					thisnote = m.mname + (block.usegm ? '-' + block.usegm.name : '') + ' ' + classlab
				}
			} else {
				thisnote = (block.usegm ? block.usegm.name : '') + ' ' + classlab
			}
		} else {
			thisnote = (m.mname ? m.mname + ' ' : '') + classlab + (block.usegm ? ' in ' + block.usegm.name : '')
		}
		nameset.add(thisnote)
	}
	let note
	if (nameset.size == 1) {
		note = 'having ' + [...nameset][0]
	} else {
		note = 'having mutations' + (block.usegm ? ' in ' + block.usegm.name : '')
	}

	block.samplecart.setBtns({
		samplelst: [...sampleset],
		id: nameset.size ? [...nameset][0] : block.usegm ? block.usegm.name : '',
		basket: 'Gene Mutation',
		container: holder.append('div').style('margin-left', '10px').append('div')
	})
}
