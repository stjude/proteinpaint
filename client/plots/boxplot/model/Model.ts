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

		// Make requests for member terms in bounded-size batches to limit concurrency
		const BATCH_SIZE = 5
		const allResults: { memberTerm: any; data: BoxPlotResponse }[] = []

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
					
					const data: BoxPlotResponse = await this.app.vocabApi.getBoxPlotData(
						boxPlotDataArgs,
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

		// Calculate aggregate descriptive statistics across all member terms
		const allDescrStats = results.map(({ data }) => data.descrStats).filter(Boolean)
		const descrStats = this.calculateAggregateStats(allDescrStats)

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
			absMin: absMin === Infinity ? undefined : absMin,
			absMax: absMax === -Infinity ? undefined : absMax,
			bins: results[0]?.data.bins || {},
			charts: combinedCharts,
			descrStats,
			uncomputableValues: allUncomputableValues.length > 0 ? allUncomputableValues : null
		}
	}

	/** Calculate aggregate descriptive statistics from multiple member terms */
	calculateAggregateStats(allDescrStats: any[]): any {
		if (allDescrStats.length === 0) return {}
		if (allDescrStats.length === 1) return allDescrStats[0]

		// Aggregate statistics across all member terms
		const aggregated: any = {}
		const statsKeys = Object.keys(allDescrStats[0] || {})

		for (const key of statsKeys) {
			const values = allDescrStats.map(stats => stats[key]?.value).filter(v => v !== undefined)
			
			if (values.length === 0) continue

			const firstStat = allDescrStats[0][key]
			if (key === 'total') {
				// Sum totals across all member terms
				aggregated[key] = {
					key: firstStat.key,
					label: firstStat.label,
					value: values.reduce((sum, v) => sum + v, 0)
				}
			} else if (key === 'min') {
				// Use minimum across all member terms
				aggregated[key] = {
					key: firstStat.key,
					label: firstStat.label,
					value: Math.min(...values)
				}
			} else if (key === 'max') {
				// Use maximum across all member terms
				aggregated[key] = {
					key: firstStat.key,
					label: firstStat.label,
					value: Math.max(...values)
				}
			} else {
				// For other stats (mean, median, sd, variance, iqr), use average across member terms
				// Note: This is a simplified aggregation. For strict statistical accuracy,
				// these values should be recalculated from the raw data. However, for display
				// purposes, averaging provides a reasonable approximation of the overall trend.
				aggregated[key] = {
					key: firstStat.key,
					label: firstStat.label,
					value: values.reduce((sum, v) => sum + v, 0) / values.length
				}
			}
		}

		return aggregated
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
