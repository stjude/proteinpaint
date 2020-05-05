const fs = require('fs')

const ancestry_file = process.argv[2]
const term2parents = new Map()
for (const line of fs
	.readFileSync(ancestry_file, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [c, p] = line.split('\t')
	if (!term2parents.has(c)) term2parents.set(c, new Set())
	term2parents.get(c).add(p)
}

const root1 = 'Graded adverse events'
const root2 = 'ctcae_graded'
const shared = new Set()
let a = 0,
	A = 0
for (const [c, ps] of term2parents) {
	if (ps.has(root1)) a++
	if (ps.has(root2)) A++
	if (ps.has(root1) && ps.has(root2)) shared.add(c)
}
console.log(root1, '=', a)
console.log(root2, '=', A)
if (shared.size) {
	console.log('ERROR:', shared.size + ' terms shared', [...shared])
} else {
	console.log('No shared terms')
}
