import { scaleOrdinal } from 'd3-scale'
import * as client from './client'
import { nt2aa, codon_stop, bplen } from '#shared/common'
import { string2snp } from './coord'
import { select } from 'd3-selection'
import { dofetch3 } from '../common/dofetch'
import { first_genetrack_tolist } from '../common/1stGenetk'

/*
for processing requests from entry point (app.js ui, embedding)
mainly for launching gene view
also for browser view if search term is position/snp
*/

let hostURL = ''

export default function(arg) {
	if (!arg.holder) {
		alert('No holder for block.init')
		return
	}
	if (arg.hostURL) {
		hostURL = arg.hostURL
	}
	const paint = {
		jwt: arg.jwt
	}
	paint.holder = arg.holder instanceof Element ? select(arg.holder) : arg.holder
	paint.dataset = arg.dataset
	paint.mset = arg.mset
	paint.gmmode = arg.gmmode
	paint.hidedatasetexpression = arg.hidedatasetexpression
	paint.hidegenecontrol = arg.hidegenecontrol
	paint.hidegenelegend = arg.hidegenelegend
	paint.hlaachange = arg.hlaachange
	paint.hlvariants = arg.hlvariants
	paint.hlregions = arg.hlregions
	paint.nopopup = arg.nopopup
	paint.variantPageCall_snv = arg.variantPageCall_snv
	paint.samplecart = arg.samplecart
	paint.debugmode = arg.debugmode
	paint.tklst = arg.tklst || []
	paint.datasetqueries = arg.datasetqueries
	paint.mclassOverride = arg.mclassOverride
	paint.error = m => client.sayerror(paint.holder, m)

	if (!arg.genome) {
		paint.error('no genome')
		return
	}
	paint.genome = arg.genome
	if (arg.query) {
		step1_findgm(paint, arg.query)
	} else if (arg.model && arg.allmodels) {
		paint.model = arg.model
		paint.allmodels = arg.allmodels
		step2_getseq(paint)
	}
}

function step1_findgm(paint, querystr) {
	const says = paint.holder
		.append('p')
		.style('font-size', '2em')
		.style('color', '#858585')
		.text('Searching for ' + querystr + ' ...')

	dofetch3('genelookup', {
		method: 'POST',
		body: JSON.stringify({ deep: 1, input: querystr, genome: paint.genome.name })
	}).then(data => {
		if (!data) {
			paint.error('querying genes: server error')
			return
		}
		if (data.error) {
			paint.error('querying genes: ' + data.error)
			return
		}
		if (!data.gmlst || data.gmlst.length == 0) {
			// not a gene
			if (paint.genome.hasSNP) {
				string2snp(paint.genome, querystr, hostURL, paint.jwt)
					.then(r => {
						says.remove()
						// TODO automatically add SNP track
						const par = {
							jwt: paint.jwt,
							hostURL: hostURL,
							genome: paint.genome,
							holder: paint.holder,
							dogtag: paint.genome.name,
							chr: r.chr,
							start: Math.max(0, r.start - 300),
							stop: r.start + 300,
							nobox: true,
							allowpopup: paint.nopopup ? false : true,
							tklst: paint.tklst,
							debugmode: paint.debugmode
						}
						first_genetrack_tolist(paint.genome, par.tklst)
						return import('./block').then(b => {
							const block = new b.Block(par)
							block.addhlregion(r.chr, r.start, r.stop - 1)
						})
					})
					.catch(err => {
						says.text(err.message)
						if (err.stack) console.log(err.stack)
					})
			} else {
				says.text('No hits found for ' + querystr)
			}
			return
		}
		says.remove()
		paint.allmodels = data.gmlst

		// if query string matches with an isoform
		for (const m of paint.allmodels) {
			if (m.isoform.toUpperCase() == (data.found_isoform ? data.found_isoform.toUpperCase() : querystr.toUpperCase())) {
				// query string is an isoform
				paint.model = m
				step2_getseq(paint)
				return
			}
		}

		// query string is not an isoform
		// from the list of returned isoforms, find a canonical one and use as paint.model

		const defaultisoforms = []

		for (const m of paint.allmodels) {
			if (!m.isoform) {
				paint.error('isoform missing from one gene model: ' + JSON.stringify(m))
				return
			}
			// cache
			const n = m.isoform.toUpperCase()
			if (paint.genome.isoformcache.has(n)) {
				let nothas = true
				for (const m2 of paint.genome.isoformcache.get(n)) {
					if (m2.chr == m.chr && m2.start == m.start && m2.stop == m.stop && m2.strand == m.strand) {
						nothas = false
						break
					}
				}
				if (nothas) {
					paint.genome.isoformcache.get(n).push(m)
				}
			} else {
				paint.genome.isoformcache.set(n, [m])
			}
			if (m.isoform.toUpperCase() == querystr.toUpperCase()) {
				defaultisoforms.push(m)
				break
			}
			if (m.isdefault) {
				defaultisoforms.push(m)
			}
		}

		if (defaultisoforms.length == 1) {
			paint.model = defaultisoforms[0]
		} else if (defaultisoforms.length > 1) {
			for (const m of defaultisoforms) {
				if (m.chr == 'chrY') {
					// hardcoded to avoid for CRLF2
					continue
				}
				const chr = paint.genome.chrlookup[m.chr.toUpperCase()]
				if (!chr) {
					// unknown chr
					continue
				}
				if (!chr.major) {
					continue
				}
				paint.model = m
				/* in human, canonical isoforms are marked out in both refseq and gencode
					as in the "genes" table, refseq is loaded before gencode
					this loop will encounter refseq canonical isoform first
					break here so that it won't override it with gencode
					and maintain the old behavior of showing refseq by searching a gene symbol
					*/
				break
			}
			if (!paint.model) {
				paint.model = defaultisoforms[0]
			}
		}
		if (!paint.model) {
			paint.model = paint.allmodels[0]
		}
		step2_getseq(paint)
	})
}

function step2_getseq(paint) {
	if (paint.model.genomicseq) {
		checker()
		step2_getpdomain(paint)
		return
	}
	const arg = {
		genome: paint.genome.name,
		coord: paint.model.chr + ':' + (paint.model.start + 1) + '-' + paint.model.stop
	}
	dofetch3('ntseq', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
		if (!data) {
			paint.error('getting sequence: server error')
			return
		}
		if (data.error) {
			paint.error('getting sequence: ' + data.error)
			return
		}
		if (!data.seq) {
			paint.error('no nt seq???')
			return
		}
		paint.model.genomicseq = data.seq.toUpperCase()
		paint.model.aaseq = nt2aa(paint.model)
		checker()
		step2_getpdomain(paint)
	})
	function checker() {
		//if (paint.model.cdseq && paint.model.cdseq.length % 3 != 0)  paint.error('Dubious CDS of ' + paint.model.isoform + ': AA count ' + paint.model.aacount)
		if (paint.model.aaseq) {
			// stop codon check
			const stop = paint.model.aaseq.indexOf(codon_stop)
			const cdslen = paint.model.cdslen - (paint.model.startCodonFrame ? 3 - paint.model.startCodonFrame : 0) // subtrack non-translating nt from cds
			if (stop != -1 && stop < cdslen / 3 - 1) {
				paint.error('Translating ' + paint.model.isoform + ' ends at ' + stop + ' AA, expecting ' + cdslen / 3)
			}
			/*
			if (paint.model.aaseq[0] != 'M') {
				paint.error('Translated protein does not start with "M" in ' + paint.model.isoform)
			}
			*/
		}
	}
}

function step2_getpdomain(paint) {
	/*
	block.init special treatment:
	will get pdomain for all isoforms, not just the isoform that's used
	*/
	const isoform2gm = new Map()
	// k: isoform name, v: [{}]

	for (const m of paint.allmodels) {
		if (!m.pdomains) {
			m.pdomains = [] // empty for no domain
			m.domain_hidden = {}
			if (!isoform2gm.has(m.isoform)) isoform2gm.set(m.isoform, [])
			isoform2gm.get(m.isoform).push(m)
		}
	}
	if (isoform2gm.size == 0) {
		step3(paint)
		return
	}

	dofetch3('pdomain', {
		method: 'POST',
		body: JSON.stringify({ genome: paint.genome.name, isoforms: [...isoform2gm.keys()] })
	})
		.then(data => {
			if (data.error) throw { message: 'error getting protein domain: ' + data.error }
			if (data.lst) {
				const colorscale = scaleOrdinal().range(client.domaincolorlst)

				for (const a of data.lst) {
					for (const m of isoform2gm.get(a.name)) {
						m.pdomains = a.pdomains
					}
					for (const d of a.pdomains) {
						if (!d.color) {
							d.color = colorscale(d.name + d.description)
						}
					}
				}
			}
			step3(paint)
		})
		.catch(err => {
			paint.error(err.message)
		})
}

function step3(paint) {
	// mode
	let mode = paint.gmmode
	if (!mode) {
		if (paint.model.cdslen) {
			mode = client.gmmode.protein
		} else {
			mode = client.gmmode.exononly
		}
	}
	import('./block').then(
		b =>
			new b.Block({
				jwt: paint.jwt,
				hostURL: hostURL,
				genome: paint.genome,
				holder: paint.holder,
				nobox: true,
				usegm: paint.model,
				gmstackheight: 37,
				allgm: paint.allmodels,
				datasetlst: paint.dataset,
				mset: paint.mset,
				hlaachange: paint.hlaachange,
				hlvariants: paint.hlvariants,
				hlregions: paint.hlregions,
				gmmode: mode,
				allowpopup: paint.nopopup ? false : true,
				hidedatasetexpression: paint.hidedatasetexpression,
				hidegenecontrol: paint.hidegenecontrol,
				hidegenelegend: paint.hidegenelegend,
				variantPageCall_snv: paint.variantPageCall_snv,
				datasetqueries: paint.datasetqueries,
				samplecart: paint.samplecart,
				debugmode: paint.debugmode,
				tklst: paint.tklst,
				mclassOverride: paint.mclassOverride
			})
	)
}
