if (process.argv.length != 3) {
	console.log('<oncotree.sjsubset> output to two files: termdb/terms and termdb/ancestry')
	process.exit()
}

const file_tree = process.argv[2]

const fs = require('fs')

const root = 'root' // imaginary root, not present in table
const termid2name = new Map()
// k: term id, v: term name

const c2immediatep = new Map()
// k: child id, v: id of immediate parent

const c2allp = new Map()
// k: child id, v: set of all parents

const p2childlst = new Map()
// k: parent id, v: array of unique children, in the order appeared
p2childlst.set(root, [])

const lines = fs
	.readFileSync(file_tree, { encoding: 'utf8' })
	.trim()
	.split('\n')
for (let i = 1; i < lines.length; i++) {
	const l = lines[i].split('\t')
	const [n1, c1] = partfield(l[0])
	const [n2, c2] = partfield(l[1])
	const [n3, c3] = partfield(l[2])
	const [n4, c4] = partfield(l[3])
	const [n5, c5] = partfield(l[4])
	const [n6, c6] = partfield(l[5])
	const [n7, c7] = partfield(l[6])

	// process terms under root
	termid2name.set(c1, n1)
	if (!p2childlst.get(root).includes(c1)) p2childlst.get(root).push(c1)

	if (c2) addin(c2, n2, [c1])
	if (c3) addin(c3, n3, [c2, c1])
	if (c4) addin(c4, n4, [c3, c2, c1])
	if (c5) addin(c5, n5, [c4, c3, c2, c1])
	if (c6) addin(c6, n6, [c5, c4, c3, c2, c1])
	if (c7) addin(c7, n7, [c6, c5, c4, c3, c2, c1])
}

output_termdb()
output_ancestry()

///////////////// helpers

function addin(childcode, childname, pcodelst) {
	termid2name.set(childcode, childname)
	c2immediatep.set(childcode, pcodelst[0])

	if (!c2allp.has(childcode)) c2allp.set(childcode, new Set())

	for (let i = pcodelst.length - 1; i >= 0; i--) {
		const p = pcodelst[i]
		c2allp.get(childcode).add(p)

		if (!p2childlst.has(p)) p2childlst.set(p, [])
		const c = pcodelst[i - 1] || childcode
		if (!p2childlst.get(p).includes(c)) p2childlst.get(p).push(c)
	}
}

function partfield(s) {
	// "Eye (EYE)" returns ["Eye", "EYE"]
	if (!s) return [null, null]
	const [name, b] = s.split(' (')
	return [name, b.split(')')[0]]
}

function output_termdb() {
	const lines = []
	for (const [id, name] of termid2name) {
		const j = {
			id,
			name,
			type: 'categorical',
			values: { '1': { label: 'Yes' } },
			groupsetting: { disabled: true }
		}
		if (!p2childlst.has(id)) j.isleaf = true
		const pid = c2immediatep.get(id) || ''

		lines.push(
			id + '\t' + name + '\t' + pid + '\t' + JSON.stringify(j) + '\t' + p2childlst.get(pid || root).indexOf(id)
		)
	}
	fs.writeFileSync('termdb/terms', lines.join('\n') + '\n')
}
function output_ancestry() {
	const lines = []
	for (const [c, set] of c2allp) {
		for (const p of set) {
			lines.push(c + '\t' + p)
		}
	}
	fs.writeFileSync('termdb/ancestry', lines.join('\n') + '\n')
}
