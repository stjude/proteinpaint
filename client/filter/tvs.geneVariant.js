import { getChildTerms } from '../tw/geneVariant'

/*
TVS handler for geneVariant term
*/

export const handler = {
	type: 'geneVariant',
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

async function fillMenu(self, _div, tvs) {
	const term = structuredClone(tvs.term)
	// get child dt terms of the geneVariant term
	await getChildTerms(term, self.opts.vocabApi)
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
	const name = d.term.name
	return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
}

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
}

// no need for pill label since no pill will be rendered
// for geneVariant term (pill will be rendered for child dt term)
function get_pill_label(tvs) {
	return { txt: '' }
}
