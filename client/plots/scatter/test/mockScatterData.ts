import { getScgeneexpTw } from '../../../test/testdata/data.ts'

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
				sample: '2646',
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
