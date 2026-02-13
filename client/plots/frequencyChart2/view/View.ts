import { RunChart2View } from '../../runChart2/view/View.ts'
import { FrequencyChart2SeriesRender } from './FrequencyChart2SeriesRender.ts'
import type { FrequencyChart2Settings } from '../Settings'

/**
 * FrequencyChart2View extends RunChart2View
 *
 * The view inherits all rendering logic from RunChart2View since both charts
 * visualize time-series data with points and lines. The key difference is in
 * the data preparation (handled by FrequencyChart2Model), which groups samples
 * by month and calculates cumulative or non-cumulative frequencies.
 */
export class FrequencyChart2View extends RunChart2View {
	settings: FrequencyChart2Settings

	constructor(viewData: any, settings: FrequencyChart2Settings, holder: any, config?: any, frequencyChart2?: any) {
		super(viewData, settings, holder, config, frequencyChart2)
		this.settings = settings
	}

	getSeriesRenderClass() {
		return FrequencyChart2SeriesRender
	}

	/** Y-axis is always a computed count (per period or cumulative), not the date term. */
	getYAxisLabel(): string {
		return this.settings.showCumulativeFrequency ? 'Cumulative count' : 'Count'
	}
}
