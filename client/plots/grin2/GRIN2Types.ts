import type { Menu } from '#dom'
import type { ManhattanPoint } from '#plots/manhattan/manhattanTypes.ts'

export interface GRIN2Dom {
	controls: any
	div: any
	tip: Menu
	geneTip: Menu
	header?: any
	snvindelCheckbox: any | null
	cnvCheckbox: any | null
	fusionCheckbox: any | null
	svCheckbox: any | null
	runButton: any | null
	snvindel_minTotalDepth?: any | null
	snvindel_minAltAlleleCount?: any
	snvindel_consequences?: any
	snvindel_five_prime_flank_size?: any
	snvindel_three_prime_flank_size?: any
	cnv_lossThreshold?: any
	cnv_gainThreshold?: any
	cnv_maxSegLength?: any
	cnv_five_prime_flank_size?: any
	cnv_three_prime_flank_size?: any
	fusion_five_prime_flank_size?: any
	fusion_three_prime_flank_size?: any
	sv_five_prime_flank_size?: any
	sv_three_prime_flank_size?: any
	consequenceCheckboxes: Record<string, any | null>
	snvindelSelectAllBtn?: any | null
	snvindelClearAllBtn?: any | null
	snvindelDefaultBtn?: any | null
}

export interface GRIN2Opts {
	/** Manhattan plot settings */
	plotWidth?: number
	plotHeight?: number
	pngDotRadius?: number
	yAxisX?: number
	yAxisY?: number
	yAxisSpace?: number
	fontSize?: number
	showLegend?: boolean
	legendItemWidth?: number
	legendDotRadius?: number
	legendRightOffset?: number
	legendTextOffset?: number
	legendVerticalOffset?: number
	legendFontSize?: number
	showInteractiveDots?: boolean
	interactiveDotRadius?: number
	interactiveDotStrokeWidth?: number
	showDownload?: boolean
	/** Override default settings */
	overrides?: Partial<GRIN2Settings>
	/** Any additional options */
	[key: string]: any
}

export interface GRIN2Settings {
	/** Options for filtering SNV/indel file content */
	snvindelOptions: {
		/** Minimum total depth of returned SNV/indel files */
		minTotalDepth: number
		/** Minimum alternate allele count of returned SNV/indel files */
		minAltAlleleCount: number
		/** String array of consequence types to include */
		consequences: string[]
		/** Maximum mutation count cutoff for highly mutated scenarios */
		hyperMutator: number
	}

	/** Options for filtering CNV file content */
	cnvOptions: {
		/** Threshold for copy number loss detection */
		lossThreshold: number
		/** Threshold for copy number gain detection */
		gainThreshold: number
		/** Maximum segment length to include (0 = no filter) */
		maxSegLength: number
		/** Hypermutator max cut off for CNVs per case */
		hyperMutator: number
	}

	/** Options for filtering fusion file content (optional). For now we won't have any options */
	fusionOptions?: {
		[key: string]: any
	}
	/** Options for filtering structural variant file content (optional). For now we won't have any options */
	svOptions?: {
		[key: string]: any
	}
	/** Options for general GRIN2 settings (optional) */
	generalOptions?: {
		[key: string]: any
	}
}
/** A row from the top genes table where the first cell contains the gene name */
export type GeneTableRow = Array<{ value?: string; [key: string]: any }>

/** Data item for gene selection tracking - either a ManhattanPoint or a table row */
export type GeneDataItem = ManhattanPoint | GeneTableRow

/**
 * Options for showGrin2ResultTable
 */
export interface ShowGrin2ResultTableOpts {
	/** Div selection where the table will be rendered */
	tableDiv: any
	/** Array of ManhattanPoint gene results (used when columns/rows not provided) */
	hits?: ManhattanPoint[]
	/** Div where Matrix/Lollipop plots will be shown */
	newPlotDiv?: any
	/** App context for dispatching Matrix/Lollipop actions */
	app?: any
	/** Menu instance to hide on button actions */
	clickMenu?: any
	/** Pre-built columns (for top genes table). If not provided, builds from hits. */
	columns?: any[]
	/** Pre-built rows (for top genes table). If not provided, builds from hits. */
	rows?: any[]
	/** Original data items for button callbacks and selection tracking. Defaults to hits. */
	dataItems?: any[]
	/** Function to extract gene name from a data item. Defaults to (item) => item.gene */
	getGene?: (item: any) => string
	/** Format for matrix button text. Use {n} as placeholder for count. Defaults to "Matrix ({n})" */
	matrixButtonFormat?: string
	/** Additional options passed directly to renderTable */
	[key: string]: any
}
