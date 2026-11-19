import tape from 'tape'
import { sampleLevelGroups, isoformExpressionHandler } from '../handlers/isoformExpression'

/*
sampleLevelGroups(): the groups for a plot of a sample-level value. On a dataset with sample ancestry a group defined by
a filter asks for its patients' samples; a group that lists its samples, and every group elsewhere, is left as it is.
*/

tape('\n', test => {
	test.comment('-***- volcano isoformExpression sampleLevelGroups -***-')
	test.end()
})

tape('sampleLevelGroups()', test => {
	const filterGroup = { name: 'a', in: true, filter: { type: 'tvslst', in: true, join: '', lst: [] } }
	const listGroup = { name: 'b', in: true, values: [{ sampleId: 1 }] }
	const [a, b] = sampleLevelGroups([filterGroup, listGroup], { hasSampleAncestry: true })
	test.equal(a.mapParent2Children, true, 'a filter group asks for the samples of its patients')
	test.equal(filterGroup['mapParent2Children'], undefined, 'the given group is not modified')
	test.equal(b, listGroup, 'a group that lists its samples is left as it is')
	const same = [filterGroup]
	test.equal(sampleLevelGroups(same, {}), same, 'nothing changes on a dataset without sample ancestry')
	test.end()
})

tape('isoform volcano row actions plot the samples of filter groups', async test => {
	const filterGroup = { name: 'a', in: true, filter: { type: 'tvslst', in: true, join: '', lst: [] } }
	let launched: any
	const plotFilter = { type: 'tvslst', in: true, join: '', lst: [] }
	const termdbConfig = { hasSampleAncestry: true, queries: { isoformExpression: { unit: 'TPM' } } }
	const ctx: any = {
		interactions: { launchPlot: (c: any) => (launched = c) },
		config: { tw: { q: { groups: [filterGroup, filterGroup] }, term: { type: 'samplelst' } }, filter: plotFilter },
		termdbConfig,
		queries: termdbConfig.queries
	}
	const [violin] = isoformExpressionHandler.getRowActions!({ gene_name: 'ENST00000256078.10', gene: 'KRAS' }, ctx)
	await violin.onClick()
	test.deepEqual(
		launched.term2.q.groups.map((g: any) => g.mapParent2Children),
		[true, true],
		"each filter group asks for its patients' samples"
	)
	test.equal(launched.filter, plotFilter, "the volcano's plot-local filter goes to the plot")
	test.equal(launched.term.term.isoform, 'ENST00000256078.10', 'the term keeps the id as the DE run reports it')
	test.end()
})
