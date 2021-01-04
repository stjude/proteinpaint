if (process.argv.length != 3) {
	console.log('<update_x.csv file from Kyla> output to stdout')
	process.exit()
}

const fs = require('fs')
const readline = require('readline')
const exec = require('child_process').execSync

const tempfile = 'matrix.temp'

// csvformat is from csvkit https://csvkit.readthedocs.io/en/latest/
exec('csvformat -T ' + process.argv[2] + ' > ' + tempfile)

// read temp file by line, alter header by replacing "phenotree_source" with "subcohort"; output to matrix.stringID
let first = true
const rl = readline.createInterface({ input: fs.createReadStream(tempfile) })
rl.on('line', line => {
	if (first) {
		first = false
		const l = line.split('\t')
		if (l[3] == 'phenotree_source') {
			l[3] = 'subcohort'
			console.log(l.join('\t'))
			return
		}
		throw '"phenotree_source" not found in header'
	}
	console.log(line)
})
rl.on('close', () => {
	fs.unlink(tempfile, () => {})
})
