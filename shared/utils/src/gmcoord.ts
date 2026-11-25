/* convert a position between the genomic, RNA and protein coordinates of a gene model (gm),
such as one from server/src/bedj.parseBed.js. These gm fields are used:
- strand: '+' or '-'
- start, stop: 0-based genomic range of the isoform
- exon: list of [start, stop] genomic ranges, from 5' to 3'
- rnalen: bp length of the exons
- for a coding isoform only: coding, utr5, utr3 as lists like exon, and codingstart, codingstop, cdslen
*/

/* where a genomic position falls on a gene model, as returned by genomic2gm() */
export type GenomicPositionOnGm = {
	/** bp distance to the 5' end of the isoform, when the position is upstream of it */
	atupstream?: { off: number }
	/** bp distance to the 3' end of the isoform, when the position is downstream of it */
	atdownstream?: { off: number }
	/** 1-based number of the exon the position is in, or of the exon right after its intron */
	atexon?: number
	/** 1-based number of the intron the position is in */
	atintron?: number
	/** the position on the RNA; ends in .5 when the position is in an intron */
	rnapos?: number
	/** the 1-based position on the protein, or 0 when upstream of the coding region, for a coding isoform */
	aapos?: number
	/** the bp length of the 5' UTR, and the bp distance into it, when the position is in it */
	atutr5?: { total: number; off: number }
	/** the bp length of the 3' UTR, and the bp distance into it, when the position is in it */
	atutr3?: { total: number; off: number }
}

export function genomic2gm(pos: number, gm: any, tempoff = 0): GenomicPositionOnGm {
	/*
	pos: 0-based
	tempoff is a quick fix in order to move the imprecise 'intronic' breakpoints of cicero into exon
	should not be used in any other case
	*/
	const rev = gm.strand == '-'
	const cd: GenomicPositionOnGm = {}
	if (pos < gm.start) {
		if (rev) {
			cd.atdownstream = { off: gm.start - pos }
			cd.rnapos = gm.rnalen
			if (gm.cdslen) {
				cd.aapos = gm.cdslen / 3
			}
		} else {
			cd.atupstream = { off: gm.start - pos }
			cd.rnapos = 0
			if (gm.cdslen) {
				cd.aapos = 0
			}
		}
		return cd
	}
	if (pos >= gm.stop) {
		if (rev) {
			cd.atupstream = { off: pos - gm.stop + 1 }
			cd.rnapos = 0
			if (gm.cdslen) {
				cd.aapos = 0
			}
		} else {
			cd.atdownstream = { off: pos - gm.stop + 1 }
			cd.rnapos = gm.rnalen
			if (gm.cdslen) {
				cd.aapos = gm.cdslen / 3
			}
		}
		return cd
	}
	if (pos >= gm.start && pos < gm.stop) {
		// which exon, if in intron
		for (let i = 0; i < gm.exon.length; i++) {
			const e = gm.exon[i]
			if (rev) {
				if (e[1] + tempoff <= pos) {
					// upstream of this exon
					cd.atexon = i + 1
					cd.atintron = i
					break
				}
				if (e[0] - tempoff <= pos) {
					// inside this exon
					cd.atexon = i + 1
					break
				}
			} else {
				if (e[0] - tempoff > pos) {
					// upstream of this exon
					cd.atexon = i + 1
					cd.atintron = i
					break
				}
				if (e[1] + tempoff > pos) {
					// inside this exon
					cd.atexon = i + 1
					break
				}
			}
		}
	}
	let rnapos = 0
	for (const e of gm.exon) {
		if (rev) {
			if (pos >= e[1]) {
				// upstream of this exon
				rnapos += 0.5
				break
			}
			if (pos < e[0]) {
				// downstream of this exon
				rnapos += e[1] - e[0]
				continue
			}
			// inside this exon
			rnapos += e[1] - pos
			break
		} else {
			if (pos < e[0]) {
				// upstream of this exon
				rnapos += 0.5
				break
			}
			if (pos >= e[1]) {
				// downstream of this exon
				rnapos += e[1] - e[0]
				continue
			}
			// inside this exon
			rnapos += pos - e[0] + 1
			break
		}
	}
	cd.rnapos = rnapos
	if (gm.coding) {
		// codon position and utr, no utr in noncoding!
		let utr5len = 0
		if (gm.utr5) {
			utr5len = gm.utr5.reduce((i, j) => i + j[1] - j[0], 0)
		}
		let utr3len = 0
		if (gm.utr3) {
			utr3len = gm.utr3.reduce((i, j) => i + j[1] - j[0], 0)
		}
		if (rnapos <= utr5len) {
			cd.aapos = 0
		} else if (rnapos > utr5len + gm.cdslen) {
			cd.aapos = gm.cdslen / 3
		} else {
			cd.aapos = Math.ceil((rnapos - utr5len) / 3)
		}
		if (pos < gm.codingstart) {
			// left utr
			let bpoff = 0
			if (rev) {
				if (gm.utr3) {
					for (const i of gm.utr3) {
						bpoff += Math.max(i[1], pos) - Math.max(i[0], pos)
					}
					cd.atutr3 = {
						total: utr3len,
						off: bpoff
					}
				}
			} else {
				if (gm.utr5) {
					for (const i of gm.utr5) {
						bpoff += Math.min(i[1], pos) - Math.min(i[0], pos)
					}
					cd.atutr5 = {
						total: utr5len,
						off: bpoff
					}
				}
			}
		} else if (pos > gm.codingstop) {
			let bpoff = 0
			if (rev) {
				if (gm.utr5) {
					for (const i of gm.utr5) {
						bpoff += Math.max(i[1], pos) - Math.max(i[0], pos)
					}
					cd.atutr5 = {
						total: utr5len,
						off: bpoff
					}
				}
			} else {
				if (gm.utr3) {
					for (const i of gm.utr3) {
						bpoff += Math.min(i[1], pos) - Math.min(i[0], pos)
					}
					cd.atutr3 = {
						total: utr3len,
						off: bpoff
					}
				}
			}
		}
	}
	return cd
}

export function aa2gmcoord(aa: number, gm: any): number | null {
	// same as rna2gmcoord
	if (!Number.isInteger(aa)) return null
	if (!gm.coding) return null
	// AA is 1-based!
	let cds = 0
	for (const e of gm.coding) {
		if (cds + e[1] - e[0] >= (aa - 1) * 3) {
			if (gm.strand == '+') {
				return e[0] + (aa - 1) * 3 - cds
			}
			return e[1] - 1 - ((aa - 1) * 3 - cds)
		}
		cds += e[1] - e[0]
	}
	if (gm.strand == '+') return gm.codingstop
	return gm.codingstart
}

export function rna2gmcoord(pos: number, gm: any): number | null {
	// it should only be used for case where only rnapos is given, no gm pos
	// unreliable to convert genomic pos to rna pos, then convert back to genomic pos
	if (!Number.isFinite(pos)) return null
	if (!gm.exon) return null
	// rna is 0-based? not matter?
	let cum = 0
	for (const e of gm.exon) {
		if (cum + e[1] - e[0] >= pos) {
			if (gm.strand == '+') {
				return e[0] + pos - cum
			}
			return e[1] - 1 - pos + cum
		}
		cum += e[1] - e[0]
	}
	if (gm.strand == '+') return gm.stop
	return gm.start
}
