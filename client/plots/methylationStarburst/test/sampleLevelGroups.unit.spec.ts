import tape from 'tape'
import { sampleLevelGroups } from '../MethylationStarburst'

/*
sampleLevelGroups(): the groups for a plot of a sample-level value. On a dataset with sample ancestry a group defined by
a filter asks for its patients' samples; a group that lists its samples, and every group elsewhere, is left as it is.
*/

tape('\n', test => {
	test.comment('-***- methylationStarburst sampleLevelGroups -***-')
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
