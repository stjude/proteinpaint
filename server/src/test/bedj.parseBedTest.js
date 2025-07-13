import tape from 'tape'
import { parseBedLine } from '../bedj.parseBed'

// tape('\n', function (test) {
// 	test.comment('-***- server/bedj.parseBed test -***-')
// 	test.end()
// })

tape(
	'test #1: parsing a line from hg38 gencodeV41.bb file: https://hgdownload.soe.ucsc.edu/gbdb/hg38/gencode/gencodeV41.bb',
	function (test) {
		const bedLine = [
			'chr17',
			'7661778',
			'7676594',
			'ENST00000413465.6',
			'0',
			'-',
			'7661938',
			'7676594',
			'789624',
			'7',
			'236,110,113,184,279,22,74,',
			'0,12402,13080,13274,14215,14603,14742,',
			'uc002gig.2',
			'none',
			'none',
			'2,0,1,0,0,2,0,',
			'none',
			'TP53',
			'E7EQX7',
			'none',
			'coding',
			'havana_homo_sapiens',
			'protein_coding',
			'basic,overlapping_locus',
			'2',
			'basic,all'
		]
		const expected = {
			name: 'TP53',
			isoform: 'ENST00000413465',
			strand: '-',
			exon: [
				[7676520, 7676594],
				[7676381, 7676403],
				[7675993, 7676272],
				[7675052, 7675236],
				[7674858, 7674971],
				[7674180, 7674290],
				[7661778, 7662014]
			],
			rnalen: 1018,
			category: 'coding',
			intron: [
				[7676403, 7676520],
				[7676272, 7676381],
				[7675236, 7675993],
				[7674971, 7675052],
				[7674290, 7674858],
				[7662014, 7674180]
			],
			cdslen: 858,
			codingstart: 7661938,
			codingstop: 7676594,
			coding: [
				[7676520, 7676594],
				[7676381, 7676403],
				[7675993, 7676272],
				[7675052, 7675236],
				[7674858, 7674971],
				[7674180, 7674290],
				[7661938, 7662014]
			],
			utr3: [[7661778, 7661938]]
		}
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test #2: parsing a line from dbsnp.hg19.bb file: https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153.bb',
	function (test) {
		const bedLine = [
			'chr17',
			'7579867',
			'7579868',
			'rs766765429',
			'A',
			'1',
			'G,',
			'0',
			'12',
			'-inf,2.39328e-05,7.96381e-06,1.67766e-05,-inf,3.19591e-05,-inf,-inf,-inf,-inf,-inf,-inf,',
			',A,A,A,,A,,,,,,,',
			',G,G,G,,G,,,,,,,',
			'1819',
			'snv',
			'clinvar,clinvarBenign,rareSome,rareAll,overlapDiffClass,',
			'58095997340',
			'266'
		]
		const expected = { name: 'rs766765429' }
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test #3: parsing a line from lrg.bb file: https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/lrg.bb',
	async function (test) {
		const bedLine = [
			'chr17',
			'7681070',
			'7705502',
			'LRG_375',
			'0',
			'+',
			'7681070',
			'7705502',
			'0',
			'1',
			'24432,',
			'0,',
			'',
			'',
			'24432',
			'25522',
			'WRAP53',
			'NG_028245.1',
			'RAPID: Resource of Asian Primary Immunodeficiency Diseases',
			'http://web16.kazusa.or.jp/rapid/browseByPIDGenes',
			'2013-01-16'
		]
		const expected = {
			name: 'NG_028245.1',
			isoform: 'LRG_375',
			strand: '+',
			exon: [[7681070, 7705502]],
			rnalen: 24432,
			cdslen: 24432,
			codingstart: 7681070,
			codingstop: 7705502,
			coding: [[7681070, 7705502]]
		}
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test #4: parsing the line for gene IGKC from hg38 gencodeV41.bb file: https://hgdownload.soe.ucsc.edu/gbdb/hg38/gencode/gencodeV41.bb',
	function (test) {
		// uses a non-0 reading frame
		const bedLine = [
			'chr2',
			'88857160',
			'88857683',
			'ENST00000390237.2',
			'0',
			'-',
			'88857360',
			'88857683',
			'789624',
			'1',
			'523,',
			'0,',
			'uc061lpw.1',
			'none',
			'none',
			'1,',
			'none',
			'IGKC',
			'A0A5H1ZRQ3',
			'none',
			'coding',
			'havana_ig_gene_homo_sapiens',
			'IG_C_gene',
			'Ensembl_canonical,appris_principal_1,basic,cds_start_NF,mRNA_start_NF,overlapping_locus',
			'2',
			'canonical,basic,all'
		]
		const expected = {
			name: 'IGKC',
			isoform: 'ENST00000390237',
			strand: '-',
			exon: [[88857160, 88857683]],
			rnalen: 523,
			category: 'coding',
			cdslen: 323,
			codingstart: 88857360,
			codingstop: 88857683,
			coding: [[88857360, 88857683]],
			utr3: [[88857160, 88857360]],
			startCodonFrame: 1
		}
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape('test #5: parsing a line from genCC.bb: https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/genCC.bb', function (test) {
	const bedLine = [
		'chr17',
		'7668420',
		'7687490',
		'TP53 MONDO:0005089',
		'0',
		'-',
		'7668420',
		'7687490',
		'56,161,105',
		'ENST00000269305.9',
		'ENSG00000141510.18',
		'NM_000546.6',
		'GENCC_000104-HGNC_11998-MONDO_0005089-HP_0000006-GENCC_100002',
		'HGNC:11998',
		'TP53',
		'MONDO:0005089',
		'sarcoma',
		'MONDO:0005089',
		'sarcoma',
		'GENCC:100002',
		'Strong',
		'HP:0000006',
		'Autosomal dominant',
		'GENCC:000104',
		'Genomics England PanelApp',
		'HGNC:11998',
		'TP53',
		'MONDO:0005089',
		'SARCOMA',
		'HP:0000006',
		'Autosomal dominant inheritance',
		'GENCC:000104',
		'Genomics England PanelApp',
		'GENCC:100002',
		'Strong',
		'2021-02-11 13:01:34',
		'https://panelapp.genomicsengland.co.uk/panels/734',
		'',
		'27050224, 28338660',
		'',
		'000104.pa734.v1.11.hgnc:11998.m1.p1',
		'2021-03-31'
	]
	const expected = { name: 'TP53 MONDO:0005089', strand: '-' }
	test.deepEqual(parseBedLine(bedLine), expected)
	test.end()
})

tape(
	'test #6: parsing a line from dbSnp153BadCoords.bb, four columns : https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153BadCoords.bb',
	function (test) {
		const bedLine = ['chr17', '22078995', '22078998', 'rs587632675']
		const expected = { name: 'rs587632675' }
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test #7: parsing a line from hgmd.bb: https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/hgmd.bb, strand == .',
	function (test) {
		const bedLine = [
			'chr17',
			'7687375',
			'7687376',
			'TP53:CS002469',
			'0',
			'.',
			'7687375',
			'7687376',
			'0,0,0',
			'TP53',
			'CS002469',
			'splicing variant'
		]
		const expected = { name: 'TP53:CS002469' }
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test #8: parsing a line from interactions.bb: https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/interactions.bb',
	function (test) {
		const bedLine = [
			'chr17',
			'7687439',
			'7703502',
			'WRAP53: TP53,DKC1,SMN2,SMN1,TRNAU1AP,NCBP2,NOP10,NHP2,SNRPC,PRPF4',
			'32',
			'.',
			'7687439',
			'7703502',
			'0,0,128'
		]
		const expected = {
			name: 'WRAP53: TP53,DKC1,SMN2,SMN1,TRNAU1AP,NCBP2,NOP10,NHP2,SNRPC,PRPF4'
		}
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)

tape(
	'test#9: parsing a line from miRnaAtlasSample1.bb: https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/miRnaAtlasSample1.bb',
	function (test) {
		const bedLine = [
			'chr17',
			'8088066',
			'8088083',
			'hsa-miR-4314',
			'777',
			'+',
			'MI0015846',
			'24',
			'8.57,114.92,54.01,75.90,120.94,19.11,73.37,11.06,81.16,23.25,7.38,101.05,58.32,16.78,79.95,3.11,175.32,78.50,92.89,37.40,62.77,62.39,96.46,64.69',
			'322760',
			'418',
			'0.67'
		]
		const expected = { name: 'hsa-miR-4314', strand: '+' }
		test.deepEqual(parseBedLine(bedLine), expected)
		test.end()
	}
)
