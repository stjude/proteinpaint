import tape from 'tape'
import { VolcanoModel } from '../model/VolcanoModel'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'

/* Tests:
    - getOtherSamples
*/

/** the filtered sample list that the server would return, s={id,name} */
const filteredSamples = [
	{ id: 1, name: 'sample1' },
	{ id: 2, name: 'sample2' },
	{ id: 3, name: 'sample3' },
	{ id: 4, name: 'sample4' }
]

function getModel() {
	const plot = {
		app: {
			getState: () => ({ termfilter: { filter: {} } })
		},
		// mimics the plot-scoped vocabApi that PlotBase assigns
		vocabApi: {
			getFilteredSampleList: async () => filteredSamples
		}
	}
	return new VolcanoModel(plot, tt.GENE_EXPRESSION)
}

/** samplelst.groups[].values[]={sampleId,sample} */
function getSamplelst() {
	return {
		groups: [
			{
				name: 'group1',
				in: true,
				values: [
					{ sampleId: 1, sample: 'sample1' },
					{ sampleId: 3, sample: 'sample3' }
				]
			},
			{ name: 'others', in: false, values: [] }
		]
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/volcano/model/VolcanoModel -***-')
	test.end()
})

tape('getOtherSamples()', async function (test) {
	const model = getModel()

	const samplelst = getSamplelst()
	await model.getOtherSamples(samplelst)
	const others = samplelst.groups.find(g => g.name == 'others')!
	test.deepEqual(
		others.values,
		[
			{ sampleId: 2, sample: 'sample2' },
			{ sampleId: 4, sample: 'sample4' }
		],
		`should only add samples that are not already in the "in" group`
	)
	test.equal(others.in, true, `should set the "others" group to in=true`)

	// the two groups are compared against each other, so a sample must not appear in both
	const inGroupIds = samplelst.groups.find(g => g.name == 'group1')!.values.map(v => v.sampleId)
	test.equal(
		others.values.some(v => inGroupIds.includes(v.sampleId)),
		false,
		`should not put a sample in both groups`
	)

	const samplelst1 = getSamplelst()
	samplelst1.groups[0].values = []
	await model.getOtherSamples(samplelst1)
	test.deepEqual(
		samplelst1.groups[1].values.map(v => v.sampleId),
		[1, 2, 3, 4],
		`should add all filtered samples when the "in" group is empty`
	)

	const samplelst2 = getSamplelst()
	samplelst2.groups = samplelst2.groups.filter(g => g.in)
	const result = await model.getOtherSamples(samplelst2)
	test.equal(result, undefined, `should be a no-op when there is no "others" group`)

	test.end()
})
