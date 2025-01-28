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
	/** If provided, renders a menu on click */
	menu: {
		/** If provided, displays a prompt (e.g. pixels, scales, etc.)
		 * next to the min and max inputs*/
		minMaxLabel: string
		/** If provided, an UI renderes to switch between an
		 * ascending and descending scale. */
		showOrder: boolean
		/** Code executed when min, max, or order is changed */
		callback: (obj: { min: number; max: number; isAscending: boolean }) => void
	}
	/** Default min radius in pixels or a scale */
	minRadius: number
	/** If provided, presents the user with the option
	 * to reverse the scale. */
	isAscending?: boolean
	/** If provided, displays a title above the
	 * the circle reference. */
	title?: string
}
