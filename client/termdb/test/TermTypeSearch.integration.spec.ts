import tape from 'tape'
import * as d3s from 'd3-selection'
import { TermTypeGroups } from '#shared/terms.js'
import { TermTypes } from '#types'
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
	- initActiveHandler() should tell a handler whether the q survives the selection
	- GENE_EXPRESSION should open TVS when no selection callback is defined
	- GENE_VARIANT should retain selected origins in the TVS menu and applied filter
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
	return state
}

async function getNewTermTypeSearch(opts: {
	appState?: any
	termdbConfig?: any
	click_term?: (term: any) => void
	submit_lst?: (terms: any[]) => void
	click_term2select_tvs?: (tvs: any) => void
}) {
	const holder = d3s.select('body').append('div')

	// need to supply a custom vocabApi to simplify testing
	const vocabApi = await vocabInit({
		vocab: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest'
		}
	})
	await vocabApi.getTermdbConfig()
	if (opts.termdbConfig) Object.assign(vocabApi.termdbConfig, opts.termdbConfig)
	// override the class getTermdbConfig() method to return the test-configured termdbConfig
	vocabApi.getTermdbConfig = () => {
		return vocabApi.termdbConfig as any
	}

	const app = await appInit({
		debug: true,
		holder,
		vocabApi,
		state: getDefaultState(opts.appState || {}),
		click_term: opts.click_term,
		tree: {
			// TermTypeSearch reads both from opts.tree, see appInit() in client/termdb/app.ts
			click_term: opts.click_term,
			submit_lst: opts.submit_lst,
			click_term2select_tvs: opts.click_term2select_tvs
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

tape('initActiveHandler() should tell a handler whether the q survives the selection', async test => {
	/* a handler that offers a q the consumer would drop, such as a remembered geneVariant
	setting, would mislead the user, see mayShowRememberedQ() in termdb/handlers/geneVariant.ts.
	selectTerm() above keeps a whole tw only for click_term */
	for (const [mode, opts, expected] of [
		['click_term', { click_term: () => {} }, true],
		['submit_lst', { submit_lst: () => {} }, false],
		['neither, i.e. the tvs path', {}, false]
	] as [string, any, boolean][]) {
		const { termTypeSearch, holder } = await getNewTermTypeSearch(opts)
		const initOpts: any[] = []
		termTypeSearch.handlerByType = { [TermTypes.GENE_VARIANT]: { init: async (o: any) => initOpts.push(o) } }
		termTypeSearch.activeHandler = {
			type: TermTypes.GENE_VARIANT,
			holder: d3s.select('body').append('div'),
			details: {}
		}
		await termTypeSearch.initActiveHandler()
		test.equal(initOpts[0]?.keepsQ, expected, `should pass keepsQ=${expected} for ${mode}`)
		if (test['_ok']) holder.remove()
	}
	test.end()
})

tape('GENE_EXPRESSION should open TVS when no selection callback is defined', async test => {
	const { termTypeSearch, holder, dispatched } = await getNewTermTypeSearch({
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_EXPRESSION],
			queries: { geneExpression: { unit: 'log2 TPM', sampleTypes: [1, 2] } },
			sampleTypes: {
				1: { name: 'Tumor' },
				2: { name: 'Normal' }
			}
		}
	})

	const geneExpressionTab = termTypeSearch.tabs.find(tab => tab.termType == TermTypes.GENE_EXPRESSION)
	test.ok(geneExpressionTab, 'Should create a GENE_EXPRESSION tab')
	await geneExpressionTab?.callback()

	const geneExpressionHandler = termTypeSearch.handlerByType[TermTypes.GENE_EXPRESSION]
	geneExpressionHandler.sampleTypeSelect[1].property('checked', false)
	await geneExpressionHandler.selectGene({ geneSymbol: 'EGFR' })
	await sleep(1)

	const action = dispatched[dispatched.length - 1]
	test.equal(action.type, 'submenu_set', 'Should dispatch submenu_set for the TVS path')
	test.deepEqual(
		action.submenu,
		{
			type: 'tvs',
			origins: undefined,
			term: {
				gene: 'EGFR',
				name: 'EGFR log2 TPM',
				type: TermTypes.GENE_EXPRESSION,
				sampleTypes: [1],
				sampleTypeLabel: ''
			}
		},
		'Should open TVS with the selected gene-expression term'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('GENE_VARIANT should retain selected origins in the TVS menu and applied filter', async test => {
	for (const selectedOrigins of [['somatic'], ['germline'], ['somatic', 'germline']]) {
		let appliedTvs
		const { termTypeSearch, holder, dispatched, app } = await getNewTermTypeSearch({
			appState: { tree: { usecase: { target: 'filter' } } },
			termdbConfig: {
				allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
				queries: { snvindel: {} },
				assayAvailability: { byDt: { 1: { byOrigin: { germline: {}, somatic: {} } } } }
			},
			click_term2select_tvs: tvs => (appliedTvs = tvs)
		})
		termTypeSearch.app.vocabApi.getCategories = async () => ({
			lst: [
				{
					dt: 1,
					classes: { byOrigin: { germline: { M: 1 }, somatic: { M: 2 } } },
					mnames: { byOrigin: { germline: [], somatic: [] } }
				}
			]
		})
		const tab = termTypeSearch.tabs.find(tab => tab.termType == TermTypes.GENE_VARIANT)
		await tab.callback()
		const handler = termTypeSearch.handlerByType[TermTypes.GENE_VARIANT]
		for (const checkbox of handler.originSelect) {
			if (!selectedOrigins.includes(checkbox.property('value'))) checkbox.node().click()
		}
		await handler.selectGene({ geneSymbol: 'TP53' })
		await sleep(100)

		const action = dispatched.find(action => action.type == 'submenu_set')
		test.deepEqual(action.submenu.origins, selectedOrigins, 'Should pass selected origins to the submenu')
		test.equal(action.submenu.term.origins, undefined, 'Should keep origin selection off the shared dt term')
		const checkboxes = holder.selectAll<HTMLInputElement, unknown>('.sjpp-variantconfig-origin-checkboxes input')
		test.equal(checkboxes.size(), 2, 'Should render both origins in the TVS menu')
		test.deepEqual(
			checkboxes.nodes().map(node => node.value),
			handler.originSelect.map(checkbox => checkbox.property('value')),
			'Should order TVS origins as in the search handler'
		)
		test.deepEqual(
			checkboxes
				.nodes()
				.filter(node => node.checked)
				.map(node => node.value)
				.sort(),
			[...selectedOrigins].sort(),
			'Should check only the origins selected in the search handler'
		)
		test.equal(
			holder.select('[data-testid="sjpp-variantConfig-class-count"]').text(),
			String(selectedOrigins.reduce((count, origin) => count + (origin == 'somatic' ? 2 : 1), 0)),
			'Should tally mutation classes only from selected origins'
		)
		holder.select<HTMLButtonElement>('[data-testid="sjpp-variantConfig-apply"]').node()!.click()
		test.deepEqual(appliedTvs?.origins.sort(), [...selectedOrigins].sort(), 'Should apply the selected origins')

		await app.dispatch({ type: 'submenu_set', submenu: {} })
		test.equal(app.getState().submenu.origins, undefined, 'Should clear the seed on returning to selection')
		if (test['_ok']) holder.remove()
	}
	test.end()
})
