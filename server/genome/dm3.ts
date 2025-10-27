import type { Genome } from '#types'

export default {
	species: 'fruit fly',
	genomefile: 'genomes/dm3.gz',
	genedb: {
		dbfile: 'anno/genes.dm3.db'
	},
	tracks: [
		{
			__isgene: true, // only for initialization
			translatecoding: true,
			file: 'anno/refGene.dm3.gz',
			type: 'bedj',
			name: 'RefGene',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#1D591D'
		},
		{
			__isgene: true, // only for initialization
			translatecoding: true,
			file: 'anno/ensGene.dm3.gz',
			type: 'bedj',
			name: 'Ensembl genes',
			stackheight: 16,
			stackspace: 1,
			vpad: 4,
			color: '#004D99'
		},
		{
			type: 'bedj',
			name: 'RepeatMasker',
			stackheight: 14,
			file: 'anno/rmsk.dm3.gz',
			onerow: true,
			categories: {
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
		chr: 'chr2L',
		start: 6718954,
		stop: 6723802
	},

	majorchr: `chr2L	23011544
chr2LHet	368872
chr2R	21146708
chr2RHet	3288761
chr3L	24543557
chr3LHet	2555491
chr3R	27905053
chr3RHet	2517507
chr4	1351857
chrU	10049037
chrUextra	29004656
chrX	22422827
chrXHet	204112
chrYHet	347038
chrM	19517`
} satisfies Genome
