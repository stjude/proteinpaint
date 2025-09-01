import { scaleOrdinal } from 'd3-scale'
import { gmmode } from './client'
import { nt2aa, codon_stop, bplen, proteinDomainColorScale } from '#shared/common.js'
import { select } from 'd3-selection'
import { dofetch3 } from '#common/dofetch'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { sayerror } from '#dom'
import { string2snp } from '#common/snp'

/*
for processing requests from entry point (app.js ui, embedding)
mainly for launching gene view
also for browser view if search term is position/snp

quick fix: arg.__blockInstance is attached
*/

export default async function (arg) {
	if (!arg.holder) throw 'No holder for block.init'
	if (!arg.genome) throw 'no genome'
	if (arg.holder instanceof Element) arg.holder = select(arg.holder)
	if (!arg.tklst) arg.tklst = []

	if (arg.query) {
		/*
		query=str, run step1() to match it with gene or snp
		if match with gene, adds arg.model{} and arg.allmodels[], and run step2()
		if match with snp, load block and exit
		*/
		await step1_findgm(arg)
		return
	}

	if (arg.model && arg.allmodels) {
		await step2_getseq(arg)
		return
	}

	// TODO if to throw
	//throw '.query and (.model, .allmodels) are both missing'
}

async function step1_findgm(arg) {
	/* arg.query=str is given
	search it against gene or snp name
	*/
	const wait = arg.holder
		.append('p')
		.style('font-size', '2em')
		.style('color', '#858585')
		.text('Searching for ' + arg.query + ' ...')

	const data = await dofetch3('genelookup', {
		body: { deep: 1, input: arg.query, genome: arg.genome.name }
	})
	if (!data) throw 'querying genes: server error'
	if (data.error) throw 'error querying genes: ' + data.error

	if (!data.gmlst || data.gmlst.length == 0) {
		// not a gene
		if (arg.genome.hasSNP) {
			try {
				// throws exception if not matching a snp
				const r = await string2snp(arg.genome, arg.query)
				wait.remove()
				// TODO automatically add SNP track
				const par = {
					genome: arg.genome,
					holder: arg.holder,
					chr: r.chr,
					start: Math.max(0, r.start - 300),
					stop: r.start + 300,
					nobox: true,
					tklst: arg.tklst,
					debugmode: arg.debugmode
				}
				first_genetrack_tolist(arg.genome, par.tklst)
				const b = await import('./block')
				const block = new b.Block(par)
				block.addhlregion(r.chr, r.start, r.stop - 1)
			} catch (e) {
				wait.text('Not a gene or SNP: ' + arg.query)
			}
		} else {
			wait.text('No match to gene: ' + arg.query)
		}
		return
	}

	// match to a gene

	wait.remove()
	arg.allmodels = data.gmlst

	// if query string matches with an isoform
	for (const m of arg.allmodels) {
		if (m.isoform.toUpperCase() == (data.found_isoform ? data.found_isoform.toUpperCase() : arg.query.toUpperCase())) {
			// query string is an isoform
			arg.model = m
			await step2_getseq(arg)
			return
		}
	}

	// query string is not an isoform
	// from the list of returned isoforms, find a canonical one and use as paint.model

	const defaultisoforms = []

	for (const m of arg.allmodels) {
		if (!m.isoform) throw 'isoform missing from one gene model: ' + JSON.stringify(m)
		// cache
		const n = m.isoform.toUpperCase()
		if (arg.genome.isoformcache.has(n)) {
			let nothas = true
			for (const m2 of arg.genome.isoformcache.get(n)) {
				if (m2.chr == m.chr && m2.start == m.start && m2.stop == m.stop && m2.strand == m.strand) {
					nothas = false
					break
				}
			}
			if (nothas) {
				arg.genome.isoformcache.get(n).push(m)
			}
		} else {
			arg.genome.isoformcache.set(n, [m])
		}
		if (m.isoform.toUpperCase() == arg.query.toUpperCase()) {
			defaultisoforms.push(m)
			break
		}
		if (m.isdefault) {
			defaultisoforms.push(m)
		}
	}

	if (defaultisoforms.length == 1) {
		arg.model = defaultisoforms[0]
	} else if (defaultisoforms.length > 1) {
		for (const m of defaultisoforms) {
			if (m.chr == 'chrY') {
				// hardcoded to avoid for CRLF2
				continue
			}
			const chr = arg.genome.chrlookup[m.chr.toUpperCase()]
			if (!chr) {
				// unknown chr
				continue
			}
			if (!chr.major) {
				continue
			}
			arg.model = m
			/* in human, canonical isoforms are marked out in both refseq and gencode
			as in the "genes" table, refseq is loaded before gencode
			this loop will encounter refseq canonical isoform first
			break here so that it won't override it with gencode
			and maintain the old behavior of showing refseq by searching a gene symbol
			*/
			break
		}
		if (!arg.model) {
			arg.model = defaultisoforms[0]
		}
	}
	if (!arg.model) {
		arg.model = arg.allmodels[0]
	}
	await step2_getseq(arg)
}

async function step2_getseq(arg) {
	if (arg.model.genomicseq) {
		checker()
		step2_getpdomain(arg)
		return
	}
	const par = {
		genome: arg.genome.name,
		coord: arg.model.chr + ':' + (arg.model.start + 1) + '-' + arg.model.stop
	}
	const data = await dofetch3('ntseq', { method: 'POST', body: JSON.stringify(par) })
	if (!data) throw 'getting sequence: server error'
	if (data.error) throw 'getting sequence: ' + data.error
	if (!data.seq) throw 'no nt seq???'
	arg.model.genomicseq = data.seq.toUpperCase()
	arg.model.aaseq = nt2aa(arg.model)
	checker()
	await step2_getpdomain(arg)

	function checker() {
		if (arg.model.aaseq) {
			// stop codon check
			const stop = arg.model.aaseq.indexOf(codon_stop)
			const cdslen = arg.model.cdslen - (arg.model.startCodonFrame ? 3 - arg.model.startCodonFrame : 0) // subtrack non-translating nt from cds
			if (stop != -1 && stop < cdslen / 3 - 1) {
				sayerror(arg.holder, 'Translating ' + arg.model.isoform + ' ends at ' + stop + ' AA, expecting ' + cdslen / 3)
			}
			/*
			if (paint.model.aaseq[0] != 'M') {
				paint.error('Translated protein does not start with "M" in ' + paint.model.isoform)
			}
			*/
		}
	}
}

async function step2_getpdomain(arg) {
	/*
	block.init special treatment:
	will get pdomain for all isoforms, not just the isoform that's used
	*/
	const isoform2gm = new Map()
	// k: isoform name, v: [{}]

	for (const m of arg.allmodels) {
		if (!m.pdomains) {
			m.pdomains = [] // empty for no domain
			m.domain_hidden = {}
			if (!isoform2gm.has(m.isoform)) isoform2gm.set(m.isoform, [])
			isoform2gm.get(m.isoform).push(m)
		}
	}
	if (isoform2gm.size == 0) {
		await step3(arg)
		return
	}

	const data = await dofetch3('pdomain', {
		method: 'POST',
		body: JSON.stringify({ genome: arg.genome.name, isoforms: [...isoform2gm.keys()] })
	})
	if (data.error) throw 'error getting protein domain: ' + data.error
	if (data.lst) {
		const s = proteinDomainColorScale() // important to declare color getter outside of loop so that a domain appearing in multiple isoforms can get same color
		for (const a of data.lst) {
			if (arg.geneDomains) {
				// runpp-supplied custom domains, will be applied to all isoforms
				// defined in https://github.com/stjude/proteinpaint/wiki/Embedding#Gene-view
				if (!Array.isArray(arg.geneDomains)) throw 'geneDomains not array'
				for (const b of arg.geneDomains) {
					if (typeof b != 'object') throw 'element from geneDomains[] not object'
					// start & stop positions can only be aaposition
					if (!Number.isInteger(b.start)) throw 'start not integer from geneDomains[]'
					if (!Number.isInteger(b.stop)) throw 'stop not integer from geneDomains[]'
					if (b.start > b.stop) throw 'start>stop from geneDomains[]'
					if (!b.name) b.name = 'Custom domain'
					a.pdomains.push(b)
				}
			}

			for (const m of isoform2gm.get(a.name)) {
				m.pdomains = a.pdomains
			}
			for (const d of a.pdomains) {
				if (!d.color) {
					d.color = s(d.name + d.description)
				}
			}
		}
	}
	await step3(arg)
}

async function step3(arg) {
	// mode
	let mode = arg.gmmode
	if (!mode) {
		if (arg.model.cdslen) {
			mode = gmmode.protein
		} else {
			mode = gmmode.exononly
		}
	}

	if (arg.dataset) {
		/*
		for legacy ds
		when migrated to mds3, can delete this step
		since mds3 ds is loaded from mds3/makeTk, when initiating a track
		*/
		if (!Array.isArray(arg.dataset)) throw 'dataset is not array'

		// load dataset client-side object, register in genome
		for (const dsname of arg.dataset) {
			// potentially problematic logic: only skip the dataset when that flag is false
			// if the flag is true, tells the legacy ds is uninitiated
			if (arg.genome.datasets[dsname] && !arg.genome.datasets[dsname].legacyDsIsUninitiated) continue
			const d = await dofetch3(`getDataset?genome=${arg.genome.name}&dsname=${dsname}`)
			if (d.error) throw `invalid name from dataset[]: ${d.error}`
			if (!d.ds) throw '.ds missing'

			// dataset is already registered under genome by ds.label
			const ds = arg.genome.datasets[d.ds.label]
			Object.assign(ds, d.ds)
			const _ = await import('./legacyDataset')
			_.validate_oldds(ds)

			delete ds.legacyDsIsUninitiated
		}
	}

	const b = await import('./block')

	// quick fix to make block instance available to caller
	arg.__blockInstance = new b.Block({
		genome: arg.genome,
		holder: arg.holder,
		nobox: true,
		usegm: arg.model,
		gmstackheight: 37,
		allgm: arg.allmodels,
		datasetlst: arg.dataset,
		legacyDsFilter: arg.legacyDsFilter,
		mset: arg.mset,
		hlaachange: arg.hlaachange,
		hlvariants: arg.hlvariants,
		hlregions: arg.hlregions,
		gmmode: mode,
		hidedatasetexpression: arg.hidedatasetexpression,
		hidegenecontrol: arg.hidegenecontrol,
		hidegenelegend: arg.hidegenelegend,
		variantPageCall_snv: arg.variantPageCall_snv,
		datasetqueries: arg.datasetqueries,
		samplecart: arg.samplecart,
		debugmode: arg.debugmode,
		tklst: arg.tklst,
		mclassOverride: arg.mclassOverride,
		hide_dsHandles: arg.hide_dsHandles,
		onloadalltk_always: arg.onloadalltk_always
	})
}
