import test from 'tape'
import { ViewModelMapper } from '../ViewModelMapper'
import discoDefaults from '../../defaults'

/*
Tests:
ViewModelMapper scales plot diameter dimensions using the radius setting while keeping ring widths and font sizes fixed
*/

const settings = discoDefaults({ Disco: { autoRadius: false, radius: 500 } })
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

test('ViewModelMapper.applyRadius adjusts diameter settings while preserving widths and font sizes', t => {
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
		settings.rings.chromosomeWidth,
		'Should keep chromosomeWidth fixed when radius changes'
	)

	t.equal(
		vmSettings.rings.nonExonicRingWidth,
		settings.rings.nonExonicRingWidth,
		'Should keep nonExonicRingWidth fixed when radius changes'
	)

	t.equal(
		vmSettings.rings.snvRingWidth,
		settings.rings.snvRingWidth,
		'Should keep snvRingWidth fixed when radius changes'
	)

	t.equal(
		vmSettings.rings.lohRingWidth,
		settings.rings.lohRingWidth,
		'Should keep lohRingWidth fixed when radius changes'
	)

	t.equal(
		vmSettings.rings.cnvRingWidth,
		settings.rings.cnvRingWidth,
		'Should keep cnvRingWidth fixed when radius changes'
	)

	t.equal(
		vmSettings.rings.mutationWaterfallRingWidth,
		settings.rings.mutationWaterfallRingWidth,
		'Should keep mutationWaterfallRingWidth fixed when radius changes'
	)

	t.equal(vmSettings.label.fontSize, settings.label.fontSize, 'Should keep label font size fixed when radius changes')

	t.equal(
		vmSettings.legend.fontSize,
		settings.legend.fontSize,
		'Should keep legend font size fixed when radius changes'
	)

	t.end()
})
