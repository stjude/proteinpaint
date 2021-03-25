if (process.argv.length < 3) {
	console.log(
		'<input high20 file> <min TinN (total in germline, default 10)> <germline maf deviation, default 0.1 to keep SNVs within 0.4 to 0.6> output to stdout'
	)
	process.exit()
}

const infile = process.argv[2]
const minTinN = process.argv[3] ? Number(process.argv[3]) : 10
const mafdev = process.argv[4] ? Number(process.argv[4]) : 0.1

const fs = require('fs')
const readline = require('readline')

const rl = readline.createInterface({ input: fs.createReadStream(infile, { encoding: 'utf8' }) })

console.log('Chr\tPos\tMinD\tTinD\tMinN\tTinN')

const nt = { A: 1, T: 1, C: 1, G: 1 }

let first = 1

rl.on('line', line => {
	if (first) {
		first = false
		return
	}

	/*
1	NormalSample	SJNBL017554_G1.bam
2	TumorSample	SJNBL017554_D1.bam
3	Name	chr1.13418
4	Chr	chr1
5	Pos	13418
6	Type	SNP
7	Size	1
8	Coverage	57
9	Percent_alternative_allele	0.211
10	Chr_Allele	G
11	Alternative_Allele	A
12	Score	1.000
13	Text	CCTAGAGCCTCCACCACCCC[G/A]AGATCACATTTCTCACTGCC
14	unique_alternative_ids	12
15	reference_normal_count	23
16	reference_tumor_count	22
17	alternative_normal_count	5
18	alternative_tumor_count	7
*/

	const l = line.split('\t')

	if (nt[l[10 - 1]] && nt[l[11 - 1]]) {
		// snv
		const MinD = Number.parseInt(l[18 - 1])
		const MinN = Number.parseInt(l[17 - 1])
		const TinD = MinD + Number.parseInt(l[16 - 1])
		const TinN = MinN + Number.parseInt(l[15 - 1])

		if (TinN < minTinN) return

		const maf = MinN / TinN
		if (maf < 0.5 - mafdev || maf > 0.5 + mafdev) return

		console.log(l[4 - 1] + '\t' + l[5 - 1] + '\t' + MinD + '\t' + TinD + '\t' + MinN + '\t' + TinN)
	}
})
