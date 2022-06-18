import { gmmode, dtsnvindel, dtsv, dtfusionrna } from '../../shared/common'
import * as coord from '../coord'

/*
method shared by skewer and numeric mode

each data group is:
{
	chr
	pos
	mlst[]
	x
}
*/

const minbpwidth = 4

export function make_datagroup(tk, rawmlst, block) {
	mlst_pretreat(rawmlst, tk, block)
	// m.__x is added to viewable data points

	const x2mlst = new Map()
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
		// # pixel per nt is big enough
		// group by each nt
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

- calculate m.__x by mapping coord to view range
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

	return usemlst
}

function dsqueryresult_snvindelfusionitd(lst, tk, block) {
	// legacy function, kept the same
	for (const m of lst) {
		if (m.dt == dtsnvindel) {
			if (block.usegm) {
				const t = coord.genomic2gm(m.pos, block.usegm)
				m.rnapos = t.rnapos
				m.aapos = t.aapos
			}
			continue
		}
		if (m.dt == dtsv || m.dt == dtfusionrna) {
			if (!m.pairlst) {
				throw 'pairlst missing from sv/fusion'
			}
			// TODO following legacy code needs correction
			if (block.usegm && m.dt == dtsv) {
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
			if (block.usegm && block.gmmode != gmmode.genomic) {
				m.isoform = block.usegm.isoform
				// gmmode, single datum over current gene
				let nohit = true
				for (const [i, pair] of m.pairlst.entries()) {

					// try to match with both isoform and name, for IGH, without isoform, but the querying "gene" can be IGH
					//if (block.usegm.isoform == (pair.a.isoform || pair.a.name)) 
					if(block.usegm.chr == pair.a.chr && block.usegm.start < pair.a.pos && block.usegm.stop > pair.a.pos) {
						m.useNterm = i == 0
						m.strand = pair.a.strand

						// m.pos is already set

						/*
						m.chr = block.usegm.chr
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
						*/
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

					//if (block.usegm.isoform == (pair.b.isoform || pair.b.name)) 
					if(block.usegm.chr == pair.b.chr && block.usegm.start < pair.b.pos && block.usegm.stop > pair.b.pos) {
						m.useNterm = false // always
						m.strand = pair.b.strand

						// m.pos is already set
						/*
						m.chr = block.usegm.chr
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
						*/

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
				///////// not working yet
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
