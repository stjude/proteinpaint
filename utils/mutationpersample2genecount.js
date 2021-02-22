if (process.argv.length != 4) {
	console.log('<mutationpersample/ folder> <gene.gz> output 3 columns to stdout: sample, gene, #mutation')
	process.exit()
}

/*
accepts the "mutationpersample" directory with one JSON file for each sample in a mds dataset
for each json file, compute the number of hits on each gene, per mutation type
output to a tabular table to load to a sql db
0  gene
1  sample
2  total
3  snv_mfndi
4  snv_splice
5  snv_utr
6  snv_s
7  sv
8  fusion
9  itd
10 cnv_1mb_01 // cnv under 1 mb, abs(value)>=0.1
11 cnv_1mb_02
12 cnv_1mb_03
13 cnv_2mb_01
14 cnv_2mb_02
15 cnv_2mb_03
16 cnv_4mb_01
17 cnv_4mb_02
18 cnv_4mb_03


19 loh_1mb_01
20 loh_1mb_02
21 loh_1mb_03
22 loh_2mb_01
23 loh_2mb_02
24 loh_2mb_03
25 loh_4mb_01
26 loh_4mb_02
27 loh_4mb_03

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

const snvindel_useclass = new Set(['M', 'F', 'N', 'D', 'I', 'P', 'L', 'S', 'Utr3', 'Utr5'])

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
		try {
			if (item.dt == 1) {
				// snvindel
				if (!item.gene) {
					// mutation is not inside a gene
					continue
				}
				if (!item.class) throw 'snv_no_class'
				if (!snvindel_useclass.has(item.class)) {
					// excluded class
					continue
				}
				const g = may_initgene(item.gene, gene2count)
				g.total++
				if (item.class == 'M' || item.class == 'F' || item.class == 'N' || item.class == 'D' || item.class == 'I')
					g.snv_mfndi++
				else if (item.class == 'L' || item.class == 'P') g.snv_splice++
				else if (item.class == 'S') g.snv_s++
				else if (item.class == 'Utr3' || item.class == 'Utr5') g.snv_utr++
				continue
			}
			if (item.dt == 2 || item.dt == 5) {
				// fusion, sv
				if (!item.chrA || !item.posA || !item.chrB || !item.posB) throw 'svfusion_no_chrpos'
				const ca = hit_gene(item.chrA, item.posA, item.posA + 1)
				const cb = hit_gene(item.chrB, item.posB, item.posB + 1)
				for (const genename of new Set([...ca, ...cb])) {
					const g = may_initgene(genename, gene2count)
					g.total++
					if (item.dt == 2) g.fusion++
					else g.sv++
				}
				continue
			}
			if (item.dt == 4) {
				// cnv
				if (!Number.isFinite(item.value)) throw 'cnv_no_value'
				if (!item.chr || !Number.isInteger(item.start) || !item.stop) throw 'cnv_no_chrpos'
				const length = item.stop - item.start
				if (length > 4000000) {
					// bigger than 4 MB
					continue
				}
				const abv = Math.abs(item.value)
				if (abv < 0.1) {
					// low log2(ratio)
					continue
				}
				const c = new Set(hit_gene(item.chr, item.start, item.stop))
				for (const genename of c) {
					const g = may_initgene(genename, gene2count)
					g.total++
					if (length < 1000000) {
						if (abv > 0.3) g.cnv_1mb_03++
						else if (abv > 0.2) g.cnv_1mb_02++
						else g.cnv_1mb_01++
					} else if (length < 2000000) {
						if (abv > 0.3) g.cnv_2mb_03++
						else if (abv > 0.2) g.cnv_2mb_02++
						else g.cnv_2mb_01++
					} else {
						if (abv > 0.3) g.cnv_4mb_03++
						else if (abv > 0.2) g.cnv_4mb_02++
						else g.cnv_4mb_01++
					}
				}
				continue
			}
			if (item.dt == 6) {
				// itd
				if (!item.gene) throw 'itd_no_gene'
				const g = may_initgene(item.gene, gene2count)
				g.total++
				g.itd++
				continue
			}
		} catch (e) {
			console.error(e + ' ' + JSON.stringify(item) + ' ' + samplename)
		}
	}
	for (const [gene, g] of gene2count) {
		console.log(
			`${samplename}\t${gene}\t${g.total}\t` +
				`${g.snv_mfndi}\t${g.snv_splice}\t${g.snv_utr}\t${g.snv_s}\t` +
				`${g.sv}\t${g.fusion}\t${g.itd}\t` +
				`${g.cnv_1mb_01}\t${g.cnv_1mb_02}\t${g.cnv_1mb_03}\t` +
				`${g.cnv_2mb_01}\t${g.cnv_2mb_02}\t${g.cnv_2mb_03}\t` +
				`${g.cnv_4mb_01}\t${g.cnv_4mb_02}\t${g.cnv_4mb_03}`
		)
	}
}

function may_initgene(gene, map) {
	if (!map.has(gene)) {
		map.set(gene, {
			total: 0,
			snv_mfndi: 0,
			snv_splice: 0,
			snv_utr: 0,
			snv_s: 0,
			sv: 0,
			fusion: 0,
			itd: 0,
			cnv_1mb_01: 0,
			cnv_1mb_02: 0,
			cnv_1mb_03: 0,
			cnv_2mb_01: 0,
			cnv_2mb_02: 0,
			cnv_2mb_03: 0,
			cnv_4mb_01: 0,
			cnv_4mb_02: 0,
			cnv_4mb_03: 0
		})
	}
	return map.get(gene)
}

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
