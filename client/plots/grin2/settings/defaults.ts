/** CNV form fallbacks used when the dataset config does not supply ds-specific cutoffs. */
export const CNV_LOSS_THRESHOLD_FALLBACK = -0.4
export const CNV_GAIN_THRESHOLD_FALLBACK = 0.4
export const CNV_MAX_SEG_LENGTH_FALLBACK = 2_000_000

/** Default gene-overlap-fraction for the artifact-region mask: a gene is excluded when at least
 * this fraction of its span lies inside a selected blacklist region. The set of blacklist sources
 * (and whether the mask runs at all) comes from the per-source checkboxes, which are populated from
 * the genome's declared blacklists. */
export const EXCLUDE_OVERLAP_FRAC_FALLBACK = 0.5

export function getDefaultGRIN2Settings(opts: any) {
	const defaults = {
		manhattan: {
			// Core plot dimensions
			plotWidth: 1000,
			plotHeight: 400,
			pngDotRadius: 2,

			// Layout spacing
			yAxisX: 70,
			yAxisY: 40,
			yAxisSpace: 20,
			xAxisLabelPad: 30,
			yAxisPad: 5,
			axisColor: '#545454',
			showYAxisLine: true,

			// Typography
			fontSize: 12,

			// Legend settings
			showLegend: true,
			legendItemWidth: 80,
			legendDotRadius: 3,
			legendRightOffset: 15,
			legendTextOffset: 12,
			legendVerticalOffset: 4,
			legendFontSize: 12,

			// Interactive dots
			showInteractiveDots: true,
			interactiveDotRadius: 2,
			interactiveDotStrokeWidth: 1,

			// Download options
			showDownload: true,

			// Max genes to show in table, interactive dots cap, and tooltip genes
			maxGenesToShow: 500,
			interactiveDotsCap: 5000,
			maxTooltipGenes: 5,

			// Q-value threshold for significance indicators in the table, tooltips, and for determining which dots become interactive
			qValueThreshold: 0.05,

			// Colors for lesion types (currently used for table significance indicators. Long term will also be used for the rust code colors)
			lesionTypeColors: {
				mutation: '#44AA44', // green
				loss: '#4444FF', // blue
				gain: '#FF4444', // red
				fusion: '#FFA500', // orange
				sv: '#9932CC' // purple
			},

			// Threshold for the rust code when determining if we need to raise the cap value from the default
			maxCappedPoints: 5,

			// Bin size for cap calculations
			binSize: 10,

			// Hard cap regardless of data distribution
			hardCap: 200
		}
	}

	return Object.assign(defaults, opts?.overrides)
}
