import type { FrequencyChartRequest, FrequencyChartResponse } from '#types'
import { RunChart2Model } from '../../runChart2/model/RunChart2Model.ts'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter'

interface FrequencyChartSeries {
	seriesId: string
	median: number
	points: any[]
}

function computeMedian(values: number[]): number {
	if (values.length === 0) return NaN
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export class FrequencyChart2Model extends RunChart2Model {
	async fetchData(config: any) {
		const state = this.runChart2.state

		if (!state.vocab.genome || !state.vocab.dslabel) {
			throw new Error('FrequencyChart2 requires genome and dslabel.')
		}

		if (!config.tw) {
			throw new Error('FrequencyChart2: config.tw is required')
		}

		// Use dedicated termdb/frequencyChart endpoint
		const body: FrequencyChartRequest = {
			genome: state.vocab.genome,
			dslabel: state.vocab.dslabel,
			filter: getNormalRoot(state.termfilter?.filter ?? undefined),
			coordTWs: [config.tw],
			chartType: 'frequencyChart2',
			embedder: 'localhost'
		}

		const result: FrequencyChartResponse = await dofetch3('termdb/frequencyChart', { body })

		if (result.error) throw new Error(`FrequencyChart2Model.fetchData() failed: ${result.error}`)

		if (!result.points || result.points.length === 0) {
			throw new Error('FrequencyChart2Model.fetchData() failed: No data points returned')
		}

		// Transform frequency chart response to internal format
		return this.transformFrequencyResponse(result.points, config)
	}

	/**
	 * Transform frequency chart API response to internal format
	 * Handles cumulative vs non-cumulative display
	 */
	private transformFrequencyResponse(points: any[], config: any): FrequencyChartSeries[] {
		const showCumulative = config.settings?.frequencyChart2?.showCumulativeFrequency !== false

		// Calculate cumulative counts if needed
		let cumulativeCount = 0
		const transformedPoints = points.map(point => {
			const monthCount = point.sampleCount || 0

			if (showCumulative) {
				cumulativeCount += monthCount
				return {
					x: point.x,
					xName: point.xName,
					y: cumulativeCount,
					sampleCount: monthCount
				}
			} else {
				return {
					x: point.x,
					xName: point.xName,
					y: monthCount,
					sampleCount: monthCount
				}
			}
		})

		// When not cumulative, Y values are per-period counts — compute median for reference line
		const median = showCumulative ? NaN : computeMedian(transformedPoints.map(p => p.y))

		return [
			{
				seriesId: 'frequency',
				median,
				points: transformedPoints
			}
		]
	}
}
