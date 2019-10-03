if (process.argv.length != 3) {
	console.log('<category2vcfsample file> output category counts to stdout')
	process.exit()
}

const infile = process.argv[2]

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({ input: fs.createReadStream(infile) })
rl.on('line', line => {
	const l = line.split('\t')
	const termid = l[1]
	const categories = JSON.parse(l[4])
	for (const [i, cat] of categories.entries()) {
		console.log(
			(i == 0 ? termid : '') +
				'\t' +
				cat.group1label +
				'\t' +
				cat.group1lst.length +
				'\t' +
				cat.group2label +
				'\t' +
				(cat.group2lst ? cat.group2lst.length : '')
		)
	}
})
