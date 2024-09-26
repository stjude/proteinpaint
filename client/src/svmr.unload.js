import { genomic2gm } from './coord'
import {
	dtitd,
	dtdel,
	dtfusionrna,
	dtnloss,
	dtcloss,
	mclassitd,
	mclassnloss,
	mclasscloss,
	mclassfusionrna
} from '#shared/common.js'
import { newpane, export_data } from './client'

export function svmr_export_json(svmr, hqonly) {
	var rows = []
	for (const sample of svmr.samples) {
		for (const egg of sample.egglst) {
			for (const eg of egg.lst) {
				if (eg.ismsg) {
					const lst = eg.lst.map(evt => evt.lst[0])
					if (hqonly) {
						let hashq = false
						for (const i of lst) {
							if (i.rating == 'Major') hashq = true
						}
						if (hashq) {
							rows.push(lst)
						}
					} else {
						rows.push(lst)
					}
				} else {
					for (const evt of eg.lst) {
						for (const p of evt.lst) {
							if (hqonly) {
								if (p.rating == 'Major') rows.push([p])
							} else {
								rows.push([p])
							}
						}
					}
				}
			}
		}
	}
	const lines = [],
		e_itd = [],
		e_nloss = [],
		e_closs = []
	for (const row of rows) {
		if (row.length == 1 && row[0].usepair) {
			const p = row[0]
			if (p.isitd) {
				const u = p.usepair
				const gm = svmr.genome.isoformmatch(u.a.isoform, p.chrA, p.posA)
				if (!gm) {
					e_itd.push(p.sample + ' ' + p.geneA + ' ITD (' + p.rating + '): no gene model found for ' + u.a.isoform)
					continue
				}
				const exonbp1 = genomic2gm(p.posA, gm).rnapos
				const exonbp2 = genomic2gm(p.posB, gm).rnapos
				if (exonbp1 <= exonbp2) {
					e_itd.push(p.sample + ' ' + p.geneA + ' ITD (' + p.rating + '): negative duplication length')
					continue
				}
				const itd = {
					typecode: dtitd,
					gene: p.geneA,
					isoform: u.a.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp2,
					rnaduplength: exonbp1 - exonbp2 + 1,
					a: {
						chr: p.chrA,
						position: p.posA,
						strand: p.ortA,
						ratio: p.ratioA,
						chimericreads: p.readsA,
						totalreads: p.totalreadsA,
						match: p.matchA,
						repeat: p.repeatA
					},
					b: {
						chr: p.chrB,
						position: p.posB,
						strand: p.ortB,
						ratio: p.ratioB,
						chimericreads: p.readsB,
						totalreads: p.totalreadsB,
						match: p.matchB,
						repeat: p.repeatB
					}
				}
				// interstitial
				let aalen = 0,
					bplen = 0
				if (u.a.contigaa && u.b.contigaa) {
					aalen = u.b.contigaa - u.a.contigaa - 1
				}
				if (u.a.contigbp && u.b.contigbp) {
					bplen = u.b.contigbp - u.a.contigbp - 1
				}
				if (aalen > 0) {
					itd.interstitial = { aalen: aalen }
				}
				if (bplen > 0) {
					if (!itd.interstitial) itd.interstitial = {}
					itd.interstitial.bplen = bplen
				}
				lines.push([p.sample, p.geneA, p.usepair.a.isoform, JSON.stringify(itd)])
				continue
			}
			if (p.isnloss) {
				const p2 = p.usepair.b
				if (!p2.isoform) {
					e_nloss.push(p.sample + ' ' + p.geneB + ' NLoss (' + p.rating + '): no isoform')
					continue
				}
				const gm = svmr.genome.isoformmatch(p2.isoform, p.chrB, p.posB)
				if (!gm) {
					e_nloss.push(p.sample + ' ' + p.geneB + ' NLoss (' + p.rating + '): no gene model found for ' + p2.isoform)
					continue
				}
				const exonbp = genomic2gm(p.posB, gm).rnapos
				const pp = {
					typecode: dtnloss,
					gene: p.geneB,
					isoform: p2.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp,
					chr: p.chrB,
					position: p.posB,
					strand: p.ortB,
					ratio: p.ratioB,
					chimericreads: p.readsB,
					match: p.matchB,
					repeat: p.repeatB,
					partner: {
						chr: p.chrA,
						position: p.posA,
						strand: p.ortA,
						ratio: p.ratioA,
						chimericreads: p.readsA,
						match: p.matchA,
						repeat: p.repeatA
					}
				}
				if (p.geneA) {
					pp.partner.gene = p.geneA
				}
				if (p.usepair.a.isoform) {
					pp.partner.isoform = p.usepair.a.isoform
				}
				lines.push([p.sample, p.geneB, p2.isoform, JSON.stringify(pp)])
				continue
			}
			if (p.iscloss) {
				const p2 = p.usepair.a
				if (!p2.isoform) {
					e_nloss.push(p.sample + ' ' + p.geneA + ' CLoss (' + p.rating + '): no isoform')
					continue
				}
				const gm = svmr.genome.isoformmatch(p2.isoform, p.chrA, p.posA)
				if (!gm) {
					e_nloss.push(p.sample + ' ' + p.geneA + ' CLoss (' + p.rating + '): no gene model found by ' + p2.isoform)
					continue
				}
				const exonbp = genomic2gm(p.posA, gm).rnapos
				const pp = {
					typecode: dtcloss,
					gene: p.geneA,
					isoform: p2.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp,
					chr: p.chrA,
					position: p.posA,
					strand: p.ortA,
					ratio: p.ratioA,
					chimericreads: p.readsA,
					match: p.matchA,
					repeat: p.repeatA,
					partner: {
						chr: p.chrB,
						position: p.posB,
						strand: p.ortB,
						ratio: p.ratioB,
						chimericreads: p.readsB,
						match: p.matchB,
						repeat: p.repeatB
					}
				}
				if (p.geneB) {
					pp.partner.gene = p.geneB
				}
				if (p.usepair.b.isoform) {
					pp.partner.isoform = p.usepair.b.isoform
				}
				lines.push([p.sample, p.geneA, p2.isoform, JSON.stringify(pp)])
				continue
			}
		}
		const genes = new Set(),
			isoforms = new Set(),
			cleanup = []
		for (const p of row) {
			if (p.geneA) genes.add(p.geneA)
			if (p.geneB) genes.add(p.geneB)
			if (p.usepair) {
				if (p.usepair.a.isoform) isoforms.add(p.usepair.a.isoform)
				if (p.usepair.b.isoform) isoforms.add(p.usepair.b.isoform)
			}
			const clean = {
				type: p.type,
				type2: p.type2,
				rating: p.rating,
				score: p.score,
				functioneffect: p.functioneffect,
				a: {
					name: p.geneA,
					chr: p.chrA,
					position: p.posA,
					strand: p.ortA,
					ratio: p.ratioA,
					feature: p.featureA,
					chimericreads: p.readsA,
					contiglen: p.matchA,
					repeatscore: p.repeatA
				},
				b: {
					name: p.geneB,
					chr: p.chrB,
					position: p.posB,
					strand: p.ortB,
					ratio: p.ratioB,
					feature: p.featureB,
					chimericreads: p.readsB,
					contiglen: p.matchB,
					repeatscore: p.repeatB
				}
			}
			if (p.usepair) {
				const u = p.usepair
				clean.frame = u.frame
				if (u.a.isoform) {
					clean.a.isoform = u.a.isoform
				}
				if (u.b.isoform) {
					clean.b.isoform = u.b.isoform
				}
				/*
				clean.a.exon=u.a.exon
				clean.b.exon=u.b.exon
				clean.a.codon=u.a.codon
				clean.b.codon=u.b.codon
				*/
				// interstitial
				let aalen = 0,
					bplen = 0
				if (u.a.contigaa && u.b.contigaa) {
					aalen = u.b.contigaa - u.a.contigaa - 1
				}
				if (u.a.contigbp && u.b.contigbp) {
					bplen = u.b.contigbp - u.a.contigbp - 1
				}
				if (aalen > 0) {
					clean.interstitial = { aalen: aalen }
				}
				if (bplen > 0) {
					if (!clean.interstitial) clean.interstitial = {}
					clean.interstitial.bplen = bplen
				}
			}
			cleanup.push(clean)
		}
		const genenames = [...genes]
		const isoformnames = [...isoforms]
		lines.push([
			row[0].sample,
			genenames.length ? genenames.join(',') : 'none',
			isoformnames.length ? isoformnames.join(',') : 'none',
			JSON.stringify(cleanup)
		])
	}
	if (e_itd.length) {
		svmr.err(e_itd.join('<br>'))
	}
	if (e_nloss.length) {
		svmr.err(e_nloss.join('<br>'))
	}
	if (e_closs.length) {
		svmr.err(e_closs.join('<br>'))
	}
	export_data('Fusion data from ' + svmr.filename, [{ text: lines.map(i => i.join('\t')).join('\n') }])
}

export function svmr_2pp(svmr, hqonly) {
	const rows = []
	for (const sample of svmr.samples) {
		for (const egg of sample.egglst) {
			for (const eg of egg.lst) {
				if (eg.ismsg) {
					const lst = eg.lst.map(evt => evt.lst[0])
					if (hqonly) {
						let hashq = false
						for (const i of lst) {
							if (i.rating == 'Major') hashq = true
						}
						if (hashq) {
							rows.push(lst)
						}
					} else {
						rows.push(lst)
					}
				} else {
					for (const evt of eg.lst) {
						for (const p of evt.lst) {
							if (hqonly) {
								if (p.rating == 'Major') rows.push([p])
							} else {
								rows.push([p])
							}
						}
					}
				}
			}
		}
	}
	const genes = {},
		// k: symbol, original case, will be converted to upper case later
		e_itd = [],
		e_nloss = [],
		e_closs = []
	for (const row of rows) {
		if (row.length == 1 && row[0].usepair) {
			const p = row[0]
			if (p.isitd) {
				if (!p.geneA) {
					e_itd.push(p.sample + ' ITD (' + p.rating + '): no gene name??')
					continue
				}
				const u = p.usepair
				const gm = svmr.genome.isoformmatch(u.a.isoform, p.chrA, p.posA)
				if (!gm) {
					e_itd.push(p.sample + ' ' + p.geneA + ' ITD (' + p.rating + '): no gene model found for ' + u.a.isoform)
					continue
				}
				const exonbp1 = genomic2gm(p.posA, gm).rnapos
				const exonbp2 = genomic2gm(p.posB, gm).rnapos
				if (exonbp1 <= exonbp2) {
					e_itd.push(p.sample + ' ' + p.geneA + ' ITD (' + p.rating + '): negative duplication length')
					continue
				}
				const itd = {
					dt: dtitd,
					class: mclassitd,
					mname: 'ITD',
					gene: p.geneA,
					sample: p.sample,
					isoform: u.a.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp2,
					rnaduplength: exonbp1 - exonbp2 + 1,
					a: {
						chr: p.chrA,
						position: p.posA,
						strand: p.ortA,
						ratio: p.ratioA,
						chimericreads: p.readsA,
						totalreads: p.totalreadsA,
						match: p.matchA,
						repeat: p.repeatA
					},
					b: {
						chr: p.chrB,
						position: p.posB,
						strand: p.ortB,
						ratio: p.ratioB,
						chimericreads: p.readsB,
						totalreads: p.totalreadsB,
						match: p.matchB,
						repeat: p.repeatB
					}
				}
				// interstitial
				let aalen = 0,
					bplen = 0
				if (u.a.contigaa && u.b.contigaa) {
					aalen = u.b.contigaa - u.a.contigaa - 1
				}
				if (u.a.contigbp && u.b.contigbp) {
					bplen = u.b.contigbp - u.a.contigbp - 1
				}
				if (aalen > 0) {
					itd.interstitial = { aalen: aalen }
				}
				if (bplen > 0) {
					if (!itd.interstitial) itd.interstitial = {}
					itd.interstitial.bplen = bplen
				}
				if (!(p.geneA in genes)) {
					genes[p.geneA] = []
				}
				genes[p.geneA].push(itd)
				continue
			}
			if (p.isnloss) {
				if (!p.geneB) {
					e_nloss.push(p.sample + ' NLoss (' + p.rating + '): no geneB')
					continue
				}
				const p2 = p.usepair.b
				if (!p2.isoform) {
					e_nloss.push(p.sample + ' ' + p.geneB + ' NLoss (' + p.rating + '): no isoform')
					continue
				}
				const gm = svmr.genome.isoformmatch(p2.isoform, p.chrB, p.posB)
				if (!gm) {
					e_nloss.push(p.sample + ' ' + p.geneB + ' NLoss (' + p.rating + '): no gene model found for ' + p2.isoform)
					continue
				}
				const exonbp = genomic2gm(p.posB, gm).rnapos
				const pp = {
					dt: dtnloss,
					class: mclassnloss,
					mname: 'N-loss',
					gene: p.geneB,
					sample: p.sample,
					isoform: p2.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp,
					chr: p.chrB,
					position: p.posB,
					strand: p.ortB,
					ratio: p.ratioB,
					chimericreads: p.readsB,
					match: p.matchB,
					repeat: p.repeatB,
					partner: {
						chr: p.chrA,
						position: p.posA,
						strand: p.ortA,
						ratio: p.ratioA,
						chimericreads: p.readsA,
						match: p.matchA,
						repeat: p.repeatA
					}
				}
				if (p.geneA) {
					pp.partner.gene = p.geneA
				}
				if (p.usepair.a.isoform) {
					pp.partner.isoform = p.usepair.a.isoform
				}
				if (!(p.geneB in genes)) {
					genes[p.geneB] = []
				}
				genes[p.geneB].push(pp)
				continue
			}
			if (p.iscloss) {
				if (!p.geneA) {
					e_closs.push(p.sample + ' CLoss (' + p.rating + '): no geneA')
					continue
				}
				const p2 = p.usepair.a
				if (!p2.isoform) {
					e_closs.push(p.sample + ' ' + p.geneA + ' CLoss (' + p.rating + '): no isoform')
					continue
				}
				const gm = svmr.genome.isoformmatch(p2.isoform, p.chrA, p.posA)
				if (!gm) {
					e_closs.push(p.sample + ' ' + p.geneA + ' CLoss (' + p.rating + '): no gene model found by ' + p2.isoform)
					continue
				}
				const exonbp = genomic2gm(p.posA, gm).rnapos
				const pp = {
					dt: dtcloss,
					class: mclasscloss,
					mname: 'C-loss',
					gene: p.geneA,
					sample: p.sample,
					isoform: p2.isoform,
					rating: p.rating,
					score: p.score,
					functioneffect: p.functioneffect,
					rnaposition: exonbp,
					chr: p.chrA,
					position: p.posA,
					strand: p.ortA,
					ratio: p.ratioA,
					chimericreads: p.readsA,
					match: p.matchA,
					repeat: p.repeatA,
					partner: {
						chr: p.chrB,
						position: p.posB,
						strand: p.ortB,
						ratio: p.ratioB,
						chimericreads: p.readsB,
						match: p.matchB,
						repeat: p.repeatB
					}
				}
				if (p.geneB) {
					pp.partner.gene = p.geneB
				}
				if (p.usepair.b.isoform) {
					pp.partner.isoform = p.usepair.b.isoform
				}
				if (!(p.geneA in genes)) {
					genes[p.geneA] = []
				}
				genes[p.geneA].push(pp)
				continue
			}
		}
		// regular fusions
		const gene2isoform = new Map() // gene -> isoform
		const cleanup = []
		for (const p of row) {
			if (p.geneA) {
				if (!gene2isoform.has(p.geneA)) gene2isoform.set(p.geneA, new Set())
				if (p.usepair) {
					if (p.usepair.a.isoform) gene2isoform.get(p.geneA).add(p.usepair.a.isoform)
				}
			}
			if (p.geneB) {
				if (!gene2isoform.has(p.geneB)) gene2isoform.set(p.geneB, new Set())
				if (p.usepair) {
					if (p.usepair.b.isoform) gene2isoform.get(p.geneB).add(p.usepair.b.isoform)
				}
			}
			const clean = {
				type: p.type,
				type2: p.type2,
				rating: p.rating,
				score: p.score,
				functioneffect: p.functioneffect,
				a: {
					name: p.geneA,
					chr: p.chrA,
					position: p.posA,
					strand: p.ortA,
					ratio: p.ratioA,
					feature: p.featureA,
					chimericreads: p.readsA,
					contiglen: p.matchA,
					repeatscore: p.repeatA
				},
				b: {
					name: p.geneB,
					chr: p.chrB,
					position: p.posB,
					strand: p.ortB,
					ratio: p.ratioB,
					feature: p.featureB,
					chimericreads: p.readsB,
					contiglen: p.matchB,
					repeatscore: p.repeatB
				}
			}
			if (p.usepair) {
				const u = p.usepair
				clean.frame = u.frame
				if (u.a.isoform) {
					clean.a.isoform = u.a.isoform
				}
				if (u.b.isoform) {
					clean.b.isoform = u.b.isoform
				}
				/*
				clean.a.exon=u.a.exon
				clean.b.exon=u.b.exon
				clean.a.codon=u.a.codon
				clean.b.codon=u.b.codon
				*/
				// interstitial
				let aalen = 0,
					bplen = 0
				if (u.a.contigaa && u.b.contigaa) {
					aalen = u.b.contigaa - u.a.contigaa - 1
				}
				if (u.a.contigbp && u.b.contigbp) {
					bplen = u.b.contigbp - u.a.contigbp - 1
				}
				if (aalen > 0) {
					clean.interstitial = { aalen: aalen }
				}
				if (bplen > 0) {
					if (!clean.interstitial) clean.interstitial = {}
					clean.interstitial.bplen = bplen
				}
			}
			cleanup.push(clean)
		}
		for (const [genename, iset] of gene2isoform) {
			for (const isoform of iset) {
				if (!(genename in genes)) {
					genes[genename] = []
				}
				const pp = {
					dt: dtfusionrna,
					class: mclassfusionrna,
					sample: row[0].sample,
					isoform: isoform,
					pairlst: duplicate(cleanup)
				}
				// functional effect is offered on individual breakpoints which does not make sense, should be placed on the entire product
				for (const i of cleanup) {
					if (i.functioneffect) {
						pp.functioneffect = i.functioneffect
					}
				}
				genes[genename].push(pp)
			}
		}
	}
	if (e_itd.length) {
		svmr.err(e_itd.join('<br>'))
	}
	if (e_nloss.length) {
		svmr.err(e_nloss.join('<br>'))
	}
	if (e_closs.length) {
		svmr.err(e_closs.join('<br>'))
	}
	let genecount = 0,
		genesup = {}
	for (const k in genes) {
		genecount++
		genesup[k.toUpperCase()] = genes[k]
	}
	if (genecount == 0) {
		alert('No data can be added.')
		return
	}
	// to datasets
	let ds = null
	for (const n in svmr.genome.datasets) {
		if (svmr.genome.datasets[n].svmrid == svmr.id) {
			ds = svmr.genome.datasets[n]
			break
		}
	}
	if (ds) {
		// update existing
		ds.bulkdata = genesup
	} else {
		// create new
		ds = {
			label: svmr.filename,
			svmrid: svmr.id,
			bulkdata: genesup
		}
		svmr.genome.datasets[svmr.filename] = ds
	}
	if (svmr.cohort) {
		svmr.cohortpane.pane.remove()
	} else {
		svmr.cohort = {
			name: svmr.filename,
			genome: svmr.genome,
			show_genetable: 1,
			jwt: svmr.jwt,
			dsset: {}
		}
		svmr.cohort.dsset[svmr.filename] = ds
	}
	const pane = newpane({ x: 200, y: 200 })

	import('./tp.ui').then(p => {
		p.default(svmr.cohort, pane.body, svmr.hostURL)
		svmr.cohortpane = pane
	})
}

export function svmr_export_text(svmr, hqonly) {
	const rows = []
	const headerlst = svmr.atlst.map(i => i.label)
	// new fields
	headerlst.push('transcript_nbr')
	headerlst.push('breakpoint_nbr')
	headerlst.push('functionalClass')
	for (const sample of svmr.samples) {
		const whole = []
		for (const egg of sample.egglst) {
			for (const eg of egg.lst) {
				if (eg.ismsg) {
					const lst = eg.lst.map(evt => evt.lst[0])
					if (hqonly) {
						let hashq = false
						for (const i of lst) {
							if (i.rating == 'Major') hashq = true
						}
						if (hashq) {
							whole.push(lst)
						}
					} else {
						whole.push(lst)
					}
				} else {
					for (const evt of eg.lst) {
						for (const p of evt.lst) {
							if (hqonly) {
								if (p.rating == 'Major') whole.push([p])
							} else {
								whole.push([p])
							}
						}
					}
				}
			}
		}
		for (let gid = 0; gid < whole.length; gid++) {
			for (let prodid = 0; prodid < whole[gid].length; prodid++) {
				let prod = whole[gid][prodid]
				const frame = [],
					a_isoform = [],
					a_codon = [],
					a_exon = [],
					a_anchor = [],
					a_contigaa = [],
					a_contigbp = [],
					b_isoform = [],
					b_codon = [],
					b_exon = [],
					b_anchor = [],
					b_contigaa = [],
					b_contigbp = []
				for (const p of prod.pairs) {
					frame.push(p.frame)
					a_isoform.push(p.a.isoform)
					b_isoform.push(p.b.isoform)
					let v = p.a.codon
					a_codon.push(Number.isNaN(v) ? '' : v)
					v = p.b.codon
					b_codon.push(Number.isNaN(v) ? '' : v)
					v = p.a.exon
					a_exon.push(Number.isNaN(v) ? '' : v)
					v = p.b.exon
					b_exon.push(Number.isNaN(v) ? '' : v)
					a_anchor.push(p.a.anchor ? p.a.anchor : '')
					b_anchor.push(p.b.anchor ? p.b.anchor : '')
					v = p.a.contigaa
					a_contigaa.push(v == undefined ? '' : v)
					v = p.b.contigaa
					b_contigaa.push(v == undefined ? '' : v)
					v = p.a.contigbp
					a_contigbp.push(v == undefined ? '' : v)
					v = p.b.contigbp
					b_contigbp.push(v == undefined ? '' : v)
				}
				const row = []
				for (const i of svmr.atlst) {
					switch (i.key) {
						case 'lstframe':
							row.push(frame.join(','))
							break
						// A
						case 'lstisoforma':
							row.push(a_isoform.join(','))
							break
						case 'lstisoformacodon':
							row.push(a_codon.join(','))
							break
						case 'lstisoformaexon':
							row.push(a_exon.join(','))
							break
						case 'lstisoformaanchor':
							row.push(a_anchor.join(','))
							break
						case 'lstcontigaaA':
							row.push(a_contigaa.join(','))
							break
						case 'lstcontigbpA':
							row.push(a_contigbp.join(','))
							break
						// B
						case 'lstisoformb':
							row.push(b_isoform.join(','))
							break
						case 'lstisoformbcodon':
							row.push(b_codon.join(','))
							break
						case 'lstisoformbexon':
							row.push(b_exon.join(','))
							break
						case 'lstisoformbanchor':
							row.push(b_anchor.join(','))
							break
						case 'lstcontigaaB':
							row.push(b_contigaa.join(','))
							break
						case 'lstcontigbpB':
							row.push(b_contigbp.join(','))
							break
						default:
							row.push(prod[i.key])
					}
				}
				// new field - multi seg group
				row.push(gid + 1)
				row.push(prodid + 1)
				// new field - function effect
				row.push(prod.functioneffect ? prod.functioneffect : '')
				rows.push(row)
			}
		}
	}
	export_data('Fusion data from ' + svmr.filename, [{ text: headerlst.join('\t') + '\n' + rows.join('\n') }])
}

function duplicate(i) {
	const lst = []
	for (const j of i) {
		const k = {}
		for (const n in j) k[n] = j[n]
		k.a = {}
		for (const n in j.a) k.a[n] = j.a[n]
		k.b = {}
		for (const n in j.b) k.b[n] = j.b[n]
		if (j.interstitial) {
			k.interstitial = {}
			for (const n in j.interstitial) k.interstitial[n] = j.interstitial[n]
		}
		lst.push(k)
	}
	return lst
}
