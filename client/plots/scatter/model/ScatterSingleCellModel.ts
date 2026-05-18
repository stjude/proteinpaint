import { ScatterModelBase } from './ScatterModelBase'
import type { Scatter } from '../scatter'
import { maxSvgSamplesCutoff, noExpColor, expColor } from '../settings/defaults'
import { rgb } from 'd3-color'
import type { TermdbSingleCellPlotsResponse } from '#types'

/** Some large scale single cell plots are server side rendered and
 * ported to the ScatterViewModel2DLarge.ts. */

export class ScatterSingleCellModel extends ScatterModelBase {
	constructor(scatter: Scatter) {
		super(scatter)
	}

	getDataRequestOpts() {
		const c: any = this.scatter.config

		return {
			...c,
			canvasSettings: {
				cutoff: maxSvgSamplesCutoff,
				width: this.scatter.settings.svgw,
				height: this.scatter.settings.svgh,
				radius: this.scatter.settings.size,
				minXScale: this.scatter.settings.minXScale,
				maxXScale: this.scatter.settings.maxXScale,
				minYScale: this.scatter.settings.minYScale,
				maxYScale: this.scatter.settings.maxYScale,
				noExpColor: rgb(noExpColor).toString(),
				expColor: rgb(expColor).toString(),
				opacity: this.scatter.settings.opacity
			}
		}
	}

	async initData() {
		try {
			const reqOpts = this.getDataRequestOpts()
			//To allow removing a term in the controls, though nothing is rendered (summary tab with violin active)
			if (reqOpts.coordTWs?.length == 1 && this.scatter.type == 'sampleScatter') return

			const data: TermdbSingleCellPlotsResponse = await this.scatter.app.vocabApi.getScatterSingleCellPlotData(
				reqOpts,
				this.scatter.api?.getAbortSignal()
			)

			if ('error' in data || !data.result) throw new Error(data['error'] || 'No data received')
			this.charts = []
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
