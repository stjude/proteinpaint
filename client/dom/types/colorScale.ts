import type { Elem, SvgG } from '../../types/d3'
import type { Selection } from 'd3-selection'
import type { ScaleLinear } from 'd3-scale'

export type ColorScaleOpts = {
	/** Optional but recommended. The height of the color bar in px. Default is 14. */
	barheight?: number
	/** Optional but recommended. The width of the color bar in px. Default is 100. */
	barwidth?: number
	/** Optional but highly recommend. Default is a white to red scale.
	 * The length of the array must match the data array. */
	colors?: string[]
	/** Specifies the default min and max mode if setMinMaxCallback is provided
	 * If 'auto', renders the default min and max set on init
	 * if 'fixed', renders the min and max set by the user.
	 */
	cutoffMode?: 'auto' | 'fixed'
	/** Required
	 * Specifies the values to show along a number line. Only pass the min and max.
	 * If the data spans negative and positive values, include zero in the array.
	 */
	data: number[]
	/** Optional. Font size in px of the text labels. Default is 10. */
	fontSize?: number
	/** Required. Either a div or svg element.
	 * If not a svg, include either the .width: INT or .height:INT to create the svg.*/
	holder: Elem
	/** id for the linearGradiant elem */
	id?: string
	/** Optional. Shows a value in the color bar for the default, bottom axis
	 * This value cannot be zero at initialization.*/
	markedValue?: number
	/** Set the position within in the element. Default is 0,0 */
	position?: string
	/** If the holder is not an svg or g element, adding the width or height creates the svg. */
	/** Optional. Width of the svg. Default is 100. */
	width?: number
	/** Optional. Height fo the svg. Default is 30.*/
	height?: number
	/** If present, creates a menu on click to change the colors */
	setColorsCallback?: (val: string, idx: number) => void
	/** Creates inputs for the user to set the min and max values
	 * Use the callback to update the plot/track/app/etc.
	 * 'Auto' mode is the absolute min and max values provided to the data array
	 * 'Fixed mode is the min and max values set by the user.
	 */
	setMinMaxCallback?: (f?: { cutoffMode: 'auto' | 'fixed'; min: number; max: number }) => void
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
	gradient: GradientElem
	scale: ScaleLinear<number, number, never>
	scaleAxis: SvgG
	/** Present when important value is indicated in opts */
	//TODO: Replace with d3 type when merged
	label?: Selection<SVGTextElement, any, any, any>
	line?: Selection<SVGLineElement, any, any, any>
}

export type GradientElem = Selection<SVGLinearGradientElement, any, any, any>
