import type { Genome } from '#types'

export default {
	species: 'human',
	genomefile: 'genomes/hg19.gz',
	genedb: {
		dbfile: 'anno/genes.hg19.db'
	},
	proteindomain: {
		dbfile: 'anno/db/proteindomain.db',
		statement: 'select data from domain where isoform=? collate nocase'
	},
	repeatmasker: {
		dbfile: 'anno/rmsk.hg19.gz',
		statement: 'RepeatMasker database'
	},
	snp: {
		bigbedfile: 'anno/dbsnp.hg19.bb'
	},
	fimo_motif: {
		db: 'utils/meme/motif_databases/HUMAN/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme',
		annotationfile: 'utils/meme/motif_databases/HUMAN/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'
	},
	tracks: [
		{
			__isgene: true, // only for initialization
			translatecoding: true, // instructs to translate coding:[]
			file: 'anno/refGene.hg19.gz',
			type: 'bedj',
			name: 'RefGene',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D'
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
				coding: { color: '#004D99', label: 'Coding gene' },
				nonCoding: { color: '#008833', label: 'Noncoding gene' },
				problem: { color: '#CC3300', label: 'Problem' },
				pseudo: { color: '#CC00CC', label: 'Pseudogene' }
			}
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.hg19.gz',
			onerow: true,
			categories: {
				SINE: { color: '#ED8C8E', label: 'SINE' },
				LINE: { color: '#EDCB8C', label: 'LINE' },
				LTR: { color: '#E38CED', label: 'LTR' },
				DNA: { color: '#8C8EED', label: 'DNA transposon' },
				simple: { color: '#8EB88C', label: 'Simple repeats' },
				low_complexity: { color: '#ACEBA9', label: 'Low complexity' },
				satellite: { color: '#B59A84', label: 'Satellite' },
				RNA: { color: '#9DE0E0', label: 'RNA repeat' },
				other: { color: '#9BADC2', label: 'Other' },
				unknown: { color: '#858585', label: 'Unknown' }
			}
		}
	],

	/*
	geneset: [
		{
			name: 'Signaling',
			lst: [
				{ name: 'NRAS' },
				{ name: 'FLT3' },
				{ name: 'KRAS' },
				{ name: 'JAK3' },
				{ name: 'BRAF' },
				{ name: 'NF1' },
				{ name: 'MAPK1' }
			]
		},
		{ name: 'Cell cycle', lst: [{ name: 'TP53' }, { name: 'RB1' }, { name: 'CDKN2A' }, { name: 'CDKN2B' }] },
		{
			name: 'Epigenetics',
			lst: [
				{ name: 'ATRX' },
				{ name: 'BCOR' },
				{ name: 'MYC' },
				{ name: 'MYCN' },
				{ name: 'WHSC1' },
				{ name: 'SUZ12' },
				{ name: 'EED' },
				{ name: 'EZH2' },
				{ name: 'SETD2' },
				{ name: 'CREBBP' },
				{ name: 'EHMT2' },
				{ name: 'PRDM1' },
				{ name: 'NSD1' },
				{ name: 'KMT2D' },
				{ name: 'UBR4' },
				{ name: 'ARID1A' },
				{ name: 'EP300' }
			]
		},
		{
			name: 'Development',
			lst: [
				{ name: 'RUNX1' },
				{ name: 'ETV6' },
				{ name: 'GATA3' },
				{ name: 'IKZF1' },
				{ name: 'EP300' },
				{ name: 'IKZF2' },
				{ name: 'IKZF3' },
				{ name: 'PAX5' },
				{ name: 'VPREB1' },
				{ name: 'EBF1' }
			]
		}
	],
	*/

	defaultcoord: {
		chr: 'chr17',
		start: 7568451,
		stop: 7591984,
		gene: 'TP53'
	},

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

	hicdomain: {
		groups: {
			RaoCell2014: {
				name: 'Rao SS et al, Cell 2014',
				reference:
					'<a href=https://www.ncbi.nlm.nih.gov/pubmed/25497547 target=_blank>A 3D Map of the Human Genome at Kilobase Resolution Reveals Principles of Chromatin Looping</a>',
				sets: {
					GM12878: {
						name: 'GM12878',
						longname: 'Human B-Lymphoblastoid',
						file: 'anno/hicTAD/aiden2014/GM12878.domain.hg19.gz'
					},
					HMEC: {
						name: 'HMEC',
						longname: 'Human Mammary Epithelial',
						file: 'anno/hicTAD/aiden2014/HMEC.domain.hg19.gz'
					},
					IMR90: {
						name: 'IRM90',
						longname: 'Human Lung Fibroblast',
						file: 'anno/hicTAD/aiden2014/IMR90.domain.hg19.gz'
					},
					KBM7: {
						name: 'KBM7',
						longname: 'Near Haploid Human Myelogenous Leukemia',
						file: 'anno/hicTAD/aiden2014/KBM7.domain.hg19.gz'
					},
					HeLa: {
						name: 'HeLa',
						longname: 'Human Cervical Carcinoma',
						file: 'anno/hicTAD/aiden2014/HeLa.domain.hg19.gz'
					},
					HUVEC: {
						name: 'HUVEC',
						longname: 'Human Umbilical Vein Endothelial',
						file: 'anno/hicTAD/aiden2014/HUVEC.domain.hg19.gz'
					},
					K562: {
						name: 'K562',
						longname: 'Human Erythroleukemia',
						file: 'anno/hicTAD/aiden2014/K562.domain.hg19.gz'
					},
					NHEK: {
						name: 'NHEK',
						longname: 'Normal Human Epidermal Keratinocytes',
						file: 'anno/hicTAD/aiden2014/NHEK.domain.hg19.gz'
					}
				}
			}
		}
	},

	majorchr: `chr1	249250621
chr2	243199373
chr3	198022430
chr4	191154276
chr5	180915260
chr6	171115067
chr7	159138663
chr8	146364022
chr9	141213431
chr10	135534747
chr11	135006516
chr12	133851895
chr13	115169878
chr14	107349540
chr15	102531392
chr16	90354753
chr17	81195210
chr18	78077248
chr19	59128983
chr20	63025520
chr21	48129895
chr22	51304566
chrX	155270560
chrY	59373566
chrM	16571`,
	minorchr: `
chr6_ssto_hap7	4928567
chr6_mcf_hap5	4833398
chr6_cox_hap2	4795371
chr6_mann_hap4	4683263
chr6_apd_hap1	4622290
chr6_qbl_hap6	4611984
chr6_dbb_hap3	4610396
chr17_ctg5_hap1	1680828
chr4_ctg9_hap1	590426
chr1_gl000192_random	547496
chrUn_gl000225	211173
chr4_gl000194_random	191469
chr4_gl000193_random	189789
chr9_gl000200_random	187035
chrUn_gl000222	186861
chrUn_gl000212	186858
chr7_gl000195_random	182896
chrUn_gl000223	180455
chrUn_gl000224	179693
chrUn_gl000219	179198
chr17_gl000205_random	174588
chrUn_gl000215	172545
chrUn_gl000216	172294
chrUn_gl000217	172149
chr9_gl000199_random	169874
chrUn_gl000211	166566
chrUn_gl000213	164239
chrUn_gl000220	161802
chrUn_gl000218	161147
chr19_gl000209_random	159169
chrUn_gl000221	155397
chrUn_gl000214	137718
chrUn_gl000228	129120
chrUn_gl000227	128374
chr1_gl000191_random	106433
chr19_gl000208_random	92689
chr9_gl000198_random	90085
chr17_gl000204_random	81310
chrUn_gl000233	45941
chrUn_gl000237	45867
chrUn_gl000230	43691
chrUn_gl000242	43523
chrUn_gl000243	43341
chrUn_gl000241	42152
chrUn_gl000236	41934
chrUn_gl000240	41933
chr17_gl000206_random	41001
chrUn_gl000232	40652
chrUn_gl000234	40531
chr11_gl000202_random	40103
chrUn_gl000238	39939
chrUn_gl000244	39929
chrUn_gl000248	39786
chr8_gl000196_random	38914
chrUn_gl000249	38502
chrUn_gl000246	38154
chr17_gl000203_random	37498
chr8_gl000197_random	37175
chrUn_gl000245	36651
chrUn_gl000247	36422
chr9_gl000201_random	36148
chrUn_gl000235	34474
chrUn_gl000239	33824
chr21_gl000210_random	27682
chrUn_gl000231	27386
chrUn_gl000229	19913
chrUn_gl000226	15008
chr18_gl000207_random	4262`
} satisfies Genome
