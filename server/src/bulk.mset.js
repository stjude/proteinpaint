const bulk = require('#shared/bulk'),
	bulksnv = require('#shared/bulk.snv'),
	bulkcnv = require('#shared/bulk.cnv'),
	bulkdel = require('#shared/bulk.del'),
	bulkitd = require('#shared/bulk.itd'),
	bulksv = require('#shared/bulk.sv'),
	bulksvjson = require('#shared/bulk.svjson'),
	bulktrunc = require('#shared/bulk.trunc'),
	path = require('path'),
	fs = require('fs'),
	serverconfig = require('./serverconfig')

const handlers = {
	snvindel: bulksnv,
	sv: bulksv,
	fusion: bulksv,
	svjson: bulksvjson,
	cnv: bulkcnv,
	itd: bulkitd,
	deletion: bulkdel,
	truncation: bulktrunc
}

/*
	tw: {
		term: {
			type: 'geneVariant', 
			name: '...'
		}
	}

	q: {
		ds, 
		genome
	}


*/
exports.getGeneVariantData = async function(tw, q) {
	const tname = tw.term.name
	const flagset = await get_flagset(q.ds, q.genome)
	const bySampleId = new Map()
	for (const flagname in flagset) {
		const flag = flagset[flagname]
		if (!(tname in flag.data)) continue
		for (const d of flag.data[tname]) {
			const sid = d._SAMPLEID_
			if (!bySampleId.has(sid)) bySampleId.set(sid, { sample: sid })
			const sampleData = bySampleId.get(sid)
			sampleData[tname] = { key: tname, values: [], label: tname }
			sampleData[tname].values.push(d)
		}
	}
	return bySampleId
}

async function get_flagset(ds, genome) {
	const cohort = ds.cohort
	try {
		if (cohort.mutationFlagSet) return cohort.mutationFlagSet
		if (!cohort.mutationset) return
		const flagset = {}
		const smap = ds.sampleName2Id

		for (const [index, mset] of cohort.mutationset.entries()) {
			const flag = await process_mset(index, mset, genome)
			flagset[Math.random()] = flag
			for (const gene in flag.data) {
				for (const d of flag.data[gene]) {
					// TODO: fix the sample names in all mutation text files (PNET may use sample0;sample1; aliases)
					// if there is no semicolon in d.sample, then d.sample === d._SAMPLENAME_
					d._SAMPLENAME_ = d.sample.split(';')[0].trim()
					d._SAMPLEID_ = smap.get(d._SAMPLENAME_) || d._SAMPLENAME_
				}
			}
		}
		cohort.mutationFlagSet = flagset
		return flagset
	} catch (e) {
		throw e
	}
}

exports.get_flagset = get_flagset

async function process_mset(index, mset, genome) {
	const flag = bulk.init_bulk_flag(genome)
	if (!flag) throw 'init_bulk_flag() failed'
	flag.tpsetname = mset.name ? mset.name : 'set' + index
	for (const key in mset) {
		if (!(key in handlers)) throw `unknown mutationset: ${key}`
		const file = mset[key].startsWith('/') ? mset[key] : path.join(serverconfig.tpmasterdir, mset[key])
		try {
			const text = await fs.promises.readFile(file, 'utf8')
			const lines = text.trim().split(/\r?\n/)
			const herr = handlers[key].parseheader(lines[0], flag)
			if (herr) throw `${key} header line error: herr`
			for (let i = 1; i < lines.length; i++) {
				handlers[key].parseline(i, lines[i], flag)
			}
		} catch (e) {
			throw e
		}
	}
	return flag
}
