if (process.argv.length != 4) {
	console.log('<in file> <id columns, "0" or "0,1"> output file with integer id to stdout')
	process.exit()
}

const fs = require('fs')

const str2id = new Map()
for (const line of fs
	.readFileSync('samples.string2intID', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [s, i] = line.split('\t')
	str2id.set(s, i)
}

const infile = process.argv[2]
const columns = process.argv[3].split(',').map(Number)

const lines = fs
	.readFileSync(infile, { encoding: 'utf8' })
	.trim()
	.split('\n')
for (let i = 0; i < lines.length; i++) {
	const l = lines[i].split('\t')
	if (i == 0) {
		if (columns.length > 1) {
			// must be 0 and 1, drop a column
			l.shift()
			console.log(l.join('\t'))
		} else {
			console.log(lines[i])
		}
		continue
	}
	if (columns.length == 1) {
		// must be 0
		const id = str2id.get(l[0])
		if (id == undefined) throw 'unknown mapping for ' + l[0]
		l[0] = id
		console.log(l.join('\t'))
		continue
	}
	// must be 0 and 1
	const id = str2id.get(l[0] || l[1])
	if (id == undefined) throw 'unknown mapping for ' + (l[0] || l[1])
	l.shift()
	l[0] = id
	console.log(l.join('\t'))
}
