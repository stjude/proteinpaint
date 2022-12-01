const help = `
Connect VPN when pulling dataset (scp from hpc); no need when pulling gene db (curl from prp1).
Run this script anywhere on your computer.

node ~/dev/proteinpaint/utils/getDataset.js <dataset1> <dataset2> ...
(dry run without arg to list all datasets)

Existing files are overwritten.
Path of local "tp" folder is determined from serverconfig.json.
Folders under tp/ are auto-created if missing.
`

const datasets = {
	cosmic,
	pnet,
	ihg,
	hg38gene,
	allPharmacotyping,
	ash,
	mbmeta
	// add more datasets
}

if (process.argv.length == 2) {
	// no argument; print list of datasets for download
	console.log('Supported datasets:')
	for (const k in datasets) console.log('*', k)
	process.exit()
}

const fs = require('fs'),
	exec = require('child_process').execSync,
	path = require('path'),
	serverconfig = require('../server/src/serverconfig.js'),
	tp = serverconfig.tpmasterdir

for (let i = 2; i < process.argv.length; i++) {
	const dsname = process.argv[i]
	if (!datasets[dsname]) {
		console.error('Invalid dataset identifier:', dsname)
		process.exit()
	}
	datasets[dsname]()
}

//////////////////////// helpers

function scpHpc(file) {
	// scp from hpc:~/tp/file, to local tp/file
	exec(`scp ${path.join('hpc:~/tp', file)} ${path.join(tp, file)}`)
}

// function name is dataset identifier used in commandline argument

function cosmic() {
	checkDir('anno/db/')
	exec('scp hpc:~/tp/jwang/TASK/MDS/COSMIC/cosmic.slice.hg19.db ' + path.join(tp, 'anno/db/cosmic.hg19.db'))
	exec('scp hpc:~/tp/jwang/TASK/MDS/COSMIC/cosmic.slice.hg38.db ' + path.join(tp, 'anno/db/cosmic.hg38.db'))
}

function pnet() {
	checkDir('files/hg19/pnet/clinical/')
	exec('scp ppr:/opt/data/pp/tp_native_dir/files/hg19/pnet/clinical/db ' + path.join(tp, 'files/hg19/pnet/clinical/db'))
	checkDir('files/hg19/pnet/classification/')
	scpHpc('files/hg19/pnet/classification/pnet_apr13_tnse.txt')
	checkDir('sdhanda/mb_portal/BT_database/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/SNVindel_pnet.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/SNVindel_pnet.tsv')
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/fusion_pnet.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/fusion_pnet.tsv')
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/CNV_data_pnet.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/CNV_data_pnet.tsv')
	)
}

function ihg() {
	checkDir('files/hg19/ihg/clinical/')
	exec('scp ppr:/opt/data/pp/tp_native_dir/files/hg19/ihg/clinical/db ' + path.join(tp, 'files/hg19/ihg/clinical/db'))
	checkDir('files/hg19/ihg/classification/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/files/hg19/ihg/classification/ihg_oct20_TSNE.txt ' +
			path.join(tp, 'files/hg19/ihg/classification/ihg_oct20_TSNE.txt')
	)
	checkDir('sdhanda/mb_portal/BT_database/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/CNV_data_IHG.tsv')
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/fusion_IHG.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/fusion_IHG.tsv')
	)
	scpHpc('sdhanda/mb_portal/BT_database/SNVindel_IHG.tsv')
}

function mbmeta() {
	checkDir('files/hg38/mbmeta/clinical/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/files/hg38/mbmeta/clinical/db ' + path.join(tp, 'files/hg38/mbmeta/clinical/db')
	)
	checkDir('files/hg38/mbmeta/classification/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/files/hg38/mbmeta/classification/meta_analysis_coordinates.txt ' +
			path.join(tp, 'files/hg38/mbmeta/classification/meta_analysis_coordinates.txt')
	)
	checkDir('sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/snv_indel1.tsv ' +
			path.join(
				tp,
				'sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/snv_indel1.tsv'
			)
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/cnv_focal1.tsv ' +
			path.join(
				tp,
				'sdhanda/mb_portal/BT_database/MB03_meta_analysis/data_jan7_2022/Metadata/Alterations/cnv_focal1.tsv'
			)
	)
}

function allPharmacotyping() {
	checkDir('files/hg38/ALL-pharmacotyping/clinical/')
	scpHpc('files/hg38/ALL-pharmacotyping/clinical/db')
	scpHpc('files/hg38/ALL-pharmacotyping/clinical/transcriptome-tSNE.txt')
}

function ash() {
	checkDir('files/hg38/ash/')
	scpHpc('files/hg38/ash/db')
	scpHpc('files/hg38/ash/panall.hg38.bcf.gz')
	scpHpc('files/hg38/ash/panall.hg38.bcf.gz.csi')
	scpHpc('files/hg38/ash/panall.svfusion.hg38.gz')
	scpHpc('files/hg38/ash/panall.svfusion.hg38.gz.tbi')
}

function hg38gene() {
	checkDir('anno/')
	exec('curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz -o ' + path.join(tp, 'anno/refGene.hg38.gz'))
	exec(
		'curl https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi -o ' + path.join(tp, 'anno/refGene.hg38.gz.tbi')
	)
	exec(
		'curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz -o ' + path.join(tp, 'anno/gencode.v41.hg38.gz')
	)
	exec(
		'curl https://proteinpaint.stjude.org/ppSupport/gencode.v41.hg38.gz.tbi -o ' +
			path.join(tp, 'anno/gencode.v41.hg38.gz.tbi')
	)
	exec('curl https://proteinpaint.stjude.org/ppSupport/genes.hg38.db -o ' + path.join(tp, 'anno/genes.hg38.db'))
}

function checkDir(p) {
	// p is path relative to tp dir

	const p2 = path.join(tp, p)
	try {
		fs.statSync(p2)
	} catch (e) {
		fs.mkdirSync(p2, { recursive: true })
	}
}
