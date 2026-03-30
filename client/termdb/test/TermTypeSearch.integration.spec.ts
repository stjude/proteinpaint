import tape from 'tape'
import * as d3s from 'd3-selection'
import { TermTypeGroups, TermTypes } from '#shared/terms.js'
import { appInit } from '../app.ts'
import { vocabInit } from '../vocabulary'
import { sleep } from '../../test/test.helpers.js'

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

function getDefaultState(overrides = {}) {
	const state = Object.assign(
		{
			vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' },
			termTypeGroup: '',
			tree: { usecase: { target: 'default', detail: 'term' } },
			submenu: { term: null },
			selectedTerms: [],
			termfilter: { filter0: null, filter: null }
		},
		overrides
	)

	// below simulates what's done in the store constructor
	// state.allowedTermTypes = getAllowedTermTypesForUseCase(state, app)
	// below simulates what's done in TermTypeSearch.init()

	return state
}

async function getNewTermTypeSearch(opts: {
	appState?: any
	termdbConfig?: any
	click_term?: (term: any) => void
	submit_lst?: (terms: any[]) => void
}) {
	const holder = d3s.select('body').append('div')
	const vocabApi = await vocabInit({
		vocab: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest'
		}
	})
	await vocabApi.getTermdbConfig()
	if (opts.termdbConfig) Object.assign(vocabApi.termdbConfig, opts.termdbConfig)
	const app = await appInit({
		debug: true,
		holder,
		vocabApi,
		state: getDefaultState(opts.appState || {}),
		click_term: opts.click_term,
		tree: {
			submit_lst: opts.submit_lst
		}
	})
	vocabApi.app = app

	const dispatched: any[] = []
	app.middle(async action => {
		dispatched.push(action)
	})

	const termTypeSearch = app.getComponents('termTypeSearch')?.Inner //; console.log(98, app, termTypeSearch)

	return { termTypeSearch, holder, dispatched, appState: app.getState(), app }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/TermTypeSearch -***-')
	test.end()
})

tape('init() should accept usecase filtering for allowed term type tabs', async test => {
	const { termTypeSearch, holder } = await getNewTermTypeSearch({
		appState: {
			tree: { usecase: { target: 'survival', detail: 'term' } }
		},
		termdbConfig: { allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY] }
	})

	test.equal(termTypeSearch.tabs.length, 1, 'Should only have one tab for survival detail=term')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should keep dictionary variables and exclude metabolite intensity'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should ignore appState.termTypeGroup and derive tabs from allowed types', async test => {
	const { termTypeSearch, holder } = await getNewTermTypeSearch({
		appState: { termTypeGroup: TermTypeGroups.METABOLITE_INTENSITY },
		termdbConfig: { allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY] }
	})

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

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when no term types are allowed', async test => {
	const { holder } = await getNewTermTypeSearch({
		termdbConfig: {
			//Note: SNP_LIST is excluded from default allowed term types
			allowedTermTypes: [TermTypes.SNP_LIST]
		}
	})
	const errbar: HTMLElement | null | undefined = holder.node()?.querySelector('.sja_errorbar')
	test.equal(errbar?.checkVisibility(), true, 'Should throw when all term types are filtered out')
	test.true(
		errbar?.innerText.includes('No term types allowed for this use case'),
		'Should throw expected error message'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when TERM_COLLECTION lacks termdbConfig.termCollections', async test => {
	const { holder } = await getNewTermTypeSearch({
		termdbConfig: {
			allowedTermTypes: [TermTypes.TERM_COLLECTION]
		}
	})
	const errbar: HTMLElement | null | undefined = holder.node()?.querySelector('.sja_errorbar')
	test.equal(
		errbar?.checkVisibility(),
		true,
		'Should throw when TERM_COLLECTION is enabled without termCollections config'
	)
	test.true(
		errbar?.innerText.includes('No term types allowed for this use case'),
		'Should throw expected handler setup error for missing termCollections'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('selectTerm() should append and replace selected terms correctly in submit mode', async test => {
	const { termTypeSearch, holder, app } = await getNewTermTypeSearch({
		appState: { selectedTerms: [{ name: 'Age', id: 'agedx', type: TermTypes.INTEGER }] },
		submit_lst: () => {}
	})

	await termTypeSearch.selectTerm({ name: 'Sex', id: 'sex', type: TermTypes.CATEGORICAL })
	await sleep(1)
	test.equal(app.getState().selectedTerms.length, 2, 'Should append selected term')

	await termTypeSearch.selectTerm({
		type: TermTypes.TERM_COLLECTION,
		term: { type: TermTypes.TERM_COLLECTION, name: 'Test term collection' }
	})
	await sleep(1)
	test.equal(
		app.getState().selectedTerms[0].name,
		'Test term collection',
		'Should keep selected test term collection only'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('renderTermsSelected() click should remove selected term', async test => {
	const { termTypeSearch, holder, dispatched } = await getNewTermTypeSearch({
		appState: {
			selectedTerms: [
				{ name: 'Age', id: 'agedx', type: TermTypes.INTEGER },
				{ name: 'Sex', id: 'sex', type: TermTypes.CATEGORICAL }
			]
		},
		submit_lst: () => {}
	})

	//termTypeSearch.main()
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

tape('getDtTerm() should return child term and throw on invalid input', async test => {
	const { termTypeSearch, holder } = await getNewTermTypeSearch({})
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
