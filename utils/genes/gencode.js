if (process.argv.length != 5)
	abort(
		process.argv[1] + ' <wgEncodeGencodeCompV?.txt> <wgEncodeGencodeAttrsV?.txt> <output file basename (gencode.hg19)>'
	)

var gencode = process.argv[2],
	attrfile = process.argv[3],
	outfile = process.argv[4]

const fs = require('fs'),
	exec = require('child_process').execSync,
	checkReadingFrame = require('./checkReadingFrame')

var attr = {}
// k: ENST id
// v: { gene_type, transcript_type, transcript_class }
var categories = {
	coding: { color: '#004D99', label: 'Coding gene' },
	nonCoding: { color: '#009933', label: 'Noncoding gene' },
	problem: { color: '#FF3300', label: 'Problem' },
	pseudo: { color: '#FF00CC', label: 'Pseudogene' }
}

/*
0  `geneId` varchar(255) NOT NULL,
1  `geneName` varchar(255) NOT NULL,
2  `geneType` varchar(255) NOT NULL,
3  `geneStatus` varchar(255) NOT NULL,
4  `transcriptId` varchar(255) NOT NULL,
5  `transcriptName` varchar(255) NOT NULL,
6  `transcriptType` varchar(255) NOT NULL,
7  `transcriptStatus` varchar(255) NOT NULL,
8  `havanaGeneId` varchar(255) NOT NULL,
9  `havanaTranscriptId` varchar(255) NOT NULL,
10 `ccdsId` varchar(255) NOT NULL,
11 `level` int(11) NOT NULL,
12 `transcriptClass` varchar(255) NOT NULL,
13 `proteinId` varchar(255) NOT NULL,
*/

for (const line of fs
	.readFileSync(attrfile, 'utf8')
	.trim()
	.split('\n')) {
	var l = line.split('\t')
	var isoform = l[4].split('.')[0]
	var cls = l[12]
	if (!categories[cls]) abort('unknown class: ' + cls)
	attr[isoform] = {
		gene_type: l[2],
		transcript_type: l[6],
		transcript_class: cls
	}
}

var out = []

/*
0  `bin` smallint(5) unsigned NOT NULL,
1  `name` varchar(255) NOT NULL,
2  `chrom` varchar(255) NOT NULL,
3  `strand` char(1) NOT NULL,
4  `txStart` int(10) unsigned NOT NULL,
5  `txEnd` int(10) unsigned NOT NULL,
6  `cdsStart` int(10) unsigned NOT NULL,
7  `cdsEnd` int(10) unsigned NOT NULL,
8  `exonCount` int(10) unsigned NOT NULL,
9  `exonStarts` longblob NOT NULL,
10 `exonEnds` longblob NOT NULL,
11 `score` int(11) DEFAULT NULL,
12 `name2` varchar(255) NOT NULL,
13 `cdsStartStat` enum('none','unk','incmpl','cmpl') NOT NULL,
14 `cdsEndStat` enum('none','unk','incmpl','cmpl') NOT NULL,
15 `exonFrames` longblob NOT NULL,
*/

for (const line of fs
	.readFileSync(gencode, 'utf8')
	.trim()
	.split('\n')) {
	var l = line.split('\t')
	var strand = l[3]
	var thickstart = parseInt(l[6]),
		thickstop = parseInt(l[7]),
		forward = strand == '+',
		thin3 = [],
		thin5 = [],
		thick = [],
		intron = [],
		exon = [], // exons are sorted from 5' to 3'
		startstr = l[9].split(','),
		stopstr = l[10].split(','),
		paststop = null,
		rnalen = 0,
		cdslen = 0
	for (var i = 0; i < startstr.length - 1; i++) {
		var a = parseInt(startstr[i]),
			b = parseInt(stopstr[i])
		if (forward) {
			exon.push([a, b])
		} else {
			exon.unshift([a, b])
		}
		rnalen += b - a
		if (i > 0 && i < startstr.length - 1) {
			if (forward) {
				intron.push([paststop, a])
			} else {
				intron.unshift([paststop, a])
			}
		}
		paststop = b
		if (a < thickstart) {
			if (b < thickstart) {
				if (forward) {
					thin5.push([a, b])
				} else {
					thin3.unshift([a, b])
				}
			} else {
				if (forward) {
					thin5.push([a, thickstart])
				} else {
					thin3.unshift([a, thickstart])
				}
				if (b > thickstop) {
					if (thickstart < thickstop) {
						if (forward) {
							thick.push([thickstart, thickstop])
						} else {
							thick.unshift([thickstart, thickstop])
						}
						cdslen += thickstop - thickstart
					}
					if (forward) {
						thin3.push([thickstop, b])
					} else {
						thin5.unshift([thickstop, b])
					}
				} else {
					if (thickstart < b) {
						if (forward) {
							thick.push([thickstart, b])
						} else {
							thick.unshift([thickstart, b])
						}
						cdslen += b - thickstart
					}
				}
			}
		} else if (a < thickstop) {
			if (b <= thickstop) {
				if (a < b) {
					if (forward) {
						thick.push([a, b])
					} else {
						thick.unshift([a, b])
					}
					cdslen += b - a
				}
			} else {
				if (a < thickstop) {
					if (forward) {
						thick.push([a, thickstop])
					} else {
						thick.unshift([a, thickstop])
					}
					cdslen += thickstop - a
				}
				if (forward) {
					thin3.push([thickstop, b])
				} else {
					thin5.unshift([thickstop, b])
				}
			}
		} else {
			if (forward) {
				thin3.push([a, b])
			} else {
				thin5.unshift([a, b])
			}
		}
	}
	var isoform = l[1].split('.')[0]
	var obj = {
		name: l[12],
		isoform,
		strand,
		exon,
		rnalen
	}
	if (isoform in attr) {
		obj.attr = attr[isoform]
		obj.category = obj.attr.transcript_class
	}
	if (intron.length > 0) {
		obj.intron = intron
	}
	if (thickstart == thickstop) {
		// noncoding
	} else {
		obj.cdslen = cdslen
		obj.codingstart = thickstart
		obj.codingstop = thickstop
		obj.coding = thick
		if (thin5.length) obj.utr5 = thin5
		if (thin3.length) obj.utr3 = thin3
	}

	checkReadingFrame.default(obj, l[15])

	out.push(l[2] + '\t' + l[4] + '\t' + l[5] + '\t' + JSON.stringify(obj))
}

console.log(JSON.stringify(categories))

fs.writeFileSync(outfile, out.join('\n'))
exec('sort -k1,1 -k2,2n ' + outfile + ' > ' + outfile + '.sort')
exec('mv ' + outfile + '.sort ' + outfile)
exec('bgzip ' + outfile)
exec('tabix -p bed ' + outfile + '.gz')

function abort(m) {
	console.error(m)
	process.exit()
}

