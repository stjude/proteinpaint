import type { SvgG } from '../../types/d3'

/** Types for #dom/LegendCircleReference component */

/** Constructor opts */
export type LegendCircleReferenceOpts = {
	/** Holder */
	g: SvgG
	/** Upper limit user can input for size */
	inputMax: number
	/** Lower limit user can input for size */
	inputMin: number
	/** Default max radius in pixels or a scale */
	maxRadius: number
	/** Default min radius in pixels or a scale */
	minRadius: number
	/** If provided, presents the user with the option
	 * to reverse the scale. */
	isAscending?: boolean
	/** Displays the kind of input, for example pixels
	 * or scale to the user. */
	minMaxLabel?: string
	/** If provided, displays a prompt to the user. */
	prompt?: string
	/** If provided, displays a title above the
	 * the circle reference. */
	title?: string
	/** If provided, an UI renderes to switch between an
	 * ascending and descending scale. */
	dotScaleCallback?: () => void
	/** Code executed when min or max is changed */
	minMaxCallback?: (min: number, max: number) => void
}
