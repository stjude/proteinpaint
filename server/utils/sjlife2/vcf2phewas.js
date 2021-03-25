if (process.argv.length != 4) {
	console.log('<vcf file> <category2vcfsamples> output result to stdout')
	process.exit()
}

const fs = require('fs')
const readline = require('readline')
const exec = require('child_process').execSync
const path = require('path')

const minimum_total_sample = 10

const file_vcf = process.argv[2]
const file_category2vcfsamples = process.argv[3]

const category2samples = []
const usesamples = new Set() // samples used in file_category2vcfsamples
for (const line of fs
	.readFileSync(file_category2vcfsamples, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const categories = JSON.parse(l[4])
	for (const g of categories) {
		g.group_name = l[0]
		g.term_id = l[1]
		category2samples.push(g)

		for (const s of g.group1lst) usesamples.add(s)
		if (g.group2lst) {
			for (const s of g.group2lst) usesamples.add(s)
		}
	}
}

let vcfsamples
let vcfsamples_useindex

console.log('SNV4\tSNP\tGroup_name\tVariable_ID\tCase\tControl\tp-value\ttest.table')

const rl = readline.createInterface({ input: fs.createReadStream(file_vcf) })
rl.on('line', async line => {
	if (line[0] == '#') {
		if (line[1] == '#') return
		vcfsamples = line.split('\t').slice(9)
		const useindex = new Set()
		for (let i = 0; i < vcfsamples.length; i++) {
			if (usesamples.has(vcfsamples[i])) useindex.add(i)
		}
		if (useindex.size < vcfsamples.length) {
			// some vcf samples are excluded
			vcfsamples_useindex = useindex
		}
		return
	}

	// a variant
	const l = line.split('\t')

	const snv4 = l[0] + '.' + l[1] + '.' + l[3] + '.' + l[4]
	const snp = l[2]

	const sample2gt = new Map()
	// k: sample, v: gt key (href, halt, het)
	const genotype2sample = new Map([['href', new Set()], ['halt', new Set()], ['het', new Set()]])
	// k: gt key (href, halt, het), v: Set(samples)

	for (let i = 9; i < l.length; i++) {
		if (vcfsamples_useindex && !vcfsamples_useindex.has(i - 9)) {
			// sample excluded
			continue
		}

		const gtstring = l[i].split(':')[0]
		if (gtstring == '.') {
			// unknown gt
			continue
		}
		let gtkey
		if (gtstring == '0/0') gtkey = 'href'
		else if (gtstring == '1/1') gtkey = 'halt'
		else if (gtstring == '0/1' || gtstring == '1/0') gtkey = 'het'
		else throw 'unknown GT field: ' + gtstring
		const sample = vcfsamples[i - 9]
		sample2gt.set(sample, gtkey)
		genotype2sample.get(gtkey).add(sample)
	}

	// from vcf file, total number of samples per genotype
	const het0 = genotype2sample.get('het').size,
		href0 = genotype2sample.get('href').size,
		halt0 = genotype2sample.get('halt').size

	const tests = []
	/* list of test objects, one for each category
	.term: {id,name}
	.category: name of the category
	.q: {}
		term type-specific parameter on how the categories are synthesized
		https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.ljho28ohkqr8
	.table: [ contigency table ]
	*/

	for (const category of category2samples) {
		/************ each category a case
		.group1label
		.group2label
		.group1lst
		.group2lst
		*/

		const [het1, halt1, href1] = get_numsample_pergenotype(sample2gt, category.group1lst)

		// number of samples by genotype in control
		let het2, halt2, href2

		if (category.group2lst) {
			;[het2, halt2, href2] = get_numsample_pergenotype(sample2gt, category.group2lst)
		} else {
			het2 = het0 - het1
			halt2 = halt0 - halt1
			href2 = href0 - href1
		}

		tests.push({
			term_id: category.term_id,
			group_name: category.group_name,
			group1label: category.group1label,
			group2label: category.group2label,
			table: [href1, href2, het1, het2, halt1, halt2]
			/* by allele count
				het + 2* halt, // case alt
				het + 2* href, // case ref
				het2 + 2* halt2, // ctrl alt
				het2 + 2* href2, // ctrl ref
				*/
		})
	}

	///////// fisher
	const lines = []
	for (let i = 0; i < tests.length; i++) {
		lines.push(i + '\t' + tests[i].table.join('\t'))
	}
	const tmpfile = file_vcf + '.' + snv4 + '.fisher'
	await write_file(tmpfile, lines.join('\n'))
	const pfile = run_fishertest(tmpfile)

	let i = 0
	for (const line of fs
		.readFileSync(pfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const p = Number(l[7])
		const test = tests[i++]
		console.log(
			snv4 +
				'\t' +
				snp +
				'\t' +
				test.group_name +
				'\t' +
				test.term_id +
				'\t' +
				test.group1label +
				'\t' +
				test.group2label +
				'\t' +
				p +
				'\t' +
				test.table
		)
	}
	fs.unlink(tmpfile, () => {})
	fs.unlink(pfile, () => {})
})

function get_maxlogp(tests) {
	// set actual max for returning to client
	let m = 0
	for (const t of tests) {
		t.logp = -Math.log10(t.pvalue)
		m = Math.max(m, t.logp)
	}
	return m
}

function get_numsample_pergenotype(sample2gt, samples) {
	/*
	 */
	const gt2count = new Map()
	// k: gt, v: #samples
	for (const sample of samples) {
		const genotype = sample2gt.get(sample)
		if (!genotype) {
			// no genotype, may happen when there's no sequencing coverage at this variant for this sample
			continue
		}
		gt2count.set(genotype, 1 + (gt2count.get(genotype) || 0))
	}
	return [gt2count.get('het') || 0, gt2count.get('halt') || 0, gt2count.get('href') || 0]
}

function group_categories(tests) {
	const k2lst = new Map()
	for (const i of tests) {
		if (!k2lst.has(i.group_name)) k2lst.set(i.group_name, [])
		k2lst.get(i.group_name).push(i)
	}
	const lst = []
	for (const [k, o] of k2lst) {
		lst.push({
			group_name: k,
			categories: o
		})
	}
	return lst
}

function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}
function run_fishertest(tmpfile) {
	const pfile = tmpfile + '.pvalue'
	exec('Rscript ../fisher.2x3.R ' + tmpfile + ' ' + pfile)
	return pfile
}
function read_file(file) {
	return new Promise((resolve, reject) => {
		fs.readFile(file, { encoding: 'utf8' }, (err, txt) => {
			// must use reject in callback, not throw
			if (err) reject('cannot read file')
			resolve(txt)
		})
	})
}
async function run_fdr(plst, infile) {
	// list of pvalues
	const outfile = infile + '.fdr'
	await write_file(infile, plst.join('\t'))
	await run_fdr_2(infile, outfile)
	const text = await read_file(outfile)
	fs.unlink(infile, () => {})
	fs.unlink(outfile, () => {})
	return text
		.trim()
		.split('\n')
		.map(Number)
}

function run_fdr_2(infile, outfile) {
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', [path.join(__dirname, '../fdr.R'), infile, outfile])
		sp.on('close', () => resolve())
		sp.on('error', () => reject(e))
	})
}
