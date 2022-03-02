const bulk = require('../shared/bulk'),
	bulksnv = require('../shared/bulk.snv'),
	bulkcnv = require('../shared/bulk.cnv'),
	bulkdel = require('../shared/bulk.del'),
	bulkitd = require('../shared/bulk.itd'),
	bulksv = require('../shared/bulk.sv'),
	bulksvjson = require('../shared/bulk.svjson'),
	bulktrunc = require('../shared/bulk.trunc'),
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

async function get_flagset(cohort, genome) {
	try {
		if (cohort.mutationFlagSet) return cohort.mutationFlagSet
		if (!cohort.mutationset) return
		const flagset = {}
		for (const [index, mset] of cohort.mutationset.entries()) {
			const flag = await process_mset(index, mset, genome)
			flagset[Math.random()] = flag
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
		const file = path.join(serverconfig.tpmasterdir, mset[key])
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
