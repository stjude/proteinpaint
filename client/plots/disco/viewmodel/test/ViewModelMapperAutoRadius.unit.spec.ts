import test from 'tape'
import { ViewModelMapper } from '../ViewModelMapper'
import discoDefaults from '../../defaults'
import { dtsnvindel, dtcnv, dtloh } from '#shared/common.js'

/*
Tests:
	computeDynamicRadius returns correct radius for 1, 2, and 3 ring-type combinations
	Auto-radius path computes radius and scales settings accordingly
	Explicit radius is used when autoRadius is false
*/

// ───── computeDynamicRadius unit tests ─────

test('\n', function (t) {
	t.pass('-***- plots/disco/viewmodel/ViewModelMapper autoRadius -***-')
	t.end()
})

test('computeDynamicRadius returns 200 for SNV-only data (1 ring type)', t => {
	const data = [{ dt: dtsnvindel }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 200)
	t.end()
})

test('computeDynamicRadius returns 200 for CNV-only data (1 ring type)', t => {
	const data = [{ dt: dtcnv }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 200)
	t.end()
})

test('computeDynamicRadius returns 200 for LOH-only data (1 ring type)', t => {
	const data = [{ dt: dtloh }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 200)
	t.end()
})

test('computeDynamicRadius returns 200 for empty data', t => {
	t.equal(ViewModelMapper.computeDynamicRadius([]), 200)
	t.end()
})

test('computeDynamicRadius returns 250 for SNV + CNV data (2 ring types)', t => {
	const data = [{ dt: dtsnvindel }, { dt: dtcnv }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 250)
	t.end()
})

test('computeDynamicRadius returns 250 for SNV + LOH data (2 ring types)', t => {
	const data = [{ dt: dtsnvindel }, { dt: dtloh }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 250)
	t.end()
})

test('computeDynamicRadius returns 250 for CNV + LOH data (2 ring types)', t => {
	const data = [{ dt: dtcnv }, { dt: dtloh }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 250)
	t.end()
})

test('computeDynamicRadius returns 300 for SNV + CNV + LOH data (3 ring types)', t => {
	const data = [{ dt: dtsnvindel }, { dt: dtcnv }, { dt: dtloh }]
	t.equal(ViewModelMapper.computeDynamicRadius(data), 300)
	t.end()
})

// ───── Integration: auto-radius path through map() ─────

test('Auto-radius path computes radius=200 and scales settings for SNV-only data', t => {
	const settings = discoDefaults({ Disco: { autoRadius: true } })
	const baseLabel = settings.rings.labelLinesInnerRadius
	const mapper = new ViewModelMapper(structuredClone(settings as any), {} as any)

	const opts = {
		args: {
			genome: { majorchr: { chr1: 1000 }, geneset: [] },
			sampleName: 'Sample',
			data: [{ dt: dtsnvindel, chr: 'chr1', pos: 100, gene: 'TP53', mClass: 'M' }]
		}
	}

	const vm = mapper.map(opts)
	const expectedScale = 200 / baseLabel

	t.equal(
		vm.settings.rings.labelLinesInnerRadius,
		baseLabel * expectedScale,
		'labelLinesInnerRadius should be scaled using auto-computed radius 200'
	)
	t.equal(
		vm.settings.rings.labelsToLinesDistance,
		settings.rings.labelsToLinesDistance * expectedScale,
		'labelsToLinesDistance should be scaled using auto-computed radius 200'
	)
	t.end()
})

test('Auto-radius path computes radius=250 for two ring types', t => {
	const settings = discoDefaults({ Disco: { autoRadius: true } })
	const baseLabel = settings.rings.labelLinesInnerRadius
	const mapper = new ViewModelMapper(structuredClone(settings as any), {} as any)

	const opts = {
		args: {
			genome: { majorchr: { chr1: 1000 }, geneset: [] },
			sampleName: 'Sample',
			data: [
				{ dt: dtsnvindel, chr: 'chr1', pos: 100, gene: 'TP53', mClass: 'M' },
				{ dt: dtcnv, chr: 'chr1', start: 50, stop: 200, value: 2 }
			]
		}
	}

	const vm = mapper.map(opts)
	const expectedScale = 250 / baseLabel

	t.equal(
		vm.settings.rings.labelLinesInnerRadius,
		baseLabel * expectedScale,
		'labelLinesInnerRadius should be scaled using auto-computed radius 250'
	)
	t.end()
})

test('Auto-radius path computes radius=300 for three ring types', t => {
	const settings = discoDefaults({ Disco: { autoRadius: true } })
	const baseLabel = settings.rings.labelLinesInnerRadius
	const mapper = new ViewModelMapper(structuredClone(settings as any), {} as any)

	const opts = {
		args: {
			genome: { majorchr: { chr1: 1000 }, geneset: [] },
			sampleName: 'Sample',
			data: [
				{ dt: dtsnvindel, chr: 'chr1', pos: 100, gene: 'TP53', mClass: 'M' },
				{ dt: dtcnv, chr: 'chr1', start: 50, stop: 200, value: 2 },
				{ dt: dtloh, chr: 'chr1', start: 50, stop: 200, value: 0.5, segmean: 0.5 }
			]
		}
	}

	const vm = mapper.map(opts)
	const expectedScale = 300 / baseLabel

	t.equal(
		vm.settings.rings.labelLinesInnerRadius,
		baseLabel * expectedScale,
		'labelLinesInnerRadius should be scaled using auto-computed radius 300'
	)
	t.end()
})

test('Explicit radius is used when autoRadius is false', t => {
	const settings = discoDefaults({ Disco: { autoRadius: false, radius: 500 } })
	const baseLabel = settings.rings.labelLinesInnerRadius
	const mapper = new ViewModelMapper(structuredClone(settings as any), {} as any)

	const opts = {
		args: {
			genome: { majorchr: { chr1: 1000 }, geneset: [] },
			sampleName: 'Sample',
			data: [{ dt: dtsnvindel, chr: 'chr1', pos: 100, gene: 'TP53', mClass: 'M' }]
		}
	}

	const vm = mapper.map(opts)
	const expectedScale = 500 / baseLabel

	t.equal(
		vm.settings.rings.labelLinesInnerRadius,
		baseLabel * expectedScale,
		'labelLinesInnerRadius should be scaled using explicit radius 500, not auto-computed 200'
	)
	t.end()
})