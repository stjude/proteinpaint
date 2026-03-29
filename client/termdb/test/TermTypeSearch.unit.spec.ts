import tape from 'tape'
import { getAllowedTabs, useCasesExcluded } from '../TermTypeSearch'
import { TermTypeGroups, TermTypes } from '#shared/terms.js'

/*
Tests:
	getAllowedTabs() - basic tab creation for allowed term types
	getAllowedTabs() - SNP_LIST and SNP_LOCUS exclusion
	getAllowedTabs() - usecase filtering for survival with detail=term
	getAllowedTabs() - usecase filtering for regression with detail=independent
	getAllowedTabs() - usecase filtering for dataDownload
	getAllowedTabs() - usecase filtering for sampleScatter with numeric detail
	getAllowedTabs() - term type group deduplication
	getAllowedTabs() - GENE_VARIANT custom label generation
	getAllowedTabs() - should throw for invalid term type without group
	getAllowedTabs() - numeric termCollection should show up in dictionary usecase
*/

/*************************
 reusable helper functions
**************************/

// Default state structure with usecase
function getDefaultState() {
	return {
		vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' },
		termTypeGroup: '',
		usecase: { target: 'default', detail: 'term' },
		submenu: { term: null },
		selectedTerms: [],
		termfilter: { filter0: null, filter: null }
	}
}

// Create minimal mock for 'self' parameter needed by getAllowedTabs()
function getMockSelf(opts: { allowedTermTypes: string[]; queries?: any; termCollections?: any[] }) {
	return {
		types: opts.allowedTermTypes,
		app: {
			vocabApi: {
				termdbConfig: {
					allowedTermTypes: opts.allowedTermTypes,
					queries: opts.queries || {},
					termCollections: opts.termCollections
				}
			}
		},
		useCasesExcluded,
		setTermTypeGroup: () => {} // Mock callback function
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/TermTypeSearch.unit -***-')
	test.end()
})

tape('getAllowedTabs() - basic tab creation for allowed term types', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.INTEGER],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should create one tab for DICTIONARY_VARIABLES group')
	test.equal(
		tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Both CATEGORICAL and INTEGER should map to DICTIONARY_VARIABLES group'
	)
	test.equal(tabs[0].label, TermTypeGroups.DICTIONARY_VARIABLES, 'Tab label should match term type group')

	test.end()
})

tape('getAllowedTabs() - SNP_LIST and SNP_LOCUS exclusion', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.SNP_LIST, TermTypes.SNP_LOCUS, TermTypes.CATEGORICAL],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should exclude SNP_LIST and SNP_LOCUS from tabs')
	test.equal(tabs[0].termTypeGroup, TermTypeGroups.DICTIONARY_VARIABLES, 'Should only include CATEGORICAL in tabs')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for survival with detail=term', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'survival', detail: 'term' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY, TermTypes.GENE_EXPRESSION],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for survival with detail=term')
	test.equal(tabs[0].termTypeGroup, TermTypeGroups.DICTIONARY_VARIABLES, 'Should exclude non-dictionary term types')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for cuminc with detail=term', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'cuminc', detail: 'term' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.METABOLITE_INTENSITY, TermTypes.GENE_EXPRESSION],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for cuminc with detail=term')
	test.equal(tabs[0].termTypeGroup, TermTypeGroups.DICTIONARY_VARIABLES, 'Should exclude non-dictionary term types')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for regression with detail=independent', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'regression', detail: 'independent' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT, TermTypes.GENE_EXPRESSION, TermTypes.SNP],
		queries: {
			snvindel: { dt: 1 }
		}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 3, 'Should allow multiple term type groups for regression with detail=independent')
	const groups = tabs.map(t => t.termTypeGroup)
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.ok(groups.includes(TermTypeGroups.MUTATION_CNV_FUSION), 'Should include MUTATION_CNV_FUSION for GENE_VARIANT')
	test.ok(groups.includes(TermTypeGroups.GENE_EXPRESSION), 'Should include GENE_EXPRESSION')
	test.notOk(groups.includes(TermTypeGroups.SNP), 'Should exclude SNP for regression')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for regression with detail=outcome', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'regression', detail: 'outcome' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT, TermTypes.GENE_EXPRESSION],
		queries: {
			snvindel: { dt: 1 }
		}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should only allow DICTIONARY_VARIABLES for regression with detail=outcome')
	test.equal(
		tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should exclude GENE_VARIANT and GENE_EXPRESSION when detail != independent'
	)

	test.end()
})

tape('getAllowedTabs() - usecase filtering for dataDownload', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'dataDownload', detail: '' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.SNP, TermTypes.GENE_VARIANT],
		queries: {
			snvindel: { dt: 1 }
		}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should exclude both SNP and GENE_VARIANT for dataDownload')
	const groups = tabs.map(t => t.termTypeGroup)
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.notOk(groups.includes(TermTypeGroups.MUTATION_CNV_FUSION), 'Should exclude MUTATION_CNV_FUSION for dataDownload')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for sampleScatter with numeric detail', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'sampleScatter', detail: 'numeric' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.INTEGER, TermTypes.FLOAT, TermTypes.METABOLITE_INTENSITY],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	const groups = tabs.map(t => t.termTypeGroup)
	test.ok(
		groups.includes(TermTypeGroups.DICTIONARY_VARIABLES),
		'Should include DICTIONARY_VARIABLES with numeric types'
	)
	test.ok(
		groups.includes(TermTypeGroups.METABOLITE_INTENSITY),
		'Should include METABOLITE_INTENSITY for numeric detail'
	)

	test.end()
})

tape('getAllowedTabs() - term type group deduplication', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [
			TermTypes.CATEGORICAL,
			TermTypes.INTEGER,
			TermTypes.FLOAT,
			TermTypes.CONDITION,
			TermTypes.SURVIVAL
		],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should create only one tab even though multiple term types map to same group')
	test.equal(
		tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'All specified types should map to DICTIONARY_VARIABLES'
	)

	test.end()
})

tape('getAllowedTabs() - GENE_VARIANT custom label generation with snvindel', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
		queries: {
			snvindel: { dt: 1 }
		}
	})

	const tabs = getAllowedTabs(state, self)

	const geneVariantTab = tabs.find(t => t.termTypeGroup == TermTypeGroups.MUTATION_CNV_FUSION)
	test.ok(geneVariantTab, 'Should create tab for GENE_VARIANT')
	test.equal(geneVariantTab!.label, 'Mutation', 'Should use "Mutation" label when only snvindel query is available')

	test.end()
})

tape('getAllowedTabs() - GENE_VARIANT custom label generation with multiple queries', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
		queries: {
			snvindel: { dt: 1 },
			cnv: { dt: 2 },
			svfusion: { dt: 3 }
		}
	})

	const tabs = getAllowedTabs(state, self)

	const geneVariantTab = tabs.find(t => t.termTypeGroup == TermTypeGroups.MUTATION_CNV_FUSION)
	test.ok(geneVariantTab, 'Should create tab for GENE_VARIANT')
	test.equal(
		geneVariantTab!.label,
		'Mutation/CNV/Fusion',
		'Should join all available labels with "/" when multiple queries are available'
	)

	test.end()
})

tape('getAllowedTabs() - GENE_VARIANT without queries should skip tab creation', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.GENE_VARIANT],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should only create tab for CATEGORICAL')
	test.equal(
		tabs[0].termTypeGroup,
		TermTypeGroups.DICTIONARY_VARIABLES,
		'Should not create tab for GENE_VARIANT without queries'
	)

	test.end()
})

tape('getAllowedTabs() - usecase exclusion using useCasesExcluded', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'matrix', detail: '' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.SINGLECELL_CELLTYPE],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should exclude SINGLECELL_CELLTYPE for matrix usecase')
	test.equal(tabs[0].termTypeGroup, TermTypeGroups.DICTIONARY_VARIABLES, 'Should only include DICTIONARY_VARIABLES')

	test.end()
})

tape('getAllowedTabs() - usecase filtering for sampleScatter with singleCell special case', test => {
	const state = {
		...getDefaultState(),
		usecase: {
			target: 'sampleScatter',
			detail: 'numeric',
			specialCase: { type: 'singleCell' }
		}
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.FLOAT, TermTypes.SINGLECELL_GENE_EXPRESSION, TermTypes.CATEGORICAL],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	const groups = tabs.map(t => t.termTypeGroup)
	test.ok(
		groups.includes(TermTypeGroups.SINGLECELL_GENE_EXPRESSION),
		'Should include single cell types for singleCell special case'
	)

	test.end()
})

tape('getAllowedTabs() - usecase filtering for sampleScatter without singleCell special case', test => {
	const state = {
		...getDefaultState(),
		usecase: {
			target: 'sampleScatter',
			detail: 'numeric'
		}
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.FLOAT, TermTypes.SINGLECELL_GENE_EXPRESSION, TermTypes.CATEGORICAL],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	const groups = tabs.map(t => t.termTypeGroup)
	test.notOk(
		groups.includes(TermTypeGroups.SINGLECELL_GENE_EXPRESSION),
		'Should exclude single cell types when not in singleCell special case'
	)

	test.end()
})

tape('getAllowedTabs() - should throw for invalid term type without group', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: ['invalidTermType'],
		queries: {}
	})

	try {
		getAllowedTabs(state, self)
		test.fail('Should throw error for term type without group mapping')
	} catch (e) {
		test.match(String(e), /no group for a term type/, 'Should throw expected error for invalid term type')
	}

	test.end()
})

tape('getAllowedTabs() - usecase filtering for multiple exclusions', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'facet', detail: '' }
	}
	const self = getMockSelf({
		allowedTermTypes: [
			TermTypes.CATEGORICAL,
			TermTypes.METABOLITE_INTENSITY,
			TermTypes.SINGLECELL_CELLTYPE,
			TermTypes.GENE_EXPRESSION
		],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	const groups = tabs.map(t => t.termTypeGroup)
	test.equal(tabs.length, 3, 'Should filter out only excluded term type groups')
	test.ok(groups.includes(TermTypeGroups.DICTIONARY_VARIABLES), 'Should include DICTIONARY_VARIABLES')
	test.ok(groups.includes(TermTypeGroups.METABOLITE_INTENSITY), 'Should include METABOLITE_INTENSITY')
	test.notOk(groups.includes(TermTypeGroups.SINGLECELL_CELLTYPE), 'Should exclude SINGLECELL_CELLTYPE for facet')
	test.ok(groups.includes(TermTypeGroups.GENE_EXPRESSION), 'GENE_EXPRESSION is not excluded for facet usecase')

	test.end()
})

tape('getAllowedTabs() - callback execution', test => {
	const state = getDefaultState()
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL],
		queries: {}
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 1, 'Should create one tab')
	test.equal(typeof tabs[0].callback, 'function', 'Tab should have a callback function')

	test.end()
})

tape('getAllowedTabs() - numeric termCollection should show up in dictionary usecase', test => {
	const state = {
		...getDefaultState(),
		usecase: { target: 'dictionary', detail: '' }
	}
	const self = getMockSelf({
		allowedTermTypes: [TermTypes.CATEGORICAL, TermTypes.TERM_COLLECTION],
		queries: {},
		termCollections: [
			{ name: 'Gene Expression Signature', type: 'numeric' },
			{ name: 'Assay Availability', type: 'categorical' }
		]
	})

	const tabs = getAllowedTabs(state, self)

	test.equal(tabs.length, 2, 'Should create tabs for DICTIONARY_VARIABLES and numeric termCollection')
	const collectionTabs = tabs.filter(t => t.termType == TermTypes.TERM_COLLECTION)
	test.equal(collectionTabs.length, 1, 'Should create one tab for numeric termCollection')
	test.equal(
		collectionTabs[0].label,
		'Gene Expression Signature',
		'Should use termCollection name as label for numeric collection'
	)
	test.notOk(
		tabs.some(t => t.label == 'Assay Availability'),
		'Should exclude categorical termCollection in dictionary usecase'
	)

	test.end()
})
