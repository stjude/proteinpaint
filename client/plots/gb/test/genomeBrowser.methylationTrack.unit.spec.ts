import tape from 'tape'
import { Interactions } from '../interactions/Interactions.ts'

/**
 * Tests
 *  - onGeneSearch(): the methylation track starts on, unless config.noDefaultMethylationTrack
 */

/**************
 helper functions
***************/

/** an app of one genome browser plot, on a dataset with CpG-level methylation; records the dispatched actions */
function getApp(plotConfig: any) {
	const actions: any[] = []
	const app: any = {
		vocabApi: { termdbConfig: { queries: { dnaMethylation: { regionAnalysis: 'cpg' }, geneExpression: {} } } },
		getState: () => ({ plots: [{ id: 'gb1', ...plotConfig }] }),
		dispatch: (action: any) => actions.push(action)
	}
	return { app, actions }
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/genomeBrowser methylation track -***-')
	test.end()
})

tape('onGeneSearch(): methylation track', function (test) {
	const result = { geneSymbol: 'TP53' }
	const a = getApp({})
	new Interactions(a.app, {}, 'gb1').onGeneSearch(result, false)
	test.deepEqual(
		a.actions[0].config.tracks,
		[{ type: 'dnameth', name: 'Methylation', gene: 'TP53' }],
		'Should start the methylation track with the searched gene.'
	)
	const b = getApp({ noDefaultMethylationTrack: true })
	new Interactions(b.app, {}, 'gb1').onGeneSearch(result, false)
	test.equal(b.actions[0].config.tracks, undefined, 'Should not start the track with config.noDefaultMethylationTrack.')
	test.end()
})
