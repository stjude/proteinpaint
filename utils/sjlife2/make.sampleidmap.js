const fs = require('fs')

const ccss2sj = new Map()
for (const line of fs
	.readFileSync('raw/ccss.2compbio', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [a, b] = line.split('-CCSS-')
	if (!b) continue
	ccss2sj.set(b, a)
}

const intid2name = new Map()
// for samples that are both sjlife and ccss, will only keep sjlife id
// k: integer id, v: sjlife or ccss id
for (const line of fs
	.readFileSync('samples.string2intID', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [oldid, id] = line.split('\t')
	if (intid2name.has(id)) {
		// rely on the fact that sjlife id is always printed in front of ccss id
		// do not overwrite with ccss id here
		continue
	}
	intid2name.set(id, oldid)
}

for (const [intid, name] of intid2name) {
	console.log(intid + '\t' + (ccss2sj.get(name) || name))
}
