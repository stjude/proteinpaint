import type { RouteApi, RoutePayload } from '#types'
import serverconfig from '#src/serverconfig.js'

/*
The route of the ideogram of a chromosome.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_ideogram
	get init() {
		return serverconfig.features.disableFeature_ideogram ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'ideogram',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return function handle_ideogram(req, res) {
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome'
			if (!g.genedb.hasIdeogram) throw 'ideogram not supported on this genome'
			if (!req.query.chr) throw '.chr missing'
			const lst = g.genedb.getIdeogramByChr.all(req.query.chr)
			if (!lst.length) throw 'no ideogram data for this chr'
			res.send(lst)
		} catch (e: any) {
			res.send({ error: e.message || e })
		}
	}
}
