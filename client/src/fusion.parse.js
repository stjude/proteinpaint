/*
duplicated from lines 120-220 of block.ds.gmcustomdata.js
may only work on client as it needs client-side genome object

input: a string e.g. "PAX5,NM_016734,201,JAK2,NM_004972,812"
	positionType = codon, rna, genomic
		codon and rna values are single integer value
		genomic: "chr:pos", pos is 1-based

output: object representing this fusion
*/

import * as coord from './coord'

export async function parseFusion({ line, genome, positionType }) {
	const l = line.split(',')
	let codon1 = null,
		codon2 = null,
		rnapos1 = null,
		rnapos2 = null,
		chr1 = null,
		chr2 = null,
		position1 = null,
		position2 = null
	if (positionType == 'codon') {
		codon1 = Number.parseInt(l[2].trim())
		if (Number.isNaN(codon1)) throw 'N-term codon position is not integer'
		codon2 = Number.parseInt(l[5].trim())
		if (Number.isNaN(codon2)) throw 'C-term codon position is not integer'
	} else if (positionType == 'rna') {
		rnapos1 = Number.parseInt(l[2].trim())
		if (Number.isNaN(rnapos1)) throw 'N-term RNA position is not integer'
		rnapos2 = Number.parseInt(l[5].trim())
		if (Number.isNaN(rnapos2)) throw 'C-term RNA position is not integer'
	} else if (positionType == 'genomic') {
		let t = l[2].trim().split(':')
		if (t.length != 2) throw 'N-term genomic position format is not chr:position'
		chr1 = t[0]
		position1 = Number.parseInt(t[1])
		if (Number.isNaN(position1)) throw 'invalid N-term genomic position'
		position1--
		const e1 = coord.invalidcoord(genome, chr1, position1, position1)
		if (e1) throw 'N-term genomic position error: ' + e1
		t = l[5].trim().split(':')
		if (t.length != 2) throw 'C-term genomic position format is not chr:position'
		chr2 = t[0]
		position2 = Number.parseInt(t[1])
		if (Number.isNaN(position2)) throw ': invalid C-term genomic position'
		position2--
		const e2 = coord.invalidcoord(block.genome, chr2, position2, position2)
		if (e2) throw 'C-term genomic position error: ' + e2
	} else {
		throw 'unknown positionType'
	}

	const isoform1 = l[1].trim().toUpperCase()
	const isoform2 = l[4].trim().toUpperCase()

	const m = {
		class: 'Fuserna', // common.mclassfusionrna,
		dt: 2, // common.dtfusionrna,
		isoform: isoform1,
		pairlst: [
			{
				a: {
					name: l[0].trim(),
					isoform: isoform1,
					codon: codon1,
					rnaposition: rnapos1,
					chr: chr1,
					position: position1
				},
				b: {
					name: l[3].trim(),
					isoform: isoform2,
					codon: codon2,
					rnaposition: rnapos2,
					chr: chr2,
					position: position2
				}
			}
		]
	}
	if (l[6]) {
		const ilen = Number.parseInt(l[6].trim())
		if (!Number.isNaN(ilen)) {
			m.pairlst[0].interstitial = { aalen: ilen }
		}
	}
	return m
}
