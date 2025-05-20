/*
later move  handle_gene2canonicalisoform here

parameters:

.genome=str
.input=str
.deep=true
.gene2canonicalisoform=str

*/

/*
g: server side genome obj
q: {deep:true, input:str}
*/
export function getResult(g, q) {
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
			/* gene coordinate is from bed files with start=0-based, and stop=not included for feature display
			minus 1 from stop is a stop-gap for client to uniformly "plus 1" to both start & stop when displaying
			e.g. hg38 sox1 bed=chr13:112067148-112071706, client shows=chr13:112067149-112071706
			*/
			j.stop--
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
