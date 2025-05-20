import { handler as catHandler } from './tvs.categorical.js'

/*
Base TVS handler for dt terms
*/

export const handler = Object.assign({}, catHandler, { term_name_gen })

function term_name_gen(d) {
	const name = d.term.geneVariantTerm ? `${d.term.geneVariantTerm.name} ${d.term.name}` : d.term.name
	return name.length < 31 ? name : '<label title="' + name + '">' + name.substring(0, 28) + '...' + '</label>'
}
