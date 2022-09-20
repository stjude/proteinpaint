if (process.argv.length != 3) {
	console.log('<matrix file from Kyla (e.g. "december_7741.txt")> output to stdout')
	process.exit()
}

/*
input file is the big sample-by-term tabular text file
1. has a header line
2. sample on rows
3. terms on columns

must run dos2unix on the file first

% cut -f1-8 december_7741.txt|more
sjlid   Sample  sample_source   sample_status   sample_cloud    phenotree_source        wgs_sequenced   snp6_genotyped
        <name1>        CCSS    Good    Yes     CCSS    1       -994
        <name2>  CCSS    Good    Yes     CCSS    1       -994

first two columns are sjlife and ccss sample ids

in header line, "phenotree_source" will be replaced by 'subcohort', to become the "subcohort" term
*/

const fs = require('fs')
const readline = require('readline')

// read temp file by line, alter header by replacing "phenotree_source" with "subcohort"; output to matrix.stringID
let first = true
const rl = readline.createInterface({ input: fs.createReadStream(process.argv[2]) })
rl.on('line', line => {
	if (first) {
		first = false
		const l = line.split('\t')

		const idx = l.findIndex(i => i == 'phenotree_source')
		if (idx == -1) throw '"phenotree_source" column missing from ' + process.argv[2]

		l[idx] = 'subcohort'
		console.log(l.join('\t'))
		return
	}
	console.log(line)
})
