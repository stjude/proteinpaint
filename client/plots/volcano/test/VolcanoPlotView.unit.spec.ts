import tape from 'tape'
import { select } from 'd3-selection'
import { VolcanoPlotView } from '../view/VolcanoPlotView'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'

/* Tests:
	- renderUserActions() by data type
*/

function getView(termType: string, queries: any = {}) {
	const holder = select(document.body).append('div')
	const dom: any = { holder, actionsTip: { d: holder.append('div'), hide: () => {} } }
	const interactions: any = {
		id: 'test',
		app: { vocabApi: { termdbConfig: { queries }, vocab: {} }, getState: () => ({ plots: [] }) }
	}
	return new VolcanoPlotView(dom, interactions, termType)
}

/** the action bar in order: a button by its text, the caption of the significant count as {caption} */
function renderActions(view: VolcanoPlotView, settings: any, viewData: any) {
	view.settings = settings
	view.viewData = Object.assign(
		{ userActions: { noShow: new Set() }, numSignificantUp: 0, numSignificantDown: 0, xOffset: 0, centered: false },
		viewData
	)
	view.renderUserActions()
	const items = [...view.volcanoDom.actions.node()!.childNodes].map((n: any) =>
		n.tagName == 'BUTTON' ? n.textContent : { caption: n.textContent }
	)
	view.dom.holder.remove()
	return items
}

/** the stats row that the caption reads its count and noun from */
function sigStats(noun: string, n: number) {
	return [{ label: `Number of significant ${noun}`, value: n }]
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/view/VolcanoPlotView -***-')
	test.end()
})

tape('renderUserActions(): gene expression', test => {
	const queries = { rnaseqGeneCount: true }
	test.deepEqual(
		renderActions(
			getView(tt.GENE_EXPRESSION, queries),
			{ method: 'edgeR' },
			{ statsData: sigStats('genes', 5), numSignificantUp: 3, numSignificantDown: 2 }
		),
		[
			'Confounding factors',
			'Highlight genes',
			'Statistics',
			{ caption: '5 DE genes (3 up / 2 down):' },
			'Show p-value table',
			'Hierarchical clustering of 5 DE genes'
		],
		'should offer every expression action, and caption the DE genes up and down'
	)
	test.deepEqual(
		renderActions(
			getView(tt.GENE_EXPRESSION, queries),
			{ method: 'wilcoxon', showPValueTable: true },
			{ statsData: sigStats('genes', 2), userActions: { noShow: new Set(['confounders']) } }
		),
		['Highlight genes', 'Statistics', { caption: '2 DE genes:' }, 'Hide p-value table'],
		'should leave out a hidden action, the split of no direction, and clustering under 3 genes'
	)
	test.deepEqual(
		renderActions(getView(tt.GENE_EXPRESSION, queries), { method: 'edgeR' }, { statsData: sigStats('genes', 0) }),
		['Confounding factors', 'Highlight genes', 'Statistics'],
		'should leave out the caption and the table button with no significant gene'
	)
	test.end()
})

tape('renderUserActions(): dna methylation', test => {
	const isoformQueries = { isoformExpressionCount: true, dnaMethylation: { regionAnalysis: 'cpg' } }
	test.deepEqual(
		renderActions(
			getView(tt.DNA_METHYLATION, isoformQueries),
			{ elementType: 'promoter' },
			{
				statsData: sigStats('promoters', 7),
				numSignificantUp: 4,
				numSignificantDown: 3,
				centered: true,
				xOffset: 0.0123
			}
		),
		[
			'Confounding factors',
			'Highlight genes',
			'Statistics',
			'Methylation vs expression by isoform',
			{ caption: '7 DM promoters (4 hyper / 3 hypo), centered on median Δβ +0.012:' },
			'Show p-value table'
		],
		'should caption the DM elements hyper and hypo, and offer the isoform starburst with transcript counts'
	)
	test.deepEqual(
		renderActions(
			getView(tt.DNA_METHYLATION, { rnaseqGeneCount: true, dnaMethylation: { regionAnalysis: 'cpg' } }),
			{ elementType: 'promoter' },
			{ statsData: sigStats('promoters', 1) }
		),
		['Confounding factors', 'Highlight genes', 'Statistics', { caption: '1 DM promoters:' }, 'Show p-value table'],
		'should not offer the starburst with gene counts only: there is no gene-level starburst'
	)
	test.deepEqual(
		renderActions(
			getView(tt.DNA_METHYLATION, isoformQueries),
			{ elementType: DMR_SCAN_ELEMENT_TYPE },
			{
				statsData: sigStats('DMRs', 9),
				numSignificantUp: 9,
				scan: { cacheId: 'c1' },
				userActions: { noShow: new Set(['confounders']) }
			}
		),
		[
			'Highlight genes',
			'Statistics',
			'Methylation vs expression by isoform',
			{ caption: '9 DMRs (9 hyper / 0 hypo):' },
			'Show p-value table'
		],
		'should offer the starburst on a scan too, which opens it beside the volcano, and not say "DM DMRs"'
	)
	test.end()
})

tape('renderUserActions(): splicing, single-cell cell type and proteome', test => {
	test.deepEqual(
		renderActions(getView(tt.JUNCTION), { method: 'leafcutter' }, { statsData: sigStats('clusters', 4) }),
		[{ caption: '4 significant clusters:' }],
		'should offer splicing no action'
	)
	test.deepEqual(
		renderActions(
			getView(tt.SINGLECELL_CELLTYPE),
			{},
			{ statsData: sigStats('genes', 3), numSignificantUp: 2, numSignificantDown: 1 }
		),
		['Highlight genes', 'Statistics', { caption: '3 significant genes (2 up / 1 down):' }, 'Show p-value table'],
		'should offer a cell type the highlight, statistics and table, but not clustering'
	)
	test.deepEqual(
		renderActions(
			getView(tt.PROTEOME_DAP),
			{},
			{ statsData: sigStats('proteins', 2), numSignificantUp: 1, numSignificantDown: 1 }
		),
		[{ caption: '2 significant proteins (1 up / 1 down):' }],
		'should offer a proteome no action'
	)
	test.end()
})
