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
			const seq = await utils.get_fasta(g, gm.chr + ':' + (gm.start + 1) + '-' + gm.stop)
			const frame = common.fasta2gmframecheck(gm, seq)
			res.send({ frame })
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
