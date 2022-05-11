import * as common from '../../shared/common'
import * as coord from '../coord'
import * as client from '../client'
import { skewer_make, settle_glyph, fold_glyph, unfold_glyph } from './skewer.render'
import { make_datagroup } from './datagroup'
import { render as nm_render } from './numericmode'

/*
at some point, data.skewer will return aggregated data,
e.g. one object for ten or hundreds of variants of same class, 
ssm_id list may be given when there are not a lot of variants in a group,
otherwise, ssm_id list will not be given when the number is big, in hundreds
availability of ssm_id decides if variant2samples query is allowed


legacy code to clean up:
hlaachange_addnewtrack

********************** EXPORTED
may_render_skewer

*********** function cascade
may_render_skewer
	make_skewer_data
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

export function may_render_skewer(data, tk, block) {
	// return skewer tk height
	if (!tk.skewer) {
		// not equipped with skewer track
		// created in makeTk when skewer datatype is available
		return 0
	}

	if (tk.skewer.mode == 'numeric') {
		return nm_render(data, tk, block)
	}

	if (tk.skewer.mode != 'skewer') throw 'skewer.mode is not "skewer"'

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
	const datagroup = make_datagroup(tk, tk.skewer.rawmlst, block)
	// generate secondary groups (discs) in each datagroup
	// specific for skewer, not for numeric mode
	for (const g of datagroup) {
		g.groups = mlst2disc(g.mlst, tk)
	}
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
