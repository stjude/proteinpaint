import tape from 'tape'
import { GSEAViewModel } from '../viewModel/GSEAViewModel'
import {
	getMockBlitzOutputMap,
	getMockCernoOutputMap,
	getMockGSEA,
	getMockGseaParams,
	getMockGseaSettings,
	getMockRankedDE
} from './mockData'

/*
Tests:
	- init GSEAViewModel
	- getPathwayOpts should append blitz options in test mode and mark selected pathway
	- getRequestBody should include cache params and blitz permutations
	- getOutputMap should parse blitz and cerno responses and reject invalid cerno response
	- getTableData should keep top rows sorted by FDR and honor size cutoffs
	- getTableData should filter by FDR for cerno mode
	- getSelectedRows should resolve the selected gene set index
	- getCernoPlotData should return descending ranked genes and parsed leading edge genes
	- getRankedDE should return inline ranked data and cache it
	- getRankedDE should fetch once for cacheId mode and reuse cache on repeat calls
	- processData should populate cerno table/stats/selection/plot data
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/gsea/viewModel/GSEAViewModel -***-')
	test.end()
})

tape('init GSEAViewModel', function (test) {
	const mockGsea = getMockGSEA()
	const viewModel = new GSEAViewModel(mockGsea as any)

	test.ok(
		viewModel.initPathwayOpts !== mockGsea.app.opts.genome.termdbs.msigdb.analysisGenesetGroups,
		'Initial pathway options should be a cloned array, not the source reference'
	)
	test.deepEqual(
		viewModel.initPathwayOpts,
		mockGsea.app.opts.genome.termdbs.msigdb.analysisGenesetGroups,
		'Initial pathway options should match the source values'
	)
	test.end()
})

tape('getPathwayOpts should append blitz options in test mode and mark selected pathway', function (test) {
	const mockGsea = getMockGSEA({ testEnabled: true })
	const viewModel = new GSEAViewModel(mockGsea as any)
	const settings = getMockGseaSettings({ gsea_method: 'blitzgsea', pathway: 'H: hallmark gene sets' })

	const pathwayOpts = viewModel.getPathwayOpts(settings)
	const selectedOpt = pathwayOpts.find((opt: any) => opt.value == 'H: hallmark gene sets')

	test.equal(
		pathwayOpts[0].value,
		'H: hallmark gene sets',
		'The placeholder option should be removed when pathway is set'
	)
	test.equal(selectedOpt?.selected, true, 'The selected pathway should be marked')
	test.ok(
		pathwayOpts.some((opt: any) => opt.value == 'REACTOME--blitzgsea'),
		'REACTOME blitzgsea option should be appended in test mode'
	)
	test.ok(
		pathwayOpts.some((opt: any) => opt.value == 'KEGG--blitzgsea'),
		'KEGG blitzgsea option should be appended in test mode'
	)
	test.ok(
		pathwayOpts.some((opt: any) => opt.value == 'WikiPathways--blitzgsea'),
		'WikiPathways blitzgsea option should be appended in test mode'
	)
	test.end()
})

tape('getRequestBody should include cache params and blitz permutations', function (test) {
	const gseaParams = getMockGseaParams({
		cacheId: 'cache-1',
		daRequest: { some: 'request' },
		dslabel: 'TermdbTest'
	})
	const mockGsea = getMockGSEA({ gsea_params: gseaParams })
	const viewModel = new GSEAViewModel(mockGsea as any)
	const settings = getMockGseaSettings({
		pathway: 'H: hallmark gene sets',
		gsea_method: 'blitzgsea',
		num_permutations: 250,
		filter_non_coding_genes: false
	})

	const body = viewModel.getRequestBody(settings, 'SET_A')

	test.equal(body.cacheId, 'cache-1', 'cacheId should be copied into the request body')
	test.deepEqual(body.daRequest, { some: 'request' }, 'daRequest payload should be copied into the request body')
	test.equal(body.dslabel, 'TermdbTest', 'Dataset label should be included for cache-backed requests')
	test.equal(body.num_permutations, 250, 'Blitzgsea requests should include num_permutations')
	test.equal(body.geneset_name, 'SET_A', 'Optional geneset_name should be included when provided')
	test.equal(body.method, 'blitzgsea', 'Request method should match configured gsea_method')
	test.equal(body.filter_non_coding_genes, false, 'filter_non_coding_genes should be propagated to the request body')
	test.end()
})

tape('getOutputMap should parse blitz and cerno responses and reject invalid cerno response', function (test) {
	const viewModel = new GSEAViewModel(getMockGSEA() as any)
	const blitzMap = getMockBlitzOutputMap()
	const cernoMap = getMockCernoOutputMap()

	test.deepEqual(
		viewModel.getOutputMap({ data: blitzMap }, 'blitzgsea'),
		blitzMap,
		'Blitzgsea output should be read from output.data'
	)
	test.deepEqual(
		viewModel.getOutputMap({ data: cernoMap }, 'cerno'),
		cernoMap,
		'Cerno output should accept map-shaped output.data payloads'
	)
	test.throws(
		() => viewModel.getOutputMap(['bad'] as any, 'cerno'),
		/Invalid cerno response/,
		'Invalid cerno payloads should throw an explicit error'
	)
	test.end()
})

tape('getTableData should keep top rows sorted by FDR and honor size cutoffs', function (test) {
	const viewModel = new GSEAViewModel(getMockGSEA() as any)
	const settings = getMockGseaSettings({
		gsea_method: 'blitzgsea',
		fdr_or_top: 'top',
		top_genesets: 2,
		min_gene_set_size_cutoff: 6,
		max_gene_set_size_cutoff: 100
	})

	const table = viewModel.getTableData(getMockBlitzOutputMap(), settings)

	test.equal(table.columns.length, 6, 'Blitz table should use blitz columns')
	test.equal(table.rows.length, 2, 'Should include the top two sets within size cutoffs')
	test.equal(table.rows[0][0].value, 'SET_A', 'Top row should be the set with the lowest FDR')
	test.equal(table.rows[1][0].value, 'SET_B', 'Second row should be the set with the second lowest FDR')
	test.deepEqual(table.rowItems[0].genes, ['G1', 'G2'], 'Row items should include parsed leading edge genes')
	test.end()
})

tape('getTableData should filter by FDR for cerno mode', function (test) {
	const viewModel = new GSEAViewModel(getMockGSEA() as any)
	const settings = getMockGseaSettings({
		gsea_method: 'cerno',
		fdr_or_top: 'fdr',
		fdr_cutoff: 0.01,
		min_gene_set_size_cutoff: 0,
		max_gene_set_size_cutoff: 20000
	})

	const table = viewModel.getTableData(getMockCernoOutputMap(), settings)

	test.equal(table.columns.length, 7, 'Cerno table should use cerno columns')
	test.equal(table.rows.length, 1, 'Only one row should pass both FDR and size filters')
	test.equal(table.rows[0][0].value, 'SET_A', 'The remaining row should be the one with FDR < 0.01')
	test.end()
})

tape('getSelectedRows should resolve the selected gene set index', function (test) {
	const mockGsea = getMockGSEA({ stateGenesetName: 'SET_B' })
	const viewModel = new GSEAViewModel(mockGsea as any)
	const rowItems = [{ genesetName: 'SET_A' }, { genesetName: 'SET_B' }, { genesetName: 'SET_C' }]

	test.deepEqual(
		viewModel.getSelectedRows(rowItems as any[]),
		[1],
		'Should resolve the index of the selected gene set based on stateGenesetName'
	)
	test.end()
})

tape('getCernoPlotData should return descending ranked genes and parsed leading edge genes', function (test) {
	const viewModel = new GSEAViewModel(getMockGSEA() as any)
	;(viewModel as any).getRankedDE = async () => getMockRankedDE()

	viewModel
		.getCernoPlotData(getMockCernoOutputMap(), 'SET_A')
		.then(plotData => {
			test.equal(plotData.genesetName, 'SET_A', 'Geneset name should match the input')
			test.deepEqual(plotData.leadingEdgeGenes, ['G1', 'G2'], 'Leading edge genes should be parsed from the output map')
			test.equal(plotData.rankedGenes[0].gene, 'G3', 'Largest fold-change should be first')
			test.equal(
				plotData.rankedGenes[plotData.rankedGenes.length - 1].gene,
				'G2',
				'Smallest fold-change should be last'
			)
			test.end()
		})
		.catch(e => {
			test.fail(String(e))
			test.end()
		})
})

tape('getRankedDE should return inline ranked data and cache it', function (test) {
	let callCount = 0
	const mockGsea = getMockGSEA({
		gsea_params: getMockGseaParams({ cacheId: null, dapParams: null }),
		runEnrichment: async () => {
			callCount++
			return { data: getMockRankedDE() }
		}
	})
	const viewModel = new GSEAViewModel(mockGsea as any)

	viewModel
		.getRankedDE()
		.then(first => {
			return viewModel.getRankedDE().then(second => {
				test.equal(callCount, 0, 'Inline mode should not call runEnrichment for ranked DE')
				test.deepEqual(first, second, 'Second call should reuse cached ranked DE')
				test.deepEqual(first.genes, mockGsea.gsea_params.genes, 'Ranked DE genes should match the input genes')
				test.end()
			})
		})
		.catch(e => {
			test.fail(String(e))
			test.end()
		})
})

tape('getRankedDE should fetch once for cacheId mode and reuse cache on repeat calls', function (test) {
	let callCount = 0
	const rankedDE = getMockRankedDE()
	const mockGsea = getMockGSEA({
		gsea_params: getMockGseaParams({
			cacheId: 'cache-123',
			daRequest: { method: 'edgeR' },
			dslabel: 'TermdbTest'
		}),
		runEnrichment: async () => {
			callCount++
			return { data: rankedDE }
		}
	})
	const viewModel = new GSEAViewModel(mockGsea as any)

	viewModel
		.getRankedDE()
		.then(() => {
			return viewModel.getRankedDE().then(() => {
				test.equal(callCount, 1, 'runEnrichment should only be called once when cache key is unchanged')
				test.equal(viewModel.rankedDEKey, 'cache:cache-123', 'Ranked DE cache key should match the cacheId')
				test.end()
			})
		})
		.catch(e => {
			test.fail(String(e))
			test.end()
		})
})

tape('processData should populate cerno table/stats/selection/plot data', function (test) {
	test.timeoutAfter(1000)
	const settings = getMockGseaSettings({
		pathway: 'H: hallmark gene sets',
		gsea_method: 'cerno',
		fdr_or_top: 'fdr',
		fdr_cutoff: 0.05
	})
	const configGeneset = 'SET_A'
	const mockGsea = getMockGSEA({
		settings,
		stateGenesetName: configGeneset,
		gsea_params: getMockGseaParams({ geneset_name: configGeneset, cacheId: null, dapParams: null }),
		runEnrichment: async () => ({ data: getMockCernoOutputMap() })
	})
	const viewModel = new GSEAViewModel(mockGsea as any)

	viewModel
		.processData()
		.then(() => {
			test.equal(viewModel.viewData.statsData[0].value, 3, 'Stats should report all analyzed gene sets')
			test.equal(
				viewModel.viewData.tableData.rows.length,
				2,
				'Table should include rows under the configured FDR cutoff'
			)
			test.deepEqual(viewModel.viewData.selectedRows, [0], 'Selected row should match selected geneset')
			test.equal(
				viewModel.viewData.cernoPlotData.genesetName,
				'SET_A',
				'Selected geneset should match configured geneset'
			)
			test.equal(
				viewModel.viewData.showHighlightButton,
				true,
				'Highlight button should be shown when leading edge genes are present'
			)
			test.end()
		})
		.catch(e => {
			test.fail(String(e))
			test.end()
		})
})
