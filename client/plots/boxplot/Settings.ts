/** User controlled settings. Some settings are calculated based on
 * the number of boxplots */
export type BoxPlotSettings = {
	/** Length of the boxplots and scale, excluding labels */
	plotLength: number
	/** Default is common plot color.  */
	color: string
	/** Toggle between different display modes
	 * 'default': colored lines on white background
	 * 'filled': black lines with filled rects on white background
	 * 'dark': lighted colored lines on black background */
	displayMode: string
	/** Padding between the left hand label and boxplot */
	labelPad: number
	/** Toggle between a linear and log scale
	 * When true, renders a log scale. Default is false */
	isLogScale: boolean
	/** Toggle between vertical and horizontal orientation.
	 * The default is false */
	isVertical: boolean
	/** If true, order box plots from smallest to largest median value
	 * Default is by alphanumeric order or by bin
	 * May change this later to `orderBy` if more options arise */
	orderByMedian: boolean
	/** Height of individual boxplots */
	rowHeight: number
	/** Space between the boxplots */
	rowSpace: number
	/** If true, remove outliers from the analysis */
	removeOutliers: boolean
	/** If true, show association tests table */
	showAssocTests: boolean
}
