import type { PdomainRequest, PdomainResponse, RouteApi, RoutePayload } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'PdomainRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'PdomainResponse' }
}

export const api: RouteApi = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'pdomain',
	methods: {
		get: payload,
		post: payload
	}
}

// upper limit of the distinct isoforms of a request, well above the isoforms of any gene
const maxIsoforms = 1000

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
			const isoforms = [...new Set(q.isoforms)]
			if (isoforms.length > maxIsoforms)
				throw `isoforms[] has ${isoforms.length} isoforms, it must have ${maxIsoforms} or fewer`
			const lst: any[] = []
			for (const isoform of isoforms) {
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
