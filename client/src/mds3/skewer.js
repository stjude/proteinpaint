import * as common from '../../shared/common'
import * as coord from '../coord'
import * as client from '../client'
import { skewer_make, settle_glyph, fold_glyph, unfold_glyph } from './skewer.render'

/*
at some point, data.skewer will return aggregated data,
e.g. one object for ten or hundreds of variants of same class, 
ssm_id list may be given when there are not a lot of variants in a group,
otherwise, ssm_id list will not be given when the number is big, in hundreds
availability of ssm_id decides if variant2samples query is allowed


legacy code to clean up:
hlaachange_addnewtrack
getter_mcset_key

********************** EXPORTED
may_render_skewer
********************** INTERNAL
*********** function cascade
may_render_skewer
	make_skewer_data
		mlst_pretreat
			dsqueryresult_snvindelfusionitd
	skewer_make
	tkdata_update_x
	settle_glyph
	done_tknodata


tk.skewer{}
	.rawmlst[] -- comes from server-returned data.skewer[]
	.g
	.data[]
		.chr, pos
		.x
		.occurrence
		.mlst[]
		.groups[]
			.dt
			.occurrence
			.mlst[]
	.selection
	.stem1, stem2, stem3 // #pixel
	.maxheight

*/

/*
cutoff value of # pixel per bp
compared to exonsf
when exonsf>:
	basepairs are visible enough, and group mutation grps by basepair position
else exon<:
	basepairs are too tiny and will group mutations by AA position
*/
const minbpwidth = 4

export function may_render_skewer(data, tk, block) {
	// return skewer tk height
	if (!tk.skewer) {
		// not equipped with skewer track
		// created in makeTk when skewer datatype is available
		return 0
	}
	tk.aboveprotein = true

	if (data && !data.skewer && block.usegm && block.gmmode != client.gmmode.genomic && block.pannedpx != undefined) {
		// when data.skewer is not given
		// in gmmode, browser panned, no re-requesting data
		// no need to re-group
		// set x
		tkdata_update_x(tk, block)
		tk.skewer.selection.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		settle_glyph(tk, block)
	} else {
		if (data && data.skewer) {
			// register new mlst data
			// otherwise will not overwrite skewer.mlst
			tk.skewer.rawmlst = data.skewer
		}
		// when zooming protein mode, data.skewer is not given but still need to remake skewers
		// generate new skewer track data from skewer.mlst
		tk.skewer.g.selectAll('*').remove()
		tk.skewer.data = make_skewer_data(tk, block)
		skewer_make(tk, block)
	}

	if (!tk.skewer.data || tk.skewer.data.length == 0) {
		return done_tknodata(tk, block)
	}

	/*
	variants loaded for this track
	*/

	if (tk.hlaachange || tk.hlssmid) {
		/*
		for any variants to be highlighted, expanded and fold all the others
		*/
		const fold = []
		const unfold = []

		if (tk.hlaachange) {
			// is map
			for (const d of tk.skewer.data) {
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
		if (tk.hlssmid) {
			// is map
			for (const d of tk.skewer.data) {
				let has = false
				for (const g of d.groups) {
					for (const m of g.mlst) {
						// harcoded key of "ssm_id"!!!
						if (tk.hlssmid.has(m.ssm_id)) {
							has = true
							tk.hlssmid.delete(m.ssm_id)
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
			delete tk.hlssmid
		}

		fold_glyph(fold, tk)
		unfold_glyph(unfold, tk, block)
	} else {
		// natural expand
		settle_glyph(tk, block)
	}

	return tk.skewer.maxheight + tk.skewer.stem1 + tk.skewer.stem2 + tk.skewer.stem3
}

function tkdata_update_x(tk, block) {
	/*
	call when panned in gmmode,
	no re-requesting data
	no re-rendering
	only update skewer x position
	*/

	for (const d of tk.skewer.data) {
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

function make_skewer_data(tk, block) {
	// raw data is at tk.skewer.mlst
	// XXX sort out logic: no need for mlst_pretreat to return, as skewer making will always use full list from skewer.rawmlst
	const usemlst = mlst_pretreat(tk, block)
	// m.__x added

	const x2mlst = new Map()
	for (const m of tk.skewer.rawmlst) {
		if (m.__x == undefined) continue // dropped
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
	if (tk.skewer.data && block.pannedpx != undefined && (!block.usegm || block.gmmode == client.gmmode.genomic)) {
		// inherit genomic mode and panned
		const pastmode = {}
		for (const g of tk.skewer.data) {
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
	for (const d of datagroup) {
		d.occurrence = d.groups.reduce((i, j) => i + j.occurrence, 0)
	}
	return datagroup
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
				if (
					!k2g
						.get(m.dt)
						.get(m.class)
						.has(n)
				) {
					k2g
						.get(m.dt)
						.get(m.class)
						.set(n, [])
				}
				k2g
					.get(m.dt)
					.get(m.class)
					.get(n)
					.push(m)
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
					if (
						!k2g
							.get(m.dt)
							.get(m.class)
							.use5.has(m.mname)
					) {
						k2g
							.get(m.dt)
							.get(m.class)
							.use5.set(m.mname, [])
					}
					k2g
						.get(m.dt)
						.get(m.class)
						.use5.get(m.mname)
						.push(m)
				} else {
					if (
						!k2g
							.get(m.dt)
							.get(m.class)
							.use3.has(m.mname)
					) {
						k2g
							.get(m.dt)
							.get(m.class)
							.use3.set(m.mname, [])
					}
					k2g
						.get(m.dt)
						.get(m.class)
						.use3.get(m.mname)
						.push(m)
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
		g.occurrence = g.mlst.reduce((i, j) => i + j.occurrence, 0)
	}
	groups.sort((a, b) => {
		return b.occurrence - a.occurrence
	})
	return groups
}

/*
legacy function kept to add in new filters
guard against bad data
filter data by a systematic filter

- calculate m.__x by mapping coord to view range
*/
function mlst_pretreat(tk, block) {
	let nogenomicpos = 0,
		outofcds = 0,
		nochr = 0
	const unmapped = []
	const usemlst = [] // usable after filtering, for updating stats

	for (const m of tk.skewer.rawmlst) {
		delete m.__x

		if (block.gmmode == common.gmmode.protein && block.usegm.codingstart && block.usegm.codingstop) {
			// in protein view, exclude those out of cds, e.g. utr ones
			// this may be risky as those p53 utr SVs are no longer visible
			if (m.pos < block.usegm.codingstart || m.pos > block.usegm.codingstop) {
				outofcds++
				continue
			}
		}

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
		}

		if (m.__x < -1 || m.__x > block.width + 1) {
			// out of view range
			continue
		}

		usemlst.push(m)
	}

	if (nogenomicpos + nochr > 0) {
		block.tkerror(tk, nogenomicpos + nochr + ' items have no chromosome or genomic position')
	}
	if (unmapped.length) {
		console.error(unmapped.length + ' items not mapped to any region')
		for (const m of unmapped) console.log(m)
	}

	dsqueryresult_snvindelfusionitd(usemlst, tk, block)

	return usemlst
}

function done_tknodata(tk, block) {
	/*
	no data loaded for track
	set track height by # of controllers
	in case of hlaachange, create new track and show
	*/
	let height = 0 // cumulate

	//remove previous message in case of panning in gmmode
	tk.skewer.g.selectAll('*').remove()

	let context = 'view range'
	if (block.usegm && block.gmmode != client.gmmode.genomic) {
		context = block.usegm.name || block.usegm.isoform
	}
	tk.skewer.g
		.append('text')
		.text(tk.mds.label + ': no mutation in ' + context)
		.attr('y', 25)
		.attr('x', block.width / 2)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'center')

	if (tk.hlaachange) {
		hlaachange_addnewtrack(tk, block)
		delete tk.hlaachange
	}
	return 50
}

function dsqueryresult_snvindelfusionitd(lst, tk, block) {
	// legacy function, kept the same
	for (const m of lst) {
		if (m.dt == common.dtsnvindel) {
			if (block.usegm) {
				const t = coord.genomic2gm(m.pos, block.usegm)
				m.rnapos = t.rnapos
				m.aapos = t.aapos
			}
			continue
		}
		if (m.dt == common.dtsv || m.dt == common.dtfusionrna) {
			if (!m.pairlst) {
				throw 'pairlst missing from sv/fusion'
			}
			// TODO following legacy code needs correction
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
							//tk.mlst.push(m2)
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
							//tk.mlst.push(m2)
						}
					}
				}
			}
			continue
		}
		throw 'unknown dt: ' + m.dt
	}
}

function hlaachange_addnewtrack(tk, block) {
	/*
	not in use

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
