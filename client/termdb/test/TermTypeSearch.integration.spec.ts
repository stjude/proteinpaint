import tape from 'tape'
import * as d3s from 'd3-selection'
import { TermTypeSearch } from '../TermTypeSearch'
import { TermTypeGroups, TermTypes } from '#shared/terms.js'

/*
Tests:
	- init() should accept usecase filtering for allowed term type tabs
	- init() should ignore appState.termTypeGroup and derive tabs from allowed types
	- init() should throw when no term types are allowed
	- init() should throw when TERM_COLLECTION lacks termdbConfig.termCollections
	- selectTerm() should append and replace selected terms correctly in submit mode
	- renderTermsSelected() click should remove selected term
	- getDtTerm() should return child term and throw on invalid input
*/

/*************************
 reusable helper functions
**************************/

function getDefaultState() {
	return {
		vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' },
		termTypeGroup: '',
		tree: { usecase: { target: 'default', detail: 'term' } },
		submenu: { term: null },
		selectedTerms: [],
		termfilter: { filter0: null, filter: null }
	}
}

function getNewTermTypeSearch(opts: {
	appState?: any
	termdbConfig?: any
	click_term?: (term: any) => void
	submit_lst?: (terms: any[]) => void
}) {
	const holder = d3s.select('body').append('div')
	const topbar = holder.append('div')
	const submitDiv = holder.append('div')
	const dispatched: any[] = []
	let appState = opts.appState || getDefaultState()

	const termTypeSearch = new TermTypeSearch({
		holder,
		topbar,
		submitDiv,
		genome: {},
		click_term: opts.click_term,
		submit_lst: opts.submit_lst
	})

	termTypeSearch.app = {
		vocabApi: {
			termdbConfig: opts.termdbConfig || {
				allowedTermTypes: [TermTypes.CATEGORICAL],
				queries: {}
			}
		},
		dispatch: async action => {
			dispatched.push(action)
			if (action.type == 'set_term_type_group') {
				appState = { ...appState, termTypeGroup: action.value }
				termTypeSearch.state = { ...termTypeSearch.state, termTypeGroup: action.value }
			}
			if (action.type == 'app_refresh') {
				appState = { ...appState, ...action.state }
				termTypeSearch.state = { ...termTypeSearch.state, ...action.state }
			}
		},
		getState: () => appState
	}

	return { termTypeSearch, holder, dispatched }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/TermTypeSearch -***-')
	test.end()
})

tape('init() should accept usecase filtering for allowed term type tabs', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'survival', detail: 'term' } }
	}
	const { termTypeSearch, holder, dispatched } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY],
			queries: {}
		}
	})

	await termTypeSearch.init(appState)
	test.equal(termTypeSearch.tabs.length, 1, 'Should only have one tab for survival detail=term')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should keep dictionary variables and exclude metabolite intensity'
	)

	const setGroupAction = dispatched.find(a => a.type == 'set_term_type_group')
	test.equal(
		setGroupAction?.value,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should dispatch first allowed term type group'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should ignore appState.termTypeGroup and derive tabs from allowed types', async test => {
	const appState = {
		...getDefaultState(),
		termTypeGroup: TermTypeGroups.METABOLITE_INTENSITY
	}
	const { termTypeSearch, holder, dispatched } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY],
			queries: {}
		}
	})

	await termTypeSearch.init(appState)
	test.equal(
		termTypeSearch.tabs.length,
		2,
		'Should create tabs from allowed term types regardless of appState.termTypeGroup'
	)
	test.deepEqual(
		termTypeSearch.tabs.map(t => t.termTypeGroup),
		[TermTypeGroups.DICTIONARY_VARIABLES, TermTypeGroups.METABOLITE_INTENSITY],
		'Should keep tab groups in allowedTermTypes order'
	)

	const setGroupAction = dispatched.find(a => a.type == 'set_term_type_group')
	test.equal(
		setGroupAction?.value,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should dispatch first tab group and not prior appState.termTypeGroup'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when no term types are allowed', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			//Note: SNP_LIST is excluded from default allowed term types
			allowedTermTypes: [TermTypes.SNP_LIST],
			queries: {}
		}
	})

	try {
		await termTypeSearch.init(appState)
		test.fail('Should throw when all term types are filtered out')
	} catch (e) {
		test.equal(e, 'No term types allowed for this use case', 'Should throw expected error message')
	}
	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when TERM_COLLECTION lacks termdbConfig.termCollections', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.TERM_COLLECTION],
			queries: {}
		}
	})

	try {
		await termTypeSearch.init(appState)
		test.fail('Should throw when TERM_COLLECTION is enabled without termCollections config')
	} catch (e) {
		test.match(
			String(e),
			/No term types allowed for this use case/,
			'Should throw expected handler setup error for missing termCollections'
		)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('selectTerm() should append and replace selected terms correctly in submit mode', test => {
	const appState = {
		...getDefaultState(),
		selectedTerms: [{ name: 'Age', id: 'agedx', type: TermTypes.INTEGER }]
	}
	const { termTypeSearch, holder, dispatched } = getNewTermTypeSearch({ appState, submit_lst: () => {} })
	termTypeSearch.state = termTypeSearch.getState(appState)

	termTypeSearch.selectTerm({ name: 'Sex', id: 'sex', type: TermTypes.CATEGORICAL })
	const appendAction = dispatched[dispatched.length - 1]
	test.equal(appendAction.type, 'app_refresh', 'Should dispatch app_refresh for dictionary term')
	test.equal(appendAction.state.selectedTerms.length, 2, 'Should append selected term')

	termTypeSearch.selectTerm({
		type: TermTypes.TERM_COLLECTION,
		term: { type: TermTypes.TERM_COLLECTION, name: 'Test term collection' }
	})
	const replaceAction = dispatched[dispatched.length - 1]
	test.equal(replaceAction.state.selectedTerms.length, 1, 'termCollection Should replace selected terms list')
	test.equal(
		replaceAction.state.selectedTerms[0].name,
		'Test term collection',
		'Should keep selected test term collection only'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('renderTermsSelected() click should remove selected term', test => {
	const appState = {
		...getDefaultState(),
		selectedTerms: [
			{ name: 'Age', id: 'agedx', type: TermTypes.INTEGER },
			{ name: 'Sex', id: 'sex', type: TermTypes.CATEGORICAL }
		]
	}
	const { termTypeSearch, holder, dispatched } = getNewTermTypeSearch({ appState, submit_lst: () => {} })
	termTypeSearch.state = termTypeSearch.getState(appState)

	termTypeSearch.main()
	const renderedTerms = termTypeSearch.dom.selectedTermsDiv.selectAll('.sja_menuoption')
	test.equal(renderedTerms.size(), 2, 'Should render both selected terms')

	const firstTermDiv: any = renderedTerms.nodes()[0]
	firstTermDiv.click()

	const deleteAction = dispatched[dispatched.length - 1]
	test.equal(deleteAction.type, 'app_refresh', 'Should dispatch app_refresh after deleting term')
	test.equal(deleteAction.state.selectedTerms.length, 1, 'Should remove one term from selected terms')
	test.equal(deleteAction.state.selectedTerms[0].name, 'Sex', 'Should remove clicked term by name')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('getDtTerm() should return child term and throw on invalid input', test => {
	const { termTypeSearch, holder } = getNewTermTypeSearch({})

	const tw = {
		term: {
			type: TermTypes.GENE_VARIANT,
			childTerms: [{ id: 'dt1', type: TermTypes.CATEGORICAL }]
		},
		q: { type: 'predefined-groupset', predefined_groupset_idx: 0 }
	}
	test.deepEqual(termTypeSearch.getDtTerm(tw), tw.term.childTerms[0], 'Should return child dt term by groupset index')

	test.throws(
		() =>
			termTypeSearch.getDtTerm({
				term: { type: TermTypes.CATEGORICAL, childTerms: [] },
				q: { type: 'predefined-groupset', predefined_groupset_idx: 0 }
			}),
		/term.type is not geneVariant/,
		'Should throw when term type is not geneVariant'
	)

	test.throws(
		() =>
			termTypeSearch.getDtTerm({
				term: { type: TermTypes.GENE_VARIANT, childTerms: [] },
				q: { type: 'predefined-groupset', predefined_groupset_idx: 2 }
			}),
		/dtTerm not found/,
		'Should throw when child dt term is missing'
	)
	if (test['_ok']) holder.remove()
	test.end()
})
