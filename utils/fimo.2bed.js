if (process.argv.length != 5) {
	console.log('<fimo output file> <log likelihood ratio score max> <score min> output to stdout')
	process.exit()
}

/*
1	motif_id	DUX4_HUMAN.H11MO.0.A
2	motif_alt_id
3	sequence_name	chr8
4	start	128503846
5	stop	128503856
6	strand	+
7	score	0.954545
8	p-value	0.000769
9	q-value
10	matched_sequence	TGATAGGTTTG
*/

const infile = process.argv[2]
const maxscore = Number(process.argv[3])
if (Number.isNaN(maxscore)) throw 'invalid max score'
const minscore = Number(process.argv[4])
if (Number.isNaN(minscore)) throw 'invalid min score'

const fs = require('fs')
const readline = require('readline')
const rl = readline.createInterface({ input: fs.createReadStream(infile) })

let dropped_score = 0
let first = true

rl.on('line', line => {
	if (first) return (first = false)

	const l = line.split('\t')
	const score = Number.parseFloat(l[7 - 1])
	if (score <= minscore) return dropped_score++
	const j = {
		strand: l[6 - 1],
		name: Math.floor(score) + l[6 - 1]
	}
	if (score >= maxscore) {
		j.color = 'black'
	} else {
		const v = Math.floor(255 * (1 - score / maxscore))
		j.color = 'rgb(' + v + ',' + v + ',' + v + ')'
	}
	console.log(l[2] + '\t' + l[3] + '\t' + l[4] + '\t' + JSON.stringify(j))
})
rl.on('close', () => {
	console.error(dropped_score + ' lines dropped with score<=0')
})
