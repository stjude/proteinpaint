import tape from 'tape'
import { VolcanoModel } from '../model/VolcanoModel'
import { DATermTypes as tt } from '../../diffAnalysis/enabledTermTypes'

/* Tests:
    - getOtherSamples
    - getVolcanoRender: which column the renderer is pointed at
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

tape('getVolcanoRender: a corrected scan is rendered on the excess column', test => {
	/* The renderer reads the x coordinate, the threshold, the up/down counts and the
	significant-row selection off ONE field, so which field is named here decides all four. A
	corrected scan has to name the excess: with raw delta-beta the cutoff gated the directions
	unequally -- at a +0.09 drift a hyper row cleared |Δβ| > 0.1 on an excess of +0.01 while a
	hypo row needed an excess of -0.19 for the same bar. */
	const model = new VolcanoModel({ app: { getState: () => ({ termfilter: { filter: {} } }) } }, tt.DNA_METHYLATION)
	const base = {
		width: 400,
		height: 400,
		pValue: 2,
		pValueType: 'adjusted',
		foldChangeCutoff: 1,
		deltaBetaCutoff: 0.1,
		xAxis: 'delta_beta',
		defaultSignColor: 'red',
		defaultNonSignColor: 'black',
		maxInteractiveDots: 1000,
		centerDeltaBeta: true
	}
	model.config = { samplelst: { groups: [{ name: 'a' }, { name: 'b' }] } }

	model.settings = { ...base, elementType: 'dmr_scan', backgroundCorrection: true }
	const corrected = model.getVolcanoRender()
	test.equal(corrected.xField, 'excess', 'corrected: the renderer is pointed at the excess column')
	test.equal(corrected.significanceThresholds.foldChangeCutoff, 0.1, 'and the cutoff travels in excess units')
	/* Excess is already the stratum's drift subtracted. Recentring it on its own median would
	subtract a shift that is no longer in the number. */
	test.notOk(corrected.centerX, 'and centring is not applied on top of the correction')

	model.settings = { ...base, elementType: 'dmr_scan', backgroundCorrection: false }
	const plain = model.getVolcanoRender()
	test.equal(plain.xField, 'delta_beta', 'uncorrected: the raw delta-beta column')
	test.ok(plain.centerX, 'and centring is still available there')

	model.settings = { ...base, elementType: 'dmr_scan', backgroundCorrection: true, xAxis: 'fold_change' }
	test.equal(model.getVolcanoRender().xField, undefined, 'off the delta-beta axis no field is named at all')

	test.end()
})
