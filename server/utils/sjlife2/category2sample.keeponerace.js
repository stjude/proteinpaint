/*
only keep European samples from category2vcfsample file
for Yutaka's group one-off request
 */

if (process.argv.length != 4) {
	console.log('<category2vcfsample file> <annotation.matrix> output to stdout the updated "category2vcfsample"')
	process.exit()
}

const file_cat2sam = process.argv[2]
const file_annotation = process.argv[3]

const only_grade = '9'
// for a term, look for samples with only events of this grade

const fs = require('fs')
const readline = require('readline')

main()

async function main() {
	const keepsamples = await getsamplesfromarace()

	for (const line of fs
		.readFileSync(file_cat2sam, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const [groupname, termid, str1, str2, str3] = line.split('\t')

		const j = JSON.parse(str3)

		const j2 = []

		for (const category of j) {
			category.group1lst = category.group1lst.filter(i => keepsamples.has(i))
			if (category.group1lst.length == 0) {
				continue
			}
			if (category.group2lst) {
				category.group2lst = category.group2lst.filter(i => keepsamples.has(i))
			}
			j2.push(category)
		}

		if (j2.length) {
			console.log(groupname + '\t' + termid + '\t' + str1 + '\t' + str2 + '\t' + JSON.stringify(j2))
		}
	}
}

function getsamplesfromarace() {
	const samples = new Set()

	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({ input: fs.createReadStream(file_annotation) })
		rl.on('line', line => {
			const [sample, key, value] = line.split('\t')
			if (key == 'genetic_race' && value == 'European Ancestry') samples.add(sample)
		})
		rl.on('close', () => {
			resolve(samples)
		})
	})
}

function load_terms(termdbfile) {
	const id2term = new Map()
	// k: id, v: json
	const parent2children = new Map()
	// k: term id
	// v: Set of child term id

	for (const line of fs
		.readFileSync(termdbfile, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const [id, name, parent_id, jsontext] = line.split('\t')
		const j = JSON.parse(jsontext)
		if (!j.iscondition) continue
		j.id = id
		id2term.set(id, j)

		if (!parent2children.has(parent_id)) parent2children.set(parent_id, new Set())
		parent2children.get(parent_id).add(id)
	}

	return [id2term, parent2children]
}

function getsampleonlyhasgrade_one_term(id, parent2children, term2sample) {
	// for both leaf and non-leaf terms
	const onlyhasgrade = new Set()
	const hasothergrade = new Set()

	recursive_getsample(onlyhasgrade, hasothergrade, id, parent2children, term2sample)

	const newset = new Set()
	for (const s of onlyhasgrade) {
		if (!hasothergrade.has(s)) newset.add(s)
	}
	return newset
}

function recursive_getsample(onlyhasgrade, hasothergrade, id, parent2children, term2sample) {
	const o = term2sample.get(id)
	if (o) {
		for (const s of o.hasothergrade) hasothergrade.add(s)
		for (const s of o.onlyhasgrade) onlyhasgrade.add(s)
	}
	if (parent2children.has(id)) {
		for (const cid of parent2children.get(id)) {
			recursive_getsample(onlyhasgrade, hasothergrade, cid, parent2children, term2sample)
		}
	}
}
