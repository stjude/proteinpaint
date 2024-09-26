import { gmmode, dtsnvindel, dtsv, dtfusionrna } from '#shared/common.js'
import * as coord from '#src/coord'

/* method shared by skewer and numeric mode

******** input ************

list of mixed snvindel or sv/fusion
each element is one data point

snvindel is:
{
	dt = dtsnvindel
	chr = str
	pos = int
}
sv/fusion is:
{
	dt = dtsv/dtfusionrna
	chr = str
	pos = int
	pairlstIdx = int
	strand = +/-
	mname = str
}

******** output ***********

input data points that are clustering together are grouped for skewer data

{
	chr
	pos
	mlst[ {} ]
		.aapos = number
		.rnapos = number
		.__x = number
		.useNterm = boolean
	x
}
*/

// minimum #pixels per basepair, for which to group data points by bp position
// if lower than this, means too zoomed out and will group by on-screen pixel position
const minbpwidth = 4

export function make_datagroup(tk, rawmlst, block) {
	mlst_pretreat(rawmlst, tk, block)
	// m.__x is added to viewable data points

	const x2mlst = new Map()
	// k: m.__x, v: mlst

	for (const m of rawmlst) {
		if (m.__x == undefined) continue // dropped
		if (!x2mlst.has(m.__x)) {
			x2mlst.set(m.__x, [])
		}
		x2mlst.get(m.__x).push(m)
	}
	const datagroup = []
	// by resolution
	if (block.exonsf >= minbpwidth) {
		// # pixel per nt is big enough, group by each nt
		for (const [x, mlst] of x2mlst) {
			datagroup.push({
				chr: mlst[0].chr,
				pos: mlst[0].pos,
				mlst,
				x
			})
		}
	} else {
		// # pixel per nt is too small
		if (block.usegm && block.usegm.coding && block.gmmode != gmmode.genomic) {
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
						mlst,
						x: mlst[0].__x
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
				mlst,
				x: xsum / mlst.length
			})
		}
	}
	datagroup.sort((a, b) => a.x - b.x)
	return datagroup
}

/*
legacy function kept to add in new filters
guard against bad data
filter data by a systematic filter

for viewable data points, add following:
.__x = view range x position
.rnapos = rna position of block.usegm
.aapos = aa position of block.usegm
*/
function mlst_pretreat(rawmlst, tk, block) {
	let nogenomicpos = 0,
		outofcds = 0,
		nochr = 0
	const unmapped = []
	const usemlst = [] // usable after filtering, for updating stats

	for (const m of rawmlst) {
		delete m.__x

		if (block.gmmode == gmmode.protein && block.usegm.codingstart && block.usegm.codingstop) {
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
}

function dsqueryresult_snvindelfusionitd(lst, tk, block) {
	for (const m of lst) {
		if (block.usegm) {
			// m.pos must always be set
			const t = coord.genomic2gm(m.pos, block.usegm)
			m.rnapos = t.rnapos
			m.aapos = t.aapos
		}

		if (m.dt == dtsnvindel) {
			// no further processing needed for snvindel
			continue
		}

		if (m.dt == dtsv || m.dt == dtfusionrna) {
			if (m.pairlstIdx == 0) {
				m.useNterm = true
			} else {
				m.useNterm = false
			}
			continue
		}

		// support additional data types

		throw 'unknown dt: ' + m.dt
	}
}
