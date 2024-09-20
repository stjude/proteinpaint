import { mclass, dtsnvindel, dtsv, dtfusionrna, dtitd, dtdel, dtnloss, dtcloss } from '#shared/common'
import { skewer_make, settle_glyph, fold_glyph, unfold_glyph, mayHighlightDiskBySsmid } from './skewer.render'
import { make_datagroup } from './datagroup'
import { renderNumericMode } from './numericmode'

/*
at some point, data.skewer will return aggregated data,
e.g. one object for ten or hundreds of variants of same class, 
ssm_id list may be given when there are not a lot of variants in a group,
otherwise, ssm_id list will not be given when the number is big, in hundreds
availability of ssm_id decides if variant2samples query is allowed



********************** EXPORTED
may_render_skewer

*********** function cascade
make_skewer_data
	skewer_make
	tkdata_update_x
	settle_glyph

*************************
* skewer data structure *
*************************
tk.skewer{}
	.pointup
	.rawmlst[] -- comes from server-returned data.skewer[]
	.g
	.data[]
		// each element is a skewer
		.chr, pos
		.x
		.occurrence // different types of values
		            // if occurrence is in rawmlst, this is the sum of occurrences from .mlst[]
					// otherwise it's the length of .mlst[]
		.mlst[]
		.groups[]
			// each group is a disk
			.dt
			.occurrence // same as above
			.mlst[]
	.selection
	.stem1, stem2, stem3 // #pixel
	.maxheight


*******************************
* numeric mode data structure *
*******************************
nm{}
	// the view mode object from skewer.viewModes[] that is in use
	.data[]
		.chr, .pos
		.g
		.mlst[]
			// can be multiple variants at the same position with different alleles
		.width
		.x
		.x0
		.xoffset
*/

/*
cutoff value of # pixel per bp
compared to exonsf
when exonsf>:
	basepairs are visible enough, and group mutation grps by basepair position
else exon<:
	basepairs are too tiny and will group mutations by AA position
*/

// if the number of mname categories from a skewer exceeds this count, these mnames will be compacted into one group/disc
// otherwise, each mname will be an individual disc
const minMnameCount2compact = 10

export function may_render_skewer(data, tk, block) {
	// update skewer subtrack height to tk.subtk2height.skewer:int

	if (!tk.skewer) {
		// not equipped with skewer track
		// created in makeTk when skewer datatype is available
		return
	}

	// numericmode axis label and any other skewer things rendered into gleft
	// record the max width
	tk.skewer.maxwidth = 0

	updateViewModes(tk, data.skewer)
	// tk.skewer.viewModes[] updated

	hlaachange2ssmid(tk, data.skewer) // tk.skewer.hlssmid may be set

	const currentMode = tk.skewer.viewModes.find(n => n.inuse)
	if (!currentMode) throw 'no mode!!'

	if (data.skewer) {
		// register new mlst data
		// otherwise will not overwrite skewer.mlst
		tk.skewer.rawmlst = data.skewer
	} else {
		// server will not return skewer data when panning/zooming in protein mode
		// the data is already kept as tk.skewer.rawmlst
	}

	if (currentMode.type == 'numeric') {
		tk.subtk2height.skewer = renderNumericMode(currentMode, data, tk, block)
		mayHighlightDiskBySsmid(tk)
		return
	}

	// possible to plug in new skewer.*.js scripts to support additional mode types

	if (currentMode.type != 'skewer') throw 'mode.type is not "skewer"'

	if (data && !data.skewer && block.usegm && block.gmmode != 'genomic' && block.pannedpx != undefined) {
		// when data.skewer is not given
		// in gmmode, browser panned, no re-requesting data
		// no need to re-group
		// set x
		tkdata_update_x(tk, block)
		tk.skewer.selection.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
		settle_glyph(tk, block)
	} else {
		// when zooming protein mode, data.skewer is not given but still need to remake skewers
		// generate new skewer track data from skewer.mlst
		tk.skewer.g.selectAll('*').remove()
		tk.skewer.data = make_skewer_data(tk, block)
		skewer_make(tk, block)
	}

	if (!tk.skewer.data || tk.skewer.data.length == 0) {
		tk.subtk2height.skewer = 0
		tk.skewer.g.selectAll('*').remove() //remove previous message in case of panning in gmmode
		return
	}

	/*
	variants loaded for this track
	*/

	if (tk.skewer.hlssmid) {
		// highlight variants based on if m.ssm_id is in hlssmid (a set)
		// and fold all the others
		const fold = []
		const unfold = []
		for (const d of tk.skewer.data) {
			let has = false
			for (const g of d.groups) {
				for (const m of g.mlst) {
					if (tk.skewer.hlssmid.has(m.ssm_id)) {
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
		fold_glyph(fold, tk)
		unfold_glyph(unfold, tk, block)
		mayHighlightDiskBySsmid(tk)
	} else {
		// automatically expand
		settle_glyph(tk, block)
	}

	tk.subtk2height.skewer = tk.skewer.maxheight + tk.skewer.stem1 + tk.skewer.stem2 + tk.skewer.stem3
}

function hlaachange2ssmid(tk, mlst) {
	if (!tk.hlaachange || !mlst) return
	// value is comma-joined list of mnames, convert to ssm_id for keeping track of variants
	// using skewer data mlst[], either from server or client,
	const set = new Set(tk.hlaachange.split(','))
	delete tk.hlaachange
	tk.skewer.hlssmid = new Set()
	for (const m of mlst) {
		if (set.has(m.mname)) tk.skewer.hlssmid.add(m.ssm_id)
	}
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
	if (tk.skewer.data && block.pannedpx != undefined) {
		/* block is panned, tk.skewer.data is the previous set of skewers
		existing data points from before panning should assemble into the same set of skewers
		as resolution did not change
		will inherit the showmode
		used to only run this at genomic mode but not in protein mode
		(!block.usegm || block.gmmode == 'genomic')
		*/
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
	/*
	mlst[] is the complete of data points to be shown in one skewer, here divide them to groups to make discs

	snvindel and svfusion has 3 layers. class & mname combination will result in individual discs in skewer
	2nd layer is classes for snvindel, and left/right for svfusion, it will have only limited number of categories
	3rd layer may have too many categories by the presence of data points with distinct mname
	it will be compacted to reduce number of discs
	<m.dt> : Map
	  <m.class> : Map
	    <m.mname> : mlst[]
	
	rest of dt are single-layer:
	<m.dt> : []
	*/
	const k2g = new Map()
	for (const m of mlst) {
		if (!Number.isInteger(m.dt)) continue

		if (!k2g.has(m.dt)) k2g.set(m.dt, new Map())

		switch (m.dt) {
			case dtsnvindel:
				if (!k2g.get(m.dt).has(m.class)) k2g.get(m.dt).set(m.class, new Map())
				const n = m.mname || ''
				if (!k2g.get(m.dt).get(m.class).has(n)) {
					k2g.get(m.dt).get(m.class).set(n, [])
				}
				k2g.get(m.dt).get(m.class).get(n).push(m)
				break
			case dtsv:
			case dtfusionrna:
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
			case dtitd:
			case dtdel:
			case dtnloss:
			case dtcloss:
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

	// each group corresponds to one disc
	const groups = []

	for (const [dt, tmp] of k2g) {
		switch (dt) {
			case dtsnvindel:
				for (const [thisClass, mname2lst] of tmp) {
					if (mname2lst.size > minMnameCount2compact) {
						// too many mname under this class, compact to one single disc
						const mlst = []
						for (const l2 of mname2lst.values()) mlst.push(...l2)
						groups.push({
							dt,
							mlst,
							mnameCompact: mclass[thisClass].label
						})
					} else {
						for (const mlst of mname2lst.values()) {
							groups.push({ dt, mlst })
						}
					}
				}
				break
			case dtsv:
			case dtfusionrna:
				for (const classset of tmp.values()) {
					if (classset.use5.size > minMnameCount2compact) {
						const mlst = []
						for (const l2 of classset.use5.values()) mlst.push(...l2)
						groups.push({ dt, mlst, useNterm: true, mnameCompact: dt == dtsv ? 'SV' : 'fusion' })
					} else {
						for (const mlst of classset.use5.values()) {
							groups.push({ dt, mlst, useNterm: true })
						}
					}

					if (classset.use3.size > minMnameCount2compact) {
						const mlst = []
						for (const l2 of classset.use3.values()) mlst.push(...l2)
						groups.push({ dt, mlst, useNterm: false, mnameCompact: dt == dtsv ? 'SV' : 'fusion' })
					} else {
						for (const mlst of classset.use3.values()) {
							groups.push({ dt, mlst, useNterm: false })
						}
					}
				}
				break
			case dtitd:
			case dtdel:
			case dtnloss:
			case dtcloss:
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
			// m rim counts are computed on server
			rim1count += m.rim1count || 0
			rim2count += m.rim2count || 0
		}
		g.rim1count = rim1count
		g.rim2count = rim2count
	}

	if (mlst.some(m => Number.isFinite(m.occurrence))) {
		// data points has occurrence; g.occurrence will be the sum from mlst[]
		for (const g of groups) g.occurrence = g.mlst.reduce((i, j) => i + j.occurrence, 0)
	} else {
		// no occurrence from mlst[]; g.occurrence is length of mlst
		for (const g of groups) g.occurrence = g.mlst.length
	}
	// this ensures that data groups all get a valid .occurrence value for rendering

	groups.sort((a, b) => {
		return b.occurrence - a.occurrence
	})
	return groups
}

function updateViewModes(tk, mlst) {
	detectNumericMode(tk, mlst)
	detectAlternativeSkewerModes(tk, mlst)
	// for numeric modes not in use, clear axisg
	for (const n of tk.skewer.viewModes) {
		if (n.type == 'numeric' && !n.inuse && n.axisg) {
			n.axisg.remove()
			delete n.axisg
		}
	}
}

function detectAlternativeSkewerModes(tk) {
	// TODO if possible to render as protein painter style
	// low #variants, low occurrences
	// may delete special skewer modes if condition no longer applies
}

function detectNumericMode(tk, mlst) {
	// detect if data has occurrence
	// mlst can be undefined when server returns no new data
	if (mlst && mlst.find(i => Number.isFinite(i.occurrence))) {
		// has occurrence, assume all data points have it thus numeric mode is possible
		if (!tk.skewer.viewModes.find(n => n.type == 'numeric' && n.byAttribute == 'occurrence')) {
			// occurrence mode obj is missing, add it
			tk.skewer.viewModes.push({
				type: 'numeric',
				byAttribute: 'occurrence',
				label: 'Occurrence',
				isinteger: true
			})
		}
	}
	// TODO more sources e.g. bcf numeric info fields
}

function makeSkewerModeUI(tk) {}
