/* 
exports a set of functions, each returns a TermdbTest-based term/tw/tvs that is complex and lengthy
that are used in unit/integration tests so to simplify test and avoid code duplication

functions could accept parameters to return customized objects

if some data contents needs to be changed, better off creating a new function and avoid changing existing one, as multiple tests may be coded against that data
*/

export function getSamplelstTw() {
	const values = [
		{
			sampleId: 42,
			sample: '2660'
		},
		{
			sampleId: 44,
			sample: '2688'
		},
		{
			sampleId: 45,
			sample: '2702'
		},
		{
			sampleId: 46,
			sample: '2716'
		},
		{
			sampleId: 59,
			sample: '2898'
		},
		{
			sampleId: 60,
			sample: '2912'
		},
		{
			sampleId: 67,
			sample: '3010'
		},
		{
			sampleId: 68,
			sample: '3024'
		},
		{
			sampleId: 69,
			sample: '3038'
		},
		{
			sampleId: 70,
			sample: '3052'
		},
		{
			sampleId: 73,
			sample: '3094'
		},
		{
			sampleId: 79,
			sample: '3178'
		},
		{
			sampleId: 80,
			sample: '3192'
		}
	]
	return {
		term: {
			name: 'termdbtest samplelst',
			type: 'samplelst',
			values: {
				'Group 1': {
					key: 'Group 1',
					label: 'Group 1',
					list: values
				},
				'Not in Group 1': {
					key: 'Not in Group 1',
					label: 'Not in Group 1',
					list: values
				}
			}
		},
		q: {
			mode: 'discrete',
			groups: [
				{
					name: 'Group 1',
					in: true,
					values
				},
				{
					name: 'Not in Group 1',
					in: false,
					values
				}
			],
			isAtomic: true,
			type: 'custom-groupset'
		}
	}
}

export function getCategoryGroupsetting() {
	return {
		id: 'diaggrp',
		q: {
			type: 'custom-groupset',
			customset: {
				name: 'A versus B',
				groups: [
					{
						name: 'Test A',
						type: 'values',
						values: [{ key: 'Acute lymphoblastic leukemia' }, { key: 'Wilms tumor' }]
					},
					{
						name: 'Test B',
						type: 'values',
						values: [
							{ key: 'Central nervous system (CNS)' },
							{ key: 'Acute myeloid leukemia' },
							{ key: 'Non-Hodgkin lymphoma' }
						]
					}
				]
			}
		}
	}
}

export function getGenesetMutTw() {
	return {
		term: {
			genes: [
				{ kind: 'gene', gene: 'TP53', type: 'geneVariant' },
				{ kind: 'gene', gene: 'KRAS', type: 'geneVariant' },
				{ kind: 'gene', gene: 'AKT1', type: 'geneVariant' }
			],
			type: 'geneVariant'
		},
		q: { type: 'predefined-groupset' }
	}
}

export function getGeneVariantTw(position = false) {
	return {
		term: {
			genes: [
				position
					? { kind: 'coord', chr: 'chr14', start: 104769349, stop: 104795747, name: 'AKT1region', type: 'geneVariant' }
					: { kind: 'gene', gene: 'TP53', type: 'geneVariant' }
			],
			type: 'geneVariant'
		},
		q: { type: 'predefined-groupset' }
	}
}
