export type Settings = {
	/** Sample size, represents the factor used to scale the sample */
	size: number
	/** Min sample size in pixels */
	minShapeSize: number
	/** Max sample size in pixels */
	maxShapeSize: number
	/** Resizes the dots based on the selected order */
	scaleDotOrder: 'Ascending' | 'Descending'
	/** Represents the area of the reference symbol in square pixels */
	refSize: number
	/** Width */
	svgw: number
	/** Height */
	svgh: number
	/** Depth */
	svgd: number
	/** In pixels */
	axisTitleFontSize: number
	/** Option to show/hide plot axes */
	showAxes: boolean
	/** Show reference samples */
	showRef: boolean
	/** Set the opacity of the elements */
	opacity: number
	/** Default color for the elements. Set to #ce768e by default */
	defaultColor: string
	regression: 'None' | 'Polynomial' | 'Lowess'
	/** Field of vision for 3D plots */
	fov: number
	/** Sample size for 2D large plots */
	threeSize: number
	/** Field of vision for 2D large plots */
	threeFOV: number
	// Color scale configuration settings
	// These settings control how numerical values are mapped to colors
	/** Default to automatic scaling based on data range
	 * Other options: 'fixed' (user-defined range) or
	 * 'percentile' (scale based on data distribution) */
	colorScaleMode: 'auto' | 'fixed' | 'percentile'
	/** Default percentile for percentile mode
	 * This means we'll scale colors based on values
	 * up to the 95th percentile by default */
	colorScalePercentile: number
	/** User-defined minimum value for fixed mode
	 * Null indicates this hasn't been set yet */
	colorScaleMinFixed: null | number
	/** User-defined maximum value for fixed mode
	 * Null indicates this hasn't been set yet */
	colorScaleMaxFixed: null | number
	//3D Plot settings
	/** Shows the density of point clouds.
	 * If 'Color' is used in continous mode,
	 * it uses it to weight the points when
	 * calculating the density contours. If
	 * 'Z/Divide by' is added in continous mode,
	 * it used it instead. */
	showContour: boolean
	/** maps contour density values to a sequential grayscale */
	colorContours: boolean
	/** Contour bandwidth in pixels
	 * This controls the smoothness of the contour lines.
	 * Smaller bandwidths produce sharper, detailed
	 * contours with many tight, jagged lines.
	 * Larger bandwidths produce smoother, more spread-out
	 * contours with fewer, broader rings. */
	contourBandwidth: number
	/** Contour thresholds in pixels
	 * Controls the density values at which the contour lines
	 * are drawn - where the slices are taken */
	contourThresholds: number
	/** Animation speed on render in ms */
	duration: number
	/** Use global, absolute min/max for all plots returned from route.
	 * If false, use absolute min/max for the current plot */
	useGlobalMinMax: boolean
	/** Option to save the zoom transformation in the state.
	 * Needed if you want to save a session with the actual
	 * zoom and pan applied */
	saveZoomTransform: boolean
	/** User defined min for X scale
	 * If none, null and use calculated value */
	minXScale: null | number
	/** User defined max for X scale
	 * If none, null and use calculated value */
	maxXScale: null | number
	/** User defined min for Y scale
	 * If none, null and use calculated value */
	minYScale: null | number
	/** User defined max for Y scale
	 * If none, null and use calculated value */
	maxYScale: null | number
	//Optional settings
	sampleCategory?: object[]
	aggregateData?: any
	excludeOutliers?: boolean
	showCumulativeFrequency?: number
}
