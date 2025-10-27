import type { Genome } from '#types'

export default {
	species: 'mouse',
	genomefile: 'genomes/mm9.gz',
	genedb: {
		dbfile: 'anno/genes.mm9.db'
	},
	tracks: [
		{
			__isgene: true,
			translatecoding: true,
			file: 'anno/refGene.mm9.gz',
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
			file: 'anno/gencode.vM9.mm9.gz',
			type: 'bedj',
			name: 'GENCODE M9',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#375E80'
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.mm9.gz',
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
	defaultcoord: {
		chr: 'chr12',
		start: 57795963,
		stop: 57815592,
		gene: 'Pax9'
	},

	hicenzymefragment: [
		{
			enzyme: 'DpnII',
			file: 'anno/hicFragment/hic.DpnII.mm9.gz'
		},
		{
			enzyme: 'EcoRI',
			file: 'anno/hicFragment/hic.EcoRI.mm9.gz'
		},
		{
			enzyme: 'HindIII',
			file: 'anno/hicFragment/hic.HindIII.mm9.gz'
		},
		{
			enzyme: 'MboI',
			file: 'anno/hicFragment/hic.MboI.mm9.gz'
		},
		{
			enzyme: 'NcoI',
			file: 'anno/hicFragment/hic.NcoI.mm9.gz'
		}
	],

	majorchr: `
chr1	197195432
chr2	181748087
chr3	159599783
chr4	155630120
chr5	152537259
chr6	149517037
chr7	152524553
chr8	131738871
chr9	124076172
chr10	129993255
chr11	121843856
chr12	121257530
chr13	120284312
chr14	125194864
chr15	103494974
chr16	98319150
chr17	95272651
chr18	90772031
chr19	61342430
chrX	166650296
chrY	15902555
chrM	16299`,
	minorchr: `
chr13_random	400311
chr16_random	3994
chr17_random	628739
chr1_random	1231697
chr3_random	41899
chr4_random	160594
chr5_random	357350
chr7_random	362490
chr8_random	849593
chr9_random	449403
chrUn_random	5900358
chrX_random	1785075
chrY_random	58682461
`
} satisfies Genome
