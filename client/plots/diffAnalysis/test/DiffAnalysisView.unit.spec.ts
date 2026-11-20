import tape from 'tape'
import { select } from 'd3-selection'
import { GENE_EXPRESSION, PROTEOME_DAP } from '#types'
import { DiffAnalysisView } from '../view/DiffAnalysisView'

/*
Tests:
	- GSEA tab is hidden when the server cannot run a GSEA method
*/

tape('\n', test => {
	test.comment('-***- plots/diffAnalysis/view/DiffAnalysisView -***-')
	test.end()
})

tape('GSEA tab is hidden when the server cannot run a GSEA method', test => {
	const holder: any = select(document.body).append('div')
	for (const [termType, unavailable, visible] of [
		[GENE_EXPRESSION, undefined, true],
		[GENE_EXPRESSION, ['blitzgsea'], true],
		[GENE_EXPRESSION, ['cerno', 'ora'], true],
		[GENE_EXPRESSION, ['blitzgsea', 'cerno', 'ora'], false],
		[PROTEOME_DAP, [], false]
	] as [string, string[] | undefined, boolean][]) {
		const view = new DiffAnalysisView(
			{ vocabApi: { termdbConfig: { unavailable } } } as any,
			{ termType, childType: 'volcano' } as any,
			{ tabsDiv: holder.append('div') } as any
		)
		const gsea = view.tabsData.find(t => t.id == 'gsea') as any
		test.equal(
			gsea.isVisible(),
			visible,
			`${termType} with unavailable=[${unavailable || ''}] should ${visible ? 'show' : 'hide'} the GSEA tab`
		)
	}
	holder.remove()
	test.end()
})
