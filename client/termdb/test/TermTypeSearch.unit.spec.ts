import tape from 'tape'
import * as d3s from 'd3-selection'
import { TermTypeSearch } from '../TermTypeSearch'
import { TermTypeGroups, TermTypes } from '#shared/terms.js'

/*
Tests:
	addTabsAllowed() - basic tab creation for allowed term types
	addTabsAllowed() - SNP_LIST and SNP_LOCUS exclusion
	addTabsAllowed() - usecase filtering for survival with detail=term
	addTabsAllowed() - usecase filtering for regression with detail=independent
	addTabsAllowed() - usecase filtering for dataDownload
	addTabsAllowed() - usecase filtering for sampleScatter with numeric detail
	addTabsAllowed() - term type group deduplication
	addTabsAllowed() - GENE_VARIANT custom label generation
	addTabsAllowed() - should throw for invalid term type without group
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
	test.comment('-***- termdb/TermTypeSearch.unit -***-')
	test.end()
})

tape('addTabsAllowed() - basic tab creation for allowed term types', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.INTEGER],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should create one tab for DICTIONARY_VARIABLES group')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Both CATEGORICAL and INTEGER should map to DICTIONARY_VARIABLES group'
	)
	test.equal(termTypeSearch.tabs[0].label, TermTypeGroups.DICTIONARY_VARIABLES, 'Tab label should match term type group')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - SNP_LIST and SNP_LOCUS exclusion', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.SNP_LIST, TermTypes.SNP_LOCUS, TermTypes.CATEGORICAL],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should exclude SNP_LIST and SNP_LOCUS from tabs')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should only include CATEGORICAL in tabs'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for survival with detail=term', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'survival', detail: 'term' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY, TermTypes.GENE_EXPRESSION],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for survival with detail=term')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should exclude non-dictionary term types'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for cuminc with detail=term', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'cuminc', detail: 'term' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY, TermTypes.GENE_EXPRESSION],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for cuminc with detail=term')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should exclude non-dictionary term types'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for regression with detail=independent', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'regression', detail: 'independent' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT, TermTypes.GENE_EXPRESSION, TermTypes.SNP],
			queries: {
				snvindel: { dt: 1 }
			}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 3, 'Should allow multiple term type groups for regression with detail=independent')
	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.ok(groups.includes(TermTypeGroups.MUTATION_CNV_FUSION), 'Should include MUTATION_CNV_FUSION for GENE_VARIANT')
	test.ok(groups.includes(TermTypeGroups.GENE_EXPRESSION), 'Should include GENE_EXPRESSION')
	test.notOk(groups.includes(TermTypeGroups.SNP), 'Should exclude SNP for regression')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for regression with detail=outcome', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'regression', detail: 'outcome' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT, TermTypes.GENE_EXPRESSION],
			queries: {
				snvindel: { dt: 1 }
			}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for regression with detail=outcome')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should exclude GENE_VARIANT and GENE_EXPRESSION when detail != independent'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for dataDownload', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'dataDownload', detail: '' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.SNP, TermTypes.GENE_VARIANT],
			queries: {
				snvindel: { dt: 1 }
			}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should exclude both SNP and GENE_VARIANT for dataDownload')
	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.notOk(groups.includes(TermTypeGroups.MUTATION_CNV_FUSION), 'Should exclude MUTATION_CNV_FUSION for dataDownload')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for sampleScatter with numeric detail', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'sampleScatter', detail: 'numeric' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.INTEGER, TermTypes.FLOAT, TermTypes.METABOLITE_INTENSITY],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES with numeric types')
	test.ok(groups.includes(TermTypeGroups.METABOLITE_INTENSITY), 'Should include METABOLITE_INTENSITY for numeric detail')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - term type group deduplication', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [
				TermTypes.CATEGORICAL,
				TermTypes.INTEGER,
				TermTypes.FLOAT,
				TermTypes.CONDITION,
				TermTypes.SURVIVAL
			],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(
		termTypeSearch.tabs.length,
		1,
		'Should create only one tab even though multiple term types map to same group'
	)
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'All specified types should map to DICTIONARY_VARIABLES'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - GENE_VARIANT custom label generation with snvindel', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
			queries: {
				snvindel: { dt: 1 }
			}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const geneVariantTab = termTypeSearch.tabs.find(t => t.termTypeGroup == TermTypeGroups.MUTATION_CNV_FUSION)
	test.ok(geneVariantTab, 'Should create tab for GENE_VARIANT')
	test.equal(geneVariantTab.label, 'Mutation', 'Should use "Mutation" label when only snvindel query is available')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - GENE_VARIANT custom label generation with multiple queries', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
			queries: {
				snvindel: { dt: 1 },
				cnv: { dt: 2 },
				svfusion: { dt: 3 }
			}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const geneVariantTab = termTypeSearch.tabs.find(t => t.termTypeGroup == TermTypeGroups.MUTATION_CNV_FUSION)
	test.ok(geneVariantTab, 'Should create tab for GENE_VARIANT')
	test.equal(
		geneVariantTab.label,
		'Mutation/CNV/Fusion',
		'Should join all available labels with "/" when multiple queries are available'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - GENE_VARIANT without queries should skip tab creation', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should only create tab for CATEGORICAL')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should not create tab for GENE_VARIANT without queries'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase exclusion using useCasesExcluded', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'matrix', detail: '' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.SINGLECELL_CELLTYPE],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should exclude SINGLECELL_CELLTYPE for matrix usecase')
	test.equal(
		termTypeSearch.tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should only include DICTIONARY_VARIABLES'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for sampleScatter with singleCell special case', async test => {
	const appState = {
		...getDefaultState(),
		tree: {
			usecase: {
				target: 'sampleScatter',
				detail: 'numeric',
				specialCase: { type: 'singleCell' }
			}
		}
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.FLOAT, TermTypes.SINGLECELL_GENE_EXPRESSION, TermTypes.CATEGORICAL],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.ok(
		groups.includes(TermTypeGroups.SINGLECELL_GENE_EXPRESSION),
		'Should include single cell types for singleCell special case'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for sampleScatter without singleCell special case', async test => {
	const appState = {
		...getDefaultState(),
		tree: {
			usecase: {
				target: 'sampleScatter',
				detail: 'numeric'
			}
		}
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.FLOAT, TermTypes.SINGLECELL_GENE_EXPRESSION, TermTypes.CATEGORICAL],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.notOk(
		groups.includes(TermTypeGroups.SINGLECELL_GENE_EXPRESSION),
		'Should exclude single cell types when not in singleCell special case'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - should throw for invalid term type without group', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: ['invalidTermType'],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)

	try {
		await termTypeSearch.addTabsAllowed(state)
		test.fail('Should throw error for term type without group mapping')
	} catch (e) {
		test.match(String(e), /no group for a term type/, 'Should throw expected error for invalid term type')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - usecase filtering for multiple exclusions', async test => {
	const appState = {
		...getDefaultState(),
		tree: { usecase: { target: 'facet', detail: '' } }
	}
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [
				TermTypes.CATEGORICAL,
				TermTypes.METABOLITE_INTENSITY,
				TermTypes.SINGLECELL_CELLTYPE,
				TermTypes.GENE_EXPRESSION
			],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	const groups = termTypeSearch.tabs.map(t => t.termTypeGroup)
	test.equal(termTypeSearch.tabs.length, 3, 'Should filter out only excluded term type groups')
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.ok(groups.includes(TermTypeGroups.METABOLITE_INTENSITY), 'Should include METABOLITE_INTENSITY')
	test.notOk(groups.includes(TermTypeGroups.SINGLECELL_CELLTYPE), 'Should exclude SINGLECELL_CELLTYPE for facet')
	test.ok(groups.includes(TermTypeGroups.GENE_EXPRESSION), 'GENE_EXPRESSION is not excluded for facet usecase')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('addTabsAllowed() - callback execution', async test => {
	const appState = getDefaultState()
	const { termTypeSearch, holder } = getNewTermTypeSearch({
		appState,
		termdbConfig: {
			allowedTermTypes: [TermTypes.CATEGORICAL],
			queries: {}
		}
	})

	// Set this.types as it would be set in init()
	termTypeSearch.types = termTypeSearch.app.vocabApi.termdbConfig.allowedTermTypes

	const state = termTypeSearch.getState(appState)
	await termTypeSearch.addTabsAllowed(state)

	test.equal(termTypeSearch.tabs.length, 1, 'Should create one tab')
	test.equal(typeof termTypeSearch.tabs[0].callback, 'function', 'Tab should have a callback function')

	if (test['_ok']) holder.remove()
	test.end()
})
