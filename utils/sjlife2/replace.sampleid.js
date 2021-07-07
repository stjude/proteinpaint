if (process.argv.length < 4) {
	console.log('<in file> <sample id columns, "0" or "0,1"> <keep header> output file with integer id to stdout')
	process.exit()
}

/*
<in file>
Required
input file is one sample per line,
sample uses the string ID, to be replaced by the integer id produced by a previous step
file must have a well-formed header line corresponding to all columns
the file can have just one sample column, which can appear at any column
or can have two sample columns (e.g. sjlifeid & ccss compbio id)
in the latter, the two columns must be 1st and 2nd of the file

<sample id columns>
Required
either an integer (0) for having the sample name in a single column
or "0,1" for a file with two sample columns, must be the first two columns
when "0,1" is provided, will use whichever column that has a value to convert to integer ID
will not try to use values of both columns to convert to id

<keep header>
Optional
will keep the header line in output
as only sample id column is kept, will write "sample_id" into the header at corresponding column (if "0,1", will write to first column)
*/

const infile = process.argv[2]
const columns = process.argv[3].split(',').map(Number)
for (const i of columns) {
	if (Number.isNaN(i)) throw 'non integer value in column ids'
}
const keepheader = process.argv[4]

const fs = require('fs')

const str2id = new Map()
// k: sample string name
// v: integer id
for (const line of fs
	.readFileSync('samples.idmap', { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const [i, s] = line.split('\t')
	str2id.set(s, i)
}

const missingsamples = new Set()

const lines = fs
	.readFileSync(infile, { encoding: 'utf8' })
	.trim()
	.split('\n')
for (let i = 0; i < lines.length; i++) {
	const l = lines[i].split('\t')
	if (i == 0) {
		if (keepheader) {
			if (columns.length > 1) {
				// must be 0 and 1, drop a column
				l.shift()
				l[0] = 'sample_id'
				console.log(l.join('\t'))
			} else {
				l[columns[0]] = 'sample_id'
				console.log(l.join('\t'))
			}
		}
		continue
	}
	if (columns.length == 1) {
		const cid = columns[0]
		const id = str2id.get(l[cid])
		if (id == undefined) {
			missingsamples.add(l[cid])
			continue
		}
		l[cid] = id
		console.log(l.join('\t'))
		continue
	}
	// must be 0 and 1
	const id = str2id.get(l[0] || l[1])
	if (id == undefined) {
		missingsamples.add(l[0] || l[1])
		continue
	}
	l.shift()
	l[0] = id
	console.log(l.join('\t'))
}
if (missingsamples.size) {
	console.error(infile + ': ' + missingsamples.size + ' samples skipped: ' + [...missingsamples].join(','))
}
