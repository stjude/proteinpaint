export const group1Values = [
	{ sampleId: 70, sample: 'SJALL044294' },
	{ sampleId: 100, sample: 'SJBALL047019' },
	{ sampleId: 109, sample: 'SJBALL047029' },
	{ sampleId: 139, sample: 'SJALL048686' },
	{ sampleId: 142, sample: 'SJALL048691' },
	{ sampleId: 163, sample: 'SJALL054521' },
	{ sampleId: 268, sample: 'SJALL061718' },
	{ sampleId: 402, sample: 'SJMLL023' },
	{ sampleId: 407, sample: 'SJMLL024' },
	{ sampleId: 462, sample: 'SJMLL003329' },
	{ sampleId: 596, sample: 'SJMLL022031' },
	{ sampleId: 597, sample: 'SJMLL009' },
	{ sampleId: 623, sample: 'SJINF022043' },
	{ sampleId: 624, sample: 'SJ0624' },
	{ sampleId: 641, sample: 'SJ0641' },
	{ sampleId: 705, sample: 'SJ0705' },
	{ sampleId: 804, sample: 'SJALL061926' },
	{ sampleId: 816, sample: 'SJBALL030059' },
	{ sampleId: 834, sample: 'SJBALL030123' },
	{ sampleId: 883, sample: 'SJBALL030313' },
	{ sampleId: 918, sample: 'SJBALL030543' },
	{ sampleId: 964, sample: 'SJBALL031077' },
	{ sampleId: 1056, sample: 'SJBALL032307' },
	{ sampleId: 1068, sample: 'SJ1068' },
	{ sampleId: 1071, sample: 'SJ1071' }
]

export const group2Values = [
	{ sampleId: 49, sample: 'SJMLL033' },
	{ sampleId: 68, sample: 'SJALL046376' },
	{ sampleId: 73, sample: 'SJALL044301' },
	{ sampleId: 81, sample: 'SJBALL042261' },
	{ sampleId: 104, sample: 'SJBALL047023' },
	{ sampleId: 107, sample: 'SJALL047974' },
	{ sampleId: 108, sample: 'SJBALL047028' },
	{ sampleId: 123, sample: 'SJALL048082' },
	{ sampleId: 133, sample: 'SJALL048672' },
	{ sampleId: 152, sample: 'SJALL049671' },
	{ sampleId: 159, sample: 'SJALL049937' },
	{ sampleId: 172, sample: 'SJALL054536' },
	{ sampleId: 180, sample: 'SJALL054545' },
	{ sampleId: 198, sample: 'SJALL055898' },
	{ sampleId: 199, sample: 'SJALL057945' },
	{ sampleId: 202, sample: 'SJALL057948' },
	{ sampleId: 214, sample: 'SJALL059329' },
	{ sampleId: 217, sample: 'SJALL059332' },
	{ sampleId: 222, sample: 'SJALL059521' },
	{ sampleId: 224, sample: 'SJALL059535' },
	{ sampleId: 225, sample: 'SJALL059523' },
	{ sampleId: 305, sample: 'SJALL063022' },
	{ sampleId: 331, sample: 'SJALL063998' },
	{ sampleId: 333, sample: 'SJALL064402' },
	{ sampleId: 334, sample: 'SJALL064403' },
	{ sampleId: 358, sample: 'SJALL066227' },
	{ sampleId: 367, sample: 'SJALL066763' },
	{ sampleId: 369, sample: 'SJALL066760' },
	{ sampleId: 509, sample: 'SJ0509' },
	{ sampleId: 512, sample: 'SJMLL003304' },
	{ sampleId: 531, sample: 'SJINF022' },
	{ sampleId: 587, sample: 'SJ0587' },
	{ sampleId: 693, sample: 'SJALL048337' },
	{ sampleId: 738, sample: 'SJALL062148' },
	{ sampleId: 752, sample: 'SJALL040130' },
	{ sampleId: 796, sample: 'SJALL048406' },
	{ sampleId: 823, sample: 'SJALL047541' },
	{ sampleId: 852, sample: 'SJ0852' },
	{ sampleId: 871, sample: 'SJBALL030301' },
	{ sampleId: 915, sample: 'SJBALL030535' },
	{ sampleId: 946, sample: 'SJBALL030887' },
	{ sampleId: 993, sample: 'SJ0993' },
	{ sampleId: 1010, sample: 'SJBALL031772' }
]

export const groups = [
	{
		name: 'Sensitive',
		in: true,
		values: group1Values
	},
	{
		name: 'Resistant',
		in: true,
		values: group2Values
	}
]

export const responseData = [
	{
		gene_id: 'ENSG00000187634.6',
		gene_name: 'SAMD11',
		fold_change: 0.1128,
		original_p_value: 0.3325,
		adjusted_p_value: 0.1565
	},
	{
		gene_id: 'ENSG00000188976.6',
		gene_name: 'NOC2L',
		fold_change: 0.1569,
		original_p_value: 0.7206,
		adjusted_p_value: 0.3427
	},
	{
		gene_id: 'ENSG00000187961.9',
		gene_name: 'KLHL17',
		fold_change: -0.1281,
		original_p_value: 0.2826,
		adjusted_p_value: 0.1345
	},
	{
		gene_id: 'ENSG00000187608.5',
		gene_name: 'ISG15',
		fold_change: 0.1667,
		original_p_value: 0.2198,
		adjusted_p_value: 0.1032
	},
	{
		gene_id: 'ENSG00000188157.9',
		gene_name: 'AGRN',
		fold_change: 0.6196,
		original_p_value: 1.483,
		adjusted_p_value: 0.7022
	},
	{
		gene_id: 'ENSG00000131591.13',
		gene_name: 'C1orf159',
		fold_change: -0.0021,
		original_p_value: 0.0049,
		adjusted_p_value: 0.0021
	},
	{
		gene_id: 'ENSG00000078808.12',
		gene_name: 'SDF4',
		fold_change: 0.4862,
		original_p_value: 3.2334,
		adjusted_p_value: 1.5562
	},
	{
		gene_id: 'ENSG00000176022.3',
		gene_name: 'B3GALT6',
		fold_change: 0.0751,
		original_p_value: 0.1906,
		adjusted_p_value: 0.0888
	},
	{
		gene_id: 'ENSG00000160087.16',
		gene_name: 'UBE2J2',
		fold_change: 0.0744,
		original_p_value: 0.3546,
		adjusted_p_value: 0.168
	},
	{
		gene_id: 'ENSG00000162572.15',
		gene_name: 'SCNN1D',
		fold_change: 0.0993,
		original_p_value: 0.1659,
		adjusted_p_value: 0.0758
	}
]
