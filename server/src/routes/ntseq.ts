import type { NtseqRequest, NtseqResponse, RouteApi, RoutePayload } from '#types'
import { get_fasta } from '#src/utils.js'

const payload: RoutePayload = {
	init,
	request: { typeId: 'NtseqRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'NtseqResponse' }
}

export const api: RouteApi = {
	endpoint: 'ntseq',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async function handle_ntseq(req, res) {
		try {
			const q: NtseqRequest = req.query
			if (!q.coord) throw 'coord missing'
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome'
			if (!g.genomefile) throw 'no sequence file available'
			const seq = await get_fasta(g, q.coord)
			res.send({
				seq: seq.split('\n').slice(1).join('')
			} satisfies NtseqResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
