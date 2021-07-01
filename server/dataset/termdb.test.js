const serverconfig = require('../src/serverconfig.js')
const fs = require('fs')
const path = require('path')
const ds = require('./sjlife2.hg38.js')

const copy = JSON.parse(JSON.stringify(ds))
delete copy.track.ld
copy.track.vcf.termdb_bygenotype.sex_chrs = ['chrX', 'chrY']

const datadir = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest')
if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir)
}

copy.cohort.db.file = 'files/hg38/TermdbTest/db2'
const srcdb = path.join(serverconfig.binpath, 'test/testdata/db2')
const destdb = path.join(serverconfig.tpmasterdir, copy.cohort.db.file)
fs.copyFileSync(srcdb, destdb)

/*
const vcfname = 'vcf.gz'
copy.track.vcf.file = 'files/hg38/TermdbTest/' + vcfname
const srcvcf = path.join(serverconfig.binpath, 'test/testdata/' + vcfname)
const destvcf = path.join(serverconfig.tpmasterdir, copy.track.vcf.file)
fs.copyFileSync(srcvcf, destvcf)

const srctbi = srcvcf + '.tbi'
const desttbi = destvcf + '.tbi'
fs.copyFileSync(srctbi, desttbi)
*/

copy.cohort.termdb.survivalplot = {
	terms: ['efs', 'os'],
	codes: [{ value: 0, name: '' }, { value: 1, name: 'censored' }]
}

module.exports = copy
