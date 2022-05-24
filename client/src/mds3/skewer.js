import { dtsnvindel, dtsv, dtfusionrna, dtitd, dtdel, dtnloss, dtcloss } from '../../shared/common'
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
makeSkewerModeUI

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

	setPossibleSkewerModes(tk, data.skewer)
	// tk.skewer.possibleModes set

	hlaachange2ssmid(tk, data.skewer) // tk.skewer.hlssmid may be set

	const currentMode = tk.skewer.viewModes.find(n => n.inuse)
	if (!currentMode) throw 'no mode!!'

	if (currentMode.type == 'numeric') {
		const h = renderNumericMode(currentMode, data, tk, block)
		mayHighlightDiskBySsmid(tk)
		return h
	}

	// possible to plug in new skewer.*.js scripts to support additional mode types

	if (currentMode.type != 'skewer') throw 'mode.type is not "skewer"'

	tk.aboveprotein = true

	if (data && !data.skewer && block.usegm && block.gmmode != 'genomic' && block.pannedpx != undefined) {
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

	return tk.skewer.maxheight + tk.skewer.stem1 + tk.skewer.stem2 + tk.skewer.stem3
}

function hlaachange2ssmid(tk, mlst) {
	if (!tk.hlaachange) return
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
	if (tk.skewer.data && block.pannedpx != undefined && (!block.usegm || block.gmmode == 'genomic')) {
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
			case dtsnvindel:
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
			case dtsv:
			case dtfusionrna:
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
	const groups = []
	for (const [dt, tmp] of k2g) {
		switch (dt) {
			case dtsnvindel:
				for (const t2 of tmp.values()) {
					for (const mlst of t2.values()) {
						groups.push({
							dt: dt,
							mlst: mlst
						})
					}
				}
				break
			case dtsv:
			case dtfusionrna:
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
	*/
	let height = 0 // cumulate

	//remove previous message in case of panning in gmmode
	tk.skewer.g.selectAll('*').remove()

	let context = 'view range'
	if (block.usegm && block.gmmode != 'genomic') {
		context = block.usegm.name || block.usegm.isoform
	}
	tk.skewer.g
		.append('text')
		.text((tk.mds.label || tk.name) + ': no mutation in ' + context)
		.attr('y', 25)
		.attr('x', block.width / 2)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'center')

	return 50
}

function setPossibleSkewerModes(tk, mlst) {
	detectNumericMode(tk, mlst)
	// all possible modes based on ds and current data
	// mode=skewer is always available
	tk.skewer.possibleModes = new Set(['skewer'])
	// modes predefined by official ds
	if (tk.mds.skewerModes) {
		for (const i of tk.mds.skewerModes) tk.skewer.possibleModes.add(i)
	}
	detectAlternativeSkewerModes(tk)
}

function detectAlternativeSkewerModes(tk) {
	// TODO if possible to render as protein painter style
	// low #variants, low occurrences
}

function detectNumericMode(tk, mlst) {
	if (!mlst) {
		// mlst can be undefined when server returns no new data
		return
	}
	// detect if data has occurrence
	if (mlst.find(i => Number.isFinite(i.occurrence))) {
		// has occurrence, assume all data points have it thus numeric mode is possible
		if (!tk.skewer.viewModes.find(n => n.type == 'numeric' && n.byAttribute == 'occurrence')) {
			// occurrence mode obj is missing, add it
			tk.skewer.viewModes.push({
				type: 'numeric',
				byAttribute: 'occurrence',
				label: 'Occurrence'
			})
		}
	}
	// TODO more sources e.g. bcf numeric info fields
}

function currentSkewerModeName(tk) {
	const n = tk.skewer.viewModes.find(n => n.inuse)
	if (!n) return 'NONE IN USE'
	if (n.type == 'skewer') return 'Viewing as lollipops'
	if (n.type == 'numeric') return n.label + ' as Y axis'
	return 'unknown mode'
}

function makeSkewerModeUI(tk) {}

export function mayAddSkewerModeOption(tk) {
	if (!tk.skewer) return
	if (tk.skewer.possibleModes.size == 1) {
		// only one possible mode, cannot change to alt modes, do not add option
		return
	}
	// there are more than 1 mode for skewer, allow to change
	tk.menutip.d
		.append('div')
		.style('margin', '10px 3px 3px 3px')
		.style('font-size', '.7em')
		.style('opacity', 0.5)
		.text(currentSkewerModeName(tk))
	tk.menutip.d
		.append('div')
		.text('Change mode')
		.attr('class', 'sja_menuoption')
		.on('click', () => {
			tk.menutip.clear()
			makeSkewerModeUI(tk)
		})
}
