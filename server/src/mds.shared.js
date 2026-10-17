/*
The helpers that the route handlers of legacy mds datasets share, moved from app.unorg.js
*/

import * as common from '#shared/common.js'

// set by the route init, so that the moved code can use genomes as in app.unorg.js
let genomes

export { mds_query_arg_check, mdssvcnv_do_copyneutralloh, get_rank_from_sortedarray }

export function setGenomes(_genomes) {
	genomes = _genomes
}

function mds_query_arg_check(q) {
	if (!q.genome) return ['no genome']
	const g = genomes[q.genome]
	if (!g) return ['invalid genome']
	if (!g.datasets) return ['genome is not equipped with datasets']
	if (!q.dslabel) return ['dslabel missing']
	const ds = g.datasets[q.dslabel]
	if (!ds) return ['invalid dslabel']
	if (!ds.queries) return ['dataset is not equipped with queries']
	if (!q.querykey) return ['querykey missing']
	const query = ds.queries[q.querykey]
	if (!query) return ['invalid querykey']
	return [null, g, ds, query]
}

function mdssvcnv_do_copyneutralloh(sample2item) {
	/*
decide what's copy neutral loh
only keep loh with no overlap with cnv

quick fix: only do this filter when hideLOHwithCNVoverlap is true on the server-side mdssvcnv query object
*/
	for (const [sample, lst] of sample2item) {
		// put cnv and loh into respective maps, keyed by chr
		const chr2loh = new Map()
		const chr2cnv = new Map()
		const thissampleitems = []
		for (const i of lst) {
			if (i.dt == common.dtloh) {
				if (!chr2loh.has(i.chr)) chr2loh.set(i.chr, [])
				chr2loh.get(i.chr).push(i)
				continue
			}
			if (i.dt == common.dtcnv) {
				if (!chr2cnv.has(i.chr)) chr2cnv.set(i.chr, [])
				chr2cnv.get(i.chr).push(i)
			}
			thissampleitems.push(i)
		}

		if (chr2loh.size == 0) continue

		for (const [chr, lohlst] of chr2loh) {
			const cnvlst = chr2cnv.get(chr)
			if (!cnvlst) {
				// this sample has no cnv in view range, use all loh as copy neutral
				for (const i of lohlst) thissampleitems.push(i)
				continue
			}

			for (const loh of lohlst) {
				// for each loh
				let nocnvmatch = true
				for (const cnv of cnvlst) {
					if (Math.max(loh.start, cnv.start) < Math.min(loh.stop, cnv.stop)) {
						// this loh overlaps with a cnv, then it isn't copy neutral
						nocnvmatch = false
						break
					}
				}
				if (nocnvmatch) thissampleitems.push(loh)
			}
		}

		sample2item.set(sample, thissampleitems)
	}
}

function get_rank_from_sortedarray(v, lst) {
	// [ { value: v } ]
	// lst must be sorted ascending
	const i = lst.findIndex(j => j.value >= v)
	if (i == -1 || i == lst.length - 1) return 100
	if (i == 0) return 0
	return Math.ceil((100 * i) / lst.length)
}

/** true if a loaded genome has a legacy mds dataset; the legacy mds routes are only set up then, see app.unorg.js */
export function hasMdsDataset(genomes) {
	return Object.values(genomes).some(g => Object.values(g.datasets || {}).some(ds => ds.isMds))
}
