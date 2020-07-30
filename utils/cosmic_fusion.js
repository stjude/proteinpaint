if (process.argv.length != 4) {
	console.log(process.argv.length)
	console.log('<CosmicFusionExport.tsv> <hg19/hg38> output to ./cosmicfusion')
	process.exit()
}

const rawfile = process.argv[2]
const genomename = process.argv[3]

const builds = {
	hg19: {
		refgene: '/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg19/refGene.hg19',
		ensgene: '/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg19/gencode.v34.hg19',
		ref2ens:
			'/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg19/wgEncodeGencodeRefSeqV34lift37.txt'
	},
	hg38: {
		refgene: '/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg38/refGene.hg38',
		ensgene: '/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg38/gencode.v34.hg38',
		ref2ens:
			'/research/rgs01/resgen/legacy/gb_customTracks/tp/jwang/tools/cosmic_update/dataset/hg38/wgEncodeGencodeRefSeqV34.txt'
	}
}

const genome = builds[genomename]
if (!genome) {
	console.log('invalid genome name')
	process.exit()
}

const fs = require('fs')

const refgene = {}
for (const line of fs
	.readFileSync(genome.refgene, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const j = JSON.parse(l[3])
	refgene[j.isoform] = {
		exon: j.exon,
		strand: j.strand,
		chr: l[0]
	}
}

const ensgene = {}
for (const line of fs
	.readFileSync(genome.ensgene, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const j = JSON.parse(l[3])
	ensgene[j.isoform] = {
		exon: j.exon,
		strand: j.strand,
		chr: l[0]
	}
}

const refseqmap = {}
for (const line of fs
	.readFileSync(genome.ref2ens, 'utf8')
	.trim()
	.split('\n')) {
	const l = line.trim().split('\t')
	if (l[0] && l[1]) {
		refseqmap[l[0].split('.')[0]] = l[1].split('.')[0]
	}
}

var lines = fs
	.readFileSync(rawfile, 'utf8')
	.trim()
	.split('\n')

var sample2fus = {}

function err(msg) {
	console.error('<' + i + '> ' + msg)
	process.exit()
}

var nofusionname = 0
var norefseq = 0
var duplicated = 0
var nomatchensemble = 0
var skipquestionmark = 0
var outlines = []

for (var i = 1; i < lines.length; i++) {
	var l = lines[i].split('\t')
	var fus = l[12 - 1]
	if (fus.length == 0) {
		nofusionname++
		continue
	}
	if (fus.indexOf('?') != -1) {
		skipquestionmark++
		continue
	}
	var sampleid = l[0]
	if (!(sampleid in sample2fus)) {
		sample2fus[sampleid] = {}
	}
	if (fus in sample2fus[sampleid]) {
		duplicated++
		continue
	}
	sample2fus[sampleid][fus] = 1

	var prev = 0,
		lst = []
	for (var j = 0; j < fus.length; j++) {
		if (fus[j] == '_' && fus[j + 1].match(/[oA-Z]/)) {
			lst.push(fus.substring(prev, j))
			prev = j + 1
		}
	}
	lst.push(fus.substring(prev))
	//if(lst.length<=1) err(`pairlst length<=1: ${fus}`)
	if (lst.length <= 1) {
		console.log(`pairlst length<=1: ${fus}`)
		continue
	}

	//console.log(lst.join(' '), ' === ', fus)

	var pairlst = []
	var bad = false
	for (var j = 1; j < lst.length; j++) {
		var astring = lst[j - 1],
			bstring = lst[j]
		var [e, a, interstitial] = parsenode(astring, true)
		if (e) {
			if (e == 'refseq') {
				norefseq++
			} else if (e == 'ensemble') {
				nomatchensemble++
			} else {
				console.error(`<${i}> node A: ${e}`)
			}
			bad = true
			continue
		}

		var [e, b] = parsenode(bstring, false)
		if (e) {
			if (e == 'refseq') {
				norefseq++
			} else if (e == 'ensemble') {
				nomatchensemble++
			} else {
				console.error(`<${i}> node B: ${e}`)
			}
			bad = true
			continue
		}

		var pair = {
			a: a,
			b: b,
			translocationname: astring + '_' + bstring
		}
		if (interstitial) {
			pair.interstitial = interstitial
		}
		pairlst.push(pair)
	}
	if (bad) continue
	var namehash = {},
		isoformhash = {}
	pairlst.forEach(j => {
		if (j.a.name) namehash[j.a.name] = 1
		if (j.b.name) namehash[j.b.name] = 1
		if (j.a.isoform) isoformhash[j.a.isoform] = 1
		if (j.b.isoform) isoformhash[j.b.isoform] = 1
	})
	var namelst = [],
		isoformlst = []
	for (var n in namehash) namelst.push(n)
	for (var n in isoformhash) isoformlst.push(n)
	/*
	3	Primary site	
	4	Site subtype 1	
	5	Site subtype 2	
	6	Site subtype 3	
	7	Primary histology	
	8	Histology subtype 1	
	9	Histology subtype 2	
	10	Histology subtype 3	
	13  fusion type / note
	14  pmid
	*/
	outlines.push(
		l[0] +
			'\t' +
			l[1] +
			'\t' +
			namelst.join(',') +
			'\t' +
			isoformlst.join(',') +
			'\t' +
			JSON.stringify(pairlst) +
			'\t' +
			l[2] +
			'\t' +
			l[3] +
			'\t' +
			l[4] +
			'\t' +
			l[5] +
			'\t' +
			l[6] +
			'\t' +
			l[7] +
			'\t' +
			l[8] +
			'\t' +
			l[9] +
			'\t' +
			l[12] +
			'\t' +
			l[13]
	)
}

fs.writeFileSync('cosmicfusion', outlines.join('\n'))

if (nofusionname) console.error(nofusionname + ' lines have no fusion name')
if (skipquestionmark) console.error(skipquestionmark + ' skipped for ? in fusion name')
if (norefseq) console.error(norefseq + ' lines with ensemble name cannot be converted to refseq')
if (nomatchensemble) console.error(nomatchensemble + ' lines with invalid ensemble accession')
if (duplicated) console.error(duplicated + ' duplicated lines removed')

console.error(`
drop table if exists cosmic_fusion;
create table cosmic_fusion (
  sample_id int,
  sample_name character varying(255),
  genes text,
  isoforms text,
  fusions json,
  primarysite character,
  sitesubtype1 character,
  sitesubtype2 character,
  sitesubtype3 character,
  primaryhistology character,
  histologysubtype1 character,
  histologysubtype2 character,
  histologysubtype3 character,
  note character,
  pmid integer,
);
create index cosmicfusiongene on cosmic_fusion(genes);
create index cosmicfusionisoform on cosmic_fusion(isoforms);`)

function parsenode(string, isA) {
	// SS18{ENST00000415083}:r.1_1286
	var lst = string.split(':')
	if (lst.length != 2) return ['node wrong string: ' + string]
	var namematch = lst[0].match(/(\w+)\.\d+\((.*)\)/)
	var gid = namematch[1]
	namematch[1] = namematch[2]
	namematch[2] = gid
	if (!namematch) return ['node name not match: ' + lst[0]]
	var isoform = namematch[2]
	var gm = null
	var refseqname = null
	if (isoform[0] == 'N') {
		refseqname = isoform.split('.')[0]
		gm = refgene[refseqname]
		if (!gm) return ['invalid isoform ' + refseqname]
	} else {
		refseqname = refseqmap[isoform]
		gm = ensgene[isoform]
		if (!gm) return ['invalid isoform ' + isoform]
	}
	if (!refseqname) return ['refseq']

	var node = {
		name: namematch[1].replace(/^o/, ''),
		isoform: refseqname
	}
	var interstitial = null
	var posstr = lst[1].replace(/r\./g, '')
	var [e, poslst] = parsepositionstr(posstr)
	if (e) return ['position error: ' + e + ' original: ' + posstr]
	if (poslst.length < 2) return ['node position list length less than 2: ' + posstr]
	var useposition = isA ? poslst[1] : poslst[0]
	if (isNaN(useposition.pos)) return ['NaN node position: ' + posstr]

	// rna to genomic
	node.chr = gm.chr
	node.strand = gm.strand
	var cum = 0
	for (var i = 0; i < gm.exon.length; i++) {
		var e = gm.exon[i]
		if (e[1] - e[0] + cum >= useposition.pos) {
			if (gm.strand == '+') {
				node.position = e[0] + useposition.pos - cum - 1
			} else {
				node.position = e[1] - (useposition.pos - cum)
			}
			break
		}
		cum += e[1] - e[0]
	}
	if (node.position == undefined) return ['cannot map from rna to genomic position']
	if (useposition.left != undefined) {
		if (isNaN(useposition.left)) return ["invalid 5' shift: " + posstr]
		node.position -= (gm.strand == '+' ? 1 : -1) * useposition.left
	}
	if (useposition.right != undefined) {
		if (isNaN(useposition.right)) return ["invalid 3' shift: " + posstr]
		node.position += (gm.strand == '+' ? 1 : -1) * useposition.right
	}

	if (isA) {
		if (poslst[2]) {
			if (poslst[2].ins) {
				interstitial = {}
				var remainder = poslst[2].stuff
				if (isNaN(parseInt(remainder))) {
					interstitial.nt = remainder
					interstitial.bplen = remainder.length
				} else {
					interstitial.bplen = parseInt(remainder)
				}
			} else {
				return ['unknown trailing position: ' + JSON.stringify(poslst) + ' ' + posstr]
			}
		}
	}
	return [null, node, interstitial]
}

function parsepositionstr(str) {
	var poslst = []
	var prev = 0
	for (var i = 0; i < str.length; i++) {
		if (str[i] == '_') {
			poslst.push(str.substring(prev, i))
			prev = i + 1
			continue
		}
		if (str[i] == '(') {
			if (i == prev) {
				// 1_(546_732) parenthesis at the beginning of pos
				// or r.(819)_937
				var thisparenthesis = i
				while (str[i] != ')') {
					i++
				}
				var nextparenthesis = i
				var thischunk = str.substring(thisparenthesis + 1, nextparenthesis)
				var tryint = parseInt(thischunk)
				if (isNaN(tryint)) return ['nan from stuff in (): ' + thischunk]
				poslst.push(tryint)
				i++
				if (i == str.length) {
					prev = i
					break
				}
				if (str[i] != '_') return ['_ not following (): ' + str]
				prev = i + 1
				i++
				continue
			} else {
				// 1_929+(7320)
				// ignore stuff in parenthesis
				var tryint = parseInt(str.substr(prev))
				if (isNaN(tryint)) return ['attempt int by disregarding trailing (xxx) but wrong: ' + str]
				poslst.push(tryint)
				while (str[i] != ')') {
					i++
				}
				i++
				if (i == str.length) {
					prev = i
					break
				}
				if (str[i] != '_') return ['_ not following trailing (): ' + str]
				prev = i + 1
				i++
				continue
			}
		}
	}
	if (prev < str.length - 1) {
		poslst.push(str.substring(prev))
	}
	var poslst2 = []
	poslst.forEach(function(s) {
		if (typeof s == 'number') {
			poslst2.push({ pos: s })
			return
		}
		if (s.indexOf('ins') == 0) {
			poslst2.push({
				ins: true,
				stuff: s.replace('ins', '')
			})
			return
		}
		var pos = parseInt(s)
		if (s.indexOf('+') != -1) {
			var lst = s.split('+')
			poslst2.push({
				pos: pos,
				right: parseInt(lst[1])
			})
			return
		}
		if (s.indexOf('-') != -1) {
			var lst = s.split('-')
			poslst2.push({
				pos: pos,
				left: parseInt(lst[1])
			})
			return
		}
		poslst2.push({ pos: pos })
	})
	return [null, poslst2]
}
