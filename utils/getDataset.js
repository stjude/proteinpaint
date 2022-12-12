const help = `
Connect VPN when pulling dataset (scp from hpc); no need when pulling gene db (curl from prp1).
Run this script anywhere on your computer.

	node ~/dev/proteinpaint/utils/getDataset.js <dataset1> <dataset2> ...

Dry run without arg to list all datasets:

	node ~/dev/proteinpaint/utils/getDataset.js

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
	mbmeta,
	sjlife2,
	mbunder6
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

////////////////////////////////////////////
//         one function per dataset       //
////////////////////////////////////////////

// function name is dataset identifier used in commandline argument

function cosmic() {
	scpHpc('anno/db/cosmic.hg19.db')
	scpHpc('anno/db/cosmic.hg38.db')
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

function mbunder6() {
	checkDir('files/hg38/mbunder6/clinical/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/files/hg38/mbunder6/clinical/db ' +
			path.join(tp, 'files/hg38/mbunder6/clinical/db')
	)
	checkDir('sdhanda/mb_portal/BT_database/mb_review/')
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/mb_review/CNV_data_firstcase.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/mb_review/CNV_data_firstcase.tsv')
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/mb_review/fusion_firstcase.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/mb_review/fusion_firstcase.tsv')
	)
	exec(
		'scp ppr:/opt/data/pp/tp_native_dir/sdhanda/mb_portal/BT_database/mb_review/SNVindel_firstcase.tsv ' +
			path.join(tp, 'sdhanda/mb_portal/BT_database/mb_review/SNVindel_firstcase.tsv')
	)
}

function allPharmacotyping() {
	scpHpc('files/hg38/ALL-pharmacotyping/clinical/db')
	scpHpc('files/hg38/ALL-pharmacotyping/clinical/transcriptome-tSNE.txt')
}

function ash() {
	scpHpc('files/hg38/ash/db')
	scpHpc('files/hg38/ash/panall.hg38.bcf.gz')
	scpHpc('files/hg38/ash/panall.hg38.bcf.gz.csi')
	scpHpc('files/hg38/ash/panall.svfusion.hg38.gz')
	scpHpc('files/hg38/ash/panall.svfusion.hg38.gz.tbi')
}

function sjlife2() {
	scpHpc('files/hg38/sjlife/clinical/db')

	scpHpc('files/hg38/sjlife/clinical/PCA/*')

	checkDir('files/hg38/sjlife/bcf/INFOGT/')
	exec('scp "hpc:~/tp/files/hg38/sjlife/bcf/INFOGT/min/chr*" ' + path.join(tp, 'files/hg38/sjlife/bcf/INFOGT'))

	checkDir('files/hg38/sjlife/bcf/AD/')
	exec('scp "hpc:~/tp/files/hg38/sjlife/bcf/AD/min/chr*" ' + path.join(tp, 'files/hg38/sjlife/bcf/AD'))

	checkDir('files/hg38/sjlife/ld/')
	exec('scp "hpc:~/tp/files/hg38/sjlife/ld/small/*.gz*" ' + path.join(tp, 'files/hg38/sjlife/ld'))
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

////////////////////////////////////////////
//               helpers                  //
////////////////////////////////////////////

function scpHpc(file) {
	// scp from hpc:~/tp/file, to local tp/file

	// always check file dir and create if missing
	checkDir(path.dirname(file))

	exec(`scp ${path.join('hpc:~/tp', file)} ${path.join(tp, file.endsWith('*') ? path.dirname(file) : file)}`)
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
