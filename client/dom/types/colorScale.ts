import type { SvgG, SvgLine, SvgSvg, SvgText } from '../../types/d3'
import type { Selection } from 'd3-selection'
// import type { ScaleDiverging, ScaleLinear } from 'd3-scale'

export type ColorScaleOpts = {
	/** Optional but recommended. The height of the color bar in px. Default is 14. */
	barheight?: number
	/** Optional but recommended. The width of the color bar in px. Default is 100. */
	barwidth?: number
	/** Optional but highly recommend. Default is a white to red scale.
	 * The length of the array must match the domain array. */
	colors?: string[]
	/** Required. Specifies the values to show along a number line.
	 * The length must equal the colors array length.
	 */
	domain: number[]
	/** Optional. Font size in px of the text labels. Default is 10. */
	fontSize?: number
	/** Required. Either a div or svg element.
	 * If not a svg, include either the .width: INT or .height:INT to create the svg.*/
	holder: SvgSvg
	/** id for the linearGradiant elem */
	id?: string
	/** Optional. Shows a value in the color bar for the default, bottom axis
	 * This value cannot be zero at initialization.*/
	markedValue?: number
	/** Creates menu options to change the numeric values for the track/app/etc.
	 * 'Automatic' mode is the absolute min and max values provided to the data array
	 * 'Fixed' mode is the min and max values set by the user.
	 * 	Optional 'Percentile' mode is the cutoff set by the user.
	 */
	numericInputs?: NumericInputs
	/** Optional. Show a static text on either side of the color scale */
	labels?: {
		/** Label at the beginning of the scale, on the left */
		left: string
		/** Label at the end of the scale, on the right */
		right: string
	}
	/** Set the position within in the element. Default is 0,0 */
	position?: string
	/** If the holder is not an svg or g element, adding the width or height creates the svg. */
	/** Optional. Width of the svg. Default is 100. */
	width?: number
	/** Optional. Height fo the svg. Default is 30.*/
	height?: number
	/** If present, creates a menu on click to change the colors */
	setColorsCallback?: (val: string, idx: number) => void
	/** Avoids formating tick labels. Instead shows the domain values as is, without formating.
	 * If using this option, *** round the domain values in caller. *** Normal d3 rounding
	 * functions are disabled.
	 * Do not use with .ticks(). If .ticks() is provided it will be ignored. Default is false.*/
	showNumsAsIs: boolean
	/** Optional. Suggested number of ticks to show. Cannot be zero. Default is 5.
	 * NOTE: D3 considers this a ** suggested ** count. d3-axis will ultimateluy render the
	 * ticks based on the available space of each label.
	 * See d3 documentation for more info: https://d3js.org/d3-axis#axis_ticks.
	 */
	ticks?: number
	/** Optional. Size of the ticks in px. Default is 1. */
	tickSize?: number
	/** Optional. Placement of numbered ticks. Default is false (i.e. placement
	 * below the color bar). */
	topTicks?: boolean
}

export type ColorScaleDom = {
	/** Holder for the axis, and gradient */
	barG: SvgG
	/** color bar */
	gradient: GradientElem
	/** d3 scale */
	scale: any
	/** holder for the d3 scale */
	scaleAxis: SvgG
	/** Marked value label */
	label?: SvgText
	/** vertical line shown to indicate a marked value */
	line?: SvgLine
}

export type GradientElem = Selection<SVGLinearGradientElement, any, any, any>

export type ColorScaleMenuOpts = {
	scaleSvg: SvgSvg
	barG: SvgG
	colors: string[]
	cutoffMode?: CutoffMode
	domain: number[]
	percentile?: number
	setColorsCallback?: (val: string, idx: number) => void
	setNumbersCallback?: (f?: { cutoffMode: CutoffMode; min?: number; max?: number; percentile?: number }) => void
}

export type GetInterpolatedArg = {
	/** the absolute magnitude of the interpolation domain minimum value */
	absMin: number
	/** the absolute magnitude of the interpolation domain minimum value */
	absMax: number
	/** function to convert number to css color */
	negInterpolator: (a: number) => string
	/** function to convert number to css color */
	posInterpolator: (a: number) => string
	/**
	 * Optional color to insert between two interpolated color ranges,
	 * This can be used to generate a zero-centered divergent color bar
	 * with white in the middle.
	 * */
	middleColor?: string
	/** the target number of increments within the interpolation domain and range  */
	numSteps?: number
}

export type InterpolatedDomainRange = {
	values: number[]
	colors: string[]
}

export type CutoffMode = 'auto' | 'fixed' | 'percentile'

export type NumericInputs = {
	/** Default cutoff mode on init */
	cutoffMode: CutoffMode
	/** If default percentile value provided, 'Percentile' added to dropdown.
	 * Value is show by default. */
	defaultPercentile?: number
	/** Creates inputs for the user to set the min and max or use the percentile
	 *  Use the callback to update the plot/track/app/etc.
	 * 'Auto' mode is the absolute min and max values provided to the data array
	 * 'Fixed' mode is the min and max values set by the user.
	 * 'Percentile' mode is the cutoff set by the user.
	 */
	callback: (f?: {
		/** Which mode the user selected */
		cutoffMode: CutoffMode
		/** Returns the min and max for 'fixed' and 'auto' modes */
		min?: number
		/** Returns the min and max for 'fixed' and 'auto' modes */
		max?: number
		/** If percentile is enabled, return value */
		percentile?: number
	}) => void
}
