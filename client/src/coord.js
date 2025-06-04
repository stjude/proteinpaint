/*******************************

				!!!
       THIS SCRIPT IS NO LONGER MAINTAINED
				!!!

invalidcoord() and string2pos() has been copied to share/utils/src/common.js

they will be deleted from this script

client script should switch import to `import { invalidcoord, string2pos } from '#shared/common.js'`

*******************************/
export function invalidcoord(thisgenome, chrom, start, stop) {
	if (!thisgenome) return 'no genome'
	if (!chrom) return 'no chr name'
	const chr = thisgenome.chrlookup[chrom.toUpperCase()]
	if (!chr) return 'Invalid chromosome name: ' + chr
	if (!Number.isInteger(start)) return 'Non-numerical position: ' + start
	if (start < 0 || start >= chr.len) return 'Position out of range: ' + start
	if (!Number.isInteger(stop)) return 'Non-numerical position: ' + stop
	if (stop < 0 || stop > chr.len) return 'Position out of range: ' + stop
	if (start > stop) return 'Start position is greater than stop'
	return false
}

export function string2pos(s, genome, donotextend) {
	s = s.replace(/,/g, '')
	const chr = genome.chrlookup[s.toUpperCase()]
	if (chr) {
		// chr name only, to middle
		return {
			chr: chr.name,
			chrlen: chr.len,
			start: Math.max(0, Math.ceil(chr.len / 2) - 10000),
			stop: Math.min(chr.len, Math.ceil(chr.len / 2) + 10000)
		}
	}
	{
		// special handling for snv4
		const tmp = s.split('.')
		if (tmp.length >= 2) {
			const chr = genome.chrlookup[tmp[0].toUpperCase()]
			const pos = Number.parseInt(tmp[1])
			const e = invalidcoord(genome, tmp[0], pos, pos + 1)
			if (!e) {
				// valid snv4
				const bpspan = 400
				return {
					chr: chr.name,
					chrlen: chr.len,
					start: Math.max(0, pos - Math.ceil(bpspan / 2)),
					stop: Math.min(chr.len, pos + Math.ceil(bpspan / 2)),
					actualposition: { position: pos, len: 1 }
				}
			}
		}
	}
	const tmp = s.split(/[-:\s]+/)
	if (tmp.length == 2) {
		// must be chr - pos
		const pos = Number.parseInt(tmp[1])
		const e = invalidcoord(genome, tmp[0], pos, pos + 1)
		if (e) {
			return null
		}
		const chr = genome.chrlookup[tmp[0].toUpperCase()]
		const bpspan = 400
		return {
			chr: chr.name,
			chrlen: chr.len,
			start: Math.max(0, pos - Math.ceil(bpspan / 2)),
			stop: Math.min(chr.len, pos + Math.ceil(bpspan / 2)),
			actualposition: { position: pos, len: 1 }
		}
	}
	if (tmp.length == 3) {
		// must be chr - start - stop
		let start = Number.parseInt(tmp[1]),
			stop = Number.parseInt(tmp[2])
		const e = invalidcoord(genome, tmp[0], start, stop)
		if (e) {
			return null
		}
		const actualposition = { position: start, len: stop - start }
		const chr = genome.chrlookup[tmp[0].toUpperCase()]

		if (!donotextend) {
			const minspan = 400
			if (stop - start < minspan) {
				let center = Math.ceil((start + stop) / 2)
				if (center + minspan / 2 >= chr.len) {
					center = chr.len - Math.ceil(minspan / 2)
				}
				start = Math.max(0, center - Math.ceil(minspan / 2))
				stop = start + minspan
			}
		}

		return {
			chr: chr.name,
			chrlen: chr.len,
			start,
			stop,
			actualposition
		}
	}
	return null
}

export function genomic2gm(pos, gm, tempoff = 0) {
	/*
	pos: 0-based
	tempoff is a quick fix in order to move the imprecise 'intronic' breakpoints of cicero into exon
	should not be used in any other case
	*/
	//if (tempoff) console.log(pos, gm)
	const rev = gm.strand == '-'
	const cd = {}
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

export function aa2gmcoord(aa, gm) {
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

export function rna2gmcoord(pos, gm) {
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
