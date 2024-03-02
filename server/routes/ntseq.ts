import { get_fasta } from '#src/utils.js'

export const api: any = {
	endpoint: 'ntseq',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async function handle_ntseq(req, res) {
		try {
			if (!req.query.coord) throw 'coord missing'
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome'
			if (!g.genomefile) throw 'no sequence file available'
			const seq = await get_fasta(g, req.query.coord)
			res.send({
				seq: seq.split('\n').slice(1).join('')
			})
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
