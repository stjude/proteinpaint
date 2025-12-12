import type { BoxPlotSettings } from './Settings'
import { plotColor } from '#shared/common.js'

export function getDefaultBoxplotSettings(app, overrides = {}) {
	const defaults: BoxPlotSettings = {
		plotLength: 550,
		color: plotColor,
		displayMode: 'default',
		labelPad: 10,
		isLogScale: false,
		isVertical: false,
		orderByMedian: false,
		rowHeight: 50,
		rowSpace: 15,
		removeOutliers: false,
		showAssocTests: true
	}
	return Object.assign(defaults, overrides)
}
