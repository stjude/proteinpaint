import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import * as common from '#shared/common.js'

/*
The route of the reading frame check of a gene model.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'translategm',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return async function handle_translategm(req, res) {
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome'
			const gm = req.query.gm
			if (!gm) throw 'missing gm{}'
			if (!gm.chr) throw 'gm.chr missing'
			if (!gm.start) throw 'gm.start missing'
			if (!Number.isInteger(gm.start)) throw 'gm.start not integer'
			if (!gm.stop) throw 'gm.stop missing'
			if (!Number.isInteger(gm.stop)) throw 'gm.stop not integer'
			if (gm.stop <= gm.start) throw 'gm.stop not after gm.start'
			validateCoding(gm)
			const seq = await utils.get_fasta(g, gm.chr + ':' + (gm.start + 1) + '-' + gm.stop)
			const frame = common.fasta2gmframecheck(gm, seq)
			res.send({ frame })
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

/* the coding regions are copied out of the gene sequence and joined, so each must be inside the gene,
and together they cannot be longer than the gene */
function validateCoding(gm) {
	if (gm.coding === undefined) return
	if (!Array.isArray(gm.coding)) throw 'gm.coding[] not array'
	let total = 0
	for (const e of gm.coding) {
		if (!Array.isArray(e) || !Number.isInteger(e[0]) || !Number.isInteger(e[1]))
			throw 'gm.coding[] has an invalid range'
		if (e[0] < gm.start || e[1] > gm.stop || e[1] <= e[0]) throw 'gm.coding[] has a range outside of the gene'
		total += e[1] - e[0]
		if (total > gm.stop - gm.start) throw 'gm.coding[] is longer than the gene'
	}
}
