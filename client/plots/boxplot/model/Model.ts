import type { MassAppApi, MassState } from '#mass/types/mass'
import type { BoxPlotConfig } from '../BoxPlotTypes'
import type { TdbBoxplot } from '../BoxPlot.ts'
import type { BoxPlotResponse } from '#types'
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
		// Check if we're dealing with a numeric termCollection
		if (this.isNumericTermCollection()) {
			return await this.getDataForNumericTermCollection()
		}
		
		const boxPlotDataArgs = this.setRequestOpts()
		const data: BoxPlotResponse = await this.app.vocabApi.getBoxPlotData(
			boxPlotDataArgs,
			this.boxplot.api.getAbortSignal()
		)
		return data
	}

	/** Check if term is a numeric termCollection */
	isNumericTermCollection() {
		const t1 = this.config.term
		return t1?.term?.type === 'termCollection' && t1.term.memberType === 'numeric'
	}

	/** Get data for each member term in a numeric termCollection */
	async getDataForNumericTermCollection(): Promise<BoxPlotResponse> {
		const termCollection = this.config.term
		const memberTerms = termCollection.term.termlst || []
		
		if (!memberTerms.length) {
			throw new Error('No member terms found in numeric termCollection')
		}

		// Make a request for each member term
		const allResults = await Promise.all(
			memberTerms.map(async (memberTerm: any) => {
				// Create a term wrapper for this member term
				const memberTw = {
					term: memberTerm,
					q: { mode: 'continuous' as const }
				}
				
				const boxPlotDataArgs = {
					...this.setRequestOpts(),
					tw: memberTw
				}
				
				const data: BoxPlotResponse = await this.app.vocabApi.getBoxPlotData(
					boxPlotDataArgs,
					this.boxplot.api.getAbortSignal()
				)
				
				return { memberTerm, data }
			})
		)

		// Combine all results into a single response
		return this.combineNumericTermCollectionData(allResults, termCollection)
	}

	/** Combine data from multiple member terms into a single BoxPlotResponse */
	combineNumericTermCollectionData(results: any[], termCollection: any): BoxPlotResponse {
		// Find the overall min/max across all member terms
		let absMin = Number.POSITIVE_INFINITY
		let absMax = Number.NEGATIVE_INFINITY
		const combinedCharts: any = {}
		const allUncomputableValues: any[] = []

		// Use the first member term's descriptive stats as overall stats
		const descrStats = results[0]?.data.descrStats || {}

		results.forEach(({ memberTerm, data }) => {
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
			absMin: absMin === Number.POSITIVE_INFINITY ? undefined : absMin,
			absMax: absMax === Number.NEGATIVE_INFINITY ? undefined : absMax,
			bins: results[0]?.data.bins || {},
			charts: combinedCharts,
			descrStats,
			uncomputableValues: allUncomputableValues.length > 0 ? allUncomputableValues : null
		}
	}

	setRequestOpts() {
		const opts: { [index: string]: any } = {
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
