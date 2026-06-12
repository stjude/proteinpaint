import type { Filter } from '../filter.ts'
import type { ErrorResponse } from './errorResponse.ts'
import type { ColorLegendEntry, ShapeLegendEntry } from './termdb.sampleScatter.ts'

export type TermdbSingleCellPlotsRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	singleCellPlot: {
		/** Name of the single cell plot type, e.g. 'umap', 'tsne' */
		name: string
		sample?: { eID?: string; sID: string }
	}
	filter?: Filter
	filter0?: any //ds specific filter, specifically for api requests
	/** When sample size is too large, canvas rendering uses
	 * these settings to control how the plot is rendered. */
	canvasSettings: {
		/** Maximum number of samples to render on the client side.
		 * If over the cutoff, will return an image instead of sample array.
		 * Matches the maxSvgSamplesCutoff in scatter settings.*/
		cutoff: number
		/** Width of the scatter canvas */
		width: number
		/** Height of the scatter canvas */
		height: number
		/** Radius of the points in the scatter plot. In scatter,
		 * this is the setting size. */
		radius: number
		/** Default or user defined lower limit cutoff for x scale */
		minXScale: number | null
		/** Default or user defined upper limit cutoff for x scale */
		maxXScale: number | null
		/** Default or user defined lower limit cutoff for y scale */
		minYScale: number | null
		/** Default or user defined upper limit cutoff for y scale */
		maxYScale: number | null
		/** Default or user defined opacity for the scatter plot points */
		opacity: number
		/** Required non expression color for scge plots. 'startColor' is the
		 * settings key in the scatter. */
		startColor: string
		/** Required non expression color for scge plots. 'stopColor' is the
		 * settings key in the scatter. */
		stopColor: string
		/** Device pixel ratio from the client for HiDPI rendering */
		devicePixelRatio?: number
	}
	/** Term wrapper for coloring the single cell plot */
	colorTW?: any
}

export type TermdbSingleCellPlotsResponse = ErrorResponse | ValidSingleCellPlotsResponse

/** The computed coordinate and gene expression range for cells
 * returned in a single request. Scoped to the specific plot type
 * (e.g. 'umap', 'tsne') and optional sample filter — not a global
 * range across all plots or samples. Used to define axis domains
 * and color scale domains for rendering. */
export type SingleCellRange = {
	/** Minimum x coordinate across all cells in this plot response */
	xMin: number
	/** Maximum x coordinate across all cells in this plot response */
	xMax: number
	/** Minimum y coordinate across all cells in this plot response */
	yMin: number
	/** Maximum y coordinate across all cells in this plot response */
	yMax: number
	/** Minimum gene expression value (Infinity when no expression data) */
	geMin: number
	/** Maximum gene expression value (-Infinity when no expression data) */
	geMax: number
}

/** Returns cell data formatted in samples array for the sampleScatter */
export type FormattedCell2Sample = {
	/** Cell identifier used as the sample id */
	sampleId: string
	/** X coordinate of the cell in the plot */
	x: number
	/** Y coordinate of the cell in the plot */
	y: number
	/** Z coordinate, always 0 (2D plots only) */
	z: number
	/** Cell type or group assignment for coloring */
	category: string
	/** Shape key for the legend, always 'Ref' */
	shape: string
	/** Visibility state based on user-hidden categories */
	hidden: { category: boolean }
	/** Gene expression value for this cell, undefined when not applicable */
	geneExp: number | undefined
}

export type SingleCellPlotDataResult = {
	colorLegend: ColorLegendEntry[]
	shapeLegend: ShapeLegendEntry[]
	samples?: FormattedCell2Sample[]
	/** If over the cutoff, will return image instead of sample array */
	src?: string
	/** css dimensions of the canvas image, used to display at
	 * the correct size when devicePixelRatio > 1 */
	canvasWidth?: number
	canvasHeight?: number
	/** When no sample array is returned, send the total sample count for
	 * the legend. */
	totalSampleCount?: number
}

export type ValidSingleCellPlotsResponse = {
	range: SingleCellRange
	result: { Default: SingleCellPlotDataResult }
}

const TermdbSingleCellPlotsRequestExample = {
	genome: 'hg38-test',
	dslabel: 'TermdbTest',
	singleCellPlot: {
		name: 'umap',
		sample: { sID: 'sample1' }
	},
	filter: {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				tag: 'cohortFilter',
				type: 'tvs',
				tvs: {
					term: { id: 'subcohort', type: 'multivalue' },
					values: [{ key: 'ABC', label: 'ABC' }]
				}
			}
		]
	},
	filter0: undefined,
	canvasSettings: {
		cutoff: 10000,
		width: 800,
		height: 600,
		radius: 3,
		minXScale: null,
		maxXScale: null,
		minYScale: null,
		maxYScale: null,
		opacity: 0.8,
		startColor: '#0000ff',
		stopColor: '#ff0000',
		devicePixelRatio: 2
	},
	colorTW: {
		term: {
			name: 'Cell Type',
			plot: 'UMAP',
			type: 'singleCellCellType',
			sample: { sID: '1_patient' },
			groupsetting: { disabled: false },
			values: {}
		},
		q: { mode: 'discrete', type: 'values', hiddenValues: {} }
	}
}

const TermdbSingleCellPlotsResponseExample = {
	range: {
		xMin: -2.45230826499861,
		xMax: 2.02116419939392,
		yMin: -2.670907125487,
		yMax: 2.97596441655721,
		geMin: null,
		geMax: null
	},
	result: {
		Default: {
			colorLegend: [
				[
					'T_NK',
					{
						sampleCount: 20,
						color: '#1b9e77',
						key: 'T_NK'
					}
				],
				[
					'Blast',
					{
						sampleCount: 54,
						color: '#030303',
						key: 'Blast'
					}
				],
				[
					'Monocyte',
					{
						sampleCount: 26,
						color: '#7570b3',
						key: 'Monocyte'
					}
				]
			],
			shapeLegend: [
				[
					'Ref',
					{
						sampleCount: 100,
						shape: 0,
						key: 'Ref'
					}
				]
			],
			samples: [
				{
					sampleId: 'cell1',
					x: 0.958429213345285,
					y: 1.94008987552318,
					z: 0,
					category: 'T_NK',
					shape: 'Ref',
					hidden: {
						category: false
					}
				},
				{
					sampleId: 'cell2',
					x: 0.678836078621254,
					y: -1.13854914348622,
					z: 0,
					category: 'T_NK',
					shape: 'Ref',
					hidden: {
						category: false
					}
				},
				{
					sampleId: 'cell3',
					x: -2.11135267144421,
					y: -2.33519450621652,
					z: 0,
					category: 'T_NK',
					shape: 'Ref',
					hidden: {
						category: false
					}
				},
				{
					sampleId: 'cell4',
					x: 0.551783876521269,
					y: -1.24685552943596,
					z: 0,
					category: 'T_NK',
					shape: 'Ref',
					hidden: {
						category: false
					}
				},
				{
					sampleId: 'cell5',
					x: 1.84959385901015,
					y: 2.68311790617899,
					z: 0,
					category: 'T_NK',
					shape: 'Ref',
					hidden: {
						category: false
					}
				}
			]
		}
	}
}

export const TermdbSingleCellPlotsExample = {
	request: {
		body: TermdbSingleCellPlotsRequestExample
	},
	response: {
		body: TermdbSingleCellPlotsResponseExample
	}
}
