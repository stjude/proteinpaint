import type { SvgG } from '../../types/d3'

/** Types for #dom/DotSizeScale component */

/** Constructor opts */
export type DotSizeScaleOpts = {
	/** Holder */
	g: SvgG
	/** Upper limit user can input for size */
	inputMax: number
	/** Lower limit user can input for size */
	inputMin: number
	maxLabel?: number
	/** Default max radius in pixels or a scale */
	maxRadius: number
	/** If provided, renders a menu on click */
	menu?: {
		/** If provided, displays a prompt (e.g. pixels, scales, etc.)
		 * next to the min and max inputs*/
		minMaxLabel?: string
		/** If provided, an UI renderes to switch between an
		 * ascending and descending scale. */
		showOrder?: boolean
		/** Code executed when min, max, or order is changed */
		callback: (obj: { min: number; max: number; isAscending: boolean }) => void
	}
	minLabel?: number
	/** Default min radius in pixels or a scale */
	minRadius: number
	/** If provided, presents the user with the option
	 * to reverse the scale. */
	isAscending?: boolean
	/** If provided, displays a title above the
	 * the circle reference. */
	title?: string
	/** Center of the first circle in the holder. If not provided, it is where the circles and
	 * their labels fit, and at least 40. The title is at the origin of the holder, above the circles. */
	x?: number
	y?: number
}
