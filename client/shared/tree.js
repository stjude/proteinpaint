/*
input:
1. list of leaf nodes, e.g. mutation cases, each with a set of key-value pairs
2. levels of hierarchy in an ordered list
   each item: { k, full }
   "k" and "full" are two attribute keys

output:
a list of items, as input for d3-hierarchy.stratify
one item for each child-parent relationship in the hierarchy
{
	id:
	parentId:
	lst:
	value:
	name:
	full:
	id0:
	v0:
	id1:
	v1:
	id2:
	v2:
}

strange issue: https://github.com/stjude/proteinpaint/commit/c36004d47d4374d2ade719c6ef9e2b848f0850dc
using Map for lp, nodes etc will cause memory issue, thus the use of simple objects

to-do: verify this works after a reorg
*/

const hardcode_root = 'root'
const hierarchy_spacer = '...'

export function stratinput(lst, levels) {
	const lp = Object.create(null)
	// leaf to parent
	// k: HM...BALL...sub
	// v: HM...BALL

	const nodes = Object.create(null)
	/*
	k: string id of node, e.g. HM...BALL
	v: node
		.full
		.lst[]
			items from input
	*/

	const size = Object.create(null)
	// only increment size to leaf nodes, so that root.sum() will work
	// k: string id of a node, e.g. HM...BALL
	// v: number of items

	for (const m of lst) {
		for (const [i, lev] of levels.entries()) {
			const thisv = getkey(m, i, levels)
			const pav = getkey(m, i - 1, levels)

			// as mutations can come as {"subtype":""}
			// in the sunburst chart at the subtype level, this mutation should not be counted
			// thus the test with !m[lev.k] rather than !(lev.k in m)
			if (!m[lev.k]) {
				// stop at this level
				// add count to prev level
				if (i > 0) {
					size[pav] += 1
				}
				break
			}

			lp[thisv] = pav
			if (!(thisv in size)) {
				size[thisv] = 0
			}
			if (!(thisv in nodes)) {
				const n = {
					lst: []
				}
				if (lev.full) {
					n.full = m[lev.full]
				}

				n.id0 = levels[0].k
				n.v0 = m[levels[0].k]
				if (i == 1) {
					n.id1 = levels[1].k
					n.v1 = m[levels[1].k]
				}
				if (i == 2) {
					n.id2 = levels[2].k
					n.v1 = m[levels[2].k]
				}

				nodes[thisv] = n
			}
			nodes[thisv].lst.push(m)
			if (i == levels.length - 1) {
				size[thisv] += 1
			}
		}
	}

	const nlst = [{ id: hardcode_root, name: hardcode_root }]

	for (const chid in lp) {
		const paid = lp[chid]
		const n = nodes[chid]
		const fields = chid.split(hierarchy_spacer)
		nlst.push({
			id: chid,
			parentId: paid,
			lst: n.lst,
			value: size[chid],
			name: fields[fields.length - 1], // show this instead of chid
			full: n.full,
			id0: n.id0,
			v0: n.v0,
			id1: n.id1,
			v1: n.v1,
			id2: n.id2,
			v2: n.v2
		})
	}
	return nlst
}

function getkey(m, i, levels) {
	// if i is 0, return 'root'
	const klst = [hardcode_root]
	for (let j = 0; j < i; j++) {
		klst.push(m[levels[j].k])
	}
	if (i >= 0) {
		klst.push(m[levels[i].k])
	}
	return klst.join(hierarchy_spacer)
}
