const fs = require('fs')
const readline = require('readline')
const exec = require('child_process').execSync
const vcf = require('../../src/vcf')

const abort = m => {
	console.error('Error:', m)
	process.exit()
}

const argerror = m => {
	console.log(
		'Error: ' +
			m +
			`
  --vcf       = VCF text file
                file must have POS, REF, and ALT fields
  --vcfhaschr = 1; set this if VCF has chr names like "chr1"
  --bam       = a BAM file;
                if this parameter is used, will count alleles irrespective of strands
                and stranded BAMs are ignored
                all BAM files should have the .bai index at the same location
  --bamhaschr = 1; set this if all BAM files have chr names like "chr1"

Out put a tsv file for allelic read count at heterozygous regions.
`
	)
	process.exit()
}

const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [a, b] = process.argv[i].split('=')
	arg[a.substr(2)] = b
}

if (!arg.vcf) argerror('no vcf file')
if (arg.vcf.endsWith('.gz')) argerror('vcf file should not be compressed')
if (!fs.existsSync(arg.vcf)) argerror('vcf file not found')

if (arg.bam) {
	if (!fs.existsSync(arg.bam)) argerror('BAM file not found')
	if (!fs.existsSync(arg.bam + '.bai')) argerror('BAM index file not found')
} else {
	argerror('no bam file given')
}

const nt = new Set(['A', 'T', 'C', 'G'])

const rl = readline.createInterface({ input: fs.createReadStream(arg.vcf) })

const metalines = []
let first = true
let vcfobj

let count_notsnp = 0,
	count_nosampledata = 0,
	count_nosample0 = 0,
	count_nogenotype = 0,
	count_snpnotphased = 0,
	count_not2alleles = 0,
	count_homozygous = 0,
	count_nops = 0,
	count_used = 0,
	count_dup = 0
const pileuperrors = new Map()
const allsnv4 = new Set()

rl.on('line', line => {
	if (line[0] == '#') {
		metalines.push(line)
		return
	}

	if (first) {
		first = false
		const [info, format, samples, err] = vcf.vcfparsemeta(metalines)
		if (err) abort(err.join(' '))
		vcfobj = {
			info: info,
			format: format,
			samples: samples
		}
	}

	analyze(line)
})

/////////////////////////// helpers

let psid = null,
	pschr,
	psstart,
	psstop,
	psalt = true

const analyze = line => {
	const [badkeys, mlst, invalidalt] = vcf.vcfparseline(line, vcfobj)
	if (badkeys) abort('badkeys: ' + badkeys.join(' '))
	if (invalidalt) abort('invalidalt: ' + invalidalt.join(' '))

	for (const m of mlst) {
		const chr = (arg.vcfhaschr ? '' : 'chr') + m.chr

		if (!nt.has(m.ref) || !nt.has(m.alt)) {
			continue
		}

		checkbam(m)
	}
}

const checkbamcoord = m => {
	let chr
	if (arg.bamhaschr) {
		if (arg.vcfhaschr) {
			chr = m.chr
		} else {
			chr = 'chr' + m.chr
		}
	} else {
		if (arg.vcfhaschr) {
			chr = m.chr.substr(3)
		} else {
			chr = m.chr
		}
	}
	return chr + ':' + (m.pos + 1) + '-' + (m.pos + 1)
}

const checkbam = m => {
	const upcase1 = m.ref.toUpperCase()
	const upcase2 = m.alt.toUpperCase()

	const [c1, c2] = dopileup(m, arg.bam, upcase1, upcase2)
	console.log(m.chr + '\t' + m.pos + '\t' + m.ref + '\t' + c1 + '\t' + m.alt + '\t' + c2)
}

function dopileup(m, bam, upcase1, upcase2) {
	const coord = checkbamcoord(m)
	const line = exec('samtools mpileup -d 999999 -Q 0 -r ' + coord + ' ' + bam + ' 2>x', { encoding: 'utf8' })
		.trim()
		.split('\n')[0]

	let c1 = 0,
		c2 = 0

	if (line) {
		// 8	128744796	N	33	>>>>>>>>>>>>>>>>>>>>>>><<>><><>>T	HH9GJIHIJHJJB<JDJ>IFJHACFJJFJDDGq
		const l = line.split('\t')
		if (l[4]) {
			for (const x of l[4]) {
				// do not consider case here
				const xup = x.toUpperCase()
				if (!nt.has(xup)) {
					// not a nt
					continue
				}
				if (xup == upcase1) {
					c1++
				} else if (xup == upcase2) {
					c2++
				}
			}
		}
	}
	return [c1, c2]
}
