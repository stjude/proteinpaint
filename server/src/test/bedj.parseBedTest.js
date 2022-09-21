const tape = require('tape')
const parseBedLine = require('../bedj.parseBed').parseBedLine

tape('\n', function(test) {
	test.pass('-***- server/bedj.parseBed test -***-')
	test.end()
})

tape('test...', function(test) {
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
})
