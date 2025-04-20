import { handler as catHandler } from './tvs.categorical.js'
import { FrontendVocab } from '../termdb/FrontendVocab.js'
import { vocabInit } from '../termdb/vocabulary.js'

/*
Base TVS handler for dt terms
*/

export const handler = Object.assign({}, catHandler, { setVocabApi, term_name_gen })

function setVocabApi(self, tvs) {
	if (!(self.opts.vocabApi instanceof FrontendVocab)) {
		// vocabApi may become termdb vocab when tvs
		// is edited within global filter
		// ensure vocabApi is frontend vocab using dt terms
		const terms = tvs.term.geneVariantTerm.filter.terms
		if (!terms) throw 'missing terms'
		self.opts.vocabApi = vocabInit({
			vocab: {
				terms,
				parent_termdbConfig: self.opts.vocabApi.termdbConfig
			}
		})
	}
}

function term_name_gen(d) {
	const name = d.term.geneVariantTerm ? `${d.term.geneVariantTerm.name} ${d.term.name}` : d.term.name
	return name.length < 31 ? name : '<label title="' + name + '">' + name.substring(0, 28) + '...' + '</label>'
}
