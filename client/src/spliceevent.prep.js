export function mapjunctiontoexons(junctions, genes) {
	/*
run this prior to running a event finder

paramters explained in exonskip.js

*/

	// clear isoform/exon assignment
	for (const j of junctions) {
		j.exonleft = [] // left end at last base of exon
		j.exonright = [] // right end at first base of exon
		j.exonleftin = [] // left inside exon
		j.exonrightin = [] // right inside exon

		j.intronleft = [] // left inside intron
		j.intronright = [] // right inside intron

		j.leftout = [] // left outside of gene
		j.rightout = [] // right outside of gene

		j.matchisoform = [] // from exonleft & exonright at common isoform
	}

	/* in cases e.g. NBPF9 the genes can be at different loci on same/different chromosomes
so must identify genes that overlaps with any of the junctions
*/
	const usegenes = []
	for (const gene of genes) {
		let use = false
		for (const j of junctions) {
			if (gene.chr == j.chr && Math.max(gene.start, j.start) < Math.min(gene.stop, j.stop)) {
				use = true
				break
			}
		}
		if (use) {
			usegenes.push(gene)
		}
	}
	if (usegenes.length == 0) {
		return
	}

	// get unique set of 5' and 3' junction positions, and mapping to junctions
	// for later mapping junction positions to exons
	// so that each unique junction position is computed only once
	// TODO distinguish 5' and 3' ends by junction strand
	const leftpos = new Map()
	const rightpos = new Map()
	// k: 0-based position
	// v: [ list of junctions ]
	for (const j of junctions) {
		if (!leftpos.has(j.start)) {
			leftpos.set(j.start, [])
		}
		leftpos.get(j.start).push(j)

		if (!rightpos.has(j.stop)) {
			rightpos.set(j.stop, [])
		}
		rightpos.get(j.stop).push(j)
	}

	for (const [pos, jlst] of leftpos) {
		for (const gm of usegenes) {
			if (!gm.exon) continue

			for (let i = 0; i < gm.exon.length; i++) {
				if (gm.exon[i][1] - 1 == pos) {
					// this left position matches to exon stop
					for (const j of jlst) {
						j.exonleft.push({
							gm: gm,
							exonidx: i
						})
					}
				}

				if (gm.exon[i][0] <= pos && gm.exon[i][1] - 1 > pos) {
					// this left position is inside the exon
					for (const j of jlst) {
						j.exonleftin.push({
							gm: gm,
							exonidx: i
						})
					}
				}
			}

			if (gm.intron) {
				for (let i = 0; i < gm.intron.length; i++) {
					if (gm.intron[i][0] <= pos && gm.intron[i][1] > pos) {
						// this left pos inside intron
						for (const j of jlst) {
							j.intronleft.push({
								gm: gm,
								intronidx: i
							})
						}
					}
				}
			}
		}
	}

	// right pos should be exon start
	for (const [pos, jlst] of rightpos) {
		for (const gm of usegenes) {
			if (!gm.exon) continue
			for (let i = 0; i < gm.exon.length; i++) {
				if (gm.exon[i][0] == pos) {
					// this right position matches with exon start
					for (const j of jlst) {
						j.exonright.push({
							gm: gm,
							exonidx: i
						})
					}
				}

				if (gm.exon[i][0] < pos && gm.exon[i][1] > pos) {
					// this pos inside exon
					for (const j of jlst) {
						j.exonrightin.push({
							gm: gm,
							exonidx: i
						})
					}
				}
			}

			if (gm.intron) {
				for (let i = 0; i < gm.intron.length; i++) {
					if (gm.intron[i][0] <= pos && gm.intron[i][1] > pos) {
						// this pos inside intron
						for (const j of jlst) {
							j.intronright.push({
								gm: gm,
								intronidx: i
							})
						}
					}
				}
			}
		}
	}

	/*
may identify junctions with one end inside, the other end outside a gene, for diagram purpose
*/
	for (const j of junctions) {
		{
			const isoforms = new Set()
			for (const q of j.exonleft) isoforms.add(q.gm.isoform)
			for (const q of j.exonleftin) isoforms.add(q.gm.isoform)
			for (const q of j.intronleft) isoforms.add(q.gm.isoform)
			if (isoforms.size) {
				// left end in some isoforms, see if right end stands out
				for (const gm of usegenes) {
					if (!isoforms.has(gm.isoform)) continue
					if (gm.stop <= j.stop) {
						j.rightout.push({
							gm: gm
						})
					}
				}
			}
		}

		{
			const isoforms = new Set()
			for (const q of j.exonright) isoforms.add(q.gm.isoform)
			for (const q of j.exonrightin) isoforms.add(q.gm.isoform)
			for (const q of j.intronright) isoforms.add(q.gm.isoform)
			if (isoforms.size) {
				// right end in some isoforms, see if right end stands out
				for (const gm of usegenes) {
					if (!isoforms.has(gm.isoform)) continue
					if (gm.start > j.start) {
						j.leftout.push({
							gm: gm
						})
					}
				}
			}
		}
	}

	/*
find matching isoform for each junction
an exon-end of the isoform should match junction start
and an exon-start should match junction stop
exon end/start can be on different exons, as the basis of exon skipping
*/
	for (const j of junctions) {
		if (j.exonleft.length == 0 || j.exonright.length == 0) continue
		for (const el of j.exonleft) {
			for (const er of j.exonright) {
				if (el.gm.isoform == er.gm.isoform) {
					j.matchisoform.push({
						gm: el.gm,
						leftexonidx: el.exonidx,
						rightexonidx: er.exonidx
					})
				}
			}
		}
	}
}
