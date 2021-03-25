if (process.argv.length != 4) {
	console.log('<oncotree.allterms> <table.oncoid>; output to stdout')
	process.exit()
}

const file_allterms = process.argv[2]
const file_table = process.argv[3]

// to subset oncotree text file based on codes only used in table.oncoid

const fs = require('fs')
const parse_c2p = require('./oncotree.parse.c2p.js').default
const c2p = parse_c2p(file_allterms)

const usedchildids = new Set()
for (const line of fs
	.readFileSync(file_table, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	usedchildids.add(line.split('\t')[3])
}
const usedids = new Set()
for (const cid of usedchildids) {
	usedids.add(cid)
	let pid = cid
	while (1) {
		pid = c2p.get(pid)
		if (!pid) break
		usedids.add(pid)
	}
}

// parse oncotree second time to see if each line is to be kept, so that output is based on original order
const lines = fs
	.readFileSync(file_allterms, { encoding: 'utf8' })
	.trim()
	.split('\n')
console.log(lines[0])
for (let i = 1; i < lines.length; i++) {
	const line = lines[i]
	if (test_line_inuse(line)) console.log(line)
}

function test_line_inuse(line) {
	const l = line.split('\t')
	const L1 = getid(l[0])
	const L2 = getid(l[1])
	const L3 = getid(l[2])
	const L4 = getid(l[3])
	const L5 = getid(l[4])
	const L6 = getid(l[5])
	const L7 = getid(l[6])
	if (L7) return usedids.has(L7)
	if (L6) return usedids.has(L6)
	if (L5) return usedids.has(L5)
	if (L4) return usedids.has(L4)
	if (L3) return usedids.has(L3)
	if (L2) return usedids.has(L2)
	if (usedids.has(L1)) return true
}

function getid(s) {
	return s ? s.split(' (')[1].split(')')[0] : null
}
