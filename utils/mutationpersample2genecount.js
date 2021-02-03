if (process.argv.length != 4) {
	console.log('<mutationpersample/ folder> <gene.gz> output 3 columns to stdout: sample, gene, #mutation')
	process.exit()
}

/*
accepts the "mutationpersample" directory with one JSON file for each sample in a mds dataset
for each json file, compute the mutated genes and number of hits on each gene,
output to a 3-column tabular table to load to a sql db

snvindel: only genic mutations with given classes
sv/fusion: coding genes
cnv: focal <2mb with coding genes
loh: not considered
itd: coding genes
*/

const glob = require('glob')
const fs = require('fs')
const path = require('path')
const exec = require('child_process').execSync

const in_dir = process.argv[2]
const genefile = process.argv[3]

const snvindel_useclass = new Set(['M', 'F', 'N', 'D', 'I', 'P', 'L', 'Utr3', 'Utr5'])

let snv_no_class = 0,
	sv_no_chr = 0,
	cnv_no_value = 0,
	cnv_no_chr = 0

for (const file of glob.sync(path.join(in_dir, '*'))) {
	// json file is named by the sample
	const samplename = path.basename(file)

	let json
	try {
		json = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }))
	} catch (e) {
		console.error('skipped a non-json file: ' + file)
		continue
	}
	if (!Array.isArray(json)) throw 'json content is not array: ' + file
	const gene2count = new Map()
	for (const item of json) {
		if (item.dt == 1) {
			// snvindel
			if (!item.gene) {
				// mutation is not inside a gene
				continue
			}
			if (!item.class) {
				snv_no_class++
				continue
			}
			if (!snvindel_useclass.has(item.class)) {
				// excluded class
				continue
			}
			gene2count.set(item.gene, 1 + (gene2count.get(item.gene) || 0))
			continue
		}
		if (item.dt == 2 || item.dt == 5) {
			// fusion, sv
			if (!item.chrA || !item.posA || !item.chrB || !item.posB) {
				sv_no_chr++
				continue
			}
			const ca = hit_gene(item.chrA, item.posA, item.posA + 1)
			const cb = hit_gene(item.chrB, item.posB, item.posB + 1)
			for (const g of new Set([...ca, ...cb])) {
				gene2count.set(g, 1 + (gene2count.get(g) || 0))
			}
			continue
		}
		if (item.dt == 4) {
			// cnv
			if (!Number.isFinite(item.value)) {
				cnv_no_value++
				continue
			}
			if (!item.chr || !item.start || !item.stop) {
				cnv_no_chr++
				continue
			}
			if (item.stop - item.start >= 2000000) {
				// bigger than 2mb
				continue
			}
			if (Math.abs(item.value) <= 0.2) {
				// low log2(ratio)
				continue
			}
			const c = new Set(hit_gene(item.chr, item.start, item.stop))
			for (const g of c) {
				gene2count.set(g, 1 + (gene2count.get(g) || 0))
			}
			continue
		}
	}
	for (const [gene, count] of gene2count) {
		console.log(samplename + '\t' + gene + '\t' + count)
	}
}

if (snv_no_class) console.error('SNV no class: ' + snv_no_class)
if (sv_no_chr) console.error('SV no chr/pos: ' + sv_no_chr)
if (cnv_no_value) console.error('CNV no value: ' + cnv_no_value)
if (cnv_no_chr) console.error('CNV no chr/start/stop: ' + cnv_no_chr)

function hit_gene(chr, start, stop) {
	const re = exec(`tabix ${genefile} ${chr}:${start}-${stop}`, { encoding: 'utf8' }).trim()
	if (!re) return []
	const genenames = []
	for (const line of re.split('\n')) {
		const gene = JSON.parse(line.split('\t')[3])
		if (gene.coding) {
			genenames.push(gene.name)
		}
	}
	return genenames
}
