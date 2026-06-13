import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotConfig } from '../BoxPlotTypes'
import type { TdbBoxplot } from '../BoxPlot.ts'
import type { ViolinBoxResponse } from '#types'
import { isNumericTerm } from '#shared/terms.js'
import type { BoxPlotSettings } from '../Settings.ts'

/**
 * Requests data for the boxplots.
 * Add more methods for formating the request opts and api requests.
 */
export class Model {
	boxplot: TdbBoxplot
	config: BoxPlotConfig
	state: MassState
	app: MassAppApi
	settings: BoxPlotSettings

	constructor(boxplot: TdbBoxplot, config: BoxPlotConfig) {
		this.boxplot = boxplot
		this.config = config
		this.state = boxplot.state
		this.app = boxplot.app
		this.settings = config.settings.boxplot
	}

	async getData() {
		const signal = this.boxplot.api.getAbortSignal()
		const data: ViolinBoxResponse = await this.app.vocabApi.getViolinBox(this.setRequestOpts(), {}, signal)
		// In violin mode, also fetch density bins via the same getViolinBox()
		// endpoint with plotType:'violin', then merge density into the boxplot
		// charts so the renderer can draw the violin shape around each box.
		// The server route is unchanged.
		if (this.settings.mode === 'violin' && data && !(data as any).error) {
			try {
				const violinData: any = await this.app.vocabApi.getViolinBox(this.setViolinRequestOpts(), {}, signal)
				if (violinData && !violinData.error) this.mergeDensity(data as any, violinData)
			} catch (e: any) {
				if (this.app.isAbortError && this.app.isAbortError(e)) throw e
				// if density fetch fails, continue rendering the box-only chart
				console.warn('boxplot violin-mode density fetch failed:', e?.message || e)
			}
		}
		return data
	}

	setRequestOpts() {
		const isNumericTC = this.config.term.term.type == 'termCollection' && this.config.term.term.memberType == 'numeric'
		const opts: { [index: string]: any } = {
			plotType: 'box',
			tw: this.getContinousTerm(),
			filter: this.state.termfilter.filter,
			filter0: this.state.termfilter.filter0,
			orderByMedian: this.settings.orderByMedian,
			isLogScale: this.settings.isLogScale,
			removeOutliers: this.settings.removeOutliers,
			showAssocTests: this.settings.showAssocTests
		}
		// Server creates a synthetic overlay for numeric termCollection,
		// so don't send term2/term0 — they would be overwritten
		if (!isNumericTC) {
			if (this.config.term2)
				opts.overlayTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term
			if (this.config.term0) opts.divideTw = this.config.term0
		}

		return opts
	}

	/** Build request opts for the violin density fetch in violin mode.
	 * Mirrors setRequestOpts() but sets plotType:'violin' and supplies the
	 * extra fields the violin route requires for its server-side canvas image
	 * generation (which we do not consume — only plot.density is used). */
	setViolinRequestOpts() {
		const boxOpts = this.setRequestOpts()
		const violinOpts: { [index: string]: any } = {
			...boxOpts,
			plotType: 'violin',
			// extra params required by ViolinRequest. Values mirror the violin
			// chart defaults; the server-rendered canvas image they drive is
			// not consumed by the boxplot renderer.
			svgw: 500,
			orientation: this.settings.isVertical ? 'vertical' : 'horizontal',
			devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
			datasymbol: 'rug',
			radius: 5,
			ticks: 20
		}
		// remove box-only fields that violin route does not use
		delete violinOpts.removeOutliers
		delete violinOpts.showAssocTests
		delete violinOpts.orderByMedian
		return violinOpts
	}

	/** Copy plot.density from the violin response into the matching box-plot
	 * entries by chartId + seriesId/label, so the boxplot view can render the
	 * violin shape around each box. */
	mergeDensity(boxData: any, violinData: any) {
		if (!boxData?.charts || !violinData?.charts) return
		for (const chartId of Object.keys(boxData.charts)) {
			const boxChart = boxData.charts[chartId]
			const violinChart = violinData.charts[chartId]
			if (!boxChart?.plots || !violinChart?.plots) continue
			for (const boxPlot of boxChart.plots) {
				const match = violinChart.plots.find(
					(vp: any) =>
						(boxPlot.seriesId !== undefined && vp.seriesId !== undefined && vp.seriesId === boxPlot.seriesId) ||
						vp.label === boxPlot.boxplot?.label ||
						vp.label === boxPlot.key
				)
				if (match?.density) boxPlot.density = match.density
			}
		}
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		// Numeric termCollection is always the primary continuous term
		if (this.config.term.term.type == 'termCollection' && this.config.term.term.memberType == 'numeric')
			return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}
}
