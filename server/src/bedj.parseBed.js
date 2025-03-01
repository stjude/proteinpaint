/*
input:

l = array of following fields.

these are fields from gencode bb file:

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

these are fields from dbsnp bb file:

[
  'chr17',
  '7591983',
  '7591984',
  'rs376621917',
  'T',
  '1',
  'A,',
  '0',
  '12',
  '-inf,0.000254613,0.000159276,0.000372153,-inf,0.000159256,0.000153775,-inf,0,0.000269687,0.00166667,-inf,',
  ',T,T,T,,T,T,,T,T,T,,',
  ',A,A,A,,A,A,,A,A,A,,',
  '1819',
  'snv',
  'rareSome,rareAll,overlapDiffClass,',
  '45495586234',
  '313'
]


output:

a json-bed item object

preliminary logic

to parse line as gene file, require following:
- column 6 is +/-
- column 7 and 8 are integers (cds start/stop)
- column 11 and 12 are comma-joined integers


*/

import checkReadingFrame from './checkReadingFrame.js'

//a valid exonFrames field can only contain members of validFrames, names -1, 0, 1, or 2
const validFrames = new Set(['-1', '0', '1', '2'])

export function parseBedLine(l, enst2desc) {
	const chr = l[0],
		chromstart = Number(l[2 - 1]),
		chromstop = l[3 - 1],
		isoform = l[4 - 1].split('.')[0], // FIXME should not split by . and trim version for generic bb file
		strand = l[6 - 1]

	if (strand != '+' && strand != '-') {
		// not having +/- as 6th field
		// cannot parse as gene file
		return { name: isoform }
	}

	const forward = strand == '+'

	const thickstart = Number(l[7 - 1]),
		thickstop = Number(l[8 - 1])

	if (!Number.isInteger(thickstart) || !Number.isInteger(thickstop)) {
		// values are not integer (cds start/stop)
		// cannot parse as gene file
		return { name: isoform, strand }
	}

	const thin3 = [],
		thin5 = [],
		thick = [],
		intron = [],
		exon = [], // exons are sorted from 5' to 3'
		exonframes = l[16 - 1],
		symbol = l[18 - 1],
		category = l[21 - 1]

	// to parse line as gene file, column 11 and 12 must be comma-joined numbers
	if (!l[11 - 1].includes(',') || !l[12 - 1].includes(',')) {
		return { name: isoform, strand }
	}

	const tmp1 = l[11 - 1].split(',')
	tmp1.pop()
	const blocksizes = tmp1.map(Number) // bp length of all exons; array length is #exons

	const tmp2 = l[12 - 1].split(',')
	tmp2.pop()
	const startlst = tmp2.map(Number)

	if (blocksizes.includes(NaN) || startlst.includes(NaN)) {
		// column 11 and 12 are not comma-joined integers, as the fields are parsed into NaN
		return { name: isoform, strand }
	}

	// the line should match with gencode file format

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
		rnalen
		//category
	}
	//only parse "field 21: category" when the bb file line has 26 fileds (most likely to be a gencode bb file).
	if (l.length == 26) {
		obj.category = category
	}

	if (enst2desc && enst2desc.has(isoform)) {
		// may add optional description
		obj.description = enst2desc.get(isoform)
	}

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

	// only call checkReadingFrame when exonframes parsed is a comma separated list that contains {-1,0,1,2}
	const tmp3 = exonframes.split(',')
	tmp3.pop()
	if (tmp3.length < 1) {
		//when exonframes doesn't have at least one comma-seperated element, e.g. when exonframes is '' or '32747'
		return obj
	}
	if (!tmp3.some(i => !validFrames.has(i))) {
		/* all fields are valid frames, reject values that are not -1, 0, 1, or 2 */
		checkReadingFrame(obj, exonframes)
	}
	return obj
}
