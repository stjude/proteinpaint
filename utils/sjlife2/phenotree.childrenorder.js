if (process.argv.length != 3) {
	console.log(
		'<phenotree (one file for entire tree)> output to stdout: parent id, list of children terms by the order of first appearance'
	)
	process.exit()
}

const phenotree_file = process.argv[2]
const fs = require('fs')

let first = true

const name2id = new Map() // k: name, v: id
const parentid2childrenlst = new Map()

const root_id = '__root'
parentid2childrenlst.set(root_id, [])

for (const line of fs
	.readFileSync(phenotree_file, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	if (first) {
		first = false
		continue
	}

	const l = line.split('\t')
	const L1 = l[0].trim(),
		L2 = l[1] ? l[1].trim() : '-',
		L3 = l[2] ? l[2].trim() : '-',
		L4 = l[3] ? l[3].trim() : '-',
		L5 = l[4] ? l[4].trim() : '-',
		id = l[5] ? l[5].trim() : null

	// id is always for deepest branch
	if (id) {
		const name = L5 != '-' ? L5 : L4 != '-' ? L4 : L3 != '-' ? L3 : L2 != '-' ? L2 : L1
		name2id.set(name, id)
	}

	{
		// L1
		const id = name2id.get(L1) || L1
		if (parentid2childrenlst.get(root_id).indexOf(id) == -1) {
			parentid2childrenlst.get(root_id).push(id)
		}
	}
	if (L2 != '-') {
		const id = name2id.get(L2) || L2
		const pid = name2id.get(L1) || L1
		if (!parentid2childrenlst.has(pid)) parentid2childrenlst.set(pid, [])
		if (parentid2childrenlst.get(pid).indexOf(id) == -1) {
			parentid2childrenlst.get(pid).push(id)
		}
	}
	if (L3 != '-') {
		const id = name2id.get(L3) || L3
		const pid = name2id.get(L2) || L2
		if (!parentid2childrenlst.has(pid)) parentid2childrenlst.set(pid, [])
		if (parentid2childrenlst.get(pid).indexOf(id) == -1) {
			parentid2childrenlst.get(pid).push(id)
		}
	}
	if (L4 != '-') {
		const id = name2id.get(L4) || L4
		const pid = name2id.get(L3) || L3
		if (!parentid2childrenlst.has(pid)) parentid2childrenlst.set(pid, [])
		if (parentid2childrenlst.get(pid).indexOf(id) == -1) {
			parentid2childrenlst.get(pid).push(id)
		}
	}
	if (L5 != '-') {
		const id = name2id.get(L5) || L5
		const pid = name2id.get(L4) || L4
		if (!parentid2childrenlst.has(pid)) parentid2childrenlst.set(pid, [])
		if (parentid2childrenlst.get(pid).indexOf(id) == -1) {
			parentid2childrenlst.get(pid).push(id)
		}
	}
}

for (const [id, lst] of parentid2childrenlst) {
	console.log((id == root_id ? '' : id) + '\t' + JSON.stringify(lst))
}
