import type { Filter } from '../filter.ts'

/** A gain/loss threshold pair for one cnv value type. Both interpreted in that type's units
 * (log2 ratio baseline 0, or absolute copy number baseline 2). */
export type CnvThresholdPair = {
	lossThreshold: number
	gainThreshold: number
}

/** GRIN2 request */
export type GRIN2Request = {
	/** Genome build identifier (e.g., 'hg38', 'hg19') */
	genome: string

	/** Dataset label within the genome */
	dslabel: string

	/** Device pixel ratio for rendering */
	devicePixelRatio?: number

	/** Desired plot width in pixels (default: 1000) */
	width?: number

	/** Desired plot height in pixels (default: 400) */
	height?: number

	/** Radius of the PNG rendered dots (default: 2) */
	pngDotRadius?: number

	/** Lesion type colors */
	lesionTypeColors?: any

	/** Threshold for q-values to be included as interactive dots, have significance indicators in the table and tooltips */
	qValueThreshold?: number

	/** Log cutoff for Manhattan plot rendering before we scale the y-axis (default: 40).
	 * This is not user defined but rather a constant defined in #shared/manhattan.js.
	 * Sending it with request for consistency. In future we will allow user to set scale value or disable scaling if they wish */
	logCutoff?: number

	/** Maximum number of points to cap the dynamic y-axis in Manhattan plots */
	maxCappedPoints: number

	/** Absolute maximum cap for the y-axis in Manhattan plots regardless of its data distribution */
	hardCap: number

	/** Bin size for Manhattan plot histogram bin size. Used in the calculation of dynamic y-axis capping process (default: 10) */
	binSize: number

	/** pp filter */
	filter?: Filter

	/** GDC-backed datasets only: read-only GDC cohort filter, passed through to the GDC API as-is to
	 * select the cohort's cases. The run uses the same cohort→sample path as native datasets; per-case
	 * mutation data comes from the general getter ds.queries.singleSampleMutation.get(). */
	filter0?: any

	/** Options for filtering SNV/indel content: consequence types and an optional MAF filter. */
	snvindelOptions?: {
		/** Consequence types to include (pp mclass keys, as emitted by the shared GRIN2 UI). Only mutations
		 * whose class is listed are included; an empty array includes none (mirrors cnvOptions.cnvCategories).
		 * Absent (undefined) yields no snvindel lesions (the getter guards on it). */
		consequences?: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator?: number // Default: 1000
		/** MAF filter object (tvslst) to filter mutations by allele frequency / read depth, sourced from
		 * queries.snvindel.mafFilter (bcf-backed datasets that expose per-sample allelic depth). */
		mafFilter?: Filter
	}

	/** Options for filtering CNV file content. Threshold semantics depend on the dataset's
	 * cnv value type (ds.queries.cnv.type): 'log2ratio'/'segmean' use a diploid baseline of 0
	 * (defaults -0.4/0.4); 'copyNumber' uses absolute integer copy number, baseline 2 (e.g. loss<=1,
	 * gain>=3); 'category' is a qualitative gain/loss call and ignores these thresholds. The type is
	 * read server-side from ds config, so it is not part of this request. */
	cnvOptions?: {
		/** Flat loss threshold, used when the cohort has a single cnv value type. Interpreted per the
		 * entry's resolved type. Ignored for 'category'. Default: -0.4 (log2ratio/segmean) */
		lossThreshold?: number
		/** Flat gain threshold (see lossThreshold). Default: 0.4 (log2ratio/segmean) */
		gainThreshold?: number
		/** Per-value-type thresholds for cohorts that mix cnv quantifications (e.g. GDC segmean +
		 * copyNumber across cases). When an entry's resolved value type has an entry here, these
		 * thresholds override the flat lossThreshold/gainThreshold above. 'category' needs no
		 * thresholds and is intentionally absent. */
		byType?: {
			log2ratio?: CnvThresholdPair
			segmean?: CnvThresholdPair
			copyNumber?: CnvThresholdPair
		}
		/** Maximum segment length to include (0 = no filter) */
		maxSegLength?: number // Default: 0
		/** For categorical cnv (ds.queries.cnv.type='category', e.g. GDC), the set of cnv-segment classes
		 * (pp mclass keys: CNV_amp/CNV_amplification/CNV_loss/CNV_homozygous_deletion) to include, as chosen
		 * via the UI checkboxes. A segment whose class is not listed is dropped. Omit (undefined) to include
		 * every class; an empty array includes none. Ignored for numeric cnv types (gain/loss come from
		 * thresholds, not discrete classes). */
		cnvCategories?: string[]
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator?: number // Default: 500
		/** For datasets that expose multiple cnv file types (ds.queries.singleSampleMutation.cnvTypes),
		 * the id of the user-selected type. The server resolves this id to a source-specific data_type
		 * and a valueType, loads only the matching file, and classifies segments with that type's
		 * baseline. Omitted for single-type datasets, which classify by ds.queries.cnv.type. */
		cnvType?: string
	}

	/** Presence enables fusions in the analysis; no per-fusion filtering options yet */
	fusionOptions?: Record<string, never>

	/** Presence enables SVs in the analysis; no per-sv filtering options yet */
	svOptions?: Record<string, never>
	/** Artifact-region exclude mask applied before the GRIN2 statistics run: genes whose span lies
	 * >= overlapFrac inside the selected blacklist regions are dropped. Blacklist sources are
	 * declared per genome (Genome.blacklists) and selected here by name; their BED files are
	 * resolved server-side. Literature-backed (ENCODE/Kundaje blacklist, UCSC segdups, assembly
	 * gaps, DGV common germline CNVs). */
	excludeOptions?: {
		/** names of genome-declared blacklist sources to apply (match Genome.blacklists[].name);
		 * omitted = apply all declared sources; empty array = apply none */
		blacklists?: string[]
		/** drop a gene when >= this fraction of its span overlaps masked regions (default: 0.5) */
		overlapFrac?: number
	}

	maxGenesToShow?: number // Default: 500
}

/** Simple Interface to store the complex plot data from the rust Manhattan plot */
interface grin2PlotData {
	points: Array<{
		x: number // X-axis position (base pair/genomic position in the pixel space)
		y: number // Y-axis position (-log10(q-value) in the pixel space)
		color: string // Point color (hexadecimal string representing a color for mutation type)
		type: string // Mutation type (e.g., 'mutation', 'loss', 'gain', 'fusion', 'sv')
		gene: string // Gene symbol
		chrom: string // Chromosome in the form of <chrX>
		start: number // Starting position of this chromosome in base pairs/genomic coordinates. Used in hover table
		end: number // Ending position of this chromosome in base pairs/genomic coordinates
		pos: number // Mid-point of this chromosome in base pairs/genomic coordinates
		nsubj: number // Number of subjects with this mutation. Used for hover table subject count
	}>
	chrom_data: Record<
		// Data for chromosome labels and positioning on the x-axis
		string,
		{
			start: number
			size: number
			center: number
		}
	>
	total_genome_length: number // Gives us the full length of the genome so we can easily append x buffer space when building d3 x-axis
	has_capped_points: boolean // Whether we have capped the y-axis due to q-values exceeding the cap
}

/**
 * Response for GRIN2 analysis run
 */
export type GRIN2Response = {
	/** Status of the analysis */
	status: 'success' | 'error'
	/** Error message if status is 'error' */
	error?: string
	/** Programmatic error code when status='error' (e.g., 'CACHE_BUSY' for 429 backpressure) */
	code?: string
	/** Base64-encoded PNG Manhattan plot image */
	pngImg?: string
	/** Plot data for the Manhattan plot */
	plotData?: grin2PlotData
	/** Download status/info */
	download?: any
	/** Sortable table of top genes identified by GRIN2 */
	topGeneTable?: {
		/** Column definitions with labels and sort capabilities */
		columns: Array<{
			label: string
			sortable: boolean
		}>
		/** Data rows with gene information and statistics */
		rows: Array<
			Array<{
				value: string | number
			}>
		>
	}

	stats?: {
		lst: Array<{
			name: string
			rows: string[][]
		}>
	}

	/** True when the GRIN2 statistical analysis (Python step) was served from
	 * cache rather than recomputed. The Manhattan plot (Rust step) is always
	 * re-rendered because it depends on view params (width, height, colors). */
	fromCache?: boolean
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
