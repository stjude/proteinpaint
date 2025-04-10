export type SingleCellSettings = {
	/** Defines the radius of the dots. Default is 0.04 */
	dotSize: number
	/** Defines the opacity for the dots. Default is 0.8 */
	dotOpacity: number
	/** The height of each individual plot. Default is 600 */
	height: number
	/** Show a grid over the plot */
	showGrid: boolean
	startColor: SettingColor
	stopColor: SettingColor
	/** The width of each individual plot. Default is 600 */
	width: number
}

/** Reused data object for the plot colors */
type SettingColor = {
	/** index corresponds to a plot name. The value is the color */
	[index: string]: string
}
