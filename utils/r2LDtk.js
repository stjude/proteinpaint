if (process.argv.length != 3) {
	console.log('<r2 file> output to stdout')
	process.exit()
}

/*
1	L1	chr10.61901276.C.G
2	L2	chr10.61901581.T.C
3	r2

*/

const infile = process.argv[2]
const fs = require('fs')
const readline = require('readline')

const rl = readline.createInterface({ input: fs.createReadStream(infile) })
let isfirst = true

let wrong = 0
let skipr2 = 0

rl.on('line', line => {
	if (isfirst) {
		isfirst = false
		return
	}
	const l = line.split('\t')
	const left = l[0].split('.')
	const right = l[1].split('.')
	const chr = left[0]
	const start = Number(left[1]) - 1
	const stop = Number(right[1]) - 1
	if (start >= stop) {
		wrong++
		return
	}

	const r2 = Number(l[2])
	if (r2 <= 0.1) {
		skipr2++
		return
	}

	console.log(
		chr + '\t' + start + '\t' + stop + '\t' + left[2] + '.' + left[3] + '\t' + right[2] + '.' + right[3] + '\t' + r2
	)
})
rl.on('close', () => {
	console.error(infile + ': ' + skipr2 + ' lines skipped with r2<=.1; ' + wrong + ' lines with wrong start/stop')
})
