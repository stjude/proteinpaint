import { dt2label } from '#shared/common.js'
import { mayMakeVariantFilter } from '../tw/geneVariant'

/*
********************** EXPORTED
handler:
    // internal functions as part of handler
    term_name_gen()
    get_pill_label()
    getSelectRemovePos()
    fillMenu()
    setTvsDefaults()
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
	// add a variant filter onto the geneVariant term
	await mayMakeVariantFilter({ q: {}, term }, self.opts.vocabApi)
	if (!term.filter?.terms?.length) return
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
				terms: term.filter.terms,
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

function get_pill_label(tvs) {
	const modifiedGrp = tvs.values.filter(v => v.mclassExcludeLst.length > 0)[0]
	const mGroup = dt2label[modifiedGrp.dt]

	if (modifiedGrp.mclassLst.length == 1) {
		// single
		const m = modifiedGrp.mclassLst[0]
		return { txt: `${mGroup}:${m}` }
	}
	// multiple
	return { txt: `${mGroup}:${modifiedGrp.mclassLst.length} groups` }
}

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
}
