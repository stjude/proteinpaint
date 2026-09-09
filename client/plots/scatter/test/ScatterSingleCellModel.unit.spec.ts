import tape from 'tape'
import { ScatterSingleCellModel } from '../model/ScatterSingleCellModel.ts'
import { getMockSingleCellScatter } from './mockScatterData.ts'

tape('\n', function (test) {
	test.comment('-***- plots/scatter/model/ScatterSingleCellModel -***-')
	test.end()
})

tape('getDataRequestOpts builds the single-cell request payload', function (test) {
	test.timeoutAfter(100)
	const scatter: any = getMockSingleCellScatter()
	const model = new ScatterSingleCellModel(scatter)
	const opts: any = model.getDataRequestOpts()

	test.deepEqual(opts.coordTWs, [scatter.config.term, scatter.config.term2], 'Should pass both coordinate term wrappers.')
	test.equal(opts.colorTW, scatter.config.colorTW, 'Should include the color term wrapper.')
	test.deepEqual(opts.filter, scatter.state.termfilter.filter, 'Should include the current term filter.')
	test.deepEqual(opts.filter0, scatter.state.termfilter.filter0, 'Should include the baseline filter.')
	test.equal(opts.singleCellPlot, scatter.config.singleCellPlot, 'Should include the single-cell plot definition.')
	test.equal(opts.canvasSettings.width, scatter.settings.svgw, 'Should include the SVG width.')
	test.equal(opts.canvasSettings.height, scatter.settings.svgh, 'Should include the SVG height.')
	test.equal(opts.canvasSettings.radius, scatter.settings.size, 'Should include the marker radius.')
	test.equal(opts.canvasSettings.startColor, scatter.config.startColor.Default, 'Should include the default gradient start color.')
	test.equal(opts.canvasSettings.stopColor, scatter.config.stopColor.Default, 'Should include the default gradient stop color.')
	test.equal(opts.canvasSettings.devicePixelRatio, window.devicePixelRatio || 1, 'Should honor the browser device pixel ratio.')
	test.end()
})
