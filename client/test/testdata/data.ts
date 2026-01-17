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
				{ kind: 'gene', gene: 'AKT1', type: 'geneVariant' },
				{ kind: 'gene', gene: 'BCR', type: 'geneVariant' }
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
		q: { type: 'predefined-groupset', predefined_groupset_idx: 0, hiddenValues: {} }
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
							isnot,
							genotype: 'variant',
							mcount: 'any'
						}
					}
				],
				tag: 'filterUiRoot'
			}
		]
	}
}

// for ds using categorical cnv, e.g. gdc or mb
// TODO shrink size!
// uses kras which exists in tdbtest, and may be used in integration test
export function getCnv_categorical() {
	return {
		term: {
			type: 'geneVariant',
			childTerms: [
				{
					id: 'snvindel',
					query: 'snvindel',
					name: 'SNV/indel',
					parent_id: null,
					isleaf: true,
					type: 'dtsnvindel',
					dt: 1,
					values: {
						M: { key: 'M', label: 'MISSENSE' },
						S: { key: 'S', label: 'SILENT' },
						Intron: { key: 'Intron', label: 'INTRON' },
						D: { key: 'D', label: 'PROTEINDEL' }
					},
					name_noOrigin: 'SNV/indel',
					parentTerm: {
						type: 'geneVariant',
						id: 'KRAS',
						name: 'KRAS',
						genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
					}
				},
				{
					id: 'cnv',
					query: 'cnv',
					name: 'CNV',
					parent_id: null,
					isleaf: true,
					type: 'dtcnv',
					dt: 4,
					values: {
						CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' },
						CNV_amp: { key: 'CNV_amp', label: 'Gain' },
						CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' }
					},
					name_noOrigin: 'CNV',
					parentTerm: {
						type: 'geneVariant',
						id: 'KRAS',
						name: 'KRAS',
						genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
					}
				}
			],
			id: 'KRAS',
			name: 'KRAS',
			genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }],
			groupsetting: {
				disabled: false,
				lst: [
					{
						name: 'SNV/indel',
						dt: 1,
						groups: [
							{
								name: 'KRAS SNV/indel Mutated',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'snvindel',
													query: 'snvindel',
													name: 'SNV/indel',
													parent_id: null,
													isleaf: true,
													type: 'dtsnvindel',
													dt: 1,
													values: {
														M: { key: 'M', label: 'MISSENSE' },
														S: { key: 'S', label: 'SILENT' },
														Intron: { key: 'Intron', label: 'INTRON' },
														D: { key: 'D', label: 'PROTEINDEL' }
													},
													name_noOrigin: 'SNV/indel',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [
													{ key: 'M', label: 'MISSENSE', value: 'M' },
													{ key: 'S', label: 'SILENT', value: 'S' },
													{ key: 'Intron', label: 'INTRON', value: 'Intron' },
													{ key: 'D', label: 'PROTEINDEL', value: 'D' }
												],
												genotype: 'variant',
												mcount: 'any',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#e75480'
							},
							{
								name: 'KRAS SNV/indel Wildtype',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'snvindel',
													query: 'snvindel',
													name: 'SNV/indel',
													parent_id: null,
													isleaf: true,
													type: 'dtsnvindel',
													dt: 1,
													values: {
														M: { key: 'M', label: 'MISSENSE' },
														S: { key: 'S', label: 'SILENT' },
														Intron: { key: 'Intron', label: 'INTRON' },
														D: { key: 'D', label: 'PROTEINDEL' }
													},
													name_noOrigin: 'SNV/indel',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [],
												genotype: 'wt',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#D3D3D3'
							}
						]
					},
					{
						name: 'CNV',
						dt: 4,
						groups: [
							{
								name: 'KRAS CNV Amplification',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'cnv',
													query: 'cnv',
													name: 'CNV',
													parent_id: null,
													isleaf: true,
													type: 'dtcnv',
													dt: 4,
													values: {
														CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' },
														CNV_amp: { key: 'CNV_amp', label: 'Gain' },
														CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' }
													},
													name_noOrigin: 'CNV',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [{ key: 'CNV_amplification', label: 'Amplification', value: 'CNV_amplification' }],
												genotype: 'variant',
												mcount: 'any',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#ff0000'
							},
							{
								name: 'KRAS CNV Gain',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'cnv',
													query: 'cnv',
													name: 'CNV',
													parent_id: null,
													isleaf: true,
													type: 'dtcnv',
													dt: 4,
													values: {
														CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' },
														CNV_amp: { key: 'CNV_amp', label: 'Gain' },
														CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' }
													},
													name_noOrigin: 'CNV',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
												genotype: 'variant',
												mcount: 'any',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#e9a3c9'
							},
							{
								name: 'KRAS CNV Heterozygous Deletion',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'cnv',
													query: 'cnv',
													name: 'CNV',
													parent_id: null,
													isleaf: true,
													type: 'dtcnv',
													dt: 4,
													values: {
														CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' },
														CNV_amp: { key: 'CNV_amp', label: 'Gain' },
														CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' }
													},
													name_noOrigin: 'CNV',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [{ key: 'CNV_loss', label: 'Heterozygous Deletion', value: 'CNV_loss' }],
												genotype: 'variant',
												mcount: 'any',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#a1d76a'
							},
							{
								name: 'KRAS CNV Wildtype',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [
										{
											type: 'tvs',
											tvs: {
												term: {
													id: 'cnv',
													query: 'cnv',
													name: 'CNV',
													parent_id: null,
													isleaf: true,
													type: 'dtcnv',
													dt: 4,
													values: {
														CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' },
														CNV_amp: { key: 'CNV_amp', label: 'Gain' },
														CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' }
													},
													name_noOrigin: 'CNV',
													parentTerm: {
														type: 'geneVariant',
														id: 'KRAS',
														name: 'KRAS',
														genes: [{ kind: 'gene', id: 'KRAS', gene: 'KRAS', name: 'KRAS', type: 'geneVariant' }]
													}
												},
												values: [],
												genotype: 'wt',
												excludeGeneName: true
											}
										}
									]
								},
								color: '#D3D3D3'
							}
						]
					}
				]
			}
		},
		q: { type: 'predefined-groupset', predefined_groupset_idx: 1, cnvMaxLength: 2000000, hiddenValues: {} }
	}
}

////////////// following are gdc-specific! may move to separate file

export function getGdcDiseaseGroupsetting() {
	return {
		term: { type: 'categorical', id: 'case.disease_type' },
		q: {
			mode: 'discrete',
			type: 'custom-groupset',
			hiddenValues: {},
			customset: {
				groups: [
					{ name: 'Excluded categories', type: 'values', uncomputable: true, values: [] },
					{
						name: 'Group Mix',
						type: 'values',
						uncomputable: false,
						values: [
							{ key: 'Ductal and Lobular Neoplasms', label: 'Ductal and Lobular Neoplasms', samplecount: 2829 },
							{ key: 'Complex Epithelial Neoplasms', label: 'Complex Epithelial Neoplasms', samplecount: 69 },
							{ key: 'Not Applicable', label: 'Not Applicable', samplecount: 9 },
							{ key: 'Epithelial Neoplasms, NOS', label: 'Epithelial Neoplasms, NOS', samplecount: 1221 },
							{
								key: 'Cystic, Mucinous and Serous Neoplasms',
								label: 'Cystic, Mucinous and Serous Neoplasms',
								samplecount: 17
							},
							{
								key: 'Adnexal and Skin Appendage Neoplasms',
								label: 'Adnexal and Skin Appendage Neoplasms',
								samplecount: 1
							},
							{ key: 'Adenomas and Adenocarcinomas', label: 'Adenomas and Adenocarcinomas', samplecount: 18 },
							{ key: 'Squamous Cell Neoplasms', label: 'Squamous Cell Neoplasms', samplecount: 3 },
							{ key: 'Nevi and Melanomas', label: 'Nevi and Melanomas', samplecount: 7 },
							{ key: 'Basal Cell Neoplasms', label: 'Basal Cell Neoplasms', samplecount: 1 },
							{ key: 'Fibroepithelial Neoplasms', label: 'Fibroepithelial Neoplasms', samplecount: 2 },
							{ key: 'Neoplasms, NOS', label: 'Neoplasms, NOS', samplecount: 1547 },
							{
								key: 'Soft Tissue Tumors and Sarcomas, NOS',
								label: 'Soft Tissue Tumors and Sarcomas, NOS',
								samplecount: 30
							},
							{ key: 'Not Reported', label: 'Not Reported', samplecount: 34 },
							{ key: 'Meningiomas', label: 'Meningiomas', samplecount: 29 },
							{ key: 'Mature B-Cell Lymphomas', label: 'Mature B-Cell Lymphomas', samplecount: 3 },
							{ key: 'Lymphoid Leukemias' },
							{ key: 'Myeloid Leukemias' },
							{ key: 'Acute Lymphoblastic Leukemia' },
							{ key: 'Neuroepitheliomatous Neoplasms' },
							{ key: 'Complex Mixed and Stromal Neoplasms' }
						]
					},
					{ name: 'Group Brain', type: 'values', uncomputable: false, values: [{ key: 'Gliomas', label: 'Gliomas' }] }
				]
			}
		}
	}
}
