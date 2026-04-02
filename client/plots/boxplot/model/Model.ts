import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotConfig } from '../BoxPlotTypes'
import type { TdbBoxplot } from '../BoxPlot.ts'
import type { ViolinBoxResponse, BoxPlotResponse } from '#types'
import { isErrorResponse, isBoxPlotResponse } from '#types'
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
		if (this.config.term.term.type == 'termCollection') {
			// special logic for termCollection
			// FIXME avoid special logic! handle termCollection just like all others
			return await this.getDataForNumericTermCollection()
		}

		const data: ViolinBoxResponse = await this.app.vocabApi.getViolinBox(
			this.setRequestOpts(),
			{},
			this.boxplot.api.getAbortSignal()
		)
		return data
	}

	/** Get data for each member term in a numeric termCollection 
	FIXME delete!!
	*/
	async getDataForNumericTermCollection(): Promise<BoxPlotResponse> {
		const termCollection = this.config.term
		const memberTerms = termCollection.term.termlst || []

		if (!memberTerms.length) {
			throw new Error('No member terms found in numeric termCollection')
		}

		// Make requests for member terms in bounded-size batches to limit concurrency
		const BATCH_SIZE = 5
		const allResults: { memberTerm: any; data: ViolinBoxResponse }[] = []

		for (let i = 0; i < memberTerms.length; i += BATCH_SIZE) {
			const batch = memberTerms.slice(i, i + BATCH_SIZE)
			const batchResults = await Promise.all(
				batch.map(async (memberTerm: any) => {
					// Create a term wrapper for this member term
					const memberTw = {
						term: memberTerm,
						q: { mode: 'continuous' as const }
					}

					const boxPlotDataArgs = {
						...this.setRequestOpts(),
						tw: memberTw
					}

					const data: ViolinBoxResponse = await this.app.vocabApi.getViolinBox(
						boxPlotDataArgs,
						{},
						this.boxplot.api.getAbortSignal()
					)

					return { memberTerm, data }
				})
			)
			allResults.push(...batchResults)
		}

		// Combine all results into a single response
		return this.combineNumericTermCollectionData(allResults, termCollection)
	}

	/** Combine data from multiple member terms into a single BoxPlotResponse */
	combineNumericTermCollectionData(results: any[], termCollection: any): BoxPlotResponse {
		// Find the overall min/max across all member terms
		let absMin = Infinity
		let absMax = -Infinity
		const combinedCharts: any = {}
		const allUncomputableValues: any[] = []

		results.forEach(({ memberTerm, data }) => {
			// Skip error responses
			if (isErrorResponse(data)) {
				console.warn(`Error response for term ${memberTerm.id}:`, data.error)
				return
			}
			
			// Only process BoxPlotResponse (not ViolinResponse)
			if (!isBoxPlotResponse(data)) {
				console.warn(`Unexpected response type for term ${memberTerm.id}`)
				return
			}

			if (data.absMin !== undefined && data.absMin < absMin) absMin = data.absMin
			if (data.absMax !== undefined && data.absMax > absMax) absMax = data.absMax

			// For each chart in this member term's data
			Object.entries(data.charts || {}).forEach(([chartId, chart]: [string, any]) => {
				if (!combinedCharts[chartId]) {
					combinedCharts[chartId] = {
						chartId,
						plots: [],
						sampleCount: 0,
						wilcoxon: chart.wilcoxon
					}
				}

				// Add this member term's plots to the combined chart
				// Update the label to include the member term name
				chart.plots.forEach((plot: any) => {
					const updatedPlot = {
						...plot,
						key: memberTerm.name || memberTerm.id,
						boxplot: {
							...plot.boxplot,
							label: memberTerm.name || memberTerm.id
						},
						// Use member term color if available from propsByTermId
						color: termCollection.term.propsByTermId?.[memberTerm.id]?.color || plot.color
					}
					combinedCharts[chartId].plots.push(updatedPlot)
				})

				combinedCharts[chartId].sampleCount += chart.sampleCount
			})

			// Collect uncomputable values
			if (data.uncomputableValues) {
				allUncomputableValues.push(...data.uncomputableValues)
			}
		})

		return {
			absMin: absMin === Infinity ? undefined : absMin,
			absMax: absMax === -Infinity ? undefined : absMax,
			bins: results[0]?.data.bins || {},
			charts: combinedCharts,
			uncomputableValues: allUncomputableValues.length > 0 ? allUncomputableValues : null,
			descrStats: {} as any // empty value needed per type def
		}
	}

	setRequestOpts() {
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
		if (this.config.term2)
			opts.overlayTw = this.getContinousTerm() == this.config.term ? this.config.term2 : this.config.term

		if (this.config.term0) opts.divideTw = this.config.term0

		return opts
	}

	getContinousTerm() {
		if (!this.config?.term2) return this.config.term
		return isNumericTerm(this.config.term.term) && this.config.term.q.mode == 'continuous'
			? this.config.term
			: this.config.term2
	}
}
