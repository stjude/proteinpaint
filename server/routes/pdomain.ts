export const api: any = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'pdomain',
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
	return function handle_pdomain(req, res) {
		try {
			const gn = req.query.genome
			if (!gn) throw 'no genome'
			const g = genomes[gn]
			if (!g) throw 'invalid genome ' + gn
			if (!g.proteindomain) {
				// no error
				return res.send({ lst: [] })
			}
			if (!Array.isArray(req.query.isoforms)) throw 'isoforms[] missing'
			const lst = []
			for (const isoform of req.query.isoforms) {
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
			res.send({ lst })
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
