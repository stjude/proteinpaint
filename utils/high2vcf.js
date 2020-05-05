// support tumor-normal pair or single sample, in that case always use "tumor"

const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [a, b] = process.argv[i].split('=')
	arg[a.substr(2)] = b
}

if (!arg.high20) abort('no high20 file')
if (!arg.genome) abort('no genome sequence file')
if (!arg.out) abort('no vcf file name')
if (!arg.chromsize) abort('no chromsize file')

function abort(m) {
	console.log(
		m +
			`
  --genome    = <.gz fasta file> samtools-indexed
  --chromsize = <chrom size file> each row: chrname -tab- size
  --out       = <output vcf file basename>
  --normal    = <normal sample name> optional
                requires these two columns: reference_normal_count, alternative_normal_count
  --tumor     = <turmo sample name> optional
                requires these two columns: reference_tumor_count alternative_tumor_count
				if neither "normal" and "tumor" is given, will output only variants
  --high20    = <high_20 text file> with following columns:
  	Chr: chr1
	Pos: 546697
	Chr_Allele: A
	Alternative_Allele: G
`
	)
	process.exit()
}

const fs = require('fs')
const readline = require('readline')
const exec = require('child_process').execSync

const chr2size = {} // chr : size
for (const line of fs
	.readFileSync(arg.chromsize, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const s = Number.parseInt(l[1])
	if (Number.isNaN(s)) abort('invalid chromosome size: ' + line)
	chr2size[l[0]] = s
}

const tempfile = Math.random().toString()
const vcfout = fs.createWriteStream(tempfile)
let headerlinenum

vcfout.on('finish', () => {
	// header has 4 lines, skip for sorting
	exec(
		'(head -n ' +
			headerlinenum +
			' ' +
			tempfile +
			' && tail -n +' +
			(headerlinenum + 1) +
			' ' +
			tempfile +
			' | sort -k1,1 -k2,2n) > ' +
			arg.out
	)
	fs.unlinkSync(tempfile)
	exec('bgzip ' + arg.out)
	exec('tabix -p vcf ' + arg.out + '.gz')

	if (invalidchr) console.log(invalidchr + ' lines skipped for invalid chr name')
})

let iChr,
	iPos,
	iChr_Allele,
	iAlternative_Allele,
	ireference_normal_count,
	ireference_tumor_count,
	ialternative_normal_count,
	ialternative_tumor_count,
	invalidchr = 0

const rl = readline.createInterface({ input: fs.createReadStream(arg.high20, { encoding: 'utf8' }) })
rl.on('close', () => {
	vcfout.end()
})
rl.on('line', line => {
	if (!iChr) {
		// header
		const err = parseheader(line)
		if (err) abort('high20 file header error: ' + err)
		return
	}

	const l = line.split('\t')

	const chr = l[iChr]
	if (!chr2size[chr]) {
		invalidchr++
		return
	}

	let pos = Number.parseInt(l[iPos])
	if (Number.isNaN(pos)) {
		console.error('invalid position: ' + l[iPos])
		return
	}

	let ref = l[iChr_Allele]
	let mut = l[iAlternative_Allele]

	if (ref == '') {
		const base = getbase(chr, pos)
		if (!base) {
			return
		}
		ref = base
		mut = base + mut
	} else if (mut == '') {
		pos--
		const base = getbase(chr, pos)
		if (!base) {
			return
		}
		ref = base + ref
		mut = base
	}

	const normal = []
	if (!arg.single) {
		// only have normal if it's not single
		const refcount = l[ireference_normal_count] || '0'
		const mutcount = l[ialternative_normal_count] || '0'
		normal.push(refcount + ',' + mutcount)
	}

	const tumor = []
	let tumorbaf
	{
		// always have tumor sample
		const refcount = l[ireference_tumor_count] || '0'
		const mutcount = l[ialternative_tumor_count] || '0'
		tumor.push(refcount + ',' + mutcount)

		if (arg.single) {
			const ref = Number.parseInt(refcount)
			const alt = Number.parseInt(mutcount)
			if (ref + alt == 0) {
				tumorbaf = 0
			} else {
				tumorbaf = alt / (ref + alt)
			}
		}
	}

	// output VCF line
	if (arg.normal || arg.tumor) {
		vcfout.write(
			chr +
				'\t' +
				pos +
				'\t.\t' +
				ref +
				'\t' +
				mut +
				'\t100\t.\t.\tAD' +
				(arg.normal ? '\t' + normal.join(',') : '') +
				(arg.tumor ? '\t' + tumor.join(',') : '') +
				'\n'
		)
	} else {
		vcfout.write(chr + '\t' + pos + '\t.\t' + ref + '\t' + mut + '\t100\t.\t.\n')
	}
})

function getbase(chr, pos) {
	const l = exec('samtools faidx ' + arg.genome + ' ' + chr + ':' + pos + '-' + pos, { encoding: 'utf8' })
		.trim()
		.split('\n')
	if (l.length == 2) {
		return l[1].toUpperCase()
	}
	console.log('getbase error: ' + chr + ':' + pos)
	return null
}

function parseheader(line) {
	const l = line.split('\t')
	for ([i, v] of l.entries()) {
		if (v == 'Chr') iChr = i
		else if (v == 'Pos') iPos = i
		else if (v == 'Chr_Allele') iChr_Allele = i
		else if (v == 'Alternative_Allele') iAlternative_Allele = i
		else if (v == 'reference_normal_count') ireference_normal_count = i
		else if (v == 'reference_tumor_count') ireference_tumor_count = i
		else if (v == 'alternative_normal_count') ialternative_normal_count = i
		else if (v == 'alternative_tumor_count') ialternative_tumor_count = i
	}
	if (iChr == undefined) return 'Chr missing'
	if (iPos == undefined) return 'Pos missing'
	if (iChr_Allele == undefined) return 'Chr_Allele missing'
	if (iAlternative_Allele == undefined) return 'Alternative_Allele missing'

	if (arg.tumor) {
		if (ireference_tumor_count == undefined) return 'reference_tumor_count missing'
		if (ialternative_tumor_count == undefined) return 'alternative_tumor_count missing'
	}

	if (arg.normal) {
		if (ireference_normal_count == undefined) return 'reference_normal_count missing'
		if (ialternative_normal_count == undefined) return 'alternative_normal_count missing'
	}
	writeheader()
	return null
}

function writeheader() {
	// vcf meta lines depend on

	const lst = ['##fileformat=VCFv4.3']
	for (const chr in chr2size) {
		lst.push('##contig=<ID=' + chr + ',length=' + chr2size[chr] + '>')
	}
	if (arg.normal || arg.tumor) {
		lst.push(
			'##FORMAT=<ID=AD,Number=R,Type=Integer,Description="Allelic depths for the ref and alt alleles in the order listed">'
		)
		lst.push(
			'#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT' +
				(arg.normal ? '\t' + arg.normal : '') +
				(arg.tumor ? '\t' + arg.tumor : '')
		)
	} else {
		lst.push('#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO')
	}

	vcfout.write(lst.join('\n') + '\n')
	headerlinenum = lst.length
}
