if (process.argv.length != 5) {
	abort(
		process.argv[1] +
			' <text dump from gencode.bb> <kgXref.txt> <output file basename (gencode.hg?)> also writes "gencode.canonical" to current dir'
	)
}

const gencodefile = process.argv[2],
	kgxreffile = process.argv[3],
	outfile = process.argv[4]

const fs = require('fs'),
	exec = require('child_process').execSync,
	checkReadingFrame = require('./checkReadingFrame')

const enst2desc = new Map()
// k: ENST id
// v: desc
const categories = {
	coding: { color: '#004D99', label: 'Coding gene' },
	nonCoding: { color: '#009933', label: 'Noncoding gene' },
	problem: { color: '#FF3300', label: 'Problem' },
	pseudo: { color: '#FF00CC', label: 'Pseudogene' }
}

/*
1	ENST00000619216.1
2	NR_106918
3
4
5	MIR6859-1
6	NR_106918
7	NR_106918
8	Homo sapiens microRNA 6859-1 (MIR6859-1), microRNA. (from RefSeq NR_106918)
*/
for (const line of fs
	.readFileSync(kgxreffile, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	if (!l[0] || !l[7]) continue
	enst2desc.set(l[0].split('.')[0], l[7])
}

const out = [] // collect bedj lines for gencode.hg?.gz
const gene2canonical = [] // collect symbol\tenst rows

/*
1  chrom		chr1	Reference sequence chromosome or scaffold
2  chromStart	166022214	Start position in chromosome
3  chromEnd		166023027	End position in chromosome
4  name			ENST00000422100.1	Ensembl ID
5  score		0	Score (0-1000)
6  strand		+	+ or - for strand
7  thickStart	166022214	Start of where display should be thick (start codon)
8  thickEnd		166022214	End of where display should be thick (stop codon)
9  reserved		16724991	RGB value (use R,G,B string in input file)
10 blockCount	1	Number of blocks
11 blockSizes	813,	Comma separated list of block sizes
12 chromStarts	0,	Start positions relative to chromStart
13 name2		uc286ezv.1	UCSC Genes ID
14 cdsStartStat	none	Status of CDS start annotation (none, unknown, incomplete, or complete)
15 cdsEndStat	none	Status of CDS end annotation (none, unknown, incomplete, or complete)
16 exonFrames	-1,	Exon frame {0,1,2}, or -1 if no frame for exon
17 type			none	Transcript type
18 geneName		RPS3AP10	Gene Symbol
19 geneName2	none	UniProt display ID
20 geneType		none	Gene type
21 transcriptClass	pseudo	Transcript Class
22 source		havana_homo_sapiens	Source of transcript (from gencodeTranscriptSource)
23 transcriptType	processed_pseudogene	BioType of transcript (from gencodeAttrs)
24 tag			Ensembl_canonical,basic,pseudo_consens	symbolic tags (from gencodeTags)
25 level		1	support level, tsl1 is strongest support, tsl5 weakest, NA means not analyzed (from gencodeTranscriptionSupportLevel)
26 tier			canonical,basic,all	Transcript Tier
*/

for (const line of fs
	.readFileSync(gencodefile, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const chr = l[0],
		chromstart = Number(l[2 - 1]),
		chromstop = l[3 - 1],
		isoform = l[4 - 1].split('.')[0],
		strand = l[6 - 1],
		forward = strand == '+',
		thickstart = Number.parseInt(l[7 - 1]),
		thickstop = Number.parseInt(l[8 - 1]),
		thin3 = [],
		thin5 = [],
		thick = [],
		intron = [],
		exon = [], // exons are sorted from 5' to 3'
		exonframes = l[16 - 1],
		symbol = l[18 - 1],
		category = l[21 - 1]

	// trim the trailing comma
	const tmp1 = l[11 - 1].split(',')
	tmp1.pop()
	const blocksizes = tmp1.map(Number) // bp length of all exons; array length is #exons

	const tmp2 = l[12 - 1].split(',')
	tmp2.pop()
	const startlst = tmp2.map(Number)

	let paststop = null, // genomic stop of previous exon, for getting intron
		rnalen = 0,
		cdslen = 0

	for (const [i, exonlen] of blocksizes.entries()) {
		rnalen += exonlen

		const a = chromstart + startlst[i] // genomic start of this exon
		const b = a + exonlen // genomic stop of this exon

		if (forward) {
			exon.push([a, b])
		} else {
			exon.unshift([a, b])
		}

		// to generate the intron behind this exon; must skip the first exon
		if (i > 0) {
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
	const obj = {
		name: symbol,
		isoform,
		strand,
		exon,
		rnalen,
		category
	}

	if (enst2desc.has(isoform)) obj.description = enst2desc.get(isoform)

	if (intron.length > 0) obj.intron = intron

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

	checkReadingFrame.default(obj, exonframes)

	out.push(`${chr}\t${chromstart}\t${chromstop}\t${JSON.stringify(obj)}`)

	//if(l[26-1].includes('canonical')) gene2canonical.push(l[18-1]+'\t'+isoform)
}

console.log(JSON.stringify(categories))

fs.writeFileSync(outfile, out.join('\n'))
exec('sort -k1,1 -k2,2n ' + outfile + ' > ' + outfile + '.sort')
exec('mv ' + outfile + '.sort ' + outfile)
exec('bgzip -f ' + outfile)
exec('tabix -f -p bed ' + outfile + '.gz')

//fs.writeFileSync('gencode.canonical', gene2canonical.join('\n'))

function abort(m) {
	console.error(m)
	process.exit()
}
