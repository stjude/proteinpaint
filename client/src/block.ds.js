import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { arc as d3arc } from 'd3-shape'
import { select as d3select } from 'd3-selection'
import { itemtable } from './block.ds.itemtable'
import * as client from './client'
import * as coord from './coord'
import * as common from '#shared/common.js'
import { duplicate as svduplicate } from '#shared/bulk.sv.js'
import * as vcftk from './block.ds.vcf'
import { rendernumerictk } from './block.ds.numericmode'
import may_sunburst from './block.sunburst'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'

/*
a dstk can be vcf, server-hosted ds (sqlite and/or 1 or more vcf)
here do following things for dstk:
- load data by querying server
- parse and add data to the track
- render the skewer track
********************** EXPORTED 
dstkload(tk,block)
	- server query and load data from sqlite/vcf
load2tk(datalst,block,tk)
	- add data to dstk
dstkrender(tk, block)
getter_mcset_key
epaint_may_hl
mlst_pretreat
done_tknodata
********************** INTERNAL
renderskewertk
skewer_make()
showlegend_populationfrequencyfilter
showlegend_vcfinfofilter
showlegend_sampleattribute
legendmenu_vcfinfo
legendmenu_sampleattribute
dsqueryresult_geneexpression()
dsqueryresult_snvindelfusionitd()
*/

// vcfinfofilter in which a variant is not annotated by a given key
const vcfnotannotated_label = 'Not annotated'

// for skewer track
export const middlealignshift = 0.3
export const disclabelspacing = 1 // px spacing between disc and label

/*
cutoff value of # pixel per bp
compared to exonsf
when exonsf>:
	basepairs are visible enough, and group mutation grps by basepair position
else exon<:
	basepairs are too tiny and will group mutations by AA position
*/
export const minbpwidth = 4

const modefold = 0
const modeshow = 1

export async function dstkload(tk, block) {
	/*
	three sources of data
	1. vcf file, server query
	2. client in-memory data
	3. server ds.queries[]
	*/

	try {
		if (!tk) throw 'no tk'
		if (!tk.ds) throw 'no ds'

		if (!block.gmmode || block.gmmode == client.gmmode.genomic) {
			// for dstk, only apply limit in genomic mode
			if (block.viewrangeabovelimit(tk.viewrangeupperlimit)) {
				tk.mlst = []
				tk.viewrangeupperlimit_above = true
				dstkrender(tk, block)
				return
			}
		}
		delete tk.viewrangeupperlimit_above

		if (tk.isvcf) {
			/* is one or a set of vcf tracks
			in this case won't require tk.ds (should be undefined)
			vcf-only, no mixture with db tk
			*/
			block.tkcloakon(tk)
			vcftk.loadvcftk(block, tk)
			return
		}

		if (block.ds2handle[tk.ds.label]) {
			tk.__handlesays = block.ds2handle[tk.ds.label].handlesays // quick fix
		}

		if (tk.ds.bulkdata || tk.ds.mlst) {
			return await dstkload_fromclientdata(tk, block)
		}

		// will query the server-side ds.queries[]
		await dstkload_fromdsquery(tk, block)

		mayAddSubtk_legacyDsFilter(tk, block)

		tk.ds.busy = false
		block.tkcloakoff(tk, {})
	} catch (e) {
		if (e.stack) console.log(e.stack)
		tk.ds.busy = false
		block.tkcloakoff(tk, { error: e.message || e })
		block.setllabel(tk)
		block.block_setheight()
	}
}

function mayAddSubtk_legacyDsFilter(tk, block) {
	if (!tk.legacyDsFilter) return

	if (!tk.legacyDsFilter.key || !tk.legacyDsFilter.value) throw 'legacyDsFilter is not {key,value}'

	const mlst = tk.mlst.filter(m => m[tk.legacyDsFilter.key] == tk.legacyDsFilter.value)
	const _ds = {
		label: tk.ds.label + ' - ' + tk.legacyDsFilter.value,
		bulkdata: {},
		parentname: tk.ds.label,
		iscustom: true,
		sampleselectable: tk.ds.sampleselectable
	}
	_ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
	block.addchilddsnoload(_ds)
	const childtk = block.block_addtk_template({ type: client.tkt.ds, ds: _ds })
	dstkload(childtk, block)
}

async function dstkload_fromclientdata(tk, block) {
	// custom ds with data stored on client
	if (block.usegm) {
		if (tk.__handlesays) {
			tk.__handlesays.style('background-color', '#ddd').style('color', 'black')
		}
		let mlst = []
		if (tk.ds.bulkdata) {
			const lst2 = tk.ds.bulkdata[block.usegm.name.toUpperCase()]
			if (lst2) {
				mlst = [...lst2]
			}
		}
		if (tk.ds.mlst) {
			for (const m of tk.ds.mlst) {
				if (m.gene.toUpperCase() == block.usegm.name.toUpperCase()) {
					mlst.push(m)
				}
			}
		}
		if (mlst.length) {
			const isoformmatch = []
			for (const m of mlst) {
				if (m.isoform && m.isoform == block.usegm.isoform) {
					isoformmatch.push(m)
				}
			}
			if (isoformmatch.length) {
				load2tk([{ lst: isoformmatch }], block, tk)
			} else {
				throw 'No data from ' + tk.ds.label + ' for ' + block.usegm.isoform
			}
		} else {
			throw 'No data from ' + tk.ds.label + ' for ' + block.usegm.name
		}
		if (tk.ds.dbexpression && (!tk.eplst || tk.eplst.length == 0)) {
			// custom expression set
			const par = {
				jwt: block.jwt,
				db: tk.ds.dbexpression.dbfile,
				tablename: tk.ds.dbexpression.tablename,
				keyname: tk.ds.dbexpression.keyname,
				key: block.usegm.name
			}
			const data = await client.dofetch2('dbdata', { method: 'POST', body: JSON.stringify(par) })
			if (data.error) throw data.error
			if (!tk.eplst) tk.eplst = []
			if (tk.ds.dbexpression.tidy) tk.ds.dbexpression.tidy(data.rows)
			const eparg = {
				data: data.rows,
				expp: tk.ds.dbexpression.config,
				block,
				genome: block.genome,
				genename: block.usegm.name,
				dsname: tk.ds.label
			}
			const p = await import('./ep')
			tk.eplst.push(new p.default(eparg))
		}
	} else {
		// genomic view
		const mlst = []
		const chrset = new Map()
		for (const r of block.rglst) {
			if (!chrset.has(r.chr)) {
				chrset.set(r.chr, [])
			}
			chrset.get(r.chr).push(r)
		}
		const allmlst = []
		if (tk.ds.bulkdata) {
			for (const k in tk.ds.bulkdata) {
				allmlst.push(...tk.ds.bulkdata[k])
			}
		}
		if (tk.ds.mlst) {
			allmlst.push(...tk.ds.mlst)
		}
		for (const m of allmlst) {
			switch (m.dt) {
				case common.dtsnvindel:
				case common.dtitd:
				case common.dtdel:
				case common.dtnloss:
				case common.dtcloss:
					if (!m.pos) {
						break
					}
					if (!m.chr && !chrset.has(m.chr)) {
						break
					}
					for (const r of chrset.get(m.chr)) {
						if (m.pos >= r.start && m.pos < r.stop) {
							mlst.push(m)
							break
						}
					}
					break
				case common.dtsv:
				case common.dtfusionrna:
					if (!m.pairlst) {
						break
					}
					let hit = false
					for (const pair of m.pairlst) {
						// a
						if (pair.a.chr && chrset.has(pair.a.chr)) {
							const pos = pair.a.position || pair.a.pos
							if (pos) {
								for (const r of chrset.get(pair.a.chr)) {
									if (pos >= r.start && pos < r.stop) {
										hit = true
										break
									}
								}
							}
						}
						// b
						if (pair.b.chr && chrset.has(pair.b.chr)) {
							const pos = pair.b.position || pair.b.pos
							if (pos) {
								for (const r of chrset.get(pair.b.chr)) {
									if (pos >= r.start && pos < r.stop) {
										hit = true
										break
									}
								}
							}
						}
					}
					if (hit) {
						mlst.push(m)
					}
					break
				// end of switch
			}
		}
		if (mlst.length) {
			load2tk([{ lst: mlst }], block, tk)
		}
	}
}

async function dstkload_fromdsquery(tk, block) {
	if (tk.__handlesays) tk.__handlesays.text('Loading...')
	tk.ds.busy = true
	block.tkcloakon(tk)

	const par = {
		genome: block.genome.name,
		dsname: tk.ds.label,
		range: block.tkarg_maygm(tk)[0] // FIXME no support for rglst!
	}
	if (block.usegm) {
		par.genename = block.usegm.name
		par.isoform = block.usegm.isoform
	}
	if (tk.eplst) {
		// hard-coded
		// means this track has already been loaded
		par.noexpression = 1
	}
	if (block.hidedatasetexpression) {
		// embed customization
		par.noexpression = 1
	}
	// ?? how to define regulatory regions associated with a gene (retrieve and show it by default)
	// ?? how to retrieve data over regulatory region from a db

	const data = await client.dofetch2('dsdata', { method: 'POST', body: JSON.stringify(par) })
	if (tk.__handlesays) {
		tk.__handlesays.text(tk.ds.label).style('background-color', '#ddd').style('color', 'black')
	}
	if (data.error) throw data.error
	load2tk(data.data, block, tk)
}

export function load2tk(datalst, block, tk) {
	if (tk.dsuninitiated) {
		// pull from tklst
		for (let i = 0; i < block.tklst.length; i++) {
			if (block.tklst[i].tkid == tk.tkid) {
				block.tklst.splice(i, 1)
				break
			}
		}
		delete tk.dsuninitiated
		// above or below pbar
		let gmtkidx = -1
		for (let i = 0; i < block.tklst.length; i++) {
			const t = block.tklst[i]
			if (t.type == client.tkt.usegm && !t.hidden) {
				gmtkidx = i
				break
			}
		}

		let aboveprotein = true

		if (gmtkidx == -1) {
			// no gmtk shown, just add
			aboveprotein = true
			block.tklst.push(tk)
		} else {
			// has gmtk
			let dsabove = false
			for (let i = 0; i < gmtkidx; i++) {
				const t = block.tklst[i]
				if (!t.hidden && t.type == client.tkt.ds) {
					dsabove = true
					break
				}
			}
			if (dsabove) {
				// this dstk to below gmtk
				aboveprotein = false
				block.tklst.splice(gmtkidx + 1, 0, tk)
			} else {
				// to above
				aboveprotein = true
				if (gmtkidx == 0) {
					block.tklst.unshift(tk)
				} else {
					block.tklst.splice(gmtkidx - 1, 0, tk)
				}
			}
		}

		if (tk.aboveprotein == undefined) {
			// do not override pointdown
			tk.aboveprotein = aboveprotein
		}

		tk.eplst = [] // only do it here!!!
	} else {
		// already in block.tklst, don't insert
	}
	// parse data
	tk.mlst = []

	/*
	pediatric has 2 ep
	will need to shift 2nd panel position
	*/
	const eploaders = []

	for (const dat of datalst) {
		// individual queries in this dataset
		if (dat.isgeneexpression) {
			eploaders.push(dsqueryresult_geneexpression(dat, tk, block))
			continue
		}
		if (dat.vcfid) {
			// single vcf
			vcftk.data2tk(dat, tk, block)
			continue
		}
		if (dat.lst) {
			// variant dataset
			dsqueryresult_snvindelfusionitd(dat.lst, tk, block)
			may_print_stratifycountfromserver(dat, tk)
			continue
		}
		block.error('unknown data/query type from ' + tk.ds.label)
		return
	}

	Promise.all(eploaders).then(() => {
		if (tk.eplst.length > 1) {
			for (let i = 1; i < tk.eplst.length; i++) {
				const ep = tk.eplst[i]
				ep.pane.pane.style('left', Number.parseInt(tk.eplst[0].pane.pane.style('left')) + 50 * i + 'px')
				ep.pane.pane.style('top', Number.parseInt(tk.eplst[0].pane.pane.style('top')) + 50 * i + 'px')
			}
		}
	})

	dstkrender(tk, block)
}

export function dstkrender(tk, block) {
	/*
tk.mlst[] is set
*/

	block.tkcloakoff(tk, {})

	mlst_set_occurrence(tk)

	if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4numeric != undefined) {
		if (!tk.numericmode) {
			// entering numeric mode
			tk.numericmode = { axisheight: tk.axisheight }
		}
	} else {
		delete tk.numericmode
	}

	/*
	jinghui asked to hide all nonpathogenic germline variants by default
	set common.morigin.GNP.hidden=true
	upon first rendering ds track, block.legend.morigins is not made yet, so no way of knowing who to hide by default
	*/
	const originhidden = new Set()
	for (const k in common.morigin) {
		if (common.morigin[k].hidden) {
			originhidden.add(k)
		}
	}

	vcfinfofilter_mayupdateautocategory(tk, block)

	if (tk.numericmode) {
		rendernumerictk(tk, block, originhidden)
	} else {
		renderskewertk(tk, block, originhidden)
	}

	block.setllabel(tk)

	block.block_setheight()

	block.tkchangeaffectlegend(tk)

	/*
	custom class, vcf info fields, sample annotation
	stuff to show on legend
	*/
	showlegend_vcfinfofilter(tk, block)
	showlegend_populationfrequencyfilter(tk, block)
	{
		const err = showlegend_sampleattribute(tk, block)
		if (err) console.log('showlegend_sampleattribute: ' + err)
	}
}

function mlst_set_occurrence(tk) {
	/*
handle multiple ways of assigning occurrence
.occurrence now applies to all legacy ds track, applications:
- skewer graph to decide dot size
- sunburst
*/
	if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4occurrence != undefined) {
		const mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4occurrence]
		if (!mcset) throw 'mcset not found by setidx4occurrence'
		for (const m of tk.mlst) {
			const [err, vlst] = getter_mcset_key(mcset, m)
			if (err || vlst == undefined) {
				m.occurrence = 1
			} else {
				m.occurrence = vlst[0]
			}
		}
	} else {
		// occurrence may not apply to the data at all, but still assigning it
		for (const m of tk.mlst) {
			m.occurrence = 1
		}
	}
}

function renderskewertk(tk, block, originhidden) {
	/*
	makes:
	tk.data
	tk.skewer
	tk.maxskewerheight
	*/

	tk.leftaxis.selectAll('*').remove() // in case turned from numericmode

	// when to skip grouping
	if (block.usegm && block.gmmode != client.gmmode.genomic && block.pannedpx != undefined && tk.skewer) {
		// in gmmode, browser panned, no re-requesting data
		// no need to re-group
		// set x

		tkdata_update_x(tk, block)

		tk.skewer.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		settle_glyph(tk, block)
	} else {
		// create group and skewer anew
		tk.glider.selectAll('*').remove()

		const usemlst = mlst_pretreat(tk, block, originhidden)

		const x2mlst = new Map()
		for (const m of tk.mlst) {
			if (m.__x == undefined) {
				// dropped by filter
				continue
			}
			if (!x2mlst.has(m.__x)) {
				x2mlst.set(m.__x, [])
			}
			x2mlst.get(m.__x).push(m)
		}
		const datagroup = []
		const topxbins = []
		// by resolution
		if (block.exonsf >= minbpwidth) {
			// # pixel per nt is big enough
			// group by each nt
			for (const [x, mlst] of x2mlst) {
				datagroup.push({
					chr: mlst[0].chr,
					pos: mlst[0].pos,
					mlst: mlst,
					x: x,
					groups: mlst2disc(mlst, tk)
				})
			}
		} else {
			// # pixel per nt is too small
			if (block.usegm && block.usegm.coding && block.gmmode != client.gmmode.genomic) {
				// by aa
				// in gmsum, rglst may include introns, need to distinguish symbolic and rglst introns, use __x difference by a exonsf*3 limit
				const aa2mlst = new Map()
				for (const [x, mlst] of x2mlst) {
					if (mlst[0].chr != block.usegm.chr) {
						continue
					}
					// TODO how to identify if mlst belongs to regulatory region rather than gm
					let aapos = undefined
					for (const m of mlst) {
						if (Number.isFinite(m.aapos)) aapos = m.aapos
					}
					if (aapos == undefined) {
						aapos = coord.genomic2gm(mlst[0].pos, block.usegm).aapos
					}
					if (aapos == undefined) {
						console.error('data item cannot map to aaposition')
						console.log(mlst[0])
						continue
					}
					x2mlst.delete(x)
					if (!aa2mlst.has(aapos)) {
						aa2mlst.set(aapos, [])
					}
					let notmet = true
					for (const lst of aa2mlst.get(aapos)) {
						if (Math.abs(lst[0].__x - mlst[0].__x) <= block.exonsf * 3) {
							for (const m of mlst) {
								lst.push(m)
							}
							notmet = false
							break
						}
					}
					if (notmet) {
						aa2mlst.get(aapos).push(mlst)
					}
				}
				const utr5len = block.usegm.utr5 ? block.usegm.utr5.reduce((i, j) => i + j[1] - j[0], 0) : 0
				for (const llst of aa2mlst.values()) {
					for (const mlst of llst) {
						let m = null
						for (const m2 of mlst) {
							if (Number.isFinite(m2.rnapos)) m = m2
						}
						if (m == null) {
							console.log('trying to map mlst to codon, but no rnapos found')
							for (const m of mlst) {
								console.log(m)
							}
							continue
						}
						datagroup.push({
							chr: mlst[0].chr,
							pos: m.pos,
							mlst: mlst,
							x: mlst[0].__x,
							groups: mlst2disc(mlst, tk)
						})
					}
				}
			}
			// leftover by px bin
			const pxbin = []
			const binpx = 2
			for (const [x, mlst] of x2mlst) {
				const i = Math.floor(x / binpx)
				if (!pxbin[i]) {
					pxbin[i] = []
				}
				pxbin[i] = [...pxbin[i], ...mlst]
			}
			for (const mlst of pxbin) {
				if (!mlst) continue
				const xsum = mlst.reduce((i, j) => i + j.__x, 0)
				datagroup.push({
					isbin: true,
					chr: mlst[0].chr,
					pos: mlst[0].pos,
					mlst: mlst,
					x: xsum / mlst.length,
					groups: mlst2disc(mlst, tk)
				})
			}
		}
		datagroup.sort((a, b) => a.x - b.x)
		if (tk.data && block.pannedpx != undefined && (!block.usegm || block.gmmode == client.gmmode.genomic)) {
			// inherit genomic mode and panned
			const pastmode = {}
			for (const g of tk.data) {
				pastmode[g.chr + '.' + g.pos] = {
					mode: g.showmode,
					xoffset: g.xoffset,
					slabelrotate: g.slabelrotate // no effect
				}
			}
			for (const g of datagroup) {
				const k = g.chr + '.' + g.pos
				if (pastmode[k]) {
					g.showmode = pastmode[k].mode
					g.xoffset = pastmode[k].xoffset
					g.slabelrotate = pastmode[k].slabelrotate
				}
			}
		}
		tk.data = datagroup
		for (const d of tk.data) {
			d.occurrence = d.groups.reduce((i, j) => i + j.occurrence, 0)
		}
		skewer_make(tk, block)
		tk.height_main = tk.toppad + tk.maxskewerheight + tk.stem1 + tk.stem2 + tk.stem3 + tk.bottompad
	}

	if (!tk.data || tk.data.length == 0) {
		done_tknodata(tk, block)
		return
	}

	/*
	variants loaded for this track
	*/

	if (tk.hlaachange || tk.hlvariants) {
		/*
		for any variants to be highlighted, expanded and fold all the others
		*/
		const fold = []
		const unfold = []

		if (tk.hlaachange) {
			// is map
			for (const d of tk.data) {
				let has = false
				for (const g of d.groups) {
					if (tk.hlaachange.has(g.mlst[0].mname)) {
						has = true
						tk.hlaachange.delete(g.mlst[0].mname)
						break
					}
				}
				if (has) {
					unfold.push(d)
				} else {
					fold.push(d)
				}
			}
			if (tk.hlaachange.size) {
				if (!block.usegm) {
					block.error('cannot add items from hlaachange: not in gene-mode')
				} else {
					hlaachange_addnewtrack(tk, block)
				}
			}
			delete tk.hlaachange
		}

		if (tk.hlvariants) {
			// is array
			const hlkeys = {}
			for (const m of tk.hlvariants) {
				hlkeys[m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt] = 1
			}

			for (const d of tk.data) {
				let has = false
				for (const g of d.groups) {
					if (has) {
						break
					}
					for (const m of g.mlst) {
						if (hlkeys[m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt]) {
							has = true
							break
						}
					}
				}
				if (has) {
					unfold.push(d)
				} else {
					fold.push(d)
				}
			}
		}

		fold_glyph(fold, tk)
		unfold_glyph(unfold, tk, block)
	} else {
		// natural expand
		settle_glyph(tk, block)
	}
}

function group2occurrence(g, tk) {
	if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4occurrence != undefined) {
		const mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4occurrence]
		const [err, vlst] = getter_mcset_key(mcset, g.mlst[0])
		if (err || vlst == undefined) return 1
		return vlst[0]
	}
	return g.mlst.length
}

function mlst2disc(mlst, tk) {
	const k2g = new Map()
	for (const m of mlst) {
		switch (m.dt) {
			case common.dtsnvindel:
				if (!k2g.has(m.dt)) {
					k2g.set(m.dt, new Map())
				}
				if (!k2g.get(m.dt).has(m.class)) {
					k2g.get(m.dt).set(m.class, new Map())
				}
				const n = m.mname || ''
				if (!k2g.get(m.dt).get(m.class).has(n)) {
					k2g.get(m.dt).get(m.class).set(n, [])
				}
				k2g.get(m.dt).get(m.class).get(n).push(m)
				break
			case common.dtsv:
			case common.dtfusionrna:
				if (!k2g.has(m.dt)) {
					k2g.set(m.dt, new Map())
				}
				if (!k2g.get(m.dt).has(m.class)) {
					k2g.get(m.dt).set(m.class, {
						use5: new Map(),
						use3: new Map()
					})
				}
				if (m.useNterm) {
					if (!k2g.get(m.dt).get(m.class).use5.has(m.mname)) {
						k2g.get(m.dt).get(m.class).use5.set(m.mname, [])
					}
					k2g.get(m.dt).get(m.class).use5.get(m.mname).push(m)
				} else {
					if (!k2g.get(m.dt).get(m.class).use3.has(m.mname)) {
						k2g.get(m.dt).get(m.class).use3.set(m.mname, [])
					}
					k2g.get(m.dt).get(m.class).use3.get(m.mname).push(m)
				}
				break
			case common.dtitd:
			case common.dtdel:
			case common.dtnloss:
			case common.dtcloss:
				if (!k2g.has(m.dt)) {
					k2g.set(m.dt, [])
				}
				k2g.get(m.dt).push(m)
				break
			default:
				console.log('unknown datatype: ' + m.dt)
				console.log(m)
				return
		}
	}
	const groups = []
	for (const [dt, tmp] of k2g) {
		switch (dt) {
			case common.dtsnvindel:
				for (const t2 of tmp.values()) {
					for (const mlst of t2.values()) {
						groups.push({
							dt: dt,
							mlst: mlst
						})
					}
				}
				break
			case common.dtsv:
			case common.dtfusionrna:
				for (const classset of tmp.values()) {
					for (const mlst of classset.use5.values()) {
						groups.push({
							dt: dt,
							useNterm: true,
							mlst: mlst
						})
					}
					for (const mlst of classset.use3.values()) {
						groups.push({
							dt: dt,
							useNterm: false,
							mlst: mlst
						})
					}
				}
				break
			case common.dtitd:
			case common.dtdel:
			case common.dtnloss:
			case common.dtcloss:
				groups.push({
					dt: dt,
					mlst: tmp
				})
		}
	}
	for (const g of groups) {
		let rim1count = 0,
			rim2count = 0
		for (const m of g.mlst) {
			if (m.isrim1) rim1count++
			else if (m.isrim2) rim2count++
		}
		g.rim1count = rim1count
		g.rim2count = rim2count
		g.occurrence = g.mlst.reduce((i, j) => i + j.occurrence, 0) //group2occurrence(g, tk)
	}
	groups.sort((a, b) => {
		return b.occurrence - a.occurrence
	})
	return groups
}

function skewer_make(tk, block) {
	/*
new things:
itd/del stacked bars
custom mclass from vcfinfofilter
*/

	delete tk.skewer2

	const color4disc = m => {
		if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4mclass != undefined) {
			const mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4mclass]

			const [err, vlst] = getter_mcset_key(mcset, m)

			if (err || vlst == undefined) return 'black'

			for (const v of vlst) {
				// no choice but simply use first value to ever have a valid color
				if (mcset.categories[v]) {
					return mcset.categories[v].color
				} else {
					return 'black'
				}
			}
		}

		// mclass
		if (common.mclass[m.class]) {
			return common.mclass[m.class].color
		}
		return 'black'
	}

	// ITD/DEL stacked bars
	const stackbars = []
	for (const d of tk.data) {
		d.x0 = d.x
		if (d.xoffset != undefined) {
			d.x = d.x0 + d.xoffset
		}
		// updates x
		// create stack bars
		for (const g of d.groups) {
			g.aa = d // disc reference group
			let rnaspan = null
			if (g.dt == common.dtitd) {
				rnaspan = g.mlst[0].rnaduplength
				for (const m of g.mlst) {
					rnaspan = Math.max(rnaspan, m.rnaduplength)
				}
			} else if (g.dt == common.dtdel) {
				rnaspan = g.mlst[0].rnadellength
				for (const m of g.mlst) {
					rnaspan = Math.max(rnaspan, m.rnadellength)
				}
			} else {
				// no business
				continue
			}
			// no isInteger, rna position can have .5
			if (!Number.isFinite(rnaspan) || rnaspan < 0) {
				// support if genomic pos is available
				console.log('no rnaspan for stack bar from itd/del')
				console.log(g.mlst)
				continue
			}
			let pxspan = null
			if (block.usegm) {
				const rnapos = g.mlst[0].rnapos // rnapos should always be available!
				const genomicpos = coord.rna2gmcoord(rnapos + rnaspan, block.usegm)
				const hits = block.seekcoord(block.usegm.chr, genomicpos)
				if (hits.length > 0) {
					pxspan = hits[0].x - d.x
				} else {
					console.log(genomicpos + ' no hit on rglst')
				}
			}
			if (!Number.isFinite(pxspan)) {
				console.log('no pxspan for stack bar from itd/del')
				console.log(g.mlst)
				continue
			}
			g.stackbar = {
				aa: d.mlst[0].aapos,
				pxspan: pxspan,
				height: 4, // fixed bar height
				grp: g
			}
			d.hasstackbar = true
			stackbars.push(g.stackbar)
		}
	}
	let stackbarmaxheight = 0 // for setting stem3
	// TODO stairs may replace stackbars
	if (stackbars.length > 0) {
		let ypad = 1
		for (let i = 0; i < stackbars.length; i++) {
			const si = stackbars[i]
			const overlap = []
			for (let j = 0; j < i; j++) {
				const sj = stackbars[j]
				if (Math.max(si.aa, sj.aa) < Math.min(si.pxspan + si.aa, sj.pxspan + sj.aa)) {
					overlap.push(sj)
				}
			}
			si.y = 2
			for (const sj of overlap) {
				if (Math.max(si.y, sj.y) < Math.min(si.y + si.height, sj.y + sj.height)) {
					si.y = sj.y + sj.height + ypad
				}
			}
			stackbarmaxheight = Math.max(stackbarmaxheight, si.y + si.height)
		}
	}

	const dotwidth = Math.max(14, block.width / 110)
	// create skewers for all data (single or multiple) and compute width

	// get max m count for discs, for scaling disc radius
	let mdc = 0
	for (const d of tk.data) {
		for (const g of d.groups) {
			mdc = Math.max(mdc, g.occurrence)
		}
	}
	let mrd = 0 // max disc radius
	const w = Math.pow(dotwidth / 2, 2) * Math.PI // unit area
	if (mdc <= 10) mrd = w * mdc * 0.9
	else if (mdc <= 100) mrd = w * 10
	else if (mdc <= 1000) mrd = w * 14
	else mrd = w * 20
	// scale for disc radius
	const sf_discradius = scaleLinear()
		.domain([1, mdc * 0.5, mdc * 0.6, mdc * 0.7, mdc * 0.8, mdc])
		.range([w, w + (mrd - w) * 0.8, w + (mrd - w) * 0.85, w + (mrd - w) * 0.9, w + (mrd - w) * 0.95, mrd])
	let globalmaxradius = dotwidth / 2
	tk.maxskewerheight = 0
	tk.skewer = tk.glider
		.selectAll()
		.data(tk.data)
		.enter()
		.append('g')
		.attr('class', 'sja_skg')
		.each(function (d) {
			// determine dimension for this skewer, do not position or render yet
			// compute radius for each group
			d.skewer = this
			if (d.showmode == undefined) {
				d.showmode = modefold
			} else {
				// has already been set by past data from genomic panning
			}
			d.maxradius = 0
			d.maxrimwidth = 0
			d.width = 0
			d.slabelrotate = false
			d.slabelwidth = 0
			for (const r of d.groups) {
				if (r.occurrence == 1) {
					r.radius = dotwidth / 2
				} else {
					const digc = r.occurrence.toString().length
					r.radius = Math.max(Math.sqrt(sf_discradius(r.occurrence) / Math.PI), digc * 5)
				}
				d.maxradius = Math.max(d.maxradius, r.radius)
				globalmaxradius = Math.max(globalmaxradius, r.radius)

				r.rimwidth = r.rim1count + r.rim2count == 0 ? 0 : Math.max(2, r.radius / 6)
				d.maxrimwidth = Math.max(d.maxrimwidth, r.rimwidth)
			}
			let totalheight = 0
			for (const r of d.groups) {
				r.yoffset = totalheight + r.radius + r.rimwidth // immutable, y shift at expand mode
				totalheight += (r.radius + r.rimwidth) * 2
			}
			tk.maxskewerheight = Math.max(tk.maxskewerheight, totalheight)
		})
	// disc containers
	const discg = tk.skewer
		.selectAll()
		.data(d => d.groups)
		.enter()
		.append('g')
		.attr(
			'transform',
			d => 'translate(0,' + (d.aa.showmode == modefold ? 0 : d.yoffset * (tk.aboveprotein ? -1 : 1)) + ')'
		)
		.attr('class', 'sja_aa_discg')
		.each(function (d) {
			d.g = this
		})
	// actual disc
	const discdot = discg.append('circle')
	// hollow disc
	discdot
		.filter(d => d.dt == common.dtitd || d.dt == common.dtdel || d.dt == common.dtnloss || d.dt == common.dtcloss)
		.attr('fill', 'white')
		.attr('stroke-width', 2)
		.attr('stroke', d => color4disc(d.mlst[0]))
		.attr('r', d => d.radius - 2)
	// full filled
	discdot
		.filter(d => d.dt == common.dtsnvindel || d.dt == common.dtsv || d.dt == common.dtfusionrna)
		.attr('fill', d => color4disc(d.mlst[0]))
		.attr('stroke', 'white')
		.attr('r', d => d.radius - 0.5)
	// masking half
	discg
		.filter(d => d.dt == common.dtfusionrna || d.dt == common.dtsv)
		.append('path')
		.attr('fill', 'white')
		.attr('stroke', 'none')
		.attr('d', d =>
			d3arc()({
				innerRadius: 0,
				outerRadius: d.radius - 2,
				startAngle: d.useNterm ? 0 : Math.PI,
				endAngle: d.useNterm ? Math.PI : Math.PI * 2
			})
		)
	// number in disc
	const textslc = discg
		.filter(d => d.occurrence > 1)
		.append('text')
		.text(d => d.occurrence)
		.attr('font-family', client.font)
		.attr('class', 'sja_aa_discnum')
		.attr('fill-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('stroke-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('text-anchor', 'middle')
		.each(d => {
			const s = d.radius * 1.5
			d.discnumfontsize = Math.min(s / (d.occurrence.toString().length * client.textlensf), s)
		})
		.attr('font-size', d => d.discnumfontsize)
		.attr('y', d => d.discnumfontsize * middlealignshift)
	textslc.filter(d => d.dt == common.dtsnvindel).attr('fill', 'white')
	textslc
		.filter(d => d.dt == common.dtsv || d.dt == common.dtfusionrna)
		.attr('stroke', d => color4disc(d.mlst[0]))
		.attr('stroke-width', 0.8)
		.attr('font-weight', 'bold')
		.attr('fill', 'white')
	textslc
		.filter(d => d.dt == common.dtitd || d.dt == common.dtdel || d.dt == common.dtcloss || d.dt == common.dtnloss)
		.attr('fill', d => color4disc(d.mlst[0]))
	// right-side label
	const textlab = discg
		.append('text')
		.text(d => d.mlst[0].mname)
		.attr('font-size', d => {
			d._labfontsize = Math.max(12, d.radius * 1.2)
			return d._labfontsize
		})
		.each(function (d) {
			// after setting font size, set skewer width by label width
			const lw = this.getBBox().width
			d._label_width = lw
			if (d.aa.groups.length == 1) {
				d.aa.slabelrotate = true
				d.aa.slabelwidth = lw
				// skewer has single disc, label may rotate up, thus should be considerred in maxskewerheight
				tk.maxskewerheight = Math.max(tk.maxskewerheight, (d.radius + d.rimwidth) * 2 + 2 + lw)
			}
		})
		.attr('fill', d => color4disc(d.mlst[0]))
		.attr('x', d => d.radius + d.rimwidth + 1)
		.attr('y', d => d._labfontsize * middlealignshift)
		.attr('font-family', client.font)
		.classed('sja_aa_disclabel', true)
		.attr('fill-opacity', d => (d.aa.showmode == modefold ? 0 : 1))
		.attr('transform', 'scale(1) rotate(0)')
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('click', (event, d) => {
			fold_glyph([d.aa], tk)
			unfold_update(tk, block)
			if (block.debugmode) {
				console.log(d.aa)
			}
		})

	if (tk.hlaachange) {
		// special effect for highlighted variants
		//const big=1.3
		textlab.filter(d => tk.hlaachange.has(d.mlst[0].mname)).classed('sja_pulse', true)
		/*
	.attr('font-weight',(d)=>{
		return tk.hlaachange.has(d.mlst[0].mname) ? 'bold' : 'normal'
	})
	.attr('font-size',(d)=>{
		return d._labfontsize*big
	})
	.attr('y',d=> d._labfontsize*big*middlealignshift)
	*/
	}

	// skewer width
	for (const d of tk.data) {
		let leftw = 0,
			rightw = 0
		for (const g of d.groups) {
			leftw = Math.max(leftw, g.radius + g.rimwidth)
			rightw = Math.max(rightw, g.radius + g.rimwidth + disclabelspacing + g._label_width)
		}
		d.width = leftw + rightw
	}

	// invisible kicking disc cover
	discg
		.append('circle')
		.attr('r', d => d.radius - 0.5)
		.attr('stroke', d => color4disc(d.mlst[0]))
		.attr('class', 'sja_aa_disckick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke-opacity', 0)
		.on('mousedown', event => {
			event.stopPropagation()
		})
		.on('mouseover', (event, d) => {
			if (tk.disc_mouseover) {
				tk.disc_mouseover(d, event.target)
			} else {
				epaint_may_hl(tk, d.mlst, true)
			}
		})
		.on('mouseout', (event, d) => {
			if (tk.disc_mouseout) {
				tk.disc_mouseout(d)
			} else {
				epaint_may_hl(tk, d.mlst, false)
			}
		})
		.on('click', async (event, d) => {
			const p = event.target.getBoundingClientRect()
			if (d.dt == common.dtfusionrna || d.dt == common.dtsv) {
				// svgraph
				itemtable({
					mlst: d.mlst,
					pane: true,
					x: p.left - 10,
					y: p.top - 10,
					tk,
					block,
					svgraph: true
				})
				return
			}
			if (d.occurrence == 1) {
				// table for single
				itemtable({ mlst: d.mlst, pane: true, x: p.left - 10, y: p.top - 10, tk: tk, block: block })
				return
			}
			if (
				await may_sunburst(
					d.occurrence,
					d.mlst,
					d.aa.x,
					skewer_sety(d, tk) + d.yoffset * (tk.aboveprotein ? -1 : 1),
					tk,
					block
				)
			) {
				return
			}
			// many items to table
			itemtable({
				mlst: d.mlst,
				pane: true,
				x: p.left - 10,
				y: p.top - 10,
				tk,
				block
			})
		})

	// disc rims
	const rimfunc = d3arc()
		.innerRadius(d => d.radius)
		.outerRadius(d => d.radius + d.rimwidth)
		.startAngle(0)
		.endAngle(d => {
			d.rim1_startangle = (Math.PI * 2 * d.rim1count) / d.occurrence
			return d.rim1_startangle
		})
	discg
		.append('path')
		.attr('d', rimfunc)
		.attr('fill', d => color4disc(d.mlst[0]))
		.attr('class', 'sja_aa_discrim')
		.attr('fill-opacity', 0)
	const rimfunc2 = d3arc()
		.innerRadius(d => d.radius + 0.5)
		.outerRadius(d => d.radius + 0.5 + d.rimwidth)
		.startAngle(d => d.rim1_startangle)
		.endAngle(d => d.rim1_startangle + (Math.PI * 2 * d.rim2count) / d.occurrence)
	discg
		.filter(d => d.rim2count > 0)
		.append('path')
		.attr('d', rimfunc2)
		.attr('stroke', d => color4disc(d.mlst[0]))
		.attr('fill', 'none')
		.attr('class', 'sja_aa_discrim')
		.attr('stroke-opacity', 0)
	// set stem lengths
	{
		// stem 1,2
		let lapcount = 0
		let lastx = 0
		for (const d of tk.data) {
			if (d.x - d.maxradius - d.maxrimwidth < lastx) {
				lapcount++
			}
			lastx = Math.max(lastx, d.x + d.width - d.maxradius - d.maxrimwidth)
		}
		// stem1
		tk.stem1 = lapcount == 0 ? 0 : dotwidth
		// stem2
		tk.stem2 = scaleLinear()
			.domain([0, 1, tk.data.length])
			.range([0, dotwidth, dotwidth * 3])(lapcount)
	}
	// stem3
	const hbaseline = dotwidth * 0.7
	// to set stem3, get max group size
	let maxm = 0
	for (const d of tk.data) {
		for (const g of d.groups) {
			maxm = Math.max(maxm, g.occurrence)
		}
	}
	tk.stem3 = Math.max(stackbarmaxheight + 2, hbaseline + dotwidth * Math.min(5, maxm))
	// invisible kicking skewer cover when folded
	tk.skewer
		.append('circle')
		.attr('class', 'sja_aa_skkick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke', 'none')
		.attr('r', d => d.maxradius + 1)
		.attr('cy', d => (tk.aboveprotein ? -1 : 1) * d.maxradius)
		.attr('transform', d => 'scale(' + (d.showmode == modefold ? 1 : 0) + ')')
		.on('mouseover', (event, d) => {
			epaint_may_hl(tk, d.mlst, true)
			const abp = tk.aboveprotein
			let cumh = 0
			let boxw = 0
			const hpad = 5
			const tiph = abp ? 7 : 14
			for (const g of d.groups) {
				g.pica_fontsize = Math.max(11, g.radius)
				cumh += g.pica_fontsize + 1
				tk.pica.g
					.append('text')
					.text(g.mlst[0].mname + (g.occurrence > 1 ? ' x' + g.occurrence : ''))
					.attr('font-size', g.pica_fontsize)
					.each(function () {
						boxw = Math.max(boxw, this.getBBox().width)
					})
					.remove()
			}
			boxw += hpad * 2
			const boxh = cumh + 5
			tk.pica.g
				.append('rect')
				.attr('y', abp ? -boxh : 0)
				.attr('width', boxw)
				.attr('height', boxh)
				.attr('fill', 'white')
				.attr('fill-opacity', 0.8)
				.attr('stroke', '#ccc')
				.attr('shape-rendering', 'crispEdges')
			cumh = 0
			const _g = tk.pica.g
				.selectAll()
				.data(d.groups)
				.enter()
				.append('g')
				.attr('transform', (g, i) => {
					cumh += g.pica_fontsize + 1
					return 'translate(' + hpad + ',' + cumh * (abp ? -1 : 1) + ')'
				})
			_g.append('text')
				.text(g => g.mlst[0].mname)
				.attr('font-size', g => g.pica_fontsize)
				.each(function (g) {
					g.pica_mlabelwidth = this.getBBox().width
				})
				.attr('fill', d => color4disc(d.mlst[0]))
				.attr('dominant-baseline', abp ? 'hanging' : 'auto')
			const firstlabw = d.groups[0].pica_mlabelwidth
			tk.pica.x = d.x - hpad - firstlabw / 2
			tk.pica.y = d.y + (abp ? -1 : 1) * (d.maxradius * 2 + tiph + 2)
			tk.pica.g.attr('transform', 'translate(' + tk.pica.x + ',' + tk.pica.y + ')')
			_g.filter(g => g.occurrence > 1)
				.append('text')
				.text(g => 'x' + g.occurrence)
				.attr('x', g => g.pica_mlabelwidth + 5)
				.attr('font-size', g => g.pica_fontsize)
				.attr('dominant-baseline', abp ? 'hanging' : 'auto')
				.attr('fill', '#9e9e9e')
			const handle = tk.pica.g
				.append('g')
				.attr('transform', 'translate(' + (hpad + firstlabw / 2) + ',' + (abp ? 1 : -1) + ')')
			handle
				.append('line')
				.attr('y2', (abp ? 1 : -1) * tiph)
				.attr('stroke', '#858585')
				.attr('shape-rendering', 'crispEdges')
			handle
				.append('line')
				.attr('x1', -1)
				.attr('x2', -1)
				.attr('y2', (abp ? 1 : -1) * tiph)
				.attr('stroke', 'white')
				.attr('shape-rendering', 'crispEdges')
			handle
				.append('line')
				.attr('x1', 1)
				.attr('x2', 1)
				.attr('y2', (abp ? 1 : -1) * tiph)
				.attr('stroke', 'white')
				.attr('shape-rendering', 'crispEdges')
		})
		.on('mouseout', (event, d) => {
			tk.pica.g.selectAll('*').remove()
			epaint_may_hl(tk, d.mlst, false)
		})
		.on('click', (event, d) => {
			tk.pica.g.selectAll('*').remove()
			unfold_glyph([d], tk, block)
		})
	// set fold y offset
	// get max mcount for skewers
	let mm = 0
	for (const d of tk.data) {
		mm = Math.max(mm, d.occurrence)
	}
	const sf_foldyoff = scaleLinear()
		.domain([1, mm])
		.range([hbaseline, tk.stem3 - globalmaxradius])
	tk.skewer.attr('transform', d => {
		d.foldyoffset = sf_foldyoff(d.occurrence)
		d.y = skewer_sety(d, tk)
		return 'translate(' + d.x + ',' + d.y + ')'
	})
	if (stackbars.length > 0) {
		// stack bars, make this before stem
		tk.skewer
			.filter(d => d.hasstackbar)
			.selectAll()
			.data(d => {
				const bars = []
				for (const g of d.groups) {
					if (g.stackbar) {
						bars.push(g.stackbar)
					}
				}
				return bars
			})
			.enter()
			.append('g')
			.attr('class', 'sja_aa_stackbar_g')
			.attr('transform', d => {
				// initially all skewers are folded so only use stem1
				return 'translate(0,' + (tk.aboveprotein ? 1 : -1) * (tk.stem1 - d.y) + ')'
			})
			.append('rect')
			.attr('y', d => (tk.aboveprotein ? -d.height : 0))
			.attr('class', 'sja_aa_stackbar_rect')
			.attr('width', 0)
			.attr('shape-rendering', 'crispEdges')
			.attr('fill-opacity', 0.5)
			.attr('stroke', 'none')
			.attr('stroke-width', 1)
			.attr('height', d => d.height)
			.attr('fill', d => color4disc(d.grp.mlst[0]))
			.on('mouseover', (event, d) => {
				const color = color4disc(d.grp.mlst[0])
				d3select(event.target).attr('stroke', color)
				const pica = tk.pica
				let label1 = 'wrong label'
				let label2 = 'wrong label, '
				switch (d.grp.mlst[0].dt) {
					case common.dtitd:
						label1 = common.mclass[d.grp.mlst[0].class].desc
						label2 = Math.ceil(d.grp.mlst[0].rnaduplength / 3) + ' aa, '
						break
					case common.dtdel:
						label1 = common.mclass[d.grp.mlst[0].class].label
						label2 = Math.ceil(d.grp.mlst[0].rnadellength / 3) + ' aa, '
						break
				}
				if (d.grp.occurrence == 1) {
					const m = d.grp.mlst[0]
					if (m.sample) {
						label2 += m.sample
					} else if (m.patient) {
						label2 += m.patient
					} else {
						label2 += '1 sample'
					}
				} else {
					label2 += d.grp.occurrence + ' samples'
				}
				const fontsize1 = 14,
					fontsize2 = 10,
					vpad = 2,
					hpad = 4
				let width = 0
				pica.g
					.append('text')
					.text(label1)
					.attr('font-size', fontsize1)
					.attr('font-family', client.font)
					.each(function () {
						width = this.getBBox().width
					})
					.remove()
				pica.g
					.append('text')
					.text(label2)
					.attr('font-size', fontsize2)
					.attr('font-family', client.font)
					.each(function () {
						width = Math.max(width, this.getBBox().width)
					})
					.remove()
				const boxheight = vpad * 3 + fontsize1 + fontsize2
				pica.x = d.grp.aa.x0 + 3
				pica.y = tk.aboveprotein
					? tk.height_main - tk.toppad - tk.bottompad - d.y - d.height - 3 - boxheight
					: d.y + d.height + 3
				pica.g.attr('transform', 'translate(' + pica.x + ',' + pica.y + ')')
				pica.g
					.append('rect')
					.attr('width', width + hpad * 2)
					.attr('height', boxheight)
					.attr('stroke', color)
					.attr('stroke-width', 1)
					.attr('shape-rendering', 'crispEdges')
					.attr('fill', 'white')
					.attr('fill-opacity', 0.8)
				pica.g
					.append('text')
					.text(label1)
					.attr('x', hpad)
					.attr('y', vpad + fontsize1 / 2)
					.attr('dominant-baseline', 'middle')
					.attr('font-size', fontsize1)
					.attr('font-family', client.font)
					.attr('fill', color)
				pica.g
					.append('text')
					.text(label2)
					.attr('x', hpad)
					.attr('y', vpad * 2 + fontsize1 + fontsize2 / 2)
					.attr('dominant-baseline', 'middle')
					.attr('font-size', fontsize2)
					.attr('font-family', client.font)
					.attr('fill', '#858585')
			})
			.on('mouseout', (event, d) => {
				d3select(event.target).attr('stroke', 'none')
				tk.pica.g.selectAll('*').remove()
			})
			.on('click', (event, d) => {
				itemtable({
					mlst: d.grp.mlst,
					pane: true,
					x: event.clientX,
					y: event.clientY,
					tk: tk,
					block: block
				})
			})
	}
	// stem
	tk.skewer
		.append('path')
		.attr('class', 'sja_aa_stem')
		.attr('d', d => skewer_setstem(d, tk))
		.attr('stroke', d => color4disc(d.groups[0].mlst[0]))
		.attr('fill', 'none')
	// ssk: only for skewers with >1 groups
	const mgsk = tk.skewer.filter(d => d.groups.length > 1)
	mgsk
		.append('rect')
		.attr('class', 'sja_aa_ssk_bg')
		.attr('shape-rendering', 'crispEdges')
		.attr('fill-opacity', 0)
		.attr('height', tk.stem1)
		.attr('fill', d => color4disc(d.groups[0].mlst[0]))
		.attr('width', d => {
			d.ssk_width = Math.max(d.occurrence.toString().length * 8 + 6, 2 * (d.maxradius + d.maxrimwidth))
			return d.ssk_width
		})
		.attr('x', d => -d.ssk_width / 2)
	mgsk
		.append('text')
		.attr('class', 'sja_aa_ssk_text')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('font-weight', 'bold')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.text(d => d.occurrence)
		.each(d => {
			d.ssk_fontsize = Math.min(tk.stem1, d.ssk_width / (d.occurrence.toString().length * client.textlensf))
		})
		.attr('font-size', d => d.ssk_fontsize)
	// ssk - kick
	mgsk
		.append('rect')
		.attr('class', 'sja_aa_ssk_kick')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke', 'none')
		.attr('height', tk.stem1)
		.attr('x', d => -d.ssk_width / 2)
		.attr('width', d => d.ssk_width)
		.on('mouseover', (event, d) => {
			const p = d3select(event.target.parentNode)
			p.selectAll('.sja_aa_disckick').transition().attr('stroke-opacity', 1)
			p.select('.sja_aa_ssk_bg').transition().attr('fill-opacity', 1).attr('stroke-opacity', 1)
			p.select('.sja_aa_ssk_text').transition().attr('fill-opacity', 1)
			epaint_may_hl(tk, d.mlst, true)
		})
		.on('mouseout', function (event, d) {
			const p = d3select(event.target.parentNode)
			p.selectAll('.sja_aa_disckick').transition().attr('stroke-opacity', 0)
			p.select('.sja_aa_ssk_bg').transition().attr('fill-opacity', 0).attr('stroke-opacity', 0)
			p.select('.sja_aa_ssk_text').transition().attr('fill-opacity', 0)
			epaint_may_hl(tk, d.mlst, false)
		})
		.on('click', async (event, d) => {
			// must not check event after await as it will be voided
			const p = event.target.getBoundingClientRect()
			if (d.occurrence > 1) {
				if (await may_sunburst(d.occurrence, d.mlst, d.x, d.y + ((tk.aboveprotein ? 1 : -1) * tk.stem1) / 2, tk, block))
					return
			}
			itemtable({
				mlst: d.mlst,
				pane: true,
				x: p.left - 10,
				y: p.top - 10,
				tk: tk,
				block: block
			})
		})
}

export function skewer_flip(tk) {
	tk.aboveprotein = !tk.aboveprotein

	if (tk.numericmode) {
		// won't do
		return
	}

	const abp = tk.aboveprotein
	const dur = 1000

	const skbars = tk.skewer.filter(d => d.hasstackbar)
	skbars
		.selectAll('.sja_aa_stackbar_g')
		.transition()
		.duration(dur)
		.attr('transform', d => {
			const k = d.grp.aa
			return (
				'translate(' +
				(k.showmode == modefold ? 0 : k.x0 - k.x) +
				',' +
				(abp ? 1 : -1) * (k.showmode == modefold ? tk.stem1 - d.y : tk.stem1 + tk.stem2 + tk.stem3 - d.y) +
				')'
			)
		})
	skbars
		.filter(d => d.showmode == modeshow)
		.selectAll('.sja_aa_stackbar_rect')
		.transition()
		.duration(dur)
		.attr('y', d => (abp ? -d.height : 0))
	tk.skewer
		.transition()
		.duration(dur)
		.attr('transform', d => {
			d.y = skewer_sety(d, tk)
			return 'translate(' + d.x + ',' + d.y + ')'
		})
	tk.skewer
		.selectAll('.sja_aa_stem')
		.transition()
		.duration(dur)
		.attr('d', d => skewer_setstem(d, tk))
	tk.skewer
		.selectAll('.sja_aa_discg')
		.transition()
		.duration(dur)
		.attr('transform', d => {
			d.y = (abp ? -1 : 1) * (d.aa.showmode == modefold ? d.aa.maxradius : d.yoffset)
			return 'translate(0,' + d.y + ')'
		})
	tk.skewer.selectAll('.sja_aa_ssk_kick').attr('y', abp ? 0 : -tk.stem1)
	tk.skewer.selectAll('.sja_aa_ssk_bg').attr('y', abp ? 0 : -tk.stem1)
	tk.skewer.selectAll('.sja_aa_ssk_text').attr('y', ((abp ? 1 : -1) * tk.stem1) / 2)
	tk.skewer.selectAll('.sja_aa_skkick').attr('cy', d => (abp ? -1 : 1) * d.maxradius)
	tk.skewer
		.filter(d => d.showmode == modeshow && d.groups.length == 1)
		.selectAll('.sja_aa_disclabel')
		.transition()
		.duration(dur)
		.attr('transform', d => 'scale(1) rotate(' + (d.aa.slabelrotate ? (abp ? '-' : '') + '90' : '0') + ')')
}

function skewer_sety(d, tk) {
	if (tk.aboveprotein) {
		if (d.showmode == modefold) {
			return tk.maxskewerheight + tk.stem1 + tk.stem2 + tk.stem3 - d.foldyoffset
		}
		return tk.maxskewerheight
	}
	if (d.showmode == modefold) return d.foldyoffset
	return tk.stem1 + tk.stem2 + tk.stem3
}

function skewer_setstem(d, tk) {
	if (tk.aboveprotein) {
		if (d.showmode == modefold) {
			return 'M0,0v0l0,0v' + d.foldyoffset
		}
		return 'M0,0v' + tk.stem1 + 'l' + (d.x0 - d.x) + ',' + tk.stem2 + 'v' + tk.stem3
	}
	if (d.showmode == modefold) {
		return 'M0,0v0l0,0v-' + d.foldyoffset
	}
	return 'M0,0v-' + tk.stem1 + 'l' + (d.x0 - d.x) + ',-' + tk.stem2 + 'v-' + tk.stem3
}

export function settle_glyph(tk, block) {
	if (tk.data.length == 0) {
		return
	}
	const x1 = 0
	const x2 = block.width
	// only settle those in view range
	// sum of skewer width, determines whether full or pack
	let sumwidth = 0
	const allinview = []
	const beyondviewitems = []
	for (const d of tk.data) {
		if (d.x0 < x1 || d.x0 > x2) {
			delete d.xoffset
			beyondviewitems.push(d)
		} else {
			// important: singleton label is rotated by default, must not include label width
			sumwidth += d.slabelrotate ? (d.groups[0].radius + d.groups[0].rimwidth) * 2 : d.width
			allinview.push(d)
		}
	}

	// reset those beyond view range
	fold_glyph(beyondviewitems, tk)
	// TODO may move d.x to +/-1000 out of sight

	let expandlst = []
	const foldlst = []

	if (sumwidth < x2 - x1) {
		// skewers can show in full
		expandlst = allinview
	} else {
		// rank skewers by ...
		allinview.sort((a, b) => {
			if (b.occurrence == a.occurrence) {
				if (b.groups.length == a.groups.length) {
					//return Math.abs(a.aapos*2-aarangestart-aarangestop)-Math.abs(b.aaposition*2-aarangestart-aarangestop);
					return Math.abs(a.x0 * 2 - x1 - x2) - Math.abs(b.x0 * 2 - x1 - x2)
				} else {
					return b.groups.length - a.groups.length
				}
			}
			return b.occurrence - a.occurrence
		})
		// collect top items to expand
		let width = 0
		let allowpx = (x2 - x1) * 0.8
		let stop = false
		for (const d of allinview) {
			if (stop) {
				delete d.xoffset
				foldlst.push(d)
				d.showmode = modefold
			} else {
				if (width + d.width < allowpx) {
					expandlst.push(d)
					width += d.width
				} else {
					stop = true
					delete d.xoffset
					foldlst.push(d)
					d.showmode = modefold
				}
			}
		}
	}
	fold_glyph(foldlst, tk)
	unfold_glyph(expandlst, tk, block)
}

function unfold_glyph(newlst, tk, block) {
	const dur = 1000
	const abp = tk.aboveprotein
	// set up new items
	const expanded = new Set() // d.x as key
	const folded = new Set()
	let hasfolded = false
	for (const d of newlst) {
		if (d.showmode == modeshow) {
			expanded.add(d.x0)
		} else {
			d.showmode = modeshow
			folded.add(d.x0)
			hasfolded = true
			d.y = skewer_sety(d, tk)
		}
	}
	/*
	tk.skewer
		.filter(d=>expanded.has(d.x0))
		.transition()
		.duration(dur)
		.attr('transform',d=> 'translate('+(d.x0+(d.xoffset==undefined ? 0 : d.xoffset))+','+d.y+')')
		*/
	if (hasfolded) {
		// vertical extending
		const set = tk.skewer.filter(d => folded.has(d.x0))
		set
			.transition()
			.duration(dur)
			.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		set
			.selectAll('.sja_aa_discg')
			.transition()
			.duration(dur)
			.attr('transform', d => {
				d.y = d.yoffset * (abp ? -1 : 1)
				return 'translate(0,' + d.y + ')'
			})
		setTimeout(function () {
			set.selectAll('.sja_aa_disckick').attr('transform', 'scale(1)')
		}, dur)
		/*
		set.selectAll('.sja_aa_qmg')
			.transition().duration(dur)
			.attr('transform','translate(0,'+(sk.maxskewerheight*(abp?-1:1))+') scale(1)')
			*/
		set.selectAll('.sja_aa_discnum').transition().duration(dur).attr('fill-opacity', 1).attr('stroke-opacity', 1)
		set
			.filter(d => d.groups.length > 1)
			.selectAll('.sja_aa_disclabel')
			.transition()
			.duration(dur)
			.attr('fill-opacity', 1)
			.attr('transform', 'scale(1)')
		set.selectAll('.sja_aa_discrim').transition().duration(dur).attr('fill-opacity', 1).attr('stroke-opacity', 1)
		set
			.selectAll('.sja_aa_ssk_kick')
			.attr('transform', 'scale(1)')
			.attr('y', abp ? 0 : -tk.stem1)
		set
			.selectAll('.sja_aa_ssk_bg')
			.attr('transform', 'scale(1)')
			.attr('y', abp ? 0 : -tk.stem1)
		set
			.selectAll('.sja_aa_ssk_text')
			.attr('transform', 'scale(1)')
			.attr('y', ((abp ? 1 : -1) * tk.stem1) / 2)
		set.selectAll('.sja_aa_skkick').attr('transform', 'scale(0)')
		set
			.filter(d => d.hasstackbar)
			.selectAll('.sja_aa_stackbar_g')
			// no transition, since the bar width is still 0
			.attr('transform', d => 'translate(0,' + (abp ? 1 : -1) * (tk.stem1 + tk.stem2 + tk.stem3 - d.y) + ')')
		let counter = 0
		set
			.selectAll('.sja_aa_stem')
			.transition()
			.duration(dur)
			.attr('d', d => skewer_setstem(d, tk))
			.each(() => ++counter)
			.on('end', () => {
				if (!--counter) {
					unfold_update(tk, block)
				}
			})
	} else {
		unfold_update(tk, block)
	}
}

function unfold_update(tk, block) {
	const dur = 1000
	const abp = tk.aboveprotein
	const alllst = [] // already expanded
	const hash = new Set() // d.x0 as key
	const x1 = 0
	const x2 = block.width
	for (const d of tk.data) {
		if (d.x0 < x1 || d.x0 > x2) continue
		if (d.showmode == modeshow) {
			d.x = d.x0
			alllst.push(d)
			hash.add(d.x0)
		}
	}
	if (alllst.length == 0) {
		return
	}
	horiplace(alllst, tk, block)
	for (const d of alllst) {
		d.xoffset = d.x - d.x0
	}
	for (let i = 0; i < alllst.length; i++) {
		const d = alllst[i]
		if (d.groups.length > 1) continue
		// single
		const disc = d.groups[0]
		if (tk.slabel_forcerotate) {
			d.slabelrotate = true
		} else {
			const next = alllst[i + 1]
			const rightx = next ? next.x - next.maxradius - next.maxrimwidth : x2
			d.slabelrotate = rightx - d.x - disc.radius - disc.rimwidth - 1 < d.slabelwidth
		}
		d.width = (disc.radius + disc.rimwidth) * 2 + (d.slabelrotate ? 0 : 2 + d.slabelwidth)
	}
	// horizontal shifting
	const set = tk.skewer.filter(d => hash.has(d.x0))
	set
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
	set
		.selectAll('.sja_aa_stem')
		.transition()
		.duration(dur)
		.attr('d', d => skewer_setstem(d, tk))
	set
		.filter(d => d.groups.length == 1)
		.selectAll('.sja_aa_disclabel')
		.transition()
		.duration(dur)
		.attr('fill-opacity', 1)
		.attr('transform', d => 'scale(1) rotate(' + (d.aa.slabelrotate ? (abp ? '-' : '') + '90' : '0') + ')')
	tk.slabel_forcerotate = false
	const skbars = set.filter(d => d.hasstackbar)
	skbars
		.selectAll('.sja_aa_stackbar_g')
		.transition()
		.duration(dur)
		.attr(
			'transform',
			d =>
				'translate(' + (d.grp.aa.x0 - d.grp.aa.x) + ',' + (abp ? 1 : -1) * (tk.stem1 + tk.stem2 + tk.stem3 - d.y) + ')'
		)
	skbars
		.selectAll('.sja_aa_stackbar_rect')
		.transition()
		.duration(dur)
		.attr('width', d => {
			return d.pxspan
		})
		.attr('y', d => {
			return abp ? -d.height : 0
		})
}

function horiplace(items, tk, block) {
	// only arrange those in aa view range
	const xoffset0 = 0
	const x2 = block.width
	let xoffset = xoffset0
	// those out of range are not touched
	// detect if any overlap
	let overlap = false
	for (const i of items) {
		if (i.x0 < xoffset0 || i.x0 > x2) continue
		if (i.groups.length == 1) {
			i.slabelrotate = true
			const disc = i.groups[0]
			i.width = (disc.radius + disc.rimwidth) * 2
		}
		const x = i.x - i.maxradius - i.maxrimwidth
		if (x < xoffset) {
			overlap = true
		}
		if (x + i.width > x2) {
			overlap = true
		}
		xoffset = Math.max(xoffset, x + i.width)
	}
	if (!overlap) {
		// nothing to do
		return false
	}
	// push and pack all to the left
	xoffset = xoffset0
	for (const i of items) {
		if (i.x0 < xoffset0 || i.x0 > x2) continue
		i.x = xoffset + i.maxradius + i.maxrimwidth
		xoffset += i.width
	}

	horiplace0(items, block.width)
}

function horiplace0(items, allwidth) {
	/*
	items[]
	.width
	.x0
	.x
		already set by pushing to left
	*/
	for (let i = 0; i < items.length; i++) {
		if (items[i].x0 < 0) continue
		if (items[i].x0 > allwidth) break

		while (1) {
			let currsum = 0,
				newsum = 0
			for (let j = i; j < items.length; j++) {
				const t = items[j]
				if (t.x0 > allwidth) {
					return
				}
				currsum += Math.abs(t.x - t.x0)
				t.x++
				newsum += Math.abs(t.x - t.x0)
			}
			if (items[i].x >= items[i].x0) {
				// wind back to make sure stem [i] stem is straight
				for (let j = i; j < items.length; j++) {
					items[j].x--
				}
				break
			}
			const z = items[items.length - 1]
			if (z.x + z.width / 2 >= allwidth) {
				return
			}
			if (newsum <= currsum) {
				// accept move
			} else {
				// reject move, procceed to next item
				for (let j = i; j < items.length; j++) {
					if (items[j].x0 > allwidth) {
						break
					}
					// wind back
					items[j].x--
				}
				break
			}
		}
	}
}

export function fold_glyph(lst, tk) {
	if (lst.length == 0) return
	const dur = 1000
	const abp = tk.aboveprotein
	// total number of discs, determines if disc details are visible prior to folding
	const hash = new Set()
	for (const d of lst) {
		d.x = d.x0
		hash.add(d.x0)
		d.showmode = modefold
		d.y = skewer_sety(d, tk)
	}
	const set = tk.skewer.filter(d => hash.has(d.x0))
	set
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
	set
		.selectAll('.sja_aa_stem')
		.transition()
		.duration(dur)
		.attr('d', d => skewer_setstem(d, tk))
	set
		.selectAll('.sja_aa_discg')
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(0,' + (abp ? '-' : '') + d.aa.maxradius + ')')
	set.selectAll('.sja_aa_disckick').attr('transform', 'scale(0)')
	/*
	set.selectAll('.sja_aa_qmg')
		.transition().duration(dur)
		.attr('transform','translate(0,0) scale(0)')
		*/
	set.selectAll('.sja_aa_discnum').transition().duration(dur).attr('fill-opacity', 0).attr('stroke-opacity', 0)
	set.selectAll('.sja_aa_disclabel').transition().duration(dur).attr('fill-opacity', 0).attr('transform', 'scale(0)') // hide this label so it won't be tred
	set.selectAll('.sja_aa_discrim').transition().duration(dur).attr('fill-opacity', 0).attr('stroke-opacity', 0)
	set.selectAll('.sja_aa_ssk_kick').attr('transform', 'scale(0)')
	set.selectAll('.sja_aa_ssk_bg').attr('transform', 'scale(0)')
	set.selectAll('.sja_aa_ssk_text').attr('transform', 'scale(0)')
	set
		.selectAll('.sja_aa_skkick')
		.transition()
		.duration(dur) // to prevent showing pica over busy skewer
		.attr('transform', 'scale(1)')
	const skbars = set.filter(d => d.hasstackbar)
	skbars
		.selectAll('.sja_aa_stackbar_g')
		.transition()
		.duration(dur)
		.attr('transform', d => 'translate(0,' + (abp ? 1 : -1) * (tk.stem1 - d.y) + ')')
	skbars.selectAll('.sja_aa_stackbar_rect').transition().duration(dur).attr('width', 0)
}

export function epaint_may_hl(tk, mlst, hl) {
	if (!tk.eplst) return
	for (const ep of tk.eplst) {
		ep.may_hl(mlst, hl)
	}
}

function dsqueryresult_geneexpression(data, tk, block) {
	if (!data.config) {
		block.error('config missing for expression data in ' + tk.ds.label)
		return
	}
	if (data.config.maf) {
		try {
			data.config.maf.get = new Function(...data.config.maf.get)
		} catch (e) {
			block.error('invalid javascript for config.maf.get of ' + tk.ds.label)
			return
		}
	}
	const config = data.config
	if (config.usecohort) {
		config.cohort = tk.ds.cohort
	}
	const eparg = {
		data: data.lst,
		expp: config,
		block: block,
		genome: block.genome,
		genename: block.usegm.name,
		dsname: tk.ds.label
	}
	if (block.samplecart) {
		/* this api has been enabled in block
		see if to pass it to ep
		only if the ds also has matching attribute
		this is to only activate sample selection in pediatric, but not in cosmic!
		*/
		if (tk.ds.sampleselectable) {
			// this ds has been configured to use it
			eparg.samplecart = block.samplecart
		}
	}
	return import('./ep').then(p => {
		tk.eplst.push(new p.default(eparg))
	})
}

function dsqueryresult_snvindelfusionitd(lst, tk, block) {
	for (const m of lst) {
		switch (m.dt) {
			case common.dtsnvindel:
				if (block.usegm) {
					const t = coord.genomic2gm(m.pos, block.usegm)
					m.rnapos = t.rnapos
					m.aapos = t.aapos
				}
				tk.mlst.push(m)
				break
			case common.dtsv:
			case common.dtfusionrna:
				if (!m.pairlst) {
					console.error('pairlst missing from sv/fusion')
					break
				}
				if (block.usegm && m.dt == common.dtsv) {
					/*
				SV data correction to suit gene strand
				do not look at strands
				*/
					if (m.pairlst.length == 1) {
						// only works for single pair
						const a = m.pairlst[0].a
						const b = m.pairlst[0].b
						if (a.chr != null && b.chr != null && a.chr == b.chr && a.position != null && b.position != null) {
							// good to check
							if (a.position < b.position) {
								if (block.usegm.strand == '+') {
									// no change
									a.strand = '+'
									b.strand = '+'
								} else {
									a.strand = '-'
									b.strand = '-'
									m.pairlst[0].a = b
									m.pairlst[0].b = a
								}
							}
						}
					}
				}
				// XXX current data format doesnt work for genomic range query!!!
				if (block.usegm && block.gmmode != client.gmmode.genomic) {
					m.isoform = block.usegm.isoform
					// gmmode, single datum over current gene
					let nohit = true
					for (let i = 0; i < m.pairlst.length; i++) {
						const pair = m.pairlst[i]
						// try to match with both isoform and name, for IGH, without isoform, but the querying "gene" can be IGH
						if (block.usegm.isoform == (pair.a.isoform || pair.a.name)) {
							m.useNterm = i == 0
							m.chr = block.usegm.chr
							m.strand = pair.a.strand
							if (pair.a.position == undefined) {
								if (pair.a.rnaposition == undefined) {
									if (pair.a.codon == undefined) {
										console.error('no position/rnaposition/codon available for ' + block.usegm.isoform)
										break
									} else {
										m.pos = coord.aa2gmcoord(pair.a.codon, block.usegm)
										pair.a.position = m.pos
									}
								} else {
									m.pos = coord.rna2gmcoord(pair.a.rnaposition - 1, block.usegm)
									if (m.pos == null) {
										console.error('failed to convert rnaposition to genomic position: ' + pair.a.rnaposition)
										break
									}
									pair.a.position = m.pos
								}
							} else {
								m.pos = pair.a.position
							}
							const t = coord.genomic2gm(m.pos, block.usegm)
							m.rnapos = t.rnapos
							m.aapos = t.aapos
							if (pair.a.codon) {
								m.aapos = pair.a.codon
							}
							m.mname = pair.b.name
							nohit = false
							break
						}
						if (block.usegm.isoform == (pair.b.isoform || pair.b.name)) {
							m.useNterm = false // always
							m.chr = block.usegm.chr
							m.strand = pair.b.strand
							if (pair.b.position == undefined) {
								if (pair.b.rnaposition == undefined) {
									if (pair.b.codon == undefined) {
										console.error('no position/rnaposition/codon available for ' + block.usegm.isoform)
										break
									} else {
										m.pos = coord.aa2gmcoord(pair.b.codon, block.usegm)
										pair.b.position = m.pos
									}
								} else {
									m.pos = coord.rna2gmcoord(pair.b.rnaposition - 1, block.usegm)
									if (m.pos == null) {
										console.error('failed to convert rnaposition to genomic')
										break
									}
									pair.b.position = m.pos
								}
							} else {
								m.pos = pair.b.position
							}
							const t = coord.genomic2gm(m.pos, block.usegm)
							m.rnapos = t.rnapos
							m.aapos = t.aapos
							if (pair.b.codon) {
								m.aapos = pair.b.codon
							}
							m.mname = pair.a.name
							nohit = false
							break
						}
					}
					if (nohit) {
						console.error('sv/fusion isoform no match to gm isoform: ' + block.usegm.isoform)
					} else {
						tk.mlst.push(m)
					}
				} else {
					// genomic mode, one m for each breakend
					for (const pair of m.pairlst) {
						let ain = false,
							bin = false
						for (let i = block.startidx; i <= block.stopidx; i++) {
							const r = block.rglst[i]
							if (pair.a.chr == r.chr && pair.a.position >= r.start && pair.a.position <= r.stop) {
								ain = true
							}
							if (pair.b.chr == r.chr && pair.b.position >= r.start && pair.b.position <= r.stop) {
								bin = true
							}
						}
						if (ain) {
							const m2 = svduplicate(m)
							const ma = pair.a
							m2.chr = ma.chr
							m2.strand = ma.strand
							m2.useNterm = ma.strand == '+'
							m2.pos = ma.pos || ma.position
							m2.mname = pair.b.name || pair.b.chr
							if (!Number.isFinite(m2.pos)) {
								console.error('no genomic pos for breakend a')
							} else if (!m2.chr) {
								console.error('no chromosome for breakend a')
							} else {
								tk.mlst.push(m2)
							}
						}
						if (bin) {
							const m2 = svduplicate(m)
							const mb = pair.b
							m2.chr = mb.chr
							m2.strand = mb.strand
							m2.useNterm = mb.strand == '+'
							m2.pos = mb.pos || mb.position
							m2.mname = pair.a.name || pair.a.chr
							if (!Number.isFinite(m2.pos)) {
								console.error('no genomic pos for breakend b')
							} else if (!m2.chr) {
								console.error('no chromosome for breakend b')
							} else {
								tk.mlst.push(m2)
							}
						}
					}
				}
				break
			case common.dtitd:
			case common.dtdel:
				if (m.chrpos1 && m.chrpos2) {
					// translate genomic pos1/pos2 to rna span
					let t = coord.genomic2gm(m.chrpos1, block.usegm)
					const rnapos1 = t.rnapos
					t = coord.genomic2gm(m.chrpos2, block.usegm)
					const rnapos2 = t.rnapos
					if (rnapos1 < rnapos2) {
						m.pos = m.chrpos1
					} else {
						m.pos = m.chrpos2
					}
					delete m.chrpos1
					delete m.chrpos2
					const rnaspan = Math.abs(rnapos1 - rnapos2)
					if (m.dt == common.dtitd) {
						m.rnaduplength = rnaspan
					} else if (m.dt == common.dtdel) {
						m.rnadellength = rnaspan
					}
				}
				if (m.position) {
					m.pos = m.position
					delete m.position
				}
				if (!m.pos) {
					if (m.dt == common.dtitd) {
						// itd exported from cicero will have a{} b{}, where b is upstream of a
						if (m.b) {
							if (m.b.position) {
								m.pos = m.b.position
								m.chr = m.b.chr
							}
						}
					}
				}
				if (!m.pos) {
					if (m.rnaposition) {
						if (block.usegm) {
							m.pos = coord.rna2gmcoord(m.rnaposition - 1, block.usegm)
							m.chr = block.usegm.chr
							if (m.pos == null) {
								console.error('failed to convert rnaposition to genomic position: ' + m.rnaposition)
								break
							}
						}
					} else if (m.aapos) {
						// TODO
					}
				}
				if (!m.pos) {
					console.error('no genomic pos for itd')
					break
				}
				if (block.usegm) {
					const t = coord.genomic2gm(m.pos, block.usegm)
					if (m.rnaposition) {
						m.rnapos = m.rnaposition
					} else {
						m.rnapos = t.rnapos
					}
					m.aapos = t.aapos
				}
				if (m.dt == common.dtitd) {
					if (!m.rnaduplength) {
						console.error('itd has no rnaduplength')
						m.rnaduplength = 1
					}
				} else {
					if (!m.rnadellength) {
						console.error('deletion has no rnadellength')
						m.rnadellength = 1
					}
				}
				tk.mlst.push(m)
				break
			case common.dtnloss:
			case common.dtcloss:
				if (m.position) {
					m.pos = m.position
					delete m.position
				}
				if (!m.pos) {
					if (m.rnaposition) {
						if (block.usegm) {
							m.pos = coord.rna2gmcoord(m.rnaposition - 1, block.usegm)
							m.chr = block.usegm.chr
							if (m.pos == null) {
								console.error('failed to convert rnaposition to genomic position: ' + m.rnaposition)
								break
							}
						}
					} else if (m.aapos) {
						// TODO
					}
				}
				if (!m.pos) {
					console.error('no genomic pos for truncation')
					break
				}
				if (block.usegm) {
					const t = coord.genomic2gm(m.pos, block.usegm)
					if (m.rnaposition) {
						m.rnapos = m.rnaposition
					} else {
						m.rnapos = t.rnapos
					}
					m.aapos = t.aapos
				}
				tk.mlst.push(m)
				break
			default:
				console.error('unknown dt: ' + m.dt)
		}
	}
}

function hlaachange_addnewtrack(tk, block) {
	/*
	variants to be highlighted were not found in track
	add a new ds track and show them
	*/
	const l2c = new Map()
	for (const c in common.mclass) {
		l2c.set(common.mclass[c].label.toUpperCase(), c)
	}
	const toadd = []
	for (const [n, m] of tk.hlaachange) {
		if (m == false) {
			// came from urlparam, cannot add
			continue
		}
		if (!m.name) {
			block.error('hlaachange item .name missing')
			continue
		}
		if (m.codon == undefined || !Number.isFinite(m.codon)) {
			block.error('hlaachange invalid codon for ' + m.name)
			continue
		}
		if (!m.class) {
			block.error('hlaachange .class missing')
			continue
		}
		const c = common.mclass[m.class] ? m.class : l2c.get(m.class.toUpperCase())
		if (!c) {
			block.error('hlaachange invalid class: ' + m.class)
			continue
		}
		m.class = c
		m.mname = m.name
		delete m.name
		m.chr = block.usegm.chr
		m.pos = coord.aa2gmcoord(m.codon, block.usegm)
		delete m.codon
		m.dt = common.dtsnvindel
		m.isoform = block.usegm.isoform
		toadd.push(m)
	}
	if (toadd.length) {
		const ds = {
			label: 'Highlight',
			type: client.tkt.ds,
			iscustom: true,
			bulkdata: {}
		}
		ds.bulkdata[block.usegm.name.toUpperCase()] = toadd
		block.ownds[ds.label] = ds
		const tk2 = block.block_addtk_template({ type: client.tkt.ds, ds: ds })
		dstkload(tk2, block)
	}
}

function showlegend_vcfinfofilter(tk, block) {
	/*
	custom mclass from vcf info
	update legend for all sets
	*/
	if (!tk.vcfinfofilter) return

	for (const mcset of tk.vcfinfofilter.lst) {
		mcset.holder.selectAll('*').remove()

		if (mcset.numericfilter) {
			// numeric
			// duplicative
			for (const o of mcset.numericfilter) {
				o.count = 0
			}

			for (const m of tk.mlst) {
				const [err, vlst] = getter_mcset_key(mcset, m)
				if (err) {
					continue
				}
				if (!vlst) continue
				const v = vlst[0]
				if (!Number.isFinite(v)) continue

				for (const o of mcset.numericfilter) {
					if (o.side == '<') {
						if (v < o.value) {
							o.count++
						}
					} else {
						if (v > o.value) {
							o.count++
						}
					}
				}
			}

			for (const o of mcset.numericfilter) {
				// lower-than or greater-than cutoff

				const cell = mcset.holder
					.append('div')
					.style('display', 'inline-block')
					.style('padding', '10px')
					.attr('class', 'sja_clb')
					.on('click', () => {
						// apply or cancel filter
						if (mcset.numericCutoff == o.value && mcset.numericCutoffSide == o.side) {
							// has been using this cutoff, to turn off filtering
							delete mcset.numericCutoff
						} else {
							// was not using this cutoff, apply this
							mcset.numericCutoff = o.value
							mcset.numericCutoffSide = o.side
						}
						dstkrender(tk, block)
					})

				if (mcset.numericCutoff == o.value && mcset.numericCutoffSide == o.side) {
					cell.style('border-bottom', 'solid 2px #ccc').style('background-color', '#f1f1f1')
				}
				if (o.count > 0) {
					// dot
					cell
						.append('div')
						.style('display', 'inline-block')
						.attr('class', 'sja_mcdot')
						.style('padding', '1px 5px')
						.style('background-color', '#ccc')
						.style('color', 'white')
						.html(o.count > 1 ? o.count : '&nbsp;')
						.style('margin-right', '5px')
				}
				// label
				cell.append('span').text(o.side + o.value)
			}
			continue
		}

		if (!mcset.categories) {
			/*
			quick fix, a numeric filter can lack both .numerifilter[] and .categories
			*/
			continue
		}

		// categorical attribute

		const key2count = new Map()

		let novaluemcount = 0

		for (const m of tk.mlst) {
			const [err, vlst] = getter_mcset_key(mcset, m)

			if (err) {
				continue
			}

			if (vlst == undefined) {
				novaluemcount++
			} else {
				for (const v of vlst) {
					if (!key2count.has(v)) {
						key2count.set(v, 0)
					}
					key2count.set(v, key2count.get(v) + 1)
				}
			}
		}

		const lst = [...key2count]
		if (novaluemcount) {
			lst.push([vcfnotannotated_label, novaluemcount])
		}
		lst.sort((i, j) => j[1] - i[1])

		for (const [k, count] of lst) {
			const v = mcset.categories[k] || { color: 'black', label: k }

			const cell = mcset.holder
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '10px')
				.attr('class', 'sja_clb')
				.on('click', () => {
					tk.vcfinfofilter.tip.showunder(cell.node())
					legendmenu_vcfinfo(mcset, k, tk, block)
				})
			// dot
			cell
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('padding', '1px 5px')
				.style('background-color', v.color)
				.style('color', 'white')
				.html(count > 1 ? count : '&nbsp;')
				.style('margin-right', '5px')
			// label
			const lab = cell.append('span').text(v.label).style('color', v.color)
			if (mcset.categoryhidden[k]) {
				lab.style('text-decoration', 'line-through')
			}
		}
	}
}

function vcfinfofilter_mayupdateautocategory(tk, block) {
	/*
	categorical info filter may use auto color
	call this after updating mlst[] -- will update the color for all categories
	*/
	if (!tk.vcfinfofilter) return

	for (const mcset of tk.vcfinfofilter.lst) {
		if (mcset.numericfilter) {
			continue
		}

		if (!mcset.autocategory) {
			continue
		}

		/* categorical attribute
		only need to record categories used in mlst[]
		then assign dynamic color
		*/

		const key2count = new Map()

		for (const m of tk.mlst) {
			const [err, vlst] = getter_mcset_key(mcset, m)

			if (err) {
				continue
			}

			if (vlst != undefined) {
				for (const v of vlst) {
					if (!key2count.has(v)) {
						key2count.set(v, 0)
					}
					key2count.set(v, key2count.get(v) + 1)
				}
			}
		}

		const lst = [...key2count]
		lst.sort((i, j) => j[1] - i[1])

		const colorfunc = scaleOrdinal(schemeCategory20)

		mcset.categories = {}

		for (const [k, count] of lst) {
			mcset.categories[k] = {
				label: k,
				color: colorfunc(k)
			}
		}
	}
}

export function getter_mcset_key(mcset, m) {
	/*
	get the key from an item (m) given a mcset
	returns list!!!
	*/
	if (mcset.altalleleinfo) {
		if (!m.altinfo) return ['no .altinfo']

		const value = m.altinfo[mcset.altalleleinfo.key]
		if (value == undefined) {
			// no value

			if (mcset.numericfilter) {
				// for alleles without AF_ExAC e.g. not seem in that population, treat value as 0
				// FIXME: only work for population frequency, assumption won't hold for negative values
				return [null, [0]]
			}

			return [null, undefined]
		}

		let vlst = Array.isArray(value) ? value : [value]

		if (mcset.altalleleinfo.separator) {
			// hardcoded separator for string
			vlst = vlst[0].split(mcset.altalleleinfo.separator)
		}
		return [null, vlst]
	}

	if (mcset.locusinfo) {
		if (!m.info) return ['no .info']

		const value = m.info[mcset.locusinfo.key]
		if (value == undefined) {
			// no value
			if (mcset.numericfilter) {
				// hard fix: for alleles without AF_ExAC e.g. not seem in that population, treat value as 0
				return [null, [0]]
			}
			return [null, undefined]
		}

		let vlst = Array.isArray(value) ? value : [value]

		if (mcset.locusinfo.separator) {
			vlst = vlst[0].split(mcset.locusinfo.separator)
		}
		return [null, vlst]
	}

	return ['no trigger']
}

function legendmenu_vcfinfo(mcset, key, tk, block) {
	/*
	tk legend shows the values from certain vcf info fields
	values are clickable to make filtering on variants of the track
	show tooltip menu for the annotation items
	key is:
	- a key of mcset.categories
	- vcfnotannotated_label
	*/
	const tip = tk.vcfinfofilter.tip
	tip.clear()

	const thiskeyhidden = mcset.categoryhidden[key]

	tip.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.html('<div style="display:inline-block;width:25px">&#10003;</div> show alone')
		.on('click', () => {
			tip.hide()
			mcset.categoryhidden = {}
			for (const k in mcset.categories) {
				if (k != key) {
					mcset.categoryhidden[k] = 1
				}
			}
			if (key != vcfnotannotated_label) {
				mcset.categoryhidden[vcfnotannotated_label] = 1
			}
			dstkrender(tk, block)
		})
	if (thiskeyhidden) {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&#10003;</div> show')
			.on('click', () => {
				tip.hide()
				delete mcset.categoryhidden[key]
				dstkrender(tk, block)
			})
	} else {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&times;</div> hide')
			.on('click', () => {
				tip.hide()
				mcset.categoryhidden[key] = 1
				dstkrender(tk, block)
			})
	}

	let hidenum = 0
	for (const k in mcset.categoryhidden) {
		hidenum++
	}
	if (hidenum > 1) {
		// more than 1 class is hidden, make "show all"
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&#10003;</div> show all')
			.on('click', () => {
				tip.hide()
				mcset.categoryhidden = {}
				dstkrender(tk, block)
			})
	}
}

function getter_pfrequency(m, tk) {
	/*
	get population frequency
	for multi-sample vcf
	do not work for variant-only vcf
	*/
	if (!m.vcfid) return ['.vcfid missing']
	if (!m.sampledata) return ['.sampledata missing']
	const v = tk.ds.id2vcf[m.vcfid]
	if (!v) return ['no vcf']
	if (!v.samples || v.samples.length == 0) return ['vcf no samples']
	/*
	only count samples without .gtallref
	*/
	let count = 0
	for (const s of m.sampledata) {
		if (!s.gtallref) count++
	}
	return [null, count / v.samples.length]
}

function showlegend_populationfrequencyfilter(tk, block) {
	/*
	hardcoded frequency filter for multi-sample vcf
	*/
	if (!tk.populationfrequencyfilter) return

	for (const o of tk.populationfrequencyfilter.lst) {
		o.count = 0
	}

	for (const m of tk.mlst) {
		const [err, f] = getter_pfrequency(m, tk)
		if (err) {
			continue
		}
		for (const o of tk.populationfrequencyfilter.lst) {
			if (f < o.value) {
				o.count++
			}
		}
	}

	tk.populationfrequencyfilter.holder.selectAll('*').remove()

	for (const o of tk.populationfrequencyfilter.lst) {
		const cell = tk.populationfrequencyfilter.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.attr('class', 'sja_clb')
			.on('click', () => {
				// apply or cancel filter
				if (tk.populationfrequencyfilter.cutoff == o.value) {
					delete tk.populationfrequencyfilter.cutoff
				} else {
					tk.populationfrequencyfilter.cutoff = o.value
				}
				dstkrender(tk, block)
			})

		if (tk.populationfrequencyfilter.cutoff == o.value) {
			cell.style('border-bottom', 'solid 2px #ccc').style('background-color', '#f1f1f1')
		}

		// dot
		cell
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_mcdot')
			.style('padding', '1px 5px')
			.style('background-color', '#ccc')
			.style('color', 'white')
			.html(o.count > 1 ? o.count : '&nbsp;')
			.style('margin-right', '5px')
		// label
		cell.append('span').text('< ' + o.value)
	}
}

function showlegend_sampleattribute(tk, block) {
	/*
	 */
	if (!tk.ds || !tk.ds.cohort || !tk.ds.cohort.sampleattribute) return
	if (!tk.ds.cohort.annotation) return '.ds.cohort.annotation missing'
	if (!tk.ds.cohort.key4annotation) return '.ds.cohort.key4annotation missing'

	const smat = tk.ds.cohort.sampleattribute

	if (!smat.lst) return '.lst missing'
	if (!smat.holder) return '.holder missing'

	smat.holder.selectAll('*').remove()

	if (tk.mlst.length == 0) {
		return
	}
	for (const attr of smat.lst) {
		if (!attr.k) return '.k missing for an attribute'
		if (!attr.hiddenvalues) attr.hiddenvalues = new Set()
	}

	const runtimelst = []
	// collect keys with any valid samples

	/*
	FIXME 
	shadow vcf, use slim matrix to map variant to sample list
	*/
	if (tk.mlst[0].sampledata) {
		/*
		multi-sample vcf
		*/
		for (const attr of smat.lst) {
			let samplecount = 0
			const value2count = new Map()
			for (const m of tk.mlst) {
				if (!m.sampledata) continue

				for (const s0 of m.sampledata) {
					const k4a = s0.sampleobj[tk.ds.cohort.key4annotation]
					if (!k4a) continue

					const o = tk.ds.cohort.annotation[k4a]
					if (!o) continue

					const value = o[attr.k]
					if (value == undefined) continue

					samplecount++

					if (!value2count.has(value)) {
						value2count.set(value, 0)
					}
					value2count.set(value, value2count.get(value) + 1)
				}
			}
			if (samplecount == 0) {
				// skip this key
				continue
			}
			runtimelst.push({
				samplecount: samplecount,
				key: attr,
				lst: [...value2count]
					.sort((a, b) => b[1] - a[1])
					.map(i => {
						return { value: i[0], count: i[1] }
					})
			})
		}
	} else {
		/*
		each m is one case
		retrieved from db
		*/
		for (const attr of smat.lst) {
			let samplecount = 0
			const value2count = new Map()
			for (const m of tk.mlst) {
				const k4a = m[tk.ds.cohort.key4annotation]
				if (!k4a) continue

				const o = tk.ds.cohort.annotation[k4a]
				if (!o) continue

				const value = o[attr.k]
				if (value == undefined) continue

				samplecount++

				if (!value2count.has(value)) {
					value2count.set(value, 0)
				}
				value2count.set(value, value2count.get(value) + 1)
			}
			if (samplecount == 0) {
				// skip this key
				continue
			}
			runtimelst.push({
				samplecount: samplecount,
				key: attr,
				lst: [...value2count]
					.sort((a, b) => b[1] - a[1])
					.map(i => {
						return { value: i[0], count: i[1] }
					})
			})
		}
	}

	if (runtimelst.length == 0) {
		// no keys are used to annotate current samples
		// disable filtering
		delete smat.runtimelst
		return
	}
	// activate filtering
	smat.runtimelst = runtimelst

	const table = smat.holder.append('table').style('border-spacing', '5px')

	for (const attr of runtimelst) {
		/*
		.samplecount
		.key
		.lst
		*/

		const tr = table.append('tr')

		// label of key
		tr.append('td')
			.style('color', '#858585')
			.style('text-align', 'right')
			.text(attr.key.label || attr.key.k)

		const td = tr.append('td')

		// values of this key
		for (const value of attr.lst) {
			/*
			.value
			.count
			*/
			const cell = td
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '5px')
				.attr('class', 'sja_clb')
				.on('click', () => {
					smat.tip.showunder(cell.node())
					legendmenu_sampleattribute(value, attr, smat.tip, tk, block)
				})
			// dot
			cell
				.append('div')
				.style('display', 'inline-block')
				.attr('class', 'sja_mcdot')
				.style('padding', '1px 3px')
				.style('background-color', '#858585')
				.style('color', 'white')
				.html(value.count > 1 ? value.count : '&nbsp;')
				.style('margin-right', '5px')
			// label
			const lab = cell.append('span').text(value.value)
			if (attr.key.hiddenvalues.has(value.value)) {
				lab.style('text-decoration', 'line-through')
			}
		}
	}
	return null
}

function legendmenu_sampleattribute(thisvalue, thisattr, tip, tk, block) {
	/*
	value
	.hidden
	*/
	tip.clear()

	tip.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.html('<div style="display:inline-block;width:25px">&#10003;</div> show alone')
		.on('click', () => {
			tip.hide()
			for (const value of thisattr.lst) {
				thisattr.key.hiddenvalues.add(value.value)
			}
			thisattr.key.hiddenvalues.delete(thisvalue.value)
			dstkrender(tk, block)
		})
	if (thisattr.key.hiddenvalues.has(thisvalue.value)) {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&#10003;</div> show')
			.on('click', () => {
				tip.hide()
				thisattr.key.hiddenvalues.delete(thisvalue.value)
				dstkrender(tk, block)
			})
	} else {
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&times;</div> hide')
			.on('click', () => {
				tip.hide()
				thisattr.key.hiddenvalues.add(thisvalue.value)
				dstkrender(tk, block)
			})
	}

	if (thisattr.key.hiddenvalues.size > 1) {
		// more than 1 attribute is hidden, make "show all"
		tip.d
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('<div style="display:inline-block;width:25px">&#10003;</div> show all')
			.on('click', () => {
				tip.hide()
				thisattr.key.hiddenvalues.clear()
				dstkrender(tk, block)
			})
	}
}

export function mlst_pretreat(tk, block, originhidden) {
	/*
	used both in skewer & numeric
	no change to tk.mlst, but return a subset where they:
	- inside view range
	- pass filter
		- mclass, morigin
		- vcf info
		- population freq
		- sample annotation
	then:
	- calculate m.__x by mapping coord to view range
	- update tk labels
	*/

	let nogenomicpos = 0
	let nochr = 0
	let unmapped = []
	let usemlst = [] // usable after filtering, for updating stats

	for (const m of tk.mlst) {
		delete m.__x

		/******************
		__filter__
		- by mclass/morigin
			block.legend.mclasses(?).hidden
		- by vcf INFO
			tk.vcfinfofilter.lst[?]
				for categorical, use categoryhidden
				for numerical, use .numericCutoff
		- by vcf populationfrequencyfilter
			for multi-sample vcf
		*******************/

		if (block.legend && block.legend.mclasses.has(m.class) && block.legend.mclasses.get(m.class).hidden) {
			continue
		}
		if (block.legend && block.legend.morigins.has(m.origin) && block.legend.morigins.get(m.origin).hidden) {
			continue
		}
		if (m.origin && originhidden.has(m.origin)) {
			continue
		}
		if (block.gmmode == common.gmmode.protein && block.usegm.codingstart && block.usegm.codingstop) {
			// in protein view, exclude those out of cds, e.g. utr ones
			// this may be risky as those p53 utr SVs are no longer visible
			if (m.pos < block.usegm.codingstart || m.pos > block.usegm.codingstop) continue
		}
		if (tk.vcfinfofilter) {
			let hidden = false
			for (const mcset of tk.vcfinfofilter.lst) {
				const [err, vlst] = getter_mcset_key(mcset, m)
				if (err) {
					continue
				}
				const v2 = vlst == undefined ? [vcfnotannotated_label] : vlst

				if (mcset.numericCutoff != undefined) {
					// numerical value, filter
					// only use the first value from vlst[]
					const v3 = Number.parseFloat(v2[0])

					if (Number.isNaN(v3)) {
						// what
						hidden = true
						break
					}

					if (mcset.numericCutoffSide == '<') {
						if (v3 >= mcset.numericCutoff) {
							hidden = true
							break
						}
					} else if (mcset.numericCutoffSide == '>') {
						if (v3 <= mcset.numericCutoff) {
							hidden = true
							break
						}
					}
				} else if (mcset.categoryhidden) {
					/* categorical
					since an INFO field may contain multiple values, if any of the value is not hidden, then the variant should not be hidden
					*/
					let onevaluenothidden = false
					for (const v of v2) {
						if (!mcset.categoryhidden[v]) {
							onevaluenothidden = true
							break
						}
					}
					if (!onevaluenothidden) {
						// all values are hidden
						hidden = true
						break
					}
				}
			}
			if (hidden) {
				continue
			}
		}
		if (tk.populationfrequencyfilter && tk.populationfrequencyfilter.cutoff) {
			const [err, f] = getter_pfrequency(m, tk)
			if (err) {
				// still keep??
			} else {
				if (f > tk.populationfrequencyfilter.cutoff) {
					continue
				}
			}
		}

		if (
			tk.ds &&
			tk.ds.cohort &&
			tk.ds.cohort.annotation &&
			tk.ds.cohort.key4annotation &&
			tk.ds.cohort.sampleattribute &&
			tk.ds.cohort.sampleattribute.runtimelst
		) {
			/*
			sample attribute filtering can be applied
			two ways of getting annotation for the current sample
			*/

			let hiddenattrcount = 0
			for (const i of tk.ds.cohort.sampleattribute.runtimelst) {
				if (i.key && i.key.hiddenvalues) {
					hiddenattrcount += i.key.hiddenvalues.size
				}
			}
			if (hiddenattrcount > 0) {
				// there are indeed hidden attributes, so commence filtering
				if (tk.ds.vcfcohorttrack) {
					/*
					slim matrix
					*/
				} else if (m.sampledata) {
					/*
					loaded from multi-sample vcf
					*/
					let usesamples = 0
					for (const s0 of m.sampledata) {
						/*
						for this sample to be considered, it must have the alt allele
						*/
						if (!common.alleleInGenotypeStr(s0.genotype, m.alt)) {
							// this sample does not have alt allele
							continue
						}

						const k4a = s0.sampleobj[tk.ds.cohort.key4annotation]
						if (k4a) {
							const sanno = tk.ds.cohort.annotation[k4a]
							if (sanno) {
								// this sample has valid annotation
								let hidden = false
								for (const attr of tk.ds.cohort.sampleattribute.runtimelst) {
									const thisvalue = sanno[attr.key.k]
									if (thisvalue != undefined) {
										// this sample is annotated by this key
										if (attr.key.hiddenvalues.has(thisvalue)) {
											// annotation value of this sample is hidden
											hidden = true
											break
										}
									}
								}
								if (hidden) {
									// this is a hidden sample
									continue
								}
							}
						}
						usesamples++
					}
					if (usesamples == 0) {
						continue
					}
				} else {
					/*
					m loaded from db, per sample case
					*/
					const k4a = m[tk.ds.cohort.key4annotation]
					if (k4a) {
						const sanno = tk.ds.cohort.annotation[k4a]
						if (sanno) {
							// this sample has valid annotation
							let hidden = false
							for (const attr of tk.ds.cohort.sampleattribute.runtimelst) {
								const thisvalue = sanno[attr.key.k]
								if (thisvalue != undefined) {
									// this sample is annotated by this key
									if (attr.key.hiddenvalues.has(thisvalue)) {
										// annotation value of this sample is hidden
										hidden = true
										break
									}
								}
							}
							if (hidden) {
								// this is a hidden sample
								continue
							}
						}
					}
				}
			}
		}

		////////////   __filter__ ends

		if (!m.chr) {
			nochr++
			continue
		}
		if (!Number.isInteger(m.pos)) {
			nogenomicpos++
			continue
		}
		const hits = block.seekcoord(m.chr, m.pos)
		if (hits.length == 0) {
			unmapped.push(m)
			continue
		}
		if (hits.length == 1) {
			m.__x = hits[0].x
		} else {
			// hit at multiple regions, still use first hit as following code is not finished
			m.__x = hits[0].x

			// see if to keep one or all
			/*
			let usehitidx=-1
			for(let i=0; i<hits.length; i++) {
				if(block.rglst[hits[i].ridx].keepthis) {
					usehitidx=i
					break
				}
			}
			if(usehitidx==-1) {
				// no preference, duplicate mlst for all positions
				console.error('use all position: not done yet')
			} else {
				// use selected position
				m.usehitidx=usehitidx
				m.__x=hits[usehitidx].x
			}
			*/
		}

		if (m.__x < -1 || m.__x > block.width + 1) {
			// out of view range
			continue
		}

		usemlst.push(m)
	}

	const collectleftlabw = []
	tk.tklabel.each(function () {
		collectleftlabw.push(this.getBBox().width)
	})

	// ************* update stats label TODO should be a standalone func
	if (usemlst.length == 0) {
		// hide label
		tk.label_mcount.text('')
	} else {
		tk.label_mcount
			.text(
				usemlst.length < tk.mlst.length
					? usemlst.length + ' of ' + tk.mlst.length + ' ' + tk.itemlabelname + 's'
					: usemlst.length + ' ' + tk.itemlabelname + (usemlst.length > 1 ? 's' : '')
			)
			.each(function () {
				collectleftlabw.push(this.getBBox().width)
			})
	}
	if (tk.label_stratify) {
		for (const strat of tk.label_stratify) {
			// get number of ?? for each strat method
			let itemcount
			if (strat.bycohort) {
				const set = new Set()
				for (const m of usemlst) {
					let key = ''
					for (const level of tk.ds.cohort.levels) {
						const v = m[level.k]
						if (v) {
							key += v
						}
					}
					set.add(key)
				}
				itemcount = set.size
			} else {
				const set = new Set()
				for (const m of usemlst) {
					let key = m[strat.attr1.k]
					if (!key) continue
					if (strat.attr2) {
						const v2 = m[strat.attr2.k]
						if (v2) {
							key += v2
						}
					}
					if (strat.attr3) {
						const v3 = m[strat.attr3.k]
						if (v3) {
							key += v3
						}
					}
					set.add(key)
				}
				itemcount = set.size
			}
			if (itemcount == 0) {
				strat.svglabel.text('')
			} else {
				strat.svglabel.text(itemcount + ' ' + strat.label + (itemcount > 1 ? 's' : '')).each(function () {
					collectleftlabw.push(this.getBBox().width)
				})
			}
		}
	}

	tk.leftLabelMaxwidth = Math.max(...collectleftlabw)
	// ************ done labels

	if (nogenomicpos + nochr > 0) {
		block.tkerror(tk, nogenomicpos + nochr + ' items have no chromosome or genomic position')
	}
	if (unmapped.length) {
		console.error(unmapped.length + ' items not mapped to any region')
		for (const m of unmapped) console.log(m)
	}

	return usemlst
}

export function tkdata_update_x(tk, block) {
	/*
	call when panned in gmmode,
	no re-requesting data
	no re-rendering
	only update skewer x position
	*/

	for (const d of tk.data) {
		if (d.isbin) {
			let sumx = 0
			for (const m of d.mlst) {
				const hits = block.seekcoord(m.chr, m.pos)
				if (m.usehitidx != undefined && hits[m.usehitidx]) {
					sumx += hits[m.usehitidx].x
				} else if (hits.length == 1) {
					sumx += hits[0].x
				} else {
					console.log('cannot map item')
					console.log(m)
				}
			}
			d.x0 = sumx / d.mlst.length
			d.x = d.x0 + (d.xoffset != undefined ? d.xoffset : 0)
		} else {
			const hits = block.seekcoord(d.chr, d.pos)
			if (hits.length > 0) {
				d.x0 = hits[0].x
				d.x = d.x0 + (d.xoffset != undefined ? d.xoffset : 0)
			} else {
				console.log('cannot map group of item')
				console.log(d)
			}
		}
	}
}

export function done_tknodata(tk, block) {
	/*
	no data loaded for track
	set track height by # of controllers
	in case of hlaachange, create new track and show
	*/
	tk.height_main = tk.toppad + block.labelfontsize + tk.bottompad
	if (tk.label_mcount && tk.label_mcount.text().length > 0) {
		tk.height_main += tk.labyspace + block.labelfontsize
	}
	if (tk.label_stratify) {
		for (const strat of tk.label_stratify) {
			if (strat.svglabel.text().length > 0) {
				tk.height_main += tk.labyspace + block.labelfontsize
			}
		}
	}

	/*
	remove previous message in case of panning in gmmode
	*/
	tk.glider.selectAll('*').remove()
	tk.leftaxis.selectAll('*').remove()

	if (tk.viewrangeupperlimit_above) {
		// went beyond range
		block.tkerror(tk, tk.name + ': zoom in under ' + common.bplen(tk.viewrangeupperlimit) + ' to view data')
	} else {
		let context
		if (!tk.skewer.data || tk.skewer.data.length == 0) {
			if (block.pannedpx != undefined || block.zoomedin == true) {
				context = 'view range'
			} else if (block.usegm && block.gmmode != 'genomic') {
				context = block.usegm.name || block.usegm.isoform
			}
		}
		block.tkerror(tk, tk.name + ': no mutation in ' + context)
	}

	if (tk.hlaachange) {
		hlaachange_addnewtrack(tk, block)
		delete tk.hlaachange
	}
}

function may_print_stratifycountfromserver(dat, tk) {
	/*
	dataset may be equipped to compute stratify category item count at server
	*/
	if (!dat.stratifycount) return
	for (const [label, count] of dat.stratifycount) {
		const strat = tk.label_stratify.find(i => i.label == label)
		if (!strat) {
			console.error('unknown strat label: ' + label)
			continue
		}
		strat.servercount = count
	}
}
