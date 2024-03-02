export const api: any = {
	endpoint: 'gene2canonicalisoform', // should rename to simply 'canonicalIsoform' or 'isoform', gene and type: 'canonical' can be part of payload
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
	return function (req, res) {
		try {
			if (!req.query.gene) throw '.gene missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'unknown genome'
			if (!genome.genedb.get_gene2canonicalisoform) throw 'gene2canonicalisoform not supported on this genome'
			const data = genome.genedb.get_gene2canonicalisoform.get(req.query.gene)
			// data = { isoform: str }
			res.send(data)
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
