export const api: any = {
	// route endpoint
	// - no need for trailing slash
	// - should be a noun (method is based on HTTP GET, POST, etc)
	// - don't add 'Data' as response is assumed to be data
	endpoint: 'isoformlst',
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
	return function handle_isoformlst(req, res) {
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome'
			if (!Array.isArray(req.query.lst)) throw '.lst missing'
			const lst: any[] = []
			for (const isoform of req.query.lst) {
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
			res.send({ lst })
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
			else console.trace(e)
		}
	}
}
