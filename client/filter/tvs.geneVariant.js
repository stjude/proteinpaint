import { handler as catHandler } from './tvs.categorical.js'
import { mayGetChildTerms } from '../tw/geneVariant'

/*
TVS handler for geneVariant term
*/

export const handler = Object.assign({}, catHandler, { type: 'geneVariant', fillMenu, term_name_gen })

async function fillMenu(self, _div, tvs) {
	const term = structuredClone(tvs.term)
	// add a variant filter onto the geneVariant term
	await mayGetChildTerms({ q: {}, term }, self.opts.vocabApi)
	if (!term.childTerms?.length) return
	// generate a frontend vocab using dt terms from the variant filter
	// and render a data dictionary of this vocab
	const termdb = await import('../termdb/app')
	termdb.appInit({
		holder: _div.append('div').style('margin-top', '15px'),
		state: {
			nav: {
				header_mode: 'hide_search'
			},
			vocab: {
				// no need to pass vocabApi as a termdb.appInit() option, since
				// termdb app will create vocabApi as needed from state.vocab
				// if provided
				terms: term.childTerms,
				parent_termdbConfig: self.opts.vocabApi.termdbConfig
			},
			tree: { usecase: { target: 'filter' } }
		},
		tree: {
			backToSelectionText: 'Change alteration type',
			click_term2select_tvs(tvs) {
				self.opts.callback(tvs)
			}
		}
	})
}

function term_name_gen(d) {
	const name = d.term.parentTerm ? `${d.term.parentTerm.name} ${d.term.name}` : d.term.name
	return name.length < 31 ? name : '<label title="' + name + '">' + name.substring(0, 28) + '...' + '</label>'
}
