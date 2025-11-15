/* 
exports a set of functions, each returns a TermdbTest-based term/tw/tvs that is complex and lengthy
that are used in unit/integration tests so to simplify test and avoid code duplication

functions could accept parameters to return customized objects

::NOTE::

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
			isAtomic: true
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
					? { kind: 'coord', chr: 'chr12', start: 25205246, stop: 25250936, name: 'KRASregion', type: 'geneVariant' }
					: { kind: 'gene', gene: 'TP53', type: 'geneVariant' }
			],
			type: 'geneVariant'
		},
		q: { type: 'predefined-groupset' }
	}
}

export function getSsgseaTw(isBin = false) {
	return {
		term: { id: 'HALLMARK_ADIPOGENESIS', type: 'ssGSEA', name: 'HALLMARK_ADIPOGENESIS' },
		q: isBin
			? {
					type: 'regular-bin',
					startinclusive: true,
					bin_size: 0.2,
					first_bin: { stop: -0.4 },
					last_bin: { start: 0.8 },
					mode: 'discrete'
			  }
			: { mode: 'continuous' }
	}
}

export function getFilter_agedx() {
	return {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				tag: 'filterUiRoot',
				type: 'tvslst',
				join: '',
				lst: [
					{
						tvs: {
							term: { id: 'agedx' },
							ranges: [
								{
									start: 10,
									startinclusive: false,
									startunbounded: false,
									stop: 16,
									stopinclusive: false,
									stopunbounded: false
								}
							]
						},
						type: 'tvs'
					}
				]
			}
		]
	}
}
export function getFilter_genemutationset(isnot = false) {
	return {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				tag: 'cohortFilter',
				type: 'tvs',
				tvs: { term: { id: 'subcohort', type: 'multivalue' }, values: [{ key: 'ABC', label: 'ABC' }] }
			},
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: {
								id: 'snvindel_somatic',
								query: 'snvindel',
								name: 'SNV/indel (somatic)',
								parent_id: null,
								isleaf: true,
								type: 'dtsnvindel',
								dt: 1,
								values: { M: { label: 'MISSENSE' }, F: { label: 'FRAMESHIFT' }, WT: { label: 'Wildtype' } },
								name_noOrigin: 'SNV/indel',
								origin: 'somatic',
								parentTerm: {
									type: 'geneVariant',
									id: 'HALLMARK_ADIPOGENESIS',
									name: 'HALLMARK_ADIPOGENESIS',
									genes: [
										{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' },
										{ kind: 'gene', id: 'AKT1', gene: 'AKT1', name: 'AKT1', type: 'geneVariant' },
										{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' },
										{ kind: 'gene', id: 'BCR', gene: 'BCR', name: 'BCR', type: 'geneVariant' }
									]
								}
							},
							values: [
								{ key: 'M', label: 'MISSENSE', value: 'M', bar_width_frac: null },
								{ key: 'F', label: 'FRAMESHIFT', value: 'F', bar_width_frac: null }
							],
							isnot
						}
					}
				],
				tag: 'filterUiRoot'
			}
		]
	}
}
