/** This file contains type definitions for runpp arguments.
 *
 * *** The types are not complete as of yet!! ***
 *
 * Note: Not all the types are available in this file, nor are
 * the applicable types used in ts files. Most of the legacy code
 * is in js. This file is for documentation and clarity.
 */

/** Total possible runproteinpaint arguments */
export type RunppArgs = CommonBlockLevelArgs & OtherBlockLevelArgs & DeprecatedBlockLevelArgs & UnkBlockLevelArgs
/** 'Block level' means applies to the entire application. Tracks and apps are initialized at this level. */

/** These common arguments in runproteinpaint().*/
type CommonBlockLevelArgs = {
	/** proteinpaint server URL */
	host: string
	/** HTML div id where the application will be rendered */
	holder: string
	/** When true displays the genome browser */
	block?: boolean
	/** If true, the page will parse a query string from the URL.*/
	parseurl?: boolean
	/** If true, the header with the logo, omnisearch, buttons, and server info
	 * are hidden. This is useful for embedding the application in another webpage.*/
	noheader?: boolean
	/** If true, will not render proteinpaint within a sandbox */
	nobox?: boolean
	/** genome name (e.g. hg19, hg38, etc. ). .genome may not be required if
	 * defined under the app specific arguments (e.g. arg.fusioneditor.genome)*/
	genome?: string
	/** When provided along with block == true, displays the specified position
	 * in the genome browser. Cannot be used with arg,gene */
	position?: string
	/** When provided lanuches the protein view. May use either the gene name or
	 * isform. Cannot be used with arg,position. */
	gene?: string
	/** When provided, shows the reference track along side the view and tracks.
	 * Possible optsions are "refseq", "ensembl", "gencode" */
	nativeTracks?: string[] | string
	commonOverrides?: CommonOverrides
	mclassOverride?: MClassOverride
	tracks?: TrackEntry[]
}

/** In use arguments for launching apps or application configuration. */
type OtherBlockLevelArgs = {
	/** Sets the minimum z-index for new panes (see client/src/client) */
	base_zindex?: number
	/** Show data from an offical ds */
	dataset?: string
	/** Inits the mass disco plot */
	disco?: DiscoPlot
	/** Inits the mds fimo app */
	fimo?: Fimo
	/** Inits the fusion editor app */
	fusioneditor?: FusionEditor
	gene2canonicalisoform?: any
	/** Set custom gene domains with default domains */
	geneDomains?: GeneDomains
	/** Inits the gene fusion svg graph */
	genefusion?: GeneFusion
	/** Set the view mode when using arg.gene. Does not work with arg.position! */
	gmmode?: 'protein' | 'exon only' | 'splicing RNA' | 'genomic'
	/** Highlight amino acid changes */
	hlaachange?: HighlightAAChangeEntry[]
	/** Highlight regions by genomic position (e.g. ["chr17:7575049-7576692","chr17:7578987-7580630"]) */
	hlregions?: string[]
	/** Highlight variants */
	hlvariants?: HighlightVariantEntry[]
	/** Inits the Hi-C app, ** not ** the track. */
	hic?: HicApp
	/** Inits the junction by matrix app */
	junctionbymatrix?: JunctionByMatrix
	/** Add custom legend image to block legend.
	 * Note: this is different from tracks[i].legendimg */
	legendimg?: LegendImg
	/** Inits the maf timeline app */
	maftimeline?: MafTimeline
	/** Inits the mass UI */
	mass?: any
	/** Inits the mass UI from a saved session on the server */
	massSessionId?: string
	/** Inits the mass UI from a provide session file */
	massSessionFile?: string
	/** Inits the MA Volcano Plot app */
	mavolcanoplot?: MAVolcanoPlot
	mds3_ssm2canonicalisoform?: Mds3SSM2CanonicalIsoform
	/** Show multiple positions in the genome browser at once */
	subpanels?: SubPanelsEntry[]
	/** Inits the termdb for a ds */
	termdb?: TermDbArgs
	/** Launches tracks from a JSON file */
	tkjsonfile?: string
	/** Inits track UIs (i.e. user input forms) to launch individual tracks/apps */
	tkui?: 'bigwig' | 'databrowser' | 'genefusion' | 'disco'
	/** Inits the 2dmaf app */
	twodmaf?: TwoDMAF
	/** Width of the block */
	width?: number
	/** Inits the mass WSI viewer plot */
	wsiViewer?: WSIViewer
	/** Callback function that runs after the application has loaded */
	onloadalltk_always?: () => void
}

/** Not supported arguments or deprecated arguments */
type DeprecatedBlockLevelArgs = {
	datasetqueries?: DatasetQueries[]
	hidedatasetexpression?: boolean
	hidegenecontrol?: boolean
	hidegenelegend?: boolean
	mdssurvivalplot?: any
	mdssamplescatterplot?: MdsSampleScatterPlot
	/** Replaced with .gene */
	p?: string
	/** Gene name - unclear of purpose */
	positionbygene?: string
	/** Inits the user form for creating the study view */
	project?: Project
	samplematrix?: any
	/** Args for original single cell app */
	singlecell?: any
	/** Inits the original study cohort (i.e. oncoprint) app with the
	 * sjcharts repo from a saved file on the server.*/
	study?: any
	/** Inits the original study cohort (i.e. oncoprint) app with the
	 * sjcharts repo. */
	studyview?: any
}

/** Defined in client/src/app but no usage example available.
 * May be deprecated. */
type UnkBlockLevelArgs = {
	/** Replaces styles.  */
	styles?: string
	/** Used in pecan only */
	clear?: boolean
	variantPageCall_snv?: any
	samplecart?: any
}

/** Override app settings for the entire application */
type CommonOverrides = {
	mclass: {
		/** Index must match the class code */
		[index: string]: {
			/** Replaces the default mutation class color */
			color: string
		}
	}
}

/** Override the default settings for mutation classes */
type MClassOverride = {
	/** Legend label for overridden classes */
	className: string
	classes: {
		/** Index must match the class code */
		[index: string]: {
			/** Shown on hover and in the legend */
			label: string
			/** Replaces the default mutation class color */
			color: string
			/** Description shown in the clickable legend menu */
			desc: string
		}
	}
}

type TrackEntry = {
	type: string
	//TODO: add types for this
}

type Fimo = {
	/** Threshold for FIMO analysis */
	fimo_thres: number
	//TODO: add types for this
}

type HicApp = {
	/** Genome name (e.g. hg19, hg38, etc.) */
	genome: string
	//TODO: add types for this
}

type FusionEditor = {
	/** Only show input form */
	uionly?: boolean
	/** Genome name (e.g. hg19, hg38, etc.) */
	genome: string
	//TODO: add types for this
}

/** Parsed text launches the gene fusion svg app via position type. */
type GeneFusion = {
	/** ex: PAX5,NM_016734,201,JAK2,NM_004972,812 */
	text: string
	positionType: 'codon' | 'genomic' | 'rna'
}

type MAVolcanoPlot = {
	/** Only show input form */
	uionly?: boolean
	//TODO: add types for this
}

type TwoDMAF = {
	/** Only show input form */
	uionly?: boolean
	//TODO: add types for this
}

type JunctionByMatrix = {
	/** Only show input form */
	uionly?: boolean
	//TODO: add types for this
}

type DiscoPlot = {
	/** Opens a sample disco plot within a dataset */
	sample_id?: string
	//TODO: add types for this
}

type WSIViewer = {
	/** Extracted from URL? */
	sample_id?: string
	//TODO: add types for this
}

type MafTimeline = {
	/** Only show input form */
	uionly?: boolean
	//TODO: add types for this
}

type GeneDomains = {
	/** Index must be the isoform. No gene names */
	[index: string]: {
		/** Genomic start position */
		start: number
		/** Genomic stop position */
		stop: number
		/** Domain name */
		name: string
		/** Domain color */
		color: string
	}
}

type DatasetQueries = {
	dataset: string
	querykey: string
	singlesample?: { name: string }
	getsampletrackquickfix?: boolean
}

type HighlightAAChangeEntry = {
	/** Custom label */
	name: string
	codon: number
	/** Must match a valid mutation class */
	class: string
}

type HighlightVariantEntry = {
	chr: string
	pos: number
	ref: string
	alt: string
}

type LegendImg = {
	/** Shown on the left of the image */
	name: string
	/** file path to png */
	file: string
}

type SubPanelsEntry = {
	chr: string
	/** Genomic start position */
	start: number
	/** Genomic stop position */
	stop: number
	/** Optional width of the subpanel */
	width?: number
	/** Optional left padding of the subpanel */
	leftpad?: number
	/** Border color */
	leftborder?: string
}

type Project = {
	/** Only show input form */
	uionly?: boolean
	//TODO: add types for this
}

type Mds3SSM2CanonicalIsoform = {
	ssm_id: string
	dslabel: string
}

type MdsSampleScatterPlot = {
	analysisdata?: any
	analysisdata_file?: string
	mds?: MdsArg
}

type MdsArg = {
	mdsIsUninitiated?: boolean
}

type TermDbArgs = {
	serverData?: any
	//TODO: add types for this
}
