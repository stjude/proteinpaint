import type { RoutePayload, IsoformLstRequest, IsoformLstResponse, RouteApi } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'IsoformLstRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'IsoformLstResponse' }
}

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'isoformlst',
	methods: {
		get: payload,
		post: payload
	}
}

// upper limit of the distinct isoforms of a request, well above the isoforms of any gene
const maxIsoforms = 1000

function init({ genomes }) {
	return function handle_isoformlst(req, res) {
		try {
			const q: IsoformLstRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome'
			if (!Array.isArray(q.lst)) throw '.lst missing'
			const isoforms = [...new Set(q.lst)]
			if (isoforms.length > maxIsoforms)
				throw `.lst has ${isoforms.length} isoforms, it must have ${maxIsoforms} or fewer`
			const lst: any[] = []
			for (const isoform of isoforms) {
				if (g.genomicNameRegexp.test(isoform)) continue
				const tmp: any[] = g.genedb.getjsonbyisoform.all(isoform)
				lst.push(
					tmp.map((i: any) => {
						const j = JSON.parse(i.genemodel)
						if (i.isdefault) j.isdefault = true
						return j
					})
				)
			}
			res.send({ lst } satisfies IsoformLstResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.trace(e)
		}
	}
}
