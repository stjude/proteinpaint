import tape from 'tape'
import { VolcanoModel } from '../model/VolcanoModel'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'
import { getSampleNum } from '../settings/defaults'

/* Tests:
    - setOthersGroup
    - setGroupSizes
*/

/** the filter of the app */
const appFilter = {
	type: 'tvslst',
	in: true,
	join: '',
	lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [{ key: '1' }] } }]
}

function getModel() {
	const plot = {
		app: {
			getState: () => ({ termfilter: { filter: appFilter } })
		},
		// mimics the plot-scoped vocabApi that PlotBase assigns
		vocabApi: {
			getFilteredSampleList: async () => {
				throw new Error('the model requests no sample list')
			}
		}
	}
	return new VolcanoModel(plot, tt.GENE_EXPRESSION)
}

/** samplelst.groups[].values[]={sampleId,sample} */
function getSamplelst(): any {
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

tape('setOthersGroup()', function (test) {
	const model = getModel()

	const samplelst = getSamplelst()
	model.setOthersGroup(samplelst)
	const [group1, others] = samplelst.groups
	test.equal(others.name, 'others', `should keep the name of the "others" group`)
	test.equal(others.in, true, `should set the "others" group to in=true`)
	test.equal(others.values, undefined, `should list no sample in the "others" group`)
	test.equal(others.filter.join, 'and', `should define the "others" group by a filter of two entries`)
	const [notListed, inApp] = others.filter.lst
	test.equal(notListed.tvs.isnot, true, `should exclude with the first entry`)
	test.deepEqual(
		Object.values(notListed.tvs.term.values).flatMap((v: any) => v.list.map(i => i.sampleId)),
		[1, 3],
		`should exclude the samples of the "in" group`
	)
	test.deepEqual(inApp, appFilter.lst[0], `should keep to the filter of the app with the second entry`)
	test.deepEqual(group1, getSamplelst().groups[0], `should not change the "in" group`)

	const samplelst2 = getSamplelst()
	samplelst2.groups = samplelst2.groups.filter(g => g.in)
	model.setOthersGroup(samplelst2)
	test.deepEqual(samplelst2.groups, [getSamplelst().groups[0]], `should be a no-op when there is no "others" group`)

	test.end()
})

tape('setGroupSizes()', function (test) {
	const model = getModel()
	const filter = { type: 'tvslst', in: true, join: '', lst: [] }
	model.config = {
		samplelst: {
			groups: [
				{ name: 'listed', in: true, values: [{ sampleId: 1 }] },
				{ name: 'by filter', in: true, filter }
			]
		}
	}
	model.setGroupSizes({ sample_size1: 9, sample_size2: 5 })
	test.equal(model.config.samplelst.groups[0].sampleCount, undefined, 'should leave a group that lists its samples')
	test.equal(model.config.samplelst.groups[1].sampleCount, 5, 'should give a group defined by a filter its size')
	model.setGroupSizes({ sample_size1: 9, sample_size2: 7 })
	test.equal(model.config.samplelst.groups[1].sampleCount, 5, 'should keep the size that a group carries')
	test.end()
})

tape('getSampleNum() counts the samples of groups that list them or that are defined by a filter', test => {
	const groups = [
		{ name: 'listed', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }] },
		{ name: 'by filter', in: true, filter: { type: 'tvslst', in: true, join: '', lst: [] }, sampleCount: 5 },
		{ name: 'by filter, no count', in: true, filter: { type: 'tvslst', in: true, join: '', lst: [] } }
	]
	test.equal(
		getSampleNum({ termType: 'geneExpression', samplelst: { groups } }),
		7,
		'should add the listed samples and the sample count of a group defined by a filter'
	)
	test.end()
})
