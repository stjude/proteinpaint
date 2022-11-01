const help = `
Connect VPN when pulling dataset (scp from hpc); no need when pulling gene db (curl from prp1).
Run this script anywhere on your computer.

node ~/dev/proteinpaint/utils/getDataset.js <dataset1> <dataset2> ...

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
	cosmic,
	pnet,
	ihg,
	hg38gene,
	allPharmacotyping
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

function pnet() {
	checkDir('files/hg19/pnet/clinical/')
	exec('scp ppr:/opt/data/pp/tp_native_dir/files/hg19/pnet/clinical/db ~/data/tp/files/hg19/pnet/clinical/db')
	checkDir('files/hg19/pnet/classification/')
	exec(
		'scp hpc:tp/files/hg19/pnet/classification/pnet_apr13_tnse.txt ~/data/tp/files/hg19/pnet/classification/pnet_apr13_tnse.txt'
	)
	checkDir('sdhanda/mb_portal/BT_database/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/SNVindel_pnet.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/SNVindel_pnet.tsv'
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/fusion_pnet.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/fusion_pnet.tsv'
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/CNV_data_pnet.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/CNV_data_pnet.tsv'
	)
}

function ihg() {
	checkDir('files/hg19/ihg/clinical/')
	exec('scp ppr:/opt/data/pp/tp_native_dir/files/hg19/ihg/clinical/db ~/data/tp/files/hg19/ihg/clinical/db')
	checkDir('files/hg19/ihg/classification/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/files/hg19/ihg/classification/ihg_oct20_TSNE.txt ~/data/tp/files/hg19/ihg/classification/ihg_oct20_TSNE.txt'
	)
	checkDir('sdhanda/mb_portal/BT_database/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv'
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/fusion_IHG.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/fusion_IHG.tsv'
	)
	exec(
		'scp hpc:~/tp/sdhanda/mb_portal/BT_database/SNVindel_IHG.tsv  ~/data/tp/sdhanda/mb_portal/BT_database/SNVindel_IHG.tsv'
	)
}

function allPharmacotyping() {
	checkDir('files/hg38/ALL-pharmacotyping/clinical/')
	exec('scp hpc:~/tp/files/hg38/ALL-pharmacotyping/clinical/db  ~/data/tp/files/hg38/ALL-pharmacotyping/clinical/db')
	exec(
		'scp hpc:~/tp/files/hg38/ALL-pharmacotyping/clinical/transcriptome-tSNE.txt ~/data/tp/files/hg38/ALL-pharmacotyping/clinical/transcriptome-tSNE.txt'
	)
}

function hg38gene() {
	checkDir('anno/')
	exec('curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz -o anno/refGene.hg38.gz')
	exec('curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi -o anno/refGene.hg38.gz.tbi')
	exec('curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz -o anno/gencode.v41.hg38.gz')
	exec('curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz.tbi -o anno/gencode.v41.hg38.gz.tbi')
	exec('curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -o anno/genes.hg38.db')
}

function checkDir(p) {
	// p is relative path starting but not including '~/data/tp/'

	const p2 = path.join(process.env.HOME, 'data/tp', p)
	try {
		fs.statSync(p2)
	} catch (e) {
		fs.mkdirSync(p2, { recursive: true })
	}
}
