export const hg19 = {
	species: 'human',
	name: 'hg19',
	hasSNP: true,
	hasIdeogram: false,
	hasClinvarVCF: true,
	fimo_motif: true,
	blat: false,
	geneset: [
		{
			name: 'Signaling',
			lst: [
				{
					name: 'NRAS'
				},
				{
					name: 'FLT3'
				},
				{
					name: 'KRAS'
				},
				{
					name: 'JAK3'
				},
				{
					name: 'BRAF'
				},
				{
					name: 'NF1'
				},
				{
					name: 'MAPK1'
				}
			]
		},
		{
			name: 'Cell cycle',
			lst: [
				{
					name: 'TP53'
				},
				{
					name: 'RB1'
				},
				{
					name: 'CDKN2A'
				},
				{
					name: 'CDKN2B'
				}
			]
		},
		{
			name: 'Epigenetics',
			lst: [
				{
					name: 'ATRX'
				},
				{
					name: 'BCOR'
				},
				{
					name: 'MYC'
				},
				{
					name: 'MYCN'
				},
				{
					name: 'WHSC1'
				},
				{
					name: 'SUZ12'
				},
				{
					name: 'EED'
				},
				{
					name: 'EZH2'
				},
				{
					name: 'SETD2'
				},
				{
					name: 'CREBBP'
				},
				{
					name: 'EHMT2'
				},
				{
					name: 'PRDM1'
				},
				{
					name: 'NSD1'
				},
				{
					name: 'KMT2D'
				},
				{
					name: 'UBR4'
				},
				{
					name: 'ARID1A'
				},
				{
					name: 'EP300'
				}
			]
		},
		{
			name: 'Development',
			lst: [
				{
					name: 'RUNX1'
				},
				{
					name: 'ETV6'
				},
				{
					name: 'GATA3'
				},
				{
					name: 'IKZF1'
				},
				{
					name: 'EP300'
				},
				{
					name: 'IKZF2'
				},
				{
					name: 'IKZF3'
				},
				{
					name: 'PAX5'
				},
				{
					name: 'VPREB1'
				},
				{
					name: 'EBF1'
				}
			]
		}
	],
	defaultcoord: {
		chr: 'chr17',
		start: 7568451,
		stop: 7591984,
		gene: 'TP53'
	},
	isdefault: true,
	majorchr: {
		chr1: 249250621,
		chr2: 243199373,
		chr3: 198022430,
		chr4: 191154276,
		chr5: 180915260,
		chr6: 171115067,
		chr7: 159138663,
		chr8: 146364022,
		chr9: 141213431,
		chr10: 135534747,
		chr11: 135006516,
		chr12: 133851895,
		chr13: 115169878,
		chr14: 107349540,
		chr15: 102531392,
		chr16: 90354753,
		chr17: 81195210,
		chr18: 78077248,
		chr19: 59128983,
		chr20: 63025520,
		chr21: 48129895,
		chr22: 51304566,
		chrX: 155270560,
		chrY: 59373566,
		chrM: 16571
	},
	majorchrorder: [
		'chr1',
		'chr2',
		'chr3',
		'chr4',
		'chr5',
		'chr6',
		'chr7',
		'chr8',
		'chr9',
		'chr10',
		'chr11',
		'chr12',
		'chr13',
		'chr14',
		'chr15',
		'chr16',
		'chr17',
		'chr18',
		'chr19',
		'chr20',
		'chr21',
		'chr22',
		'chrX',
		'chrY',
		'chrM'
	],
	minorchr: {
		chr6_ssto_hap7: 4928567,
		chr6_mcf_hap5: 4833398,
		chr6_cox_hap2: 4795371,
		chr6_mann_hap4: 4683263,
		chr6_apd_hap1: 4622290,
		chr6_qbl_hap6: 4611984,
		chr6_dbb_hap3: 4610396,
		chr17_ctg5_hap1: 1680828,
		chr4_ctg9_hap1: 590426,
		chr1_gl000192_random: 547496,
		chrUn_gl000225: 211173,
		chr4_gl000194_random: 191469,
		chr4_gl000193_random: 189789,
		chr9_gl000200_random: 187035,
		chrUn_gl000222: 186861,
		chrUn_gl000212: 186858,
		chr7_gl000195_random: 182896,
		chrUn_gl000223: 180455,
		chrUn_gl000224: 179693,
		chrUn_gl000219: 179198,
		chr17_gl000205_random: 174588,
		chrUn_gl000215: 172545,
		chrUn_gl000216: 172294,
		chrUn_gl000217: 172149,
		chr9_gl000199_random: 169874,
		chrUn_gl000211: 166566,
		chrUn_gl000213: 164239,
		chrUn_gl000220: 161802,
		chrUn_gl000218: 161147,
		chr19_gl000209_random: 159169,
		chrUn_gl000221: 155397,
		chrUn_gl000214: 137718,
		chrUn_gl000228: 129120,
		chrUn_gl000227: 128374,
		chr1_gl000191_random: 106433,
		chr19_gl000208_random: 92689,
		chr9_gl000198_random: 90085,
		chr17_gl000204_random: 81310,
		chrUn_gl000233: 45941,
		chrUn_gl000237: 45867,
		chrUn_gl000230: 43691,
		chrUn_gl000242: 43523,
		chrUn_gl000243: 43341,
		chrUn_gl000241: 42152,
		chrUn_gl000236: 41934,
		chrUn_gl000240: 41933,
		chr17_gl000206_random: 41001,
		chrUn_gl000232: 40652,
		chrUn_gl000234: 40531,
		chr11_gl000202_random: 40103,
		chrUn_gl000238: 39939,
		chrUn_gl000244: 39929,
		chrUn_gl000248: 39786,
		chr8_gl000196_random: 38914,
		chrUn_gl000249: 38502,
		chrUn_gl000246: 38154,
		chr17_gl000203_random: 37498,
		chr8_gl000197_random: 37175,
		chrUn_gl000245: 36651,
		chrUn_gl000247: 36422,
		chr9_gl000201_random: 36148,
		chrUn_gl000235: 34474,
		chrUn_gl000239: 33824,
		chr21_gl000210_random: 27682,
		chrUn_gl000231: 27386,
		chrUn_gl000229: 19913,
		chrUn_gl000226: 15008,
		chr18_gl000207_random: 4262
	},
	tracks: [
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/refGene.hg19.gz',
			type: 'bedj',
			name: 'RefGene',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D',
			tkid: '0.16057720645373252'
		},
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/gencode.v40.hg19.gz',
			type: 'bedj',
			name: 'GENCODE v40',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			categories: {
				coding: {
					color: '#004D99',
					label: 'Coding gene'
				},
				nonCoding: {
					color: '#009933',
					label: 'Noncoding gene'
				},
				problem: {
					color: '#FF3300',
					label: 'Problem'
				},
				pseudo: {
					color: '#FF00CC',
					label: 'Pseudogene'
				}
			},
			tkid: '0.7534145999292718'
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.hg19.gz',
			onerow: true,
			categories: {
				SINE: {
					color: '#ED8C8E',
					label: 'SINE'
				},
				LINE: {
					color: '#EDCB8C',
					label: 'LINE'
				},
				LTR: {
					color: '#E38CED',
					label: 'LTR'
				},
				DNA: {
					color: '#8C8EED',
					label: 'DNA transposon'
				},
				simple: {
					color: '#8EB88C',
					label: 'Simple repeats'
				},
				low_complexity: {
					color: '#ACEBA9',
					label: 'Low complexity'
				},
				satellite: {
					color: '#B59A84',
					label: 'Satellite'
				},
				RNA: {
					color: '#9DE0E0',
					label: 'RNA repeat'
				},
				other: {
					color: '#9BADC2',
					label: 'Other'
				},
				unknown: {
					color: '#858585',
					label: 'Unknown'
				}
			},
			tkid: '0.6948092394070597'
		}
	],
	hicenzymefragment: [
		{
			enzyme: 'DpnII',
			file: 'anno/hicFragment/hic.DpnII.hg19.gz'
		},
		{
			enzyme: 'EcoRI',
			file: 'anno/hicFragment/hic.EcoRI.hg19.gz'
		},
		{
			enzyme: 'HindIII',
			file: 'anno/hicFragment/hic.HindIII.hg19.gz'
		},
		{
			enzyme: 'MboI',
			file: 'anno/hicFragment/hic.MboI.hg19.gz'
		},
		{
			enzyme: 'NcoI',
			file: 'anno/hicFragment/hic.NcoI.hg19.gz'
		}
	],
	datasets: {
		ClinVar: {
			isMds3: true,
			label: 'ClinVar'
		},
		PNET: {
			isMds3: true,
			label: 'PNET'
		},
		'SAMD9-SAMD9L': {
			isMds3: true,
			label: 'SAMD9-SAMD9L'
		}
	},
	hicdomain: {
		groups: {
			RaoCell2014: {
				name: 'Rao SS et al, Cell 2014',
				reference:
					'<a href=https://www.ncbi.nlm.nih.gov/pubmed/25497547 target=_blank>A 3D Map of the Human Genome at Kilobase Resolution Reveals Principles of Chromatin Looping</a>',
				sets: {
					GM12878: {
						name: 'GM12878',
						longname: 'Human B-Lymphoblastoid'
					},
					HMEC: {
						name: 'HMEC',
						longname: 'Human Mammary Epithelial'
					},
					IMR90: {
						name: 'IRM90',
						longname: 'Human Lung Fibroblast'
					},
					KBM7: {
						name: 'KBM7',
						longname: 'Near Haploid Human Myelogenous Leukemia'
					},
					HeLa: {
						name: 'HeLa',
						longname: 'Human Cervical Carcinoma'
					},
					HUVEC: {
						name: 'HUVEC',
						longname: 'Human Umbilical Vein Endothelial'
					},
					K562: {
						name: 'K562',
						longname: 'Human Erythroleukemia'
					},
					NHEK: {
						name: 'NHEK',
						longname: 'Normal Human Epidermal Keratinocytes'
					}
				}
			}
		}
	},
	tkset: [],
	isoformcache: {},
	junctionframecache: {},
	chrlookup: {
		CHR1: {
			name: 'chr1',
			len: 249250621,
			major: true
		},
		CHR2: {
			name: 'chr2',
			len: 243199373,
			major: true
		},
		CHR3: {
			name: 'chr3',
			len: 198022430,
			major: true
		},
		CHR4: {
			name: 'chr4',
			len: 191154276,
			major: true
		},
		CHR5: {
			name: 'chr5',
			len: 180915260,
			major: true
		},
		CHR6: {
			name: 'chr6',
			len: 171115067,
			major: true
		},
		CHR7: {
			name: 'chr7',
			len: 159138663,
			major: true
		},
		CHR8: {
			name: 'chr8',
			len: 146364022,
			major: true
		},
		CHR9: {
			name: 'chr9',
			len: 141213431,
			major: true
		},
		CHR10: {
			name: 'chr10',
			len: 135534747,
			major: true
		},
		CHR11: {
			name: 'chr11',
			len: 135006516,
			major: true
		},
		CHR12: {
			name: 'chr12',
			len: 133851895,
			major: true
		},
		CHR13: {
			name: 'chr13',
			len: 115169878,
			major: true
		},
		CHR14: {
			name: 'chr14',
			len: 107349540,
			major: true
		},
		CHR15: {
			name: 'chr15',
			len: 102531392,
			major: true
		},
		CHR16: {
			name: 'chr16',
			len: 90354753,
			major: true
		},
		CHR17: {
			name: 'chr17',
			len: 81195210,
			major: true
		},
		CHR18: {
			name: 'chr18',
			len: 78077248,
			major: true
		},
		CHR19: {
			name: 'chr19',
			len: 59128983,
			major: true
		},
		CHR20: {
			name: 'chr20',
			len: 63025520,
			major: true
		},
		CHR21: {
			name: 'chr21',
			len: 48129895,
			major: true
		},
		CHR22: {
			name: 'chr22',
			len: 51304566,
			major: true
		},
		CHRX: {
			name: 'chrX',
			len: 155270560,
			major: true
		},
		CHRY: {
			name: 'chrY',
			len: 59373566,
			major: true
		},
		CHRM: {
			name: 'chrM',
			len: 16571,
			major: true
		},
		CHR6_SSTO_HAP7: {
			name: 'chr6_ssto_hap7',
			len: 4928567
		},
		CHR6_MCF_HAP5: {
			name: 'chr6_mcf_hap5',
			len: 4833398
		},
		CHR6_COX_HAP2: {
			name: 'chr6_cox_hap2',
			len: 4795371
		},
		CHR6_MANN_HAP4: {
			name: 'chr6_mann_hap4',
			len: 4683263
		},
		CHR6_APD_HAP1: {
			name: 'chr6_apd_hap1',
			len: 4622290
		},
		CHR6_QBL_HAP6: {
			name: 'chr6_qbl_hap6',
			len: 4611984
		},
		CHR6_DBB_HAP3: {
			name: 'chr6_dbb_hap3',
			len: 4610396
		},
		CHR17_CTG5_HAP1: {
			name: 'chr17_ctg5_hap1',
			len: 1680828
		},
		CHR4_CTG9_HAP1: {
			name: 'chr4_ctg9_hap1',
			len: 590426
		},
		CHR1_GL000192_RANDOM: {
			name: 'chr1_gl000192_random',
			len: 547496
		},
		CHRUN_GL000225: {
			name: 'chrUn_gl000225',
			len: 211173
		},
		CHR4_GL000194_RANDOM: {
			name: 'chr4_gl000194_random',
			len: 191469
		},
		CHR4_GL000193_RANDOM: {
			name: 'chr4_gl000193_random',
			len: 189789
		},
		CHR9_GL000200_RANDOM: {
			name: 'chr9_gl000200_random',
			len: 187035
		},
		CHRUN_GL000222: {
			name: 'chrUn_gl000222',
			len: 186861
		},
		CHRUN_GL000212: {
			name: 'chrUn_gl000212',
			len: 186858
		},
		CHR7_GL000195_RANDOM: {
			name: 'chr7_gl000195_random',
			len: 182896
		},
		CHRUN_GL000223: {
			name: 'chrUn_gl000223',
			len: 180455
		},
		CHRUN_GL000224: {
			name: 'chrUn_gl000224',
			len: 179693
		},
		CHRUN_GL000219: {
			name: 'chrUn_gl000219',
			len: 179198
		},
		CHR17_GL000205_RANDOM: {
			name: 'chr17_gl000205_random',
			len: 174588
		},
		CHRUN_GL000215: {
			name: 'chrUn_gl000215',
			len: 172545
		},
		CHRUN_GL000216: {
			name: 'chrUn_gl000216',
			len: 172294
		},
		CHRUN_GL000217: {
			name: 'chrUn_gl000217',
			len: 172149
		},
		CHR9_GL000199_RANDOM: {
			name: 'chr9_gl000199_random',
			len: 169874
		},
		CHRUN_GL000211: {
			name: 'chrUn_gl000211',
			len: 166566
		},
		CHRUN_GL000213: {
			name: 'chrUn_gl000213',
			len: 164239
		},
		CHRUN_GL000220: {
			name: 'chrUn_gl000220',
			len: 161802
		},
		CHRUN_GL000218: {
			name: 'chrUn_gl000218',
			len: 161147
		},
		CHR19_GL000209_RANDOM: {
			name: 'chr19_gl000209_random',
			len: 159169
		},
		CHRUN_GL000221: {
			name: 'chrUn_gl000221',
			len: 155397
		},
		CHRUN_GL000214: {
			name: 'chrUn_gl000214',
			len: 137718
		},
		CHRUN_GL000228: {
			name: 'chrUn_gl000228',
			len: 129120
		},
		CHRUN_GL000227: {
			name: 'chrUn_gl000227',
			len: 128374
		},
		CHR1_GL000191_RANDOM: {
			name: 'chr1_gl000191_random',
			len: 106433
		},
		CHR19_GL000208_RANDOM: {
			name: 'chr19_gl000208_random',
			len: 92689
		},
		CHR9_GL000198_RANDOM: {
			name: 'chr9_gl000198_random',
			len: 90085
		},
		CHR17_GL000204_RANDOM: {
			name: 'chr17_gl000204_random',
			len: 81310
		},
		CHRUN_GL000233: {
			name: 'chrUn_gl000233',
			len: 45941
		},
		CHRUN_GL000237: {
			name: 'chrUn_gl000237',
			len: 45867
		},
		CHRUN_GL000230: {
			name: 'chrUn_gl000230',
			len: 43691
		},
		CHRUN_GL000242: {
			name: 'chrUn_gl000242',
			len: 43523
		},
		CHRUN_GL000243: {
			name: 'chrUn_gl000243',
			len: 43341
		},
		CHRUN_GL000241: {
			name: 'chrUn_gl000241',
			len: 42152
		},
		CHRUN_GL000236: {
			name: 'chrUn_gl000236',
			len: 41934
		},
		CHRUN_GL000240: {
			name: 'chrUn_gl000240',
			len: 41933
		},
		CHR17_GL000206_RANDOM: {
			name: 'chr17_gl000206_random',
			len: 41001
		},
		CHRUN_GL000232: {
			name: 'chrUn_gl000232',
			len: 40652
		},
		CHRUN_GL000234: {
			name: 'chrUn_gl000234',
			len: 40531
		},
		CHR11_GL000202_RANDOM: {
			name: 'chr11_gl000202_random',
			len: 40103
		},
		CHRUN_GL000238: {
			name: 'chrUn_gl000238',
			len: 39939
		},
		CHRUN_GL000244: {
			name: 'chrUn_gl000244',
			len: 39929
		},
		CHRUN_GL000248: {
			name: 'chrUn_gl000248',
			len: 39786
		},
		CHR8_GL000196_RANDOM: {
			name: 'chr8_gl000196_random',
			len: 38914
		},
		CHRUN_GL000249: {
			name: 'chrUn_gl000249',
			len: 38502
		},
		CHRUN_GL000246: {
			name: 'chrUn_gl000246',
			len: 38154
		},
		CHR17_GL000203_RANDOM: {
			name: 'chr17_gl000203_random',
			len: 37498
		},
		CHR8_GL000197_RANDOM: {
			name: 'chr8_gl000197_random',
			len: 37175
		},
		CHRUN_GL000245: {
			name: 'chrUn_gl000245',
			len: 36651
		},
		CHRUN_GL000247: {
			name: 'chrUn_gl000247',
			len: 36422
		},
		CHR9_GL000201_RANDOM: {
			name: 'chr9_gl000201_random',
			len: 36148
		},
		CHRUN_GL000235: {
			name: 'chrUn_gl000235',
			len: 34474
		},
		CHRUN_GL000239: {
			name: 'chrUn_gl000239',
			len: 33824
		},
		CHR21_GL000210_RANDOM: {
			name: 'chr21_gl000210_random',
			len: 27682
		},
		CHRUN_GL000231: {
			name: 'chrUn_gl000231',
			len: 27386
		},
		CHRUN_GL000229: {
			name: 'chrUn_gl000229',
			len: 19913
		},
		CHRUN_GL000226: {
			name: 'chrUn_gl000226',
			len: 15008
		},
		CHR18_GL000207_RANDOM: {
			name: 'chr18_gl000207_random',
			len: 4262
		}
	}
}

export const hg38 = {
	species: 'human',
	name: 'hg38',
	hasSNP: true,
	hasIdeogram: false,
	hasClinvarVCF: true,
	fimo_motif: true,
	blat: false,
	defaultcoord: {
		chr: 'chr17',
		start: 7666657,
		stop: 7688274
	},
	majorchr: {
		chr1: 248956422,
		chr2: 242193529,
		chr3: 198295559,
		chr4: 190214555,
		chr5: 181538259,
		chr6: 170805979,
		chr7: 159345973,
		chr8: 145138636,
		chr9: 138394717,
		chr10: 133797422,
		chr11: 135086622,
		chr12: 133275309,
		chr13: 114364328,
		chr14: 107043718,
		chr15: 101991189,
		chr16: 90338345,
		chr17: 83257441,
		chr18: 80373285,
		chr19: 58617616,
		chr20: 64444167,
		chr21: 46709983,
		chr22: 50818468,
		chrX: 156040895,
		chrY: 57227415,
		chrM: 16569
	},
	majorchrorder: [
		'chr1',
		'chr2',
		'chr3',
		'chr4',
		'chr5',
		'chr6',
		'chr7',
		'chr8',
		'chr9',
		'chr10',
		'chr11',
		'chr12',
		'chr13',
		'chr14',
		'chr15',
		'chr16',
		'chr17',
		'chr18',
		'chr19',
		'chr20',
		'chr21',
		'chr22',
		'chrX',
		'chrY',
		'chrM'
	],
	minorchr: {
		chr15_KI270905v1_alt: 5161414,
		chr6_GL000256v2_alt: 4929269,
		chr6_GL000254v2_alt: 4827813,
		chr6_GL000251v2_alt: 4795265,
		chr6_GL000253v2_alt: 4677643,
		chr6_GL000250v2_alt: 4672374,
		chr6_GL000255v2_alt: 4606388,
		chr6_GL000252v2_alt: 4604811,
		chr17_KI270857v1_alt: 2877074,
		chr16_KI270853v1_alt: 2659700,
		chr16_KI270728v1_random: 1872759,
		chr17_GL000258v2_alt: 1821992,
		chr5_GL339449v2_alt: 1612928,
		chr14_KI270847v1_alt: 1511111,
		chr17_KI270908v1_alt: 1423190,
		chr14_KI270846v1_alt: 1351393,
		chr5_KI270897v1_alt: 1144418,
		chr7_KI270803v1_alt: 1111570,
		chr19_GL949749v2_alt: 1091841,
		chr19_KI270938v1_alt: 1066800,
		chr19_GL949750v2_alt: 1066390,
		chr19_GL949748v2_alt: 1064304,
		chr19_GL949751v2_alt: 1002683,
		chr19_GL949746v1_alt: 987716,
		chr19_GL949752v1_alt: 987100,
		chr8_KI270821v1_alt: 985506,
		chr1_KI270763v1_alt: 911658,
		chr6_KI270801v1_alt: 870480,
		chr19_GL949753v2_alt: 796479,
		chr19_GL949747v2_alt: 729520,
		chr8_KI270822v1_alt: 624492,
		chr4_GL000257v2_alt: 586476,
		chr12_KI270904v1_alt: 572349,
		chr4_KI270925v1_alt: 555799,
		chr15_KI270852v1_alt: 478999,
		chr15_KI270727v1_random: 448248,
		chr9_KI270823v1_alt: 439082,
		chr15_KI270850v1_alt: 430880,
		chr1_KI270759v1_alt: 425601,
		chr12_GL877876v1_alt: 408271,
		chrUn_KI270442v1: 392061,
		chr17_KI270862v1_alt: 391357,
		chr15_GL383555v2_alt: 388773,
		chr19_GL383573v1_alt: 385657,
		chr4_KI270896v1_alt: 378547,
		chr4_GL383528v1_alt: 376187,
		chr17_GL383563v3_alt: 375691,
		chr8_KI270810v1_alt: 374415,
		chr1_GL383520v2_alt: 366580,
		chr1_KI270762v1_alt: 354444,
		chr15_KI270848v1_alt: 327382,
		chr17_KI270909v1_alt: 325800,
		chr14_KI270844v1_alt: 322166,
		chr8_KI270900v1_alt: 318687,
		chr10_GL383546v1_alt: 309802,
		chr13_KI270838v1_alt: 306913,
		chr8_KI270816v1_alt: 305841,
		chr22_KI270879v1_alt: 304135,
		chr8_KI270813v1_alt: 300230,
		chr11_KI270831v1_alt: 296895,
		chr15_GL383554v1_alt: 296527,
		chr8_KI270811v1_alt: 292436,
		chr18_GL383567v1_alt: 289831,
		chrX_KI270880v1_alt: 284869,
		chr8_KI270812v1_alt: 282736,
		chr19_KI270921v1_alt: 282224,
		chr17_KI270729v1_random: 280839,
		chr17_JH159146v1_alt: 278131,
		chrX_KI270913v1_alt: 274009,
		chr6_KI270798v1_alt: 271782,
		chr7_KI270808v1_alt: 271455,
		chr22_KI270876v1_alt: 263666,
		chr15_KI270851v1_alt: 263054,
		chr22_KI270875v1_alt: 259914,
		chr1_KI270766v1_alt: 256271,
		chr19_KI270882v1_alt: 248807,
		chr3_KI270778v1_alt: 248252,
		chr15_KI270849v1_alt: 244917,
		chr4_KI270786v1_alt: 244096,
		chr12_KI270835v1_alt: 238139,
		chr17_KI270858v1_alt: 235827,
		chr19_KI270867v1_alt: 233762,
		chr16_KI270855v1_alt: 232857,
		chr8_KI270926v1_alt: 229282,
		chr5_GL949742v1_alt: 226852,
		chr3_KI270780v1_alt: 224108,
		chr17_GL383565v1_alt: 223995,
		chr2_KI270774v1_alt: 223625,
		chr4_KI270790v1_alt: 220246,
		chr11_KI270927v1_alt: 218612,
		chr19_KI270932v1_alt: 215732,
		chr11_KI270903v1_alt: 214625,
		chr2_KI270894v1_alt: 214158,
		chr14_GL000225v1_random: 211173,
		chrUn_KI270743v1: 210658,
		chr11_KI270832v1_alt: 210133,
		chr7_KI270805v1_alt: 209988,
		chr4_GL000008v2_random: 209709,
		chr7_KI270809v1_alt: 209586,
		chr19_KI270887v1_alt: 209512,
		chr4_KI270789v1_alt: 205944,
		chr3_KI270779v1_alt: 205312,
		chr19_KI270914v1_alt: 205194,
		chr19_KI270886v1_alt: 204239,
		chr11_KI270829v1_alt: 204059,
		chr14_GL000009v2_random: 201709,
		chr21_GL383579v2_alt: 201197,
		chr11_JH159136v1_alt: 200998,
		chr19_KI270930v1_alt: 200773,
		chrUn_KI270747v1: 198735,
		chr18_GL383571v1_alt: 198278,
		chr19_KI270920v1_alt: 198005,
		chr6_KI270797v1_alt: 197536,
		chr3_KI270935v1_alt: 197351,
		chr17_KI270861v1_alt: 196688,
		chr15_KI270906v1_alt: 196384,
		chr5_KI270791v1_alt: 195710,
		chr14_KI270722v1_random: 194050,
		chr16_GL383556v1_alt: 192462,
		chr13_KI270840v1_alt: 191684,
		chr14_GL000194v1_random: 191469,
		chr11_JH159137v1_alt: 191409,
		chr19_KI270917v1_alt: 190932,
		chr7_KI270899v1_alt: 190869,
		chr19_KI270923v1_alt: 189352,
		chr10_KI270825v1_alt: 188315,
		chr19_GL383576v1_alt: 188024,
		chr19_KI270922v1_alt: 187935,
		chrUn_KI270742v1: 186739,
		chr22_KI270878v1_alt: 186262,
		chr19_KI270929v1_alt: 186203,
		chr11_KI270826v1_alt: 186169,
		chr6_KB021644v2_alt: 185823,
		chr17_GL000205v2_random: 185591,
		chr1_KI270765v1_alt: 185285,
		chr19_KI270916v1_alt: 184516,
		chr19_KI270890v1_alt: 184499,
		chr3_KI270784v1_alt: 184404,
		chr12_GL383551v1_alt: 184319,
		chr20_KI270870v1_alt: 183433,
		chrUn_GL000195v1: 182896,
		chr1_GL383518v1_alt: 182439,
		chr22_KI270736v1_random: 181920,
		chr10_KI270824v1_alt: 181496,
		chr14_KI270845v1_alt: 180703,
		chr3_GL383526v1_alt: 180671,
		chr13_KI270839v1_alt: 180306,
		chr22_KI270733v1_random: 179772,
		chrUn_GL000224v1: 179693,
		chr10_GL383545v1_alt: 179254,
		chrUn_GL000219v1: 179198,
		chr5_KI270792v1_alt: 179043,
		chr17_KI270860v1_alt: 178921,
		chr19_GL000209v2_alt: 177381,
		chr11_KI270830v1_alt: 177092,
		chr9_KI270719v1_random: 176845,
		chrUn_GL000216v2: 176608,
		chr22_KI270928v1_alt: 176103,
		chr1_KI270712v1_random: 176043,
		chr6_KI270800v1_alt: 175808,
		chr1_KI270706v1_random: 175055,
		chr2_KI270776v1_alt: 174166,
		chr18_KI270912v1_alt: 174061,
		chr3_KI270777v1_alt: 173649,
		chr5_GL383531v1_alt: 173459,
		chr3_JH636055v2_alt: 173151,
		chr14_KI270725v1_random: 172810,
		chr5_KI270796v1_alt: 172708,
		chr9_GL383541v1_alt: 171286,
		chr19_KI270885v1_alt: 171027,
		chr19_KI270919v1_alt: 170701,
		chr19_KI270889v1_alt: 170698,
		chr19_KI270891v1_alt: 170680,
		chr19_KI270915v1_alt: 170665,
		chr19_KI270933v1_alt: 170537,
		chr19_KI270883v1_alt: 170399,
		chr19_GL383575v2_alt: 170222,
		chr19_KI270931v1_alt: 170148,
		chr12_GL383550v2_alt: 169178,
		chr13_KI270841v1_alt: 169134,
		chrUn_KI270744v1: 168472,
		chr18_KI270863v1_alt: 167999,
		chr18_GL383569v1_alt: 167950,
		chr12_GL877875v1_alt: 167313,
		chr21_KI270874v1_alt: 166743,
		chr3_KI270924v1_alt: 166540,
		chr1_KI270761v1_alt: 165834,
		chr3_KI270937v1_alt: 165607,
		chr22_KI270734v1_random: 165050,
		chr18_GL383570v1_alt: 164789,
		chr5_KI270794v1_alt: 164558,
		chr4_GL383527v1_alt: 164536,
		chrUn_GL000213v1: 164239,
		chr3_KI270936v1_alt: 164170,
		chr3_KI270934v1_alt: 163458,
		chr9_GL383539v1_alt: 162988,
		chr3_KI270895v1_alt: 162896,
		chr22_GL383582v2_alt: 162811,
		chr3_KI270782v1_alt: 162429,
		chr1_KI270892v1_alt: 162212,
		chrUn_GL000220v1: 161802,
		chr2_KI270767v1_alt: 161578,
		chr2_KI270715v1_random: 161471,
		chr2_KI270893v1_alt: 161218,
		chrUn_GL000218v1: 161147,
		chr18_GL383572v1_alt: 159547,
		chr8_KI270817v1_alt: 158983,
		chr4_KI270788v1_alt: 158965,
		chrUn_KI270749v1: 158759,
		chr7_KI270806v1_alt: 158166,
		chr7_KI270804v1_alt: 157952,
		chr18_KI270911v1_alt: 157710,
		chrUn_KI270741v1: 157432,
		chr17_KI270910v1_alt: 157099,
		chr19_KI270884v1_alt: 157053,
		chr19_GL383574v1_alt: 155864,
		chr19_KI270888v1_alt: 155532,
		chr3_GL000221v1_random: 155397,
		chr11_GL383547v1_alt: 154407,
		chr2_KI270716v1_random: 153799,
		chr12_GL383553v2_alt: 152874,
		chr6_KI270799v1_alt: 152148,
		chr22_KI270731v1_random: 150754,
		chrUn_KI270751v1: 150742,
		chrUn_KI270750v1: 148850,
		chr8_KI270818v1_alt: 145606,
		chrX_KI270881v1_alt: 144206,
		chr21_KI270873v1_alt: 143900,
		chr2_GL383521v1_alt: 143390,
		chr8_KI270814v1_alt: 141812,
		chr12_GL383552v1_alt: 138655,
		chrUn_KI270519v1: 138126,
		chr2_KI270775v1_alt: 138019,
		chr17_KI270907v1_alt: 137721,
		chrUn_GL000214v1: 137718,
		chr8_KI270901v1_alt: 136959,
		chr2_KI270770v1_alt: 136240,
		chr16_KI270854v1_alt: 134193,
		chr8_KI270819v1_alt: 133535,
		chr17_GL383564v2_alt: 133151,
		chr2_KI270772v1_alt: 133041,
		chr8_KI270815v1_alt: 132244,
		chr5_KI270795v1_alt: 131892,
		chr5_KI270898v1_alt: 130957,
		chr20_GL383577v2_alt: 128386,
		chr1_KI270708v1_random: 127682,
		chr7_KI270807v1_alt: 126434,
		chr5_KI270793v1_alt: 126136,
		chr6_GL383533v1_alt: 124736,
		chr2_GL383522v1_alt: 123821,
		chr19_KI270918v1_alt: 123111,
		chr12_GL383549v1_alt: 120804,
		chr2_KI270769v1_alt: 120616,
		chr4_KI270785v1_alt: 119912,
		chr12_KI270834v1_alt: 119498,
		chr7_GL383534v2_alt: 119183,
		chr20_KI270869v1_alt: 118774,
		chr21_GL383581v2_alt: 116689,
		chr3_KI270781v1_alt: 113034,
		chr17_KI270730v1_random: 112551,
		chrUn_KI270438v1: 112505,
		chr4_KI270787v1_alt: 111943,
		chr18_KI270864v1_alt: 111737,
		chr2_KI270771v1_alt: 110395,
		chr1_GL383519v1_alt: 110268,
		chr2_KI270768v1_alt: 110099,
		chr1_KI270760v1_alt: 109528,
		chr3_KI270783v1_alt: 109187,
		chr17_KI270859v1_alt: 108763,
		chr11_KI270902v1_alt: 106711,
		chr18_GL383568v1_alt: 104552,
		chr22_KI270737v1_random: 103838,
		chr13_KI270843v1_alt: 103832,
		chr22_KI270877v1_alt: 101331,
		chr5_GL383530v1_alt: 101241,
		chr11_KI270721v1_random: 100316,
		chr22_KI270738v1_random: 99375,
		chr22_GL383583v2_alt: 96924,
		chr2_GL582966v2_alt: 96131,
		chrUn_KI270748v1: 93321,
		chrUn_KI270435v1: 92983,
		chr5_GL000208v1_random: 92689,
		chrUn_KI270538v1: 91309,
		chr17_GL383566v1_alt: 90219,
		chr16_GL383557v1_alt: 89672,
		chr17_JH159148v1_alt: 88070,
		chr5_GL383532v1_alt: 82728,
		chr21_KI270872v1_alt: 82692,
		chrUn_KI270756v1: 79590,
		chr6_KI270758v1_alt: 76752,
		chr12_KI270833v1_alt: 76061,
		chr6_KI270802v1_alt: 75005,
		chr21_GL383580v2_alt: 74653,
		chr22_KB663609v1_alt: 74013,
		chr22_KI270739v1_random: 73985,
		chr9_GL383540v1_alt: 71551,
		chrUn_KI270757v1: 71251,
		chr2_KI270773v1_alt: 70887,
		chr17_JH159147v1_alt: 70345,
		chr11_KI270827v1_alt: 67707,
		chr1_KI270709v1_random: 66860,
		chrUn_KI270746v1: 66486,
		chr16_KI270856v1_alt: 63982,
		chr21_GL383578v2_alt: 63917,
		chrUn_KI270753v1: 62944,
		chr19_KI270868v1_alt: 61734,
		chr9_GL383542v1_alt: 60032,
		chr20_KI270871v1_alt: 58661,
		chr12_KI270836v1_alt: 56134,
		chr19_KI270865v1_alt: 52969,
		chr1_KI270764v1_alt: 50258,
		chrUn_KI270589v1: 44474,
		chr14_KI270726v1_random: 43739,
		chr19_KI270866v1_alt: 43156,
		chr22_KI270735v1_random: 42811,
		chr1_KI270711v1_random: 42210,
		chrUn_KI270745v1: 41891,
		chr1_KI270714v1_random: 41717,
		chr22_KI270732v1_random: 41543,
		chr1_KI270713v1_random: 40745,
		chrUn_KI270754v1: 40191,
		chr1_KI270710v1_random: 40176,
		chr12_KI270837v1_alt: 40090,
		chr9_KI270717v1_random: 40062,
		chr14_KI270724v1_random: 39555,
		chr9_KI270720v1_random: 39050,
		chr14_KI270723v1_random: 38115,
		chr9_KI270718v1_random: 38054,
		chrUn_KI270317v1: 37690,
		chr13_KI270842v1_alt: 37287,
		chrY_KI270740v1_random: 37240,
		chrUn_KI270755v1: 36723,
		chr8_KI270820v1_alt: 36640,
		chr1_KI270707v1_random: 32032,
		chrUn_KI270579v1: 31033,
		chrUn_KI270752v1: 27745,
		chrUn_KI270512v1: 22689,
		chrUn_KI270322v1: 21476,
		chrUn_GL000226v1: 15008,
		chrUn_KI270311v1: 12399,
		chrUn_KI270366v1: 8320,
		chrUn_KI270511v1: 8127,
		chrUn_KI270448v1: 7992,
		chrUn_KI270521v1: 7642,
		chrUn_KI270581v1: 7046,
		chrUn_KI270582v1: 6504,
		chrUn_KI270515v1: 6361,
		chrUn_KI270588v1: 6158,
		chrUn_KI270591v1: 5796,
		chrUn_KI270522v1: 5674,
		chrUn_KI270507v1: 5353,
		chrUn_KI270590v1: 4685,
		chrUn_KI270584v1: 4513,
		chrUn_KI270320v1: 4416,
		chrUn_KI270382v1: 4215,
		chrUn_KI270468v1: 4055,
		chrUn_KI270467v1: 3920,
		chrUn_KI270362v1: 3530,
		chrUn_KI270517v1: 3253,
		chrUn_KI270593v1: 3041,
		chrUn_KI270528v1: 2983,
		chrUn_KI270587v1: 2969,
		chrUn_KI270364v1: 2855,
		chrUn_KI270371v1: 2805,
		chrUn_KI270333v1: 2699,
		chrUn_KI270374v1: 2656,
		chrUn_KI270411v1: 2646,
		chrUn_KI270414v1: 2489,
		chrUn_KI270510v1: 2415,
		chrUn_KI270390v1: 2387,
		chrUn_KI270375v1: 2378,
		chrUn_KI270420v1: 2321,
		chrUn_KI270509v1: 2318,
		chrUn_KI270315v1: 2276,
		chrUn_KI270302v1: 2274,
		chrUn_KI270518v1: 2186,
		chrUn_KI270530v1: 2168,
		chrUn_KI270304v1: 2165,
		chrUn_KI270418v1: 2145,
		chrUn_KI270424v1: 2140,
		chrUn_KI270417v1: 2043,
		chrUn_KI270508v1: 1951,
		chrUn_KI270303v1: 1942,
		chrUn_KI270381v1: 1930,
		chrUn_KI270529v1: 1899,
		chrUn_KI270425v1: 1884,
		chrUn_KI270396v1: 1880,
		chrUn_KI270363v1: 1803,
		chrUn_KI270386v1: 1788,
		chrUn_KI270465v1: 1774,
		chrUn_KI270383v1: 1750,
		chrUn_KI270384v1: 1658,
		chrUn_KI270330v1: 1652,
		chrUn_KI270372v1: 1650,
		chrUn_KI270548v1: 1599,
		chrUn_KI270580v1: 1553,
		chrUn_KI270387v1: 1537,
		chrUn_KI270391v1: 1484,
		chrUn_KI270305v1: 1472,
		chrUn_KI270373v1: 1451,
		chrUn_KI270422v1: 1445,
		chrUn_KI270316v1: 1444,
		chrUn_KI270338v1: 1428,
		chrUn_KI270340v1: 1428,
		chrUn_KI270583v1: 1400,
		chrUn_KI270334v1: 1368,
		chrUn_KI270429v1: 1361,
		chrUn_KI270393v1: 1308,
		chrUn_KI270516v1: 1300,
		chrUn_KI270389v1: 1298,
		chrUn_KI270466v1: 1233,
		chrUn_KI270388v1: 1216,
		chrUn_KI270544v1: 1202,
		chrUn_KI270310v1: 1201,
		chrUn_KI270412v1: 1179,
		chrUn_KI270395v1: 1143,
		chrUn_KI270376v1: 1136,
		chrUn_KI270337v1: 1121,
		chrUn_KI270335v1: 1048,
		chrUn_KI270378v1: 1048,
		chrUn_KI270379v1: 1045,
		chrUn_KI270329v1: 1040,
		chrUn_KI270419v1: 1029,
		chrUn_KI270336v1: 1026,
		chrUn_KI270312v1: 998,
		chrUn_KI270539v1: 993,
		chrUn_KI270385v1: 990,
		chrUn_KI270423v1: 981,
		chrUn_KI270392v1: 971,
		chrUn_KI270394v1: 970
	},
	tracks: [
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/refGene.hg38.gz',
			type: 'bedj',
			name: 'RefGene',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D',
			tkid: '0.3849374642211274'
		},
		{
			__isgene: true,
			file: 'anno/gencode.v41.hg38.gz',
			translatecoding: true,
			categories: {
				coding: {
					color: '#004D99',
					label: 'Coding gene'
				},
				nonCoding: {
					color: '#009933',
					label: 'Noncoding gene'
				},
				problem: {
					color: '#FF3300',
					label: 'Problem'
				},
				pseudo: {
					color: '#FF00CC',
					label: 'Pseudogene'
				}
			},
			type: 'bedj',
			name: 'GENCODE v41',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			tkid: '0.23942119070721857'
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.hg38.gz',
			onerow: true,
			categories: {
				SINE: {
					color: '#ED8C8E',
					label: 'SINE'
				},
				LINE: {
					color: '#EDCB8C',
					label: 'LINE'
				},
				LTR: {
					color: '#E38CED',
					label: 'LTR'
				},
				DNA: {
					color: '#8C8EED',
					label: 'DNA transposon'
				},
				simple: {
					color: '#8EB88C',
					label: 'Simple repeats'
				},
				low_complexity: {
					color: '#ACEBA9',
					label: 'Low complexity'
				},
				satellite: {
					color: '#B59A84',
					label: 'Satellite'
				},
				RNA: {
					color: '#9DE0E0',
					label: 'RNA repeat'
				},
				other: {
					color: '#9BADC2',
					label: 'Other'
				},
				unknown: {
					color: '#858585',
					label: 'Unknown'
				}
			},
			tkid: '0.26252843297840034'
		}
	],
	hicenzymefragment: [
		{
			enzyme: 'DpnII',
			file: 'anno/hicFragment/hic.DpnII.hg38.gz'
		},
		{
			enzyme: 'EcoRI',
			file: 'anno/hicFragment/hic.EcoRI.hg38.gz'
		},
		{
			enzyme: 'HindIII',
			file: 'anno/hicFragment/hic.HindIII.hg38.gz'
		},
		{
			enzyme: 'MboI',
			file: 'anno/hicFragment/hic.MboI.hg38.gz'
		},
		{
			enzyme: 'NcoI',
			file: 'anno/hicFragment/hic.NcoI.hg38.gz'
		}
	],
	datasets: {
		ClinVar: {
			isMds3: true,
			label: 'ClinVar'
		},
		SJLife: {
			isMds3: true,
			noHandleOnClient: 1,
			label: 'SJLife'
		},
		MB_meta_analysis: {
			isMds3: true,
			label: 'MB_meta_analysis'
		},
		ASH: {
			isMds3: true,
			label: 'ASH'
		},
		'ALL-pharmacotyping': {
			isMds3: true,
			label: 'ALL-pharmacotyping'
		},
		GDC: {
			isMds3: true,
			label: 'GDC'
		},
		IHG: {
			isMds3: true,
			label: 'IHG'
		}
	},
	termdbs: {
		msigdb: {
			label: 'MSigDB'
		}
	},
	tkset: [],
	isoformcache: {},
	junctionframecache: {},
	chrlookup: {
		CHR1: {
			name: 'chr1',
			len: 248956422,
			major: true
		},
		CHR2: {
			name: 'chr2',
			len: 242193529,
			major: true
		},
		CHR3: {
			name: 'chr3',
			len: 198295559,
			major: true
		},
		CHR4: {
			name: 'chr4',
			len: 190214555,
			major: true
		},
		CHR5: {
			name: 'chr5',
			len: 181538259,
			major: true
		},
		CHR6: {
			name: 'chr6',
			len: 170805979,
			major: true
		},
		CHR7: {
			name: 'chr7',
			len: 159345973,
			major: true
		},
		CHR8: {
			name: 'chr8',
			len: 145138636,
			major: true
		},
		CHR9: {
			name: 'chr9',
			len: 138394717,
			major: true
		},
		CHR10: {
			name: 'chr10',
			len: 133797422,
			major: true
		},
		CHR11: {
			name: 'chr11',
			len: 135086622,
			major: true
		},
		CHR12: {
			name: 'chr12',
			len: 133275309,
			major: true
		},
		CHR13: {
			name: 'chr13',
			len: 114364328,
			major: true
		},
		CHR14: {
			name: 'chr14',
			len: 107043718,
			major: true
		},
		CHR15: {
			name: 'chr15',
			len: 101991189,
			major: true
		},
		CHR16: {
			name: 'chr16',
			len: 90338345,
			major: true
		},
		CHR17: {
			name: 'chr17',
			len: 83257441,
			major: true
		},
		CHR18: {
			name: 'chr18',
			len: 80373285,
			major: true
		},
		CHR19: {
			name: 'chr19',
			len: 58617616,
			major: true
		},
		CHR20: {
			name: 'chr20',
			len: 64444167,
			major: true
		},
		CHR21: {
			name: 'chr21',
			len: 46709983,
			major: true
		},
		CHR22: {
			name: 'chr22',
			len: 50818468,
			major: true
		},
		CHRX: {
			name: 'chrX',
			len: 156040895,
			major: true
		},
		CHRY: {
			name: 'chrY',
			len: 57227415,
			major: true
		},
		CHRM: {
			name: 'chrM',
			len: 16569,
			major: true
		},
		CHR15_KI270905V1_ALT: {
			name: 'chr15_KI270905v1_alt',
			len: 5161414
		},
		CHR6_GL000256V2_ALT: {
			name: 'chr6_GL000256v2_alt',
			len: 4929269
		},
		CHR6_GL000254V2_ALT: {
			name: 'chr6_GL000254v2_alt',
			len: 4827813
		},
		CHR6_GL000251V2_ALT: {
			name: 'chr6_GL000251v2_alt',
			len: 4795265
		},
		CHR6_GL000253V2_ALT: {
			name: 'chr6_GL000253v2_alt',
			len: 4677643
		},
		CHR6_GL000250V2_ALT: {
			name: 'chr6_GL000250v2_alt',
			len: 4672374
		},
		CHR6_GL000255V2_ALT: {
			name: 'chr6_GL000255v2_alt',
			len: 4606388
		},
		CHR6_GL000252V2_ALT: {
			name: 'chr6_GL000252v2_alt',
			len: 4604811
		},
		CHR17_KI270857V1_ALT: {
			name: 'chr17_KI270857v1_alt',
			len: 2877074
		},
		CHR16_KI270853V1_ALT: {
			name: 'chr16_KI270853v1_alt',
			len: 2659700
		},
		CHR16_KI270728V1_RANDOM: {
			name: 'chr16_KI270728v1_random',
			len: 1872759
		},
		CHR17_GL000258V2_ALT: {
			name: 'chr17_GL000258v2_alt',
			len: 1821992
		},
		CHR5_GL339449V2_ALT: {
			name: 'chr5_GL339449v2_alt',
			len: 1612928
		},
		CHR14_KI270847V1_ALT: {
			name: 'chr14_KI270847v1_alt',
			len: 1511111
		},
		CHR17_KI270908V1_ALT: {
			name: 'chr17_KI270908v1_alt',
			len: 1423190
		},
		CHR14_KI270846V1_ALT: {
			name: 'chr14_KI270846v1_alt',
			len: 1351393
		},
		CHR5_KI270897V1_ALT: {
			name: 'chr5_KI270897v1_alt',
			len: 1144418
		},
		CHR7_KI270803V1_ALT: {
			name: 'chr7_KI270803v1_alt',
			len: 1111570
		},
		CHR19_GL949749V2_ALT: {
			name: 'chr19_GL949749v2_alt',
			len: 1091841
		},
		CHR19_KI270938V1_ALT: {
			name: 'chr19_KI270938v1_alt',
			len: 1066800
		},
		CHR19_GL949750V2_ALT: {
			name: 'chr19_GL949750v2_alt',
			len: 1066390
		},
		CHR19_GL949748V2_ALT: {
			name: 'chr19_GL949748v2_alt',
			len: 1064304
		},
		CHR19_GL949751V2_ALT: {
			name: 'chr19_GL949751v2_alt',
			len: 1002683
		},
		CHR19_GL949746V1_ALT: {
			name: 'chr19_GL949746v1_alt',
			len: 987716
		},
		CHR19_GL949752V1_ALT: {
			name: 'chr19_GL949752v1_alt',
			len: 987100
		},
		CHR8_KI270821V1_ALT: {
			name: 'chr8_KI270821v1_alt',
			len: 985506
		},
		CHR1_KI270763V1_ALT: {
			name: 'chr1_KI270763v1_alt',
			len: 911658
		},
		CHR6_KI270801V1_ALT: {
			name: 'chr6_KI270801v1_alt',
			len: 870480
		},
		CHR19_GL949753V2_ALT: {
			name: 'chr19_GL949753v2_alt',
			len: 796479
		},
		CHR19_GL949747V2_ALT: {
			name: 'chr19_GL949747v2_alt',
			len: 729520
		},
		CHR8_KI270822V1_ALT: {
			name: 'chr8_KI270822v1_alt',
			len: 624492
		},
		CHR4_GL000257V2_ALT: {
			name: 'chr4_GL000257v2_alt',
			len: 586476
		},
		CHR12_KI270904V1_ALT: {
			name: 'chr12_KI270904v1_alt',
			len: 572349
		},
		CHR4_KI270925V1_ALT: {
			name: 'chr4_KI270925v1_alt',
			len: 555799
		},
		CHR15_KI270852V1_ALT: {
			name: 'chr15_KI270852v1_alt',
			len: 478999
		},
		CHR15_KI270727V1_RANDOM: {
			name: 'chr15_KI270727v1_random',
			len: 448248
		},
		CHR9_KI270823V1_ALT: {
			name: 'chr9_KI270823v1_alt',
			len: 439082
		},
		CHR15_KI270850V1_ALT: {
			name: 'chr15_KI270850v1_alt',
			len: 430880
		},
		CHR1_KI270759V1_ALT: {
			name: 'chr1_KI270759v1_alt',
			len: 425601
		},
		CHR12_GL877876V1_ALT: {
			name: 'chr12_GL877876v1_alt',
			len: 408271
		},
		CHRUN_KI270442V1: {
			name: 'chrUn_KI270442v1',
			len: 392061
		},
		CHR17_KI270862V1_ALT: {
			name: 'chr17_KI270862v1_alt',
			len: 391357
		},
		CHR15_GL383555V2_ALT: {
			name: 'chr15_GL383555v2_alt',
			len: 388773
		},
		CHR19_GL383573V1_ALT: {
			name: 'chr19_GL383573v1_alt',
			len: 385657
		},
		CHR4_KI270896V1_ALT: {
			name: 'chr4_KI270896v1_alt',
			len: 378547
		},
		CHR4_GL383528V1_ALT: {
			name: 'chr4_GL383528v1_alt',
			len: 376187
		},
		CHR17_GL383563V3_ALT: {
			name: 'chr17_GL383563v3_alt',
			len: 375691
		},
		CHR8_KI270810V1_ALT: {
			name: 'chr8_KI270810v1_alt',
			len: 374415
		},
		CHR1_GL383520V2_ALT: {
			name: 'chr1_GL383520v2_alt',
			len: 366580
		},
		CHR1_KI270762V1_ALT: {
			name: 'chr1_KI270762v1_alt',
			len: 354444
		},
		CHR15_KI270848V1_ALT: {
			name: 'chr15_KI270848v1_alt',
			len: 327382
		},
		CHR17_KI270909V1_ALT: {
			name: 'chr17_KI270909v1_alt',
			len: 325800
		},
		CHR14_KI270844V1_ALT: {
			name: 'chr14_KI270844v1_alt',
			len: 322166
		},
		CHR8_KI270900V1_ALT: {
			name: 'chr8_KI270900v1_alt',
			len: 318687
		},
		CHR10_GL383546V1_ALT: {
			name: 'chr10_GL383546v1_alt',
			len: 309802
		},
		CHR13_KI270838V1_ALT: {
			name: 'chr13_KI270838v1_alt',
			len: 306913
		},
		CHR8_KI270816V1_ALT: {
			name: 'chr8_KI270816v1_alt',
			len: 305841
		},
		CHR22_KI270879V1_ALT: {
			name: 'chr22_KI270879v1_alt',
			len: 304135
		},
		CHR8_KI270813V1_ALT: {
			name: 'chr8_KI270813v1_alt',
			len: 300230
		},
		CHR11_KI270831V1_ALT: {
			name: 'chr11_KI270831v1_alt',
			len: 296895
		},
		CHR15_GL383554V1_ALT: {
			name: 'chr15_GL383554v1_alt',
			len: 296527
		},
		CHR8_KI270811V1_ALT: {
			name: 'chr8_KI270811v1_alt',
			len: 292436
		},
		CHR18_GL383567V1_ALT: {
			name: 'chr18_GL383567v1_alt',
			len: 289831
		},
		CHRX_KI270880V1_ALT: {
			name: 'chrX_KI270880v1_alt',
			len: 284869
		},
		CHR8_KI270812V1_ALT: {
			name: 'chr8_KI270812v1_alt',
			len: 282736
		},
		CHR19_KI270921V1_ALT: {
			name: 'chr19_KI270921v1_alt',
			len: 282224
		},
		CHR17_KI270729V1_RANDOM: {
			name: 'chr17_KI270729v1_random',
			len: 280839
		},
		CHR17_JH159146V1_ALT: {
			name: 'chr17_JH159146v1_alt',
			len: 278131
		},
		CHRX_KI270913V1_ALT: {
			name: 'chrX_KI270913v1_alt',
			len: 274009
		},
		CHR6_KI270798V1_ALT: {
			name: 'chr6_KI270798v1_alt',
			len: 271782
		},
		CHR7_KI270808V1_ALT: {
			name: 'chr7_KI270808v1_alt',
			len: 271455
		},
		CHR22_KI270876V1_ALT: {
			name: 'chr22_KI270876v1_alt',
			len: 263666
		},
		CHR15_KI270851V1_ALT: {
			name: 'chr15_KI270851v1_alt',
			len: 263054
		},
		CHR22_KI270875V1_ALT: {
			name: 'chr22_KI270875v1_alt',
			len: 259914
		},
		CHR1_KI270766V1_ALT: {
			name: 'chr1_KI270766v1_alt',
			len: 256271
		},
		CHR19_KI270882V1_ALT: {
			name: 'chr19_KI270882v1_alt',
			len: 248807
		},
		CHR3_KI270778V1_ALT: {
			name: 'chr3_KI270778v1_alt',
			len: 248252
		},
		CHR15_KI270849V1_ALT: {
			name: 'chr15_KI270849v1_alt',
			len: 244917
		},
		CHR4_KI270786V1_ALT: {
			name: 'chr4_KI270786v1_alt',
			len: 244096
		},
		CHR12_KI270835V1_ALT: {
			name: 'chr12_KI270835v1_alt',
			len: 238139
		},
		CHR17_KI270858V1_ALT: {
			name: 'chr17_KI270858v1_alt',
			len: 235827
		},
		CHR19_KI270867V1_ALT: {
			name: 'chr19_KI270867v1_alt',
			len: 233762
		},
		CHR16_KI270855V1_ALT: {
			name: 'chr16_KI270855v1_alt',
			len: 232857
		},
		CHR8_KI270926V1_ALT: {
			name: 'chr8_KI270926v1_alt',
			len: 229282
		},
		CHR5_GL949742V1_ALT: {
			name: 'chr5_GL949742v1_alt',
			len: 226852
		},
		CHR3_KI270780V1_ALT: {
			name: 'chr3_KI270780v1_alt',
			len: 224108
		},
		CHR17_GL383565V1_ALT: {
			name: 'chr17_GL383565v1_alt',
			len: 223995
		},
		CHR2_KI270774V1_ALT: {
			name: 'chr2_KI270774v1_alt',
			len: 223625
		},
		CHR4_KI270790V1_ALT: {
			name: 'chr4_KI270790v1_alt',
			len: 220246
		},
		CHR11_KI270927V1_ALT: {
			name: 'chr11_KI270927v1_alt',
			len: 218612
		},
		CHR19_KI270932V1_ALT: {
			name: 'chr19_KI270932v1_alt',
			len: 215732
		},
		CHR11_KI270903V1_ALT: {
			name: 'chr11_KI270903v1_alt',
			len: 214625
		},
		CHR2_KI270894V1_ALT: {
			name: 'chr2_KI270894v1_alt',
			len: 214158
		},
		CHR14_GL000225V1_RANDOM: {
			name: 'chr14_GL000225v1_random',
			len: 211173
		},
		CHRUN_KI270743V1: {
			name: 'chrUn_KI270743v1',
			len: 210658
		},
		CHR11_KI270832V1_ALT: {
			name: 'chr11_KI270832v1_alt',
			len: 210133
		},
		CHR7_KI270805V1_ALT: {
			name: 'chr7_KI270805v1_alt',
			len: 209988
		},
		CHR4_GL000008V2_RANDOM: {
			name: 'chr4_GL000008v2_random',
			len: 209709
		},
		CHR7_KI270809V1_ALT: {
			name: 'chr7_KI270809v1_alt',
			len: 209586
		},
		CHR19_KI270887V1_ALT: {
			name: 'chr19_KI270887v1_alt',
			len: 209512
		},
		CHR4_KI270789V1_ALT: {
			name: 'chr4_KI270789v1_alt',
			len: 205944
		},
		CHR3_KI270779V1_ALT: {
			name: 'chr3_KI270779v1_alt',
			len: 205312
		},
		CHR19_KI270914V1_ALT: {
			name: 'chr19_KI270914v1_alt',
			len: 205194
		},
		CHR19_KI270886V1_ALT: {
			name: 'chr19_KI270886v1_alt',
			len: 204239
		},
		CHR11_KI270829V1_ALT: {
			name: 'chr11_KI270829v1_alt',
			len: 204059
		},
		CHR14_GL000009V2_RANDOM: {
			name: 'chr14_GL000009v2_random',
			len: 201709
		},
		CHR21_GL383579V2_ALT: {
			name: 'chr21_GL383579v2_alt',
			len: 201197
		},
		CHR11_JH159136V1_ALT: {
			name: 'chr11_JH159136v1_alt',
			len: 200998
		},
		CHR19_KI270930V1_ALT: {
			name: 'chr19_KI270930v1_alt',
			len: 200773
		},
		CHRUN_KI270747V1: {
			name: 'chrUn_KI270747v1',
			len: 198735
		},
		CHR18_GL383571V1_ALT: {
			name: 'chr18_GL383571v1_alt',
			len: 198278
		},
		CHR19_KI270920V1_ALT: {
			name: 'chr19_KI270920v1_alt',
			len: 198005
		},
		CHR6_KI270797V1_ALT: {
			name: 'chr6_KI270797v1_alt',
			len: 197536
		},
		CHR3_KI270935V1_ALT: {
			name: 'chr3_KI270935v1_alt',
			len: 197351
		},
		CHR17_KI270861V1_ALT: {
			name: 'chr17_KI270861v1_alt',
			len: 196688
		},
		CHR15_KI270906V1_ALT: {
			name: 'chr15_KI270906v1_alt',
			len: 196384
		},
		CHR5_KI270791V1_ALT: {
			name: 'chr5_KI270791v1_alt',
			len: 195710
		},
		CHR14_KI270722V1_RANDOM: {
			name: 'chr14_KI270722v1_random',
			len: 194050
		},
		CHR16_GL383556V1_ALT: {
			name: 'chr16_GL383556v1_alt',
			len: 192462
		},
		CHR13_KI270840V1_ALT: {
			name: 'chr13_KI270840v1_alt',
			len: 191684
		},
		CHR14_GL000194V1_RANDOM: {
			name: 'chr14_GL000194v1_random',
			len: 191469
		},
		CHR11_JH159137V1_ALT: {
			name: 'chr11_JH159137v1_alt',
			len: 191409
		},
		CHR19_KI270917V1_ALT: {
			name: 'chr19_KI270917v1_alt',
			len: 190932
		},
		CHR7_KI270899V1_ALT: {
			name: 'chr7_KI270899v1_alt',
			len: 190869
		},
		CHR19_KI270923V1_ALT: {
			name: 'chr19_KI270923v1_alt',
			len: 189352
		},
		CHR10_KI270825V1_ALT: {
			name: 'chr10_KI270825v1_alt',
			len: 188315
		},
		CHR19_GL383576V1_ALT: {
			name: 'chr19_GL383576v1_alt',
			len: 188024
		},
		CHR19_KI270922V1_ALT: {
			name: 'chr19_KI270922v1_alt',
			len: 187935
		},
		CHRUN_KI270742V1: {
			name: 'chrUn_KI270742v1',
			len: 186739
		},
		CHR22_KI270878V1_ALT: {
			name: 'chr22_KI270878v1_alt',
			len: 186262
		},
		CHR19_KI270929V1_ALT: {
			name: 'chr19_KI270929v1_alt',
			len: 186203
		},
		CHR11_KI270826V1_ALT: {
			name: 'chr11_KI270826v1_alt',
			len: 186169
		},
		CHR6_KB021644V2_ALT: {
			name: 'chr6_KB021644v2_alt',
			len: 185823
		},
		CHR17_GL000205V2_RANDOM: {
			name: 'chr17_GL000205v2_random',
			len: 185591
		},
		CHR1_KI270765V1_ALT: {
			name: 'chr1_KI270765v1_alt',
			len: 185285
		},
		CHR19_KI270916V1_ALT: {
			name: 'chr19_KI270916v1_alt',
			len: 184516
		},
		CHR19_KI270890V1_ALT: {
			name: 'chr19_KI270890v1_alt',
			len: 184499
		},
		CHR3_KI270784V1_ALT: {
			name: 'chr3_KI270784v1_alt',
			len: 184404
		},
		CHR12_GL383551V1_ALT: {
			name: 'chr12_GL383551v1_alt',
			len: 184319
		},
		CHR20_KI270870V1_ALT: {
			name: 'chr20_KI270870v1_alt',
			len: 183433
		},
		CHRUN_GL000195V1: {
			name: 'chrUn_GL000195v1',
			len: 182896
		},
		CHR1_GL383518V1_ALT: {
			name: 'chr1_GL383518v1_alt',
			len: 182439
		},
		CHR22_KI270736V1_RANDOM: {
			name: 'chr22_KI270736v1_random',
			len: 181920
		},
		CHR10_KI270824V1_ALT: {
			name: 'chr10_KI270824v1_alt',
			len: 181496
		},
		CHR14_KI270845V1_ALT: {
			name: 'chr14_KI270845v1_alt',
			len: 180703
		},
		CHR3_GL383526V1_ALT: {
			name: 'chr3_GL383526v1_alt',
			len: 180671
		},
		CHR13_KI270839V1_ALT: {
			name: 'chr13_KI270839v1_alt',
			len: 180306
		},
		CHR22_KI270733V1_RANDOM: {
			name: 'chr22_KI270733v1_random',
			len: 179772
		},
		CHRUN_GL000224V1: {
			name: 'chrUn_GL000224v1',
			len: 179693
		},
		CHR10_GL383545V1_ALT: {
			name: 'chr10_GL383545v1_alt',
			len: 179254
		},
		CHRUN_GL000219V1: {
			name: 'chrUn_GL000219v1',
			len: 179198
		},
		CHR5_KI270792V1_ALT: {
			name: 'chr5_KI270792v1_alt',
			len: 179043
		},
		CHR17_KI270860V1_ALT: {
			name: 'chr17_KI270860v1_alt',
			len: 178921
		},
		CHR19_GL000209V2_ALT: {
			name: 'chr19_GL000209v2_alt',
			len: 177381
		},
		CHR11_KI270830V1_ALT: {
			name: 'chr11_KI270830v1_alt',
			len: 177092
		},
		CHR9_KI270719V1_RANDOM: {
			name: 'chr9_KI270719v1_random',
			len: 176845
		},
		CHRUN_GL000216V2: {
			name: 'chrUn_GL000216v2',
			len: 176608
		},
		CHR22_KI270928V1_ALT: {
			name: 'chr22_KI270928v1_alt',
			len: 176103
		},
		CHR1_KI270712V1_RANDOM: {
			name: 'chr1_KI270712v1_random',
			len: 176043
		},
		CHR6_KI270800V1_ALT: {
			name: 'chr6_KI270800v1_alt',
			len: 175808
		},
		CHR1_KI270706V1_RANDOM: {
			name: 'chr1_KI270706v1_random',
			len: 175055
		},
		CHR2_KI270776V1_ALT: {
			name: 'chr2_KI270776v1_alt',
			len: 174166
		},
		CHR18_KI270912V1_ALT: {
			name: 'chr18_KI270912v1_alt',
			len: 174061
		},
		CHR3_KI270777V1_ALT: {
			name: 'chr3_KI270777v1_alt',
			len: 173649
		},
		CHR5_GL383531V1_ALT: {
			name: 'chr5_GL383531v1_alt',
			len: 173459
		},
		CHR3_JH636055V2_ALT: {
			name: 'chr3_JH636055v2_alt',
			len: 173151
		},
		CHR14_KI270725V1_RANDOM: {
			name: 'chr14_KI270725v1_random',
			len: 172810
		},
		CHR5_KI270796V1_ALT: {
			name: 'chr5_KI270796v1_alt',
			len: 172708
		},
		CHR9_GL383541V1_ALT: {
			name: 'chr9_GL383541v1_alt',
			len: 171286
		},
		CHR19_KI270885V1_ALT: {
			name: 'chr19_KI270885v1_alt',
			len: 171027
		},
		CHR19_KI270919V1_ALT: {
			name: 'chr19_KI270919v1_alt',
			len: 170701
		},
		CHR19_KI270889V1_ALT: {
			name: 'chr19_KI270889v1_alt',
			len: 170698
		},
		CHR19_KI270891V1_ALT: {
			name: 'chr19_KI270891v1_alt',
			len: 170680
		},
		CHR19_KI270915V1_ALT: {
			name: 'chr19_KI270915v1_alt',
			len: 170665
		},
		CHR19_KI270933V1_ALT: {
			name: 'chr19_KI270933v1_alt',
			len: 170537
		},
		CHR19_KI270883V1_ALT: {
			name: 'chr19_KI270883v1_alt',
			len: 170399
		},
		CHR19_GL383575V2_ALT: {
			name: 'chr19_GL383575v2_alt',
			len: 170222
		},
		CHR19_KI270931V1_ALT: {
			name: 'chr19_KI270931v1_alt',
			len: 170148
		},
		CHR12_GL383550V2_ALT: {
			name: 'chr12_GL383550v2_alt',
			len: 169178
		},
		CHR13_KI270841V1_ALT: {
			name: 'chr13_KI270841v1_alt',
			len: 169134
		},
		CHRUN_KI270744V1: {
			name: 'chrUn_KI270744v1',
			len: 168472
		},
		CHR18_KI270863V1_ALT: {
			name: 'chr18_KI270863v1_alt',
			len: 167999
		},
		CHR18_GL383569V1_ALT: {
			name: 'chr18_GL383569v1_alt',
			len: 167950
		},
		CHR12_GL877875V1_ALT: {
			name: 'chr12_GL877875v1_alt',
			len: 167313
		},
		CHR21_KI270874V1_ALT: {
			name: 'chr21_KI270874v1_alt',
			len: 166743
		},
		CHR3_KI270924V1_ALT: {
			name: 'chr3_KI270924v1_alt',
			len: 166540
		},
		CHR1_KI270761V1_ALT: {
			name: 'chr1_KI270761v1_alt',
			len: 165834
		},
		CHR3_KI270937V1_ALT: {
			name: 'chr3_KI270937v1_alt',
			len: 165607
		},
		CHR22_KI270734V1_RANDOM: {
			name: 'chr22_KI270734v1_random',
			len: 165050
		},
		CHR18_GL383570V1_ALT: {
			name: 'chr18_GL383570v1_alt',
			len: 164789
		},
		CHR5_KI270794V1_ALT: {
			name: 'chr5_KI270794v1_alt',
			len: 164558
		},
		CHR4_GL383527V1_ALT: {
			name: 'chr4_GL383527v1_alt',
			len: 164536
		},
		CHRUN_GL000213V1: {
			name: 'chrUn_GL000213v1',
			len: 164239
		},
		CHR3_KI270936V1_ALT: {
			name: 'chr3_KI270936v1_alt',
			len: 164170
		},
		CHR3_KI270934V1_ALT: {
			name: 'chr3_KI270934v1_alt',
			len: 163458
		},
		CHR9_GL383539V1_ALT: {
			name: 'chr9_GL383539v1_alt',
			len: 162988
		},
		CHR3_KI270895V1_ALT: {
			name: 'chr3_KI270895v1_alt',
			len: 162896
		},
		CHR22_GL383582V2_ALT: {
			name: 'chr22_GL383582v2_alt',
			len: 162811
		},
		CHR3_KI270782V1_ALT: {
			name: 'chr3_KI270782v1_alt',
			len: 162429
		},
		CHR1_KI270892V1_ALT: {
			name: 'chr1_KI270892v1_alt',
			len: 162212
		},
		CHRUN_GL000220V1: {
			name: 'chrUn_GL000220v1',
			len: 161802
		},
		CHR2_KI270767V1_ALT: {
			name: 'chr2_KI270767v1_alt',
			len: 161578
		},
		CHR2_KI270715V1_RANDOM: {
			name: 'chr2_KI270715v1_random',
			len: 161471
		},
		CHR2_KI270893V1_ALT: {
			name: 'chr2_KI270893v1_alt',
			len: 161218
		},
		CHRUN_GL000218V1: {
			name: 'chrUn_GL000218v1',
			len: 161147
		},
		CHR18_GL383572V1_ALT: {
			name: 'chr18_GL383572v1_alt',
			len: 159547
		},
		CHR8_KI270817V1_ALT: {
			name: 'chr8_KI270817v1_alt',
			len: 158983
		},
		CHR4_KI270788V1_ALT: {
			name: 'chr4_KI270788v1_alt',
			len: 158965
		},
		CHRUN_KI270749V1: {
			name: 'chrUn_KI270749v1',
			len: 158759
		},
		CHR7_KI270806V1_ALT: {
			name: 'chr7_KI270806v1_alt',
			len: 158166
		},
		CHR7_KI270804V1_ALT: {
			name: 'chr7_KI270804v1_alt',
			len: 157952
		},
		CHR18_KI270911V1_ALT: {
			name: 'chr18_KI270911v1_alt',
			len: 157710
		},
		CHRUN_KI270741V1: {
			name: 'chrUn_KI270741v1',
			len: 157432
		},
		CHR17_KI270910V1_ALT: {
			name: 'chr17_KI270910v1_alt',
			len: 157099
		},
		CHR19_KI270884V1_ALT: {
			name: 'chr19_KI270884v1_alt',
			len: 157053
		},
		CHR19_GL383574V1_ALT: {
			name: 'chr19_GL383574v1_alt',
			len: 155864
		},
		CHR19_KI270888V1_ALT: {
			name: 'chr19_KI270888v1_alt',
			len: 155532
		},
		CHR3_GL000221V1_RANDOM: {
			name: 'chr3_GL000221v1_random',
			len: 155397
		},
		CHR11_GL383547V1_ALT: {
			name: 'chr11_GL383547v1_alt',
			len: 154407
		},
		CHR2_KI270716V1_RANDOM: {
			name: 'chr2_KI270716v1_random',
			len: 153799
		},
		CHR12_GL383553V2_ALT: {
			name: 'chr12_GL383553v2_alt',
			len: 152874
		},
		CHR6_KI270799V1_ALT: {
			name: 'chr6_KI270799v1_alt',
			len: 152148
		},
		CHR22_KI270731V1_RANDOM: {
			name: 'chr22_KI270731v1_random',
			len: 150754
		},
		CHRUN_KI270751V1: {
			name: 'chrUn_KI270751v1',
			len: 150742
		},
		CHRUN_KI270750V1: {
			name: 'chrUn_KI270750v1',
			len: 148850
		},
		CHR8_KI270818V1_ALT: {
			name: 'chr8_KI270818v1_alt',
			len: 145606
		},
		CHRX_KI270881V1_ALT: {
			name: 'chrX_KI270881v1_alt',
			len: 144206
		},
		CHR21_KI270873V1_ALT: {
			name: 'chr21_KI270873v1_alt',
			len: 143900
		},
		CHR2_GL383521V1_ALT: {
			name: 'chr2_GL383521v1_alt',
			len: 143390
		},
		CHR8_KI270814V1_ALT: {
			name: 'chr8_KI270814v1_alt',
			len: 141812
		},
		CHR12_GL383552V1_ALT: {
			name: 'chr12_GL383552v1_alt',
			len: 138655
		},
		CHRUN_KI270519V1: {
			name: 'chrUn_KI270519v1',
			len: 138126
		},
		CHR2_KI270775V1_ALT: {
			name: 'chr2_KI270775v1_alt',
			len: 138019
		},
		CHR17_KI270907V1_ALT: {
			name: 'chr17_KI270907v1_alt',
			len: 137721
		},
		CHRUN_GL000214V1: {
			name: 'chrUn_GL000214v1',
			len: 137718
		},
		CHR8_KI270901V1_ALT: {
			name: 'chr8_KI270901v1_alt',
			len: 136959
		},
		CHR2_KI270770V1_ALT: {
			name: 'chr2_KI270770v1_alt',
			len: 136240
		},
		CHR16_KI270854V1_ALT: {
			name: 'chr16_KI270854v1_alt',
			len: 134193
		},
		CHR8_KI270819V1_ALT: {
			name: 'chr8_KI270819v1_alt',
			len: 133535
		},
		CHR17_GL383564V2_ALT: {
			name: 'chr17_GL383564v2_alt',
			len: 133151
		},
		CHR2_KI270772V1_ALT: {
			name: 'chr2_KI270772v1_alt',
			len: 133041
		},
		CHR8_KI270815V1_ALT: {
			name: 'chr8_KI270815v1_alt',
			len: 132244
		},
		CHR5_KI270795V1_ALT: {
			name: 'chr5_KI270795v1_alt',
			len: 131892
		},
		CHR5_KI270898V1_ALT: {
			name: 'chr5_KI270898v1_alt',
			len: 130957
		},
		CHR20_GL383577V2_ALT: {
			name: 'chr20_GL383577v2_alt',
			len: 128386
		},
		CHR1_KI270708V1_RANDOM: {
			name: 'chr1_KI270708v1_random',
			len: 127682
		},
		CHR7_KI270807V1_ALT: {
			name: 'chr7_KI270807v1_alt',
			len: 126434
		},
		CHR5_KI270793V1_ALT: {
			name: 'chr5_KI270793v1_alt',
			len: 126136
		},
		CHR6_GL383533V1_ALT: {
			name: 'chr6_GL383533v1_alt',
			len: 124736
		},
		CHR2_GL383522V1_ALT: {
			name: 'chr2_GL383522v1_alt',
			len: 123821
		},
		CHR19_KI270918V1_ALT: {
			name: 'chr19_KI270918v1_alt',
			len: 123111
		},
		CHR12_GL383549V1_ALT: {
			name: 'chr12_GL383549v1_alt',
			len: 120804
		},
		CHR2_KI270769V1_ALT: {
			name: 'chr2_KI270769v1_alt',
			len: 120616
		},
		CHR4_KI270785V1_ALT: {
			name: 'chr4_KI270785v1_alt',
			len: 119912
		},
		CHR12_KI270834V1_ALT: {
			name: 'chr12_KI270834v1_alt',
			len: 119498
		},
		CHR7_GL383534V2_ALT: {
			name: 'chr7_GL383534v2_alt',
			len: 119183
		},
		CHR20_KI270869V1_ALT: {
			name: 'chr20_KI270869v1_alt',
			len: 118774
		},
		CHR21_GL383581V2_ALT: {
			name: 'chr21_GL383581v2_alt',
			len: 116689
		},
		CHR3_KI270781V1_ALT: {
			name: 'chr3_KI270781v1_alt',
			len: 113034
		},
		CHR17_KI270730V1_RANDOM: {
			name: 'chr17_KI270730v1_random',
			len: 112551
		},
		CHRUN_KI270438V1: {
			name: 'chrUn_KI270438v1',
			len: 112505
		},
		CHR4_KI270787V1_ALT: {
			name: 'chr4_KI270787v1_alt',
			len: 111943
		},
		CHR18_KI270864V1_ALT: {
			name: 'chr18_KI270864v1_alt',
			len: 111737
		},
		CHR2_KI270771V1_ALT: {
			name: 'chr2_KI270771v1_alt',
			len: 110395
		},
		CHR1_GL383519V1_ALT: {
			name: 'chr1_GL383519v1_alt',
			len: 110268
		},
		CHR2_KI270768V1_ALT: {
			name: 'chr2_KI270768v1_alt',
			len: 110099
		},
		CHR1_KI270760V1_ALT: {
			name: 'chr1_KI270760v1_alt',
			len: 109528
		},
		CHR3_KI270783V1_ALT: {
			name: 'chr3_KI270783v1_alt',
			len: 109187
		},
		CHR17_KI270859V1_ALT: {
			name: 'chr17_KI270859v1_alt',
			len: 108763
		},
		CHR11_KI270902V1_ALT: {
			name: 'chr11_KI270902v1_alt',
			len: 106711
		},
		CHR18_GL383568V1_ALT: {
			name: 'chr18_GL383568v1_alt',
			len: 104552
		},
		CHR22_KI270737V1_RANDOM: {
			name: 'chr22_KI270737v1_random',
			len: 103838
		},
		CHR13_KI270843V1_ALT: {
			name: 'chr13_KI270843v1_alt',
			len: 103832
		},
		CHR22_KI270877V1_ALT: {
			name: 'chr22_KI270877v1_alt',
			len: 101331
		},
		CHR5_GL383530V1_ALT: {
			name: 'chr5_GL383530v1_alt',
			len: 101241
		},
		CHR11_KI270721V1_RANDOM: {
			name: 'chr11_KI270721v1_random',
			len: 100316
		},
		CHR22_KI270738V1_RANDOM: {
			name: 'chr22_KI270738v1_random',
			len: 99375
		},
		CHR22_GL383583V2_ALT: {
			name: 'chr22_GL383583v2_alt',
			len: 96924
		},
		CHR2_GL582966V2_ALT: {
			name: 'chr2_GL582966v2_alt',
			len: 96131
		},
		CHRUN_KI270748V1: {
			name: 'chrUn_KI270748v1',
			len: 93321
		},
		CHRUN_KI270435V1: {
			name: 'chrUn_KI270435v1',
			len: 92983
		},
		CHR5_GL000208V1_RANDOM: {
			name: 'chr5_GL000208v1_random',
			len: 92689
		},
		CHRUN_KI270538V1: {
			name: 'chrUn_KI270538v1',
			len: 91309
		},
		CHR17_GL383566V1_ALT: {
			name: 'chr17_GL383566v1_alt',
			len: 90219
		},
		CHR16_GL383557V1_ALT: {
			name: 'chr16_GL383557v1_alt',
			len: 89672
		},
		CHR17_JH159148V1_ALT: {
			name: 'chr17_JH159148v1_alt',
			len: 88070
		},
		CHR5_GL383532V1_ALT: {
			name: 'chr5_GL383532v1_alt',
			len: 82728
		},
		CHR21_KI270872V1_ALT: {
			name: 'chr21_KI270872v1_alt',
			len: 82692
		},
		CHRUN_KI270756V1: {
			name: 'chrUn_KI270756v1',
			len: 79590
		},
		CHR6_KI270758V1_ALT: {
			name: 'chr6_KI270758v1_alt',
			len: 76752
		},
		CHR12_KI270833V1_ALT: {
			name: 'chr12_KI270833v1_alt',
			len: 76061
		},
		CHR6_KI270802V1_ALT: {
			name: 'chr6_KI270802v1_alt',
			len: 75005
		},
		CHR21_GL383580V2_ALT: {
			name: 'chr21_GL383580v2_alt',
			len: 74653
		},
		CHR22_KB663609V1_ALT: {
			name: 'chr22_KB663609v1_alt',
			len: 74013
		},
		CHR22_KI270739V1_RANDOM: {
			name: 'chr22_KI270739v1_random',
			len: 73985
		},
		CHR9_GL383540V1_ALT: {
			name: 'chr9_GL383540v1_alt',
			len: 71551
		},
		CHRUN_KI270757V1: {
			name: 'chrUn_KI270757v1',
			len: 71251
		},
		CHR2_KI270773V1_ALT: {
			name: 'chr2_KI270773v1_alt',
			len: 70887
		},
		CHR17_JH159147V1_ALT: {
			name: 'chr17_JH159147v1_alt',
			len: 70345
		},
		CHR11_KI270827V1_ALT: {
			name: 'chr11_KI270827v1_alt',
			len: 67707
		},
		CHR1_KI270709V1_RANDOM: {
			name: 'chr1_KI270709v1_random',
			len: 66860
		},
		CHRUN_KI270746V1: {
			name: 'chrUn_KI270746v1',
			len: 66486
		},
		CHR16_KI270856V1_ALT: {
			name: 'chr16_KI270856v1_alt',
			len: 63982
		},
		CHR21_GL383578V2_ALT: {
			name: 'chr21_GL383578v2_alt',
			len: 63917
		},
		CHRUN_KI270753V1: {
			name: 'chrUn_KI270753v1',
			len: 62944
		},
		CHR19_KI270868V1_ALT: {
			name: 'chr19_KI270868v1_alt',
			len: 61734
		},
		CHR9_GL383542V1_ALT: {
			name: 'chr9_GL383542v1_alt',
			len: 60032
		},
		CHR20_KI270871V1_ALT: {
			name: 'chr20_KI270871v1_alt',
			len: 58661
		},
		CHR12_KI270836V1_ALT: {
			name: 'chr12_KI270836v1_alt',
			len: 56134
		},
		CHR19_KI270865V1_ALT: {
			name: 'chr19_KI270865v1_alt',
			len: 52969
		},
		CHR1_KI270764V1_ALT: {
			name: 'chr1_KI270764v1_alt',
			len: 50258
		},
		CHRUN_KI270589V1: {
			name: 'chrUn_KI270589v1',
			len: 44474
		},
		CHR14_KI270726V1_RANDOM: {
			name: 'chr14_KI270726v1_random',
			len: 43739
		},
		CHR19_KI270866V1_ALT: {
			name: 'chr19_KI270866v1_alt',
			len: 43156
		},
		CHR22_KI270735V1_RANDOM: {
			name: 'chr22_KI270735v1_random',
			len: 42811
		},
		CHR1_KI270711V1_RANDOM: {
			name: 'chr1_KI270711v1_random',
			len: 42210
		},
		CHRUN_KI270745V1: {
			name: 'chrUn_KI270745v1',
			len: 41891
		},
		CHR1_KI270714V1_RANDOM: {
			name: 'chr1_KI270714v1_random',
			len: 41717
		},
		CHR22_KI270732V1_RANDOM: {
			name: 'chr22_KI270732v1_random',
			len: 41543
		},
		CHR1_KI270713V1_RANDOM: {
			name: 'chr1_KI270713v1_random',
			len: 40745
		},
		CHRUN_KI270754V1: {
			name: 'chrUn_KI270754v1',
			len: 40191
		},
		CHR1_KI270710V1_RANDOM: {
			name: 'chr1_KI270710v1_random',
			len: 40176
		},
		CHR12_KI270837V1_ALT: {
			name: 'chr12_KI270837v1_alt',
			len: 40090
		},
		CHR9_KI270717V1_RANDOM: {
			name: 'chr9_KI270717v1_random',
			len: 40062
		},
		CHR14_KI270724V1_RANDOM: {
			name: 'chr14_KI270724v1_random',
			len: 39555
		},
		CHR9_KI270720V1_RANDOM: {
			name: 'chr9_KI270720v1_random',
			len: 39050
		},
		CHR14_KI270723V1_RANDOM: {
			name: 'chr14_KI270723v1_random',
			len: 38115
		},
		CHR9_KI270718V1_RANDOM: {
			name: 'chr9_KI270718v1_random',
			len: 38054
		},
		CHRUN_KI270317V1: {
			name: 'chrUn_KI270317v1',
			len: 37690
		},
		CHR13_KI270842V1_ALT: {
			name: 'chr13_KI270842v1_alt',
			len: 37287
		},
		CHRY_KI270740V1_RANDOM: {
			name: 'chrY_KI270740v1_random',
			len: 37240
		},
		CHRUN_KI270755V1: {
			name: 'chrUn_KI270755v1',
			len: 36723
		},
		CHR8_KI270820V1_ALT: {
			name: 'chr8_KI270820v1_alt',
			len: 36640
		},
		CHR1_KI270707V1_RANDOM: {
			name: 'chr1_KI270707v1_random',
			len: 32032
		},
		CHRUN_KI270579V1: {
			name: 'chrUn_KI270579v1',
			len: 31033
		},
		CHRUN_KI270752V1: {
			name: 'chrUn_KI270752v1',
			len: 27745
		},
		CHRUN_KI270512V1: {
			name: 'chrUn_KI270512v1',
			len: 22689
		},
		CHRUN_KI270322V1: {
			name: 'chrUn_KI270322v1',
			len: 21476
		},
		CHRUN_GL000226V1: {
			name: 'chrUn_GL000226v1',
			len: 15008
		},
		CHRUN_KI270311V1: {
			name: 'chrUn_KI270311v1',
			len: 12399
		},
		CHRUN_KI270366V1: {
			name: 'chrUn_KI270366v1',
			len: 8320
		},
		CHRUN_KI270511V1: {
			name: 'chrUn_KI270511v1',
			len: 8127
		},
		CHRUN_KI270448V1: {
			name: 'chrUn_KI270448v1',
			len: 7992
		},
		CHRUN_KI270521V1: {
			name: 'chrUn_KI270521v1',
			len: 7642
		},
		CHRUN_KI270581V1: {
			name: 'chrUn_KI270581v1',
			len: 7046
		},
		CHRUN_KI270582V1: {
			name: 'chrUn_KI270582v1',
			len: 6504
		},
		CHRUN_KI270515V1: {
			name: 'chrUn_KI270515v1',
			len: 6361
		},
		CHRUN_KI270588V1: {
			name: 'chrUn_KI270588v1',
			len: 6158
		},
		CHRUN_KI270591V1: {
			name: 'chrUn_KI270591v1',
			len: 5796
		},
		CHRUN_KI270522V1: {
			name: 'chrUn_KI270522v1',
			len: 5674
		},
		CHRUN_KI270507V1: {
			name: 'chrUn_KI270507v1',
			len: 5353
		},
		CHRUN_KI270590V1: {
			name: 'chrUn_KI270590v1',
			len: 4685
		},
		CHRUN_KI270584V1: {
			name: 'chrUn_KI270584v1',
			len: 4513
		},
		CHRUN_KI270320V1: {
			name: 'chrUn_KI270320v1',
			len: 4416
		},
		CHRUN_KI270382V1: {
			name: 'chrUn_KI270382v1',
			len: 4215
		},
		CHRUN_KI270468V1: {
			name: 'chrUn_KI270468v1',
			len: 4055
		},
		CHRUN_KI270467V1: {
			name: 'chrUn_KI270467v1',
			len: 3920
		},
		CHRUN_KI270362V1: {
			name: 'chrUn_KI270362v1',
			len: 3530
		},
		CHRUN_KI270517V1: {
			name: 'chrUn_KI270517v1',
			len: 3253
		},
		CHRUN_KI270593V1: {
			name: 'chrUn_KI270593v1',
			len: 3041
		},
		CHRUN_KI270528V1: {
			name: 'chrUn_KI270528v1',
			len: 2983
		},
		CHRUN_KI270587V1: {
			name: 'chrUn_KI270587v1',
			len: 2969
		},
		CHRUN_KI270364V1: {
			name: 'chrUn_KI270364v1',
			len: 2855
		},
		CHRUN_KI270371V1: {
			name: 'chrUn_KI270371v1',
			len: 2805
		},
		CHRUN_KI270333V1: {
			name: 'chrUn_KI270333v1',
			len: 2699
		},
		CHRUN_KI270374V1: {
			name: 'chrUn_KI270374v1',
			len: 2656
		},
		CHRUN_KI270411V1: {
			name: 'chrUn_KI270411v1',
			len: 2646
		},
		CHRUN_KI270414V1: {
			name: 'chrUn_KI270414v1',
			len: 2489
		},
		CHRUN_KI270510V1: {
			name: 'chrUn_KI270510v1',
			len: 2415
		},
		CHRUN_KI270390V1: {
			name: 'chrUn_KI270390v1',
			len: 2387
		},
		CHRUN_KI270375V1: {
			name: 'chrUn_KI270375v1',
			len: 2378
		},
		CHRUN_KI270420V1: {
			name: 'chrUn_KI270420v1',
			len: 2321
		},
		CHRUN_KI270509V1: {
			name: 'chrUn_KI270509v1',
			len: 2318
		},
		CHRUN_KI270315V1: {
			name: 'chrUn_KI270315v1',
			len: 2276
		},
		CHRUN_KI270302V1: {
			name: 'chrUn_KI270302v1',
			len: 2274
		},
		CHRUN_KI270518V1: {
			name: 'chrUn_KI270518v1',
			len: 2186
		},
		CHRUN_KI270530V1: {
			name: 'chrUn_KI270530v1',
			len: 2168
		},
		CHRUN_KI270304V1: {
			name: 'chrUn_KI270304v1',
			len: 2165
		},
		CHRUN_KI270418V1: {
			name: 'chrUn_KI270418v1',
			len: 2145
		},
		CHRUN_KI270424V1: {
			name: 'chrUn_KI270424v1',
			len: 2140
		},
		CHRUN_KI270417V1: {
			name: 'chrUn_KI270417v1',
			len: 2043
		},
		CHRUN_KI270508V1: {
			name: 'chrUn_KI270508v1',
			len: 1951
		},
		CHRUN_KI270303V1: {
			name: 'chrUn_KI270303v1',
			len: 1942
		},
		CHRUN_KI270381V1: {
			name: 'chrUn_KI270381v1',
			len: 1930
		},
		CHRUN_KI270529V1: {
			name: 'chrUn_KI270529v1',
			len: 1899
		},
		CHRUN_KI270425V1: {
			name: 'chrUn_KI270425v1',
			len: 1884
		},
		CHRUN_KI270396V1: {
			name: 'chrUn_KI270396v1',
			len: 1880
		},
		CHRUN_KI270363V1: {
			name: 'chrUn_KI270363v1',
			len: 1803
		},
		CHRUN_KI270386V1: {
			name: 'chrUn_KI270386v1',
			len: 1788
		},
		CHRUN_KI270465V1: {
			name: 'chrUn_KI270465v1',
			len: 1774
		},
		CHRUN_KI270383V1: {
			name: 'chrUn_KI270383v1',
			len: 1750
		},
		CHRUN_KI270384V1: {
			name: 'chrUn_KI270384v1',
			len: 1658
		},
		CHRUN_KI270330V1: {
			name: 'chrUn_KI270330v1',
			len: 1652
		},
		CHRUN_KI270372V1: {
			name: 'chrUn_KI270372v1',
			len: 1650
		},
		CHRUN_KI270548V1: {
			name: 'chrUn_KI270548v1',
			len: 1599
		},
		CHRUN_KI270580V1: {
			name: 'chrUn_KI270580v1',
			len: 1553
		},
		CHRUN_KI270387V1: {
			name: 'chrUn_KI270387v1',
			len: 1537
		},
		CHRUN_KI270391V1: {
			name: 'chrUn_KI270391v1',
			len: 1484
		},
		CHRUN_KI270305V1: {
			name: 'chrUn_KI270305v1',
			len: 1472
		},
		CHRUN_KI270373V1: {
			name: 'chrUn_KI270373v1',
			len: 1451
		},
		CHRUN_KI270422V1: {
			name: 'chrUn_KI270422v1',
			len: 1445
		},
		CHRUN_KI270316V1: {
			name: 'chrUn_KI270316v1',
			len: 1444
		},
		CHRUN_KI270338V1: {
			name: 'chrUn_KI270338v1',
			len: 1428
		},
		CHRUN_KI270340V1: {
			name: 'chrUn_KI270340v1',
			len: 1428
		},
		CHRUN_KI270583V1: {
			name: 'chrUn_KI270583v1',
			len: 1400
		},
		CHRUN_KI270334V1: {
			name: 'chrUn_KI270334v1',
			len: 1368
		},
		CHRUN_KI270429V1: {
			name: 'chrUn_KI270429v1',
			len: 1361
		},
		CHRUN_KI270393V1: {
			name: 'chrUn_KI270393v1',
			len: 1308
		},
		CHRUN_KI270516V1: {
			name: 'chrUn_KI270516v1',
			len: 1300
		},
		CHRUN_KI270389V1: {
			name: 'chrUn_KI270389v1',
			len: 1298
		},
		CHRUN_KI270466V1: {
			name: 'chrUn_KI270466v1',
			len: 1233
		},
		CHRUN_KI270388V1: {
			name: 'chrUn_KI270388v1',
			len: 1216
		},
		CHRUN_KI270544V1: {
			name: 'chrUn_KI270544v1',
			len: 1202
		},
		CHRUN_KI270310V1: {
			name: 'chrUn_KI270310v1',
			len: 1201
		},
		CHRUN_KI270412V1: {
			name: 'chrUn_KI270412v1',
			len: 1179
		},
		CHRUN_KI270395V1: {
			name: 'chrUn_KI270395v1',
			len: 1143
		},
		CHRUN_KI270376V1: {
			name: 'chrUn_KI270376v1',
			len: 1136
		},
		CHRUN_KI270337V1: {
			name: 'chrUn_KI270337v1',
			len: 1121
		},
		CHRUN_KI270335V1: {
			name: 'chrUn_KI270335v1',
			len: 1048
		},
		CHRUN_KI270378V1: {
			name: 'chrUn_KI270378v1',
			len: 1048
		},
		CHRUN_KI270379V1: {
			name: 'chrUn_KI270379v1',
			len: 1045
		},
		CHRUN_KI270329V1: {
			name: 'chrUn_KI270329v1',
			len: 1040
		},
		CHRUN_KI270419V1: {
			name: 'chrUn_KI270419v1',
			len: 1029
		},
		CHRUN_KI270336V1: {
			name: 'chrUn_KI270336v1',
			len: 1026
		},
		CHRUN_KI270312V1: {
			name: 'chrUn_KI270312v1',
			len: 998
		},
		CHRUN_KI270539V1: {
			name: 'chrUn_KI270539v1',
			len: 993
		},
		CHRUN_KI270385V1: {
			name: 'chrUn_KI270385v1',
			len: 990
		},
		CHRUN_KI270423V1: {
			name: 'chrUn_KI270423v1',
			len: 981
		},
		CHRUN_KI270392V1: {
			name: 'chrUn_KI270392v1',
			len: 971
		},
		CHRUN_KI270394V1: {
			name: 'chrUn_KI270394v1',
			len: 970
		}
	}
}
