import { dt2lesion } from '#shared/common.js'
import { manhattanLayoutDefaults } from '#plots/manhattan/manhattan.ts'

/** CNV form fallbacks used when the dataset config does not supply ds-specific cutoffs. */
export const CNV_LOSS_THRESHOLD_FALLBACK = -0.4
export const CNV_GAIN_THRESHOLD_FALLBACK = 0.4
export const CNV_MAX_SEG_LENGTH_FALLBACK = 2_000_000

/** Hypermutator cutoffs: a sample with more than this many raw records for a data type is excluded from
 * that data type (0 disables). SNV/indel counts mutation burden (source-agnostic), so 8000 is a safe
 * default. CNV counts *segments*, which varies hugely by data source: sparse for GDC's categorical cnv
 * (~30/case) but hundreds-to-thousands for dense native segmentation — where a fixed 500 silently drops
 * whole-sample CNV (esp. aneuploid, gain-heavy samples). So CNV defaults OFF (opt-in); set it per-run when
 * the source warrants it. */
export const SNVINDEL_HYPERMUTATOR_FALLBACK = 8000
export const CNV_HYPERMUTATOR_FALLBACK = 0

/** How a dataset quantifies cnv values; declared at ds.queries.cnv.type. Mirrors CnvSegmentQuery in #types. */
export type CnvType = 'log2ratio' | 'segmean' | 'category' | 'copyNumber'

/** Per-type defaults and slider bounds for the GRIN2 CNV threshold controls.
 * - log2ratio/segmean: diploid baseline 0 (loss<0, gain>0)
 * - copyNumber: absolute integer copy number, diploid baseline 2 (loss<=1, gain>=3, neutral=2)
 * - category: qualitative gain/loss call, no numeric thresholds (controls hidden) */
export type CnvTypeConfig = {
	lossDefault: number
	gainDefault: number
	lossMin: number
	lossMax: number
	gainMin: number
	gainMax: number
	step: number
	/** when true, the gain/loss threshold rows are not shown (qualitative call) */
	hideThresholds: boolean
	/** appended to the threshold row labels to convey units */
	unitLabel: string
}

export const CNV_TYPE_CONFIG: Record<CnvType, CnvTypeConfig> = {
	log2ratio: {
		lossDefault: CNV_LOSS_THRESHOLD_FALLBACK,
		gainDefault: CNV_GAIN_THRESHOLD_FALLBACK,
		lossMin: -5,
		lossMax: 0,
		gainMin: 0,
		gainMax: 5,
		step: 0.05,
		hideThresholds: false,
		unitLabel: 'log2 ratio'
	},
	segmean: {
		lossDefault: CNV_LOSS_THRESHOLD_FALLBACK,
		gainDefault: CNV_GAIN_THRESHOLD_FALLBACK,
		lossMin: -5,
		lossMax: 0,
		gainMin: 0,
		gainMax: 5,
		step: 0.05,
		hideThresholds: false,
		unitLabel: 'segment mean'
	},
	copyNumber: {
		lossDefault: 1,
		gainDefault: 3,
		lossMin: 0,
		lossMax: 2,
		gainMin: 2,
		gainMax: 20,
		step: 1,
		hideThresholds: false,
		unitLabel: 'copy number'
	},
	category: {
		lossDefault: 0,
		gainDefault: 0,
		lossMin: 0,
		lossMax: 0,
		gainMin: 0,
		gainMax: 0,
		step: 1,
		hideThresholds: true,
		unitLabel: ''
	}
}

/** Default gene-overlap-fraction for the artifact-region mask: a gene is excluded when at least
 * this fraction of its span lies inside a selected blacklist region. The set of blacklist sources
 * (and whether the mask runs at all) comes from the per-source checkboxes, which are populated from
 * the genome's declared blacklists. */
export const EXCLUDE_OVERLAP_FRAC_FALLBACK = 0.5

export function getDefaultGRIN2Settings(opts: any) {
	const defaults = {
		manhattan: {
			/* The layout the Manhattan component draws by, from its own module rather than restated
			here: these 22 keys were a second copy, so a spacing tweak for one plot silently left
			the other rendering differently. GRIN2's own knobs follow. */
			...manhattanLayoutDefaults,

			// Max genes to show in table
			maxGenesToShow: 500,

			// Q-value threshold for significance indicators in the table, tooltips, and for determining which dots become interactive
			qValueThreshold: 0.05,

			// Colors for lesion types, derived from the shared dt2lesion source of truth so every data
			// type (incl. itd and any future dt) is covered without a parallel hardcoded list. Used for
			// table significance indicators and passed to the Manhattan renderer as dot colors.
			lesionTypeColors: Object.fromEntries(
				Object.values(dt2lesion).flatMap((d: any) => d.lesionTypes.map((lt: any) => [lt.lesionType, lt.color]))
			),

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
