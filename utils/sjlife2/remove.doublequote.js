// after saving as tab delimited txt files, phenotree files can still contain double quotes and are not csv format (not accepted by "csvformat" command on mac)
// to strip all the double quotes
if (process.argv.length != 3) {
	console.log('<input file with double quotes> Will modify file in place!!')
	process.exit()
}

const fn = process.argv[2]

const fs = require('fs')
const lst = []
for (const line of fs
	.readFileSync(fn, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	lst.push(line.replace(/"/g, ''))
}

const temp = Math.random().toString()
fs.writeFileSync(temp, lst.join('\n'))
fs.renameSync(temp, fn)
