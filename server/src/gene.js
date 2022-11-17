/*
later move  handle_gene2canonicalisoform here

parameters:

.genome=str
.input=str
.deep=true
.gene2canonicalisoform=str

*/

export function handle_genelookup_closure(genomes) {
	return (req, res) => {
		try {
			res.send(getResult(genomes, req.query))
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function getResult(genomes, q) {
	const g = genomes[q.genome]
	if (!g) throw 'invalid genome name'
	if (g.genomicNameRegexp.test(q.input)) throw 'invalid character in gene name'

	if (q.deep) {
		///////////// deep

		// isoform query must be converted to symbol first, so as to retrieve all gene models related to this gene
		const result = {} // object to collect results of gene query and send back
		let symbol
		{
			// see if query string match directly with gene symbol
			const tmp = g.genedb.getnamebynameorisoform.get(q.input, q.input)
			if (tmp) symbol = tmp.name
		}
		if (!symbol) {
			// input does not directly match with symbol
			if (g.genedb.getNameByAlias) {
				// see if input is alias; if so convert alias to official symbol
				const tmp = g.genedb.getNameByAlias.get(q.input)
				if (tmp) symbol = tmp.name
			}
		}
		if (!symbol) {
			if (g.genedb.get_gene2canonicalisoform && q.input.toUpperCase().startsWith('ENSG')) {
				/* db has this table and input looks like ENSG accession
				convert it to ENST canonical isoform 
				currently db does not have a direct mapping from ENSG to symbol
				also it is more fitting to convert ENSG to ENST, rather than to symbol
				which can cause a refseq isoform to be shown instead
				*/
				const data = g.genedb.get_gene2canonicalisoform.get(q.input)
				if (data && data.isoform) {
					// mapped into an ENST isoform
					const enstIsoform = data.isoform
					result.found_isoform = enstIsoform
					// convert isoform back to symbol as in the beginning
					const tmp = g.genedb.getnamebynameorisoform.get(enstIsoform, enstIsoform)
					if (!tmp) throw 'cannot map enst isoform to symbol'
					symbol = tmp.name
				}
			}
		}
		if (!symbol) {
			// no other means of matching it to symbol
			symbol = q.input
		}
		const tmp = g.genedb.getjsonbyname.all(symbol)
		result.gmlst = tmp.map(i => {
			const j = JSON.parse(i.genemodel)
			if (i.isdefault) j.isdefault = true
			return j
		})
		return result
	}

	////////////// shallow

	const input = q.input.toUpperCase()
	const lst = []
	const s = input.substr(0, 2)
	const tmp = g.genedb.getnameslike.all(input + '%')
	if (tmp.length) {
		tmp.sort()
		return { hits: tmp.map(i => i.name) }
	}
	// no direct name match, try alias
	if (g.genedb.getNameByAlias) {
		const tmp = g.genedb.getNameByAlias.all(input)
		if (tmp.length) {
			return { hits: tmp.map(i => i.name) }
		}
	}
	// no hit by alias
	{
		// see if input is isoform and can be mapped to symbol
		const tmp = g.genedb.getnamebynameorisoform.get(q.input, q.input)
		if (tmp) return { hits: [tmp.name] }
	}
	return { hits: [] }
}
