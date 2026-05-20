import { ScatterModelBase } from './ScatterModelBase'
import type { Scatter } from '../scatter'
import { maxSvgSamplesCutoff, noExpColor, expColor } from '../settings/defaults'
import { rgb } from 'd3-color'
import type { TermdbSingleCellPlotsResponse } from '#types'

/** Some large scale single cell plots are server side rendered and
 * ported to the ScatterViewModel2DLarge.ts.
 *
 * TODO: Incorporate the plot filter in to the request. */

export class ScatterSingleCellModel extends ScatterModelBase {
	constructor(scatter: Scatter) {
		super(scatter)
	}

	getDataRequestOpts() {
		const c: any = this.scatter.config

		return {
			colorTW: c.colorTW,
			singleCellPlot: c.singleCellPlot,
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
