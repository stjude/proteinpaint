import { getScgeneexpTw } from '../../../test/testdata/data.ts'
import { scTestSample } from '#shared/testData'
import { getDefaultScatterSettings } from '../settings/defaults.ts'

export function getMockScatter(overrides: any = {}) {
	const base = {
		id: 'scatter-1',
		type: 'sampleScatter',
		parentId: null,
		zoom: 1,
		config: {
			name: 'plot-name',
			term: { term: { id: 'agedx', type: 'numeric' } },
			term2: { term: { id: 'TP53 FPKM', type: 'geneExpression' } },
			settings: {
				sampleScatter: {
					colorScaleMode: 'auto',
					colorScaleMinFixed: 0,
					colorScaleMaxFixed: 100,
					colorScalePercentile: 50
				}
			}
		},
		state: { termfilter: { filter: {}, filter0: {} } },
		settings: getDefaultScatterSettings()
	}
	return {
		...base,
		...overrides,
		config: { ...base.config, ...(overrides.config || {}) },
		state: { ...base.state, ...(overrides.state || {}) },
		settings: { ...base.settings, ...(overrides.settings || {}) }
	}
}

export function getMockChart(overrides: any = {}) {
	const base = {
		id: 'chart-1',
		data: { samples: [] as any[] },
		cohortSamples: [] as any[],
		shapeLegend: new Map([['circle', { shape: 0 }]]),
		colorLegend: new Map([
			['Default', { color: '#ccc' }],
			['A', { color: '#f00' }]
		]),
		ranges: {
			xMin: 0,
			xMax: 100,
			yMin: 0,
			yMax: 100,
			zMin: 0,
			zMax: 10,
			scaleMin: 10,
			scaleMax: 20,
			geMin: 1,
			geMax: 5
		}
	}
	return { ...base, ...overrides }
}

export function getMockSingleCellScatter(overrides: any = {}) {
	const baseConfig = {
		term: { term: { id: 'agedx', type: 'numeric' } },
		term2: { term: { id: 'visitdate', type: 'date' } },
		colorTW: { term: { id: 'expr', type: 'geneExpression' } },
		singleCellPlot: { name: 'tsne' },
		startColor: { Default: '#111111' },
		stopColor: { Default: '#eeeeee' }
	}
	const base = {
		id: 'scatter-singlecell',
		config: baseConfig,
		state: { termfilter: { filter: { cohort: 'all' }, filter0: { sample: 'subset' } } },
		settings: {
			...getDefaultScatterSettings(),
			colorScaleMode: 'fixed',
			colorScaleMinFixed: 0,
			colorScaleMaxFixed: 10,
			colorScalePercentile: 95,
			maxSvgSamplesCutoff: 20000,
			svgw: 800,
			svgh: 700,
			size: 1.2,
			minXScale: 0,
			maxXScale: 100,
			minYScale: 0,
			maxYScale: 50,
			opacity: 0.8
		},
		app: {
			vocabApi: {
				getScatterSingleCellPlotData: async () => ({
					result: {
						Default: {
							samples: [
								{ sampleId: 'c1', x: 1, y: 2, category: 'Default', geneExp: 1 },
								{ sampleId: 'c2', x: 3, y: 4, category: 'Default', geneExp: 3 }
							],
							colorLegend: [['Default', { color: '#abcdef' }]],
							shapeLegend: [['circle', { shape: 0 }]]
						}
					},
					range: { xMin: 0, xMax: 10, yMin: 0, yMax: 10, geMin: 1, geMax: 3 }
				}),
				async addGroup() {}
			},
			isAbortError: () => false
		},
		api: { getAbortSignal: () => 'signal' }
	}
	return {
		...base,
		...overrides,
		config: { ...base.config, ...(overrides.config || {}) },
		state: { ...base.state, ...(overrides.state || {}) },
		settings: { ...base.settings, ...(overrides.settings || {}) },
		app: { ...base.app, ...(overrides.app || {}) },
		api: { ...base.api, ...(overrides.api || {}) }
	}
}

export const state = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE'
		}
	]
}

export const open_state = {
	nav: { header_mode: 'hide_search' },
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE'
		}
	]
}

export const state3D = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE',
			term0: { id: 'agedx', q: { mode: 'continuous' } }
		}
	]
}

export const stateDynamicScatter = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			term: { id: 'agedx', q: { mode: 'continuous' } },
			term2: { id: 'hrtavg', q: { mode: 'continuous' } }
		}
	]
}

export const state2geneexp = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			term: { term: { type: 'geneExpression', gene: 'AKT1' }, q: { mode: 'continuous' } },
			term2: { term: { type: 'geneExpression', gene: 'TP53' }, q: { mode: 'continuous' } }
		}
	]
}

export const state2ssgsea = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			term: { term: { type: 'ssGSEA', id: 'HALLMARK_ADIPOGENESIS' }, q: { mode: 'continuous' } },
			term2: { term: { type: 'ssGSEA', id: 'HALLMARK_ALLOGRAFT_REJECTION' }, q: { mode: 'continuous' } }
		}
	]
}

export const state2dnameth = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			term: {
				term: { type: 'dnaMethylation', chr: 'chr17', start: 7673484, stop: 7681953, genomicFeatureType: 'gene' },
				q: { mode: 'continuous' }
			},
			term2: {
				term: { type: 'dnaMethylation', chr: 'chr17', start: 7663195, stop: 7671664, genomicFeatureType: 'gene' },
				q: { mode: 'continuous' }
			}
		}
	]
}

export const state2scgeneexp = {
	plots: [
		{
			chartType: 'sampleScatter',
			term: getScgeneexpTw(),
			term2: getScgeneexpTw('TP53')
		}
	]
}

export const state3DContour = {
	plots: [
		{
			chartType: 'sampleScatter',
			colorTW: { id: 'diaggrp' },
			name: 'TermdbTest TSNE',
			term0: { id: 'agedx', q: { mode: 'continuous' } },
			settings: { sampleScatter: { showContour: true } }
		}
	]
}

export const mockGroups = [
	{
		name: 'Test group 1',
		items: [
			{
				sample: scTestSample,
				x: -103.141543,
				y: 73.31223702,
				sampleId: 41,
				category_info: {},
				hidden: {
					category: false
				},
				category: '"Acute lymphoblastic leukemia"',
				shape: 'Ref'
			},
			{
				sample: '2800',
				x: -99.20065673,
				y: 73.64971694,
				sampleId: 52,
				category_info: {},
				hidden: {
					category: false
				},
				category: '"Acute lymphoblastic leukemia"',
				shape: 'Ref'
			}
		],
		index: 1
	}
]
