import type { PdomainRequest, PdomainResponse, RouteApi } from '#types'
import { pdomainPayload } from '#types/checkers'

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'pdomain',
	methods: {
		get: {
			...pdomainPayload,
			init
		},
		post: {
			...pdomainPayload,
			init
		}
	}
}

function init({ genomes }) {
	return function handle_pdomain(req, res) {
		try {
			const q: PdomainRequest = req.query
			const gn = q.genome
			if (!gn) throw 'no genome'
			const g = genomes[gn]
			if (!g) throw 'invalid genome ' + gn
			if (!g.proteindomain) {
				// no error
				return res.send({ lst: [] })
			}
			if (!Array.isArray(q.isoforms)) throw 'isoforms[] missing'
			const lst: any[] = []
			for (const isoform of q.isoforms) {
				if (g.genomicNameRegexp.test(isoform)) continue
				const tmp = g.proteindomain.getbyisoform.all(isoform)
				// FIXME returned {data} is text not json
				lst.push({
					name: isoform,
					pdomains: tmp.map(i => {
						const j = JSON.parse(i.data)
						j.refseq = isoform
						return j
					})
				})
			}
			res.send({ lst } satisfies PdomainResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
