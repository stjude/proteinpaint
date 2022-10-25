const help = `
Connect VPN.
Run this script anywhere.

node ~/dev/proteinpaint/utils/getDataset.js <dataset1> <dataset2> ...

Files are downloaded from HPC via scp.
Existing files are overwritten.
"tp" folder is hardcoded to be ~/data/tp/ on your computer.
Folders under tp/ are auto-created if missing.
`

if (process.argv.length == 2) {
	console.log(help)
	process.exit()
}

const fs = require('fs'),
	exec = require('child_process').execSync,
	path = require('path')

const datasets = {
	cosmic
	// add more datasets
}

for (let i = 2; i < process.argv.length; i++) {
	const dsname = process.argv[i]
	if (!datasets[dsname]) {
		console.error('Invalid dataset identifier:', dsname)
		process.exit()
	}
	datasets[dsname]()
}

//////////////////////// helpers

// function name is dataset identifier used in commandline argument
function cosmic() {
	checkDir('anno/db/')
	exec('scp hpc:~/tp/jwang/TASK/MDS/COSMIC/cosmic.slice.hg19.db ~/data/tp/anno/db/cosmic.hg19.db')
	exec('scp hpc:~/tp/jwang/TASK/MDS/COSMIC/cosmic.slice.hg38.db ~/data/tp/anno/db/cosmic.hg38.db')
}

function checkDir(p) {
	// p is relative path starting but not including '~/data/tp/'

	const p2 = path.join(process.env.HOME, 'data/tp', p)
	try {
		fs.statSync(p2)
	} catch (e) {
		fs.mkdirSync(p2)
	}
}
