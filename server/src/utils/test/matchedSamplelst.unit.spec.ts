import tape from 'tape'
import { matchedSamplelstForResponse } from '#src/utils/methylationMatrix.ts'

/*
test sections:
	- matchedSamplelstForResponse: a group by the shape that the request gave it in
*/

tape('\n', t => {
	t.comment('-***- utils/methylationMatrix matchedSamplelstForResponse -***-')
	t.end()
})

tape('matchedSamplelstForResponse: a group by the shape that the request gave it in', t => {
	const filter = { type: 'tvslst', in: true, join: '', lst: [] }
	const matched = {
		groups: [
			{ name: 'a', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] },
			{ name: 'b', in: true, values: [{ sampleId: 3 }] }
		]
	}
	const listed = [
		{ name: 'a', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }, { sampleId: 9 }] },
		{ name: 'b', in: true, values: [{ sampleId: 3 }] }
	]
	t.equal(
		matchedSamplelstForResponse(listed, matched),
		matched,
		'groups that the request listed go back as their matched lists'
	)

	const byFilter = [
		{ name: 'a', in: true, filter, filter0: null, mapParent2Children: true, sampleCount: 40 },
		{ name: 'b', in: true, filter }
	]
	const out = matchedSamplelstForResponse(byFilter, matched)
	t.notOk(JSON.stringify(out).includes('sampleId'), 'no sample of a group that came as a filter is listed')
	t.deepEqual(
		out.groups,
		[
			{ name: 'a', in: true, filter, filter0: null, mapParent2Children: true, sampleCount: 2 },
			{ name: 'b', in: true, filter, sampleCount: 1 }
		],
		'such a group goes back as it came, with the number of its matched samples'
	)
	t.equal(out.matchMethylation, true, 'and the contrast that follows is asked to keep to the matched samples')

	const mixed = matchedSamplelstForResponse([byFilter[0], listed[1]], matched)
	t.deepEqual(
		[mixed.groups[0].values, mixed.groups[1].values],
		[undefined, [{ sampleId: 3 }]],
		'in a request of both shapes, only the listed group goes back as a list'
	)
	t.end()
})
