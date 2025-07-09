import test from 'tape'
import { ViewModelMapper } from '../ViewModelMapper'
import discoDefaults from '../../defaults'

/*
Tests:
ViewModelMapper scales rings and dimensions using the radius setting
*/

const settings = discoDefaults({ Disco: { radius: 500 } })
const mapper = new ViewModelMapper(structuredClone(settings as any), {} as any)

const opts = {
	args: {
		chromosomes: undefined,
		genome: { majorchr: { chr1: 1000 }, geneset: [] },
		sampleName: 'Sample',
		data: []
	}
}

const viewModel = mapper.map(opts)

test('\n', function (t) {
	t.pass('-***- plots/disco/viewmodel/ViewModelMapper -***-')
	t.end()
})

test('ViewModelMapper.applyRadius adjusts settings and ViewModel dimensions', t => {
	const vmSettings = viewModel.settings
	const scale = settings.Disco.radius! / settings.rings.labelLinesInnerRadius

	function timesScale(value: number) {
		return value * scale
	}

	t.equal(
		vmSettings.rings.labelLinesInnerRadius,
		timesScale(settings.rings.labelLinesInnerRadius),
		'Should calculate labelLinesInnerRadius based on radius setting'
	)

	t.equal(
		vmSettings.rings.labelsToLinesDistance,
		timesScale(settings.rings.labelsToLinesDistance),
		'Should calculate labelsToLinesDistance based on radius setting'
	)

	t.equal(
		vmSettings.rings.chromosomeInnerRadius,
		timesScale(settings.rings.chromosomeInnerRadius),
		'Should calculate chromosomeInnerRadius based on radius setting'
	)

	t.equal(
		vmSettings.rings.chromosomeWidth,
		timesScale(settings.rings.chromosomeWidth),
		'Should calculate chromosomeWidth based on radius setting'
	)

	t.equal(
		vmSettings.rings.nonExonicRingWidth,
		timesScale(settings.rings.nonExonicRingWidth),
		'Should calculate nonExonicRingWidth based on radius setting'
	)

	t.equal(
		vmSettings.rings.snvRingWidth,
		timesScale(settings.rings.snvRingWidth),
		'Should calculate snvRingWidth based on radius setting'
	)

	t.equal(
		vmSettings.rings.lohRingWidth,
		timesScale(settings.rings.lohRingWidth),
		'Should calculate lohRingWidth based on radius setting'
	)

	t.equal(
		vmSettings.rings.cnvRingWidth,
		timesScale(settings.rings.cnvRingWidth),
		'Should calculate cnvRingWidth based on radius setting'
	)

	t.equal(
		vmSettings.label.fontSize,
		timesScale(settings.label.fontSize),
		'Should calculate label font size based on radius setting'
	)

	t.equal(
		vmSettings.legend.fontSize,
		timesScale(settings.legend.fontSize),
		'Should calculate legend font size based on radius setting'
	)

	t.end()
})
