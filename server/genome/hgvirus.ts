import type { MinGenome } from '#types'

export default {
	species: 'human',
	genomefile: 'genomes/hgvirus.gz',
	genedb: {
		dbfile: 'anno/genes.hgvirus.db'
	},
	defaultcoord: {
		chr: 'chr17_paternal',
		start: 7568451,
		stop: 7591984
	},
	hicenzymefragment: [
		{
			enzyme: 'MboI',
			file: 'anno/hicFragment/hic.MboI.hgvirus.gz'
		}
	],
	majorchr: `chr10_paternal	135534747
    chr11_paternal	135020433
    chr12_paternal	133856534
    chr13_paternal	115169878
    chr14_paternal	107349540
    chr15_paternal	102536031
    chr16_paternal	90373309
    chr17_paternal	81199849
    chr18_paternal	78077248
    chr19_paternal	59133622
    chr1_paternal	249255260
    chr20_paternal	63025520
    chr21_paternal	48134534
    chr22_paternal	51304566
    chr2_paternal	243204012
    chr3_paternal	198027069
    chr4_paternal	191168193
    chr5_paternal	180919899
    chr6_paternal	171115067
    chr7_paternal	159138663
    chr8_paternal	146364022
    chr9_paternal	141213431
    chrM_paternal	16571
    chrX_paternal	155275199
    chrY_paternal	59373566`
} satisfies MinGenome
