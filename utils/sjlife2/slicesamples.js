const exec = require('child_process').execSync
const readline = require('readline')
const fs = require('fs')

const lines = exec('tabix -H ../../vcf/SJLIFE.vcf.gz', { encoding: 'utf8' })
	.trim()
	.split('\n')
const vcfsamples = new Set(lines[lines.length - 1].split('\t').slice(9))

slice_tabfile('annotation.matrix')
slice_tabfile('annotation.outcome')
slice_tabfile('chronicevents.precomputed')

function slice_tabfile(file) {
	const fout = fs.createWriteStream(file)
	const rl = readline.createInterface({ input: fs.createReadStream('../' + file) })
	rl.on('line', line => {
		const l = line.split('\t')
		if (vcfsamples.has(l[0])) fout.write(line + '\n')
	})
	rl.on('close', () => {
		fout.end()
	})
}

check_category2vcfsample()
function check_category2vcfsample() {
	const rl = readline.createInterface({ input: fs.createReadStream('../category2vcfsample.nograde9') })
	rl.on('line', line => {
		const l = line.split('\t')
		const lst = JSON.parse(l[4])
		for (const i of lst) {
			if (i.group1lst) {
				for (const s of i.group1lst) {
					if (!vcfsamples.has(s)) throw s
				}
			}
			if (i.group2lst) {
				for (const s of i.group2lst) {
					if (!vcfsamples.has(s)) throw s
				}
			}
		}
	})
}
