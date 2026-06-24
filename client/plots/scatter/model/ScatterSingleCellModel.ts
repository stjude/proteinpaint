import { ScatterModelBase } from './ScatterModelBase'
import type { Scatter } from '../scatter'
import { maxSvgSamplesCutoff, noExpColor, expColor } from '../settings/defaults'
import { rgb } from 'd3-color'
import type { TermdbSingleCellPlotsResponse } from '#types'

/** Some large scale single cell plots are server side rendered and
 * ported to the ScatterViewModel2DLarge.ts.*/

export class ScatterSingleCellModel extends ScatterModelBase {
	constructor(scatter: Scatter) {
		super(scatter)
	}

	getDataRequestOpts() {
		const c: any = this.scatter.config
		const state = this.scatter.state

		/** SCGE terms may be applied as term/term2 from the summary plot.
		 * Capture as coordTWs[] to pass to the server for the single cell plot data request. */
		const coordTWs: any = []
		if (c.term) coordTWs.push(c.term)
		if (c.term2) coordTWs.push(c.term2)

		return {
			colorTW: c.colorTW,
			coordTWs,
			singleCellPlot: c.singleCellPlot,
			filter: state.termfilter.filter,
			filter0: state.termfilter.filter0,
			canvasSettings: {
				cutoff: maxSvgSamplesCutoff,
				width: this.scatter.settings.svgw,
				height: this.scatter.settings.svgh,
				radius: this.scatter.settings.size,
				minXScale: this.scatter.settings.minXScale,
				maxXScale: this.scatter.settings.maxXScale,
				minYScale: this.scatter.settings.minYScale,
				maxYScale: this.scatter.settings.maxYScale,
				startColor: c.startColor?.['Default'] || rgb(noExpColor).toString(),
				stopColor: c.stopColor?.['Default'] || rgb(expColor).toString(),
				opacity: this.scatter.settings.opacity,
				devicePixelRatio: window.devicePixelRatio || 1
			}
		}
	}

	async initData() {
		try {
			const reqOpts = this.getDataRequestOpts()

			const data: TermdbSingleCellPlotsResponse = await this.scatter.app.vocabApi.getScatterSingleCellPlotData(
				reqOpts,
				this.scatter.api?.getAbortSignal()
			)

			if ('error' in data || !data.result) throw new Error(data['error'] || 'No data received')

			this.charts = []
			/** There should only be one chart */
			this.createChart('Default', data.result.Default)
			this.range = data.range
			this.initRanges()
		} catch (e: any) {
			if (this.scatter.app.isAbortError(e)) return
			console.error(e)
			throw new Error(e.message || e)
		}
	}
}
