import type { Settings } from './Settings.js'
import { plotColor } from '#shared/common.js'

export function getDefaultScatterSettings(opts: any = {}): Settings {
	const overrides = opts?.overrides || {}
	const defaults: Settings = {
		size: 0.8,
		minShapeSize: 0.5,
		maxShapeSize: 4,
		scaleDotOrder: 'Ascending',
		refSize: 0.8,
		svgw: 600,
		svgh: 600,
		svgd: 600,
		axisTitleFontSize: 16,
		showAxes: true,
		showRef: true,
		opacity: 0.6,
		defaultColor: plotColor,
		regression: 'None',
		fov: 50,
		threeSize: 0.005,
		threeFOV: 70,
		//ColorScale settings
		colorScaleMode: 'auto',
		colorScalePercentile: 95,
		colorScaleMinFixed: null,
		colorScaleMaxFixed: null,
		//3D Plot settings
		showContour: false,
		colorContours: false,
		contourBandwidth: 30,
		contourThresholds: 10,
		duration: 500,
		useGlobalMinMax: true,
		saveZoomTransform: false,
		// Axis scale settings
		minXScale: null,
		maxXScale: null,
		minYScale: null,
		maxYScale: null,
		itemLabel: opts?.singleCellPlot ? 'Cell' : 'Sample'
	}

	return Object.assign(defaults, overrides)
}
