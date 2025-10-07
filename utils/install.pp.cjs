const fs = require('fs')
const exec = require('child_process').execSync
const spawn = require('child_process').spawnSync
const path = require('path')

const arg = new Map()
for (let i = 2; i < process.argv.length; i++) {
	const c = process.argv[i]
	if (c == '-c') {
		const file = process.argv[++i]
		if (!file) abort('config file missing')
		arg.set('c', file)
	} else if (c == '-v') {
		arg.set('v', 1)
	}
}

if (arg.size == 0) {
	console.log(`
Run this script under the ProteinPaint root diretory:

$ node utils/install.pp.cjs [options]

-c FILE  The config file, two-column, tab-delimited
         First column is key, and the second column is value
         Lines starting with # are ignored

         Required keys:

         MAC     - add this key if your system is mac
                   do not add if your system is linux
         TP      - full path of the TP directory, to store genome support files
         CACHE   - full path of the cache directory
         GENOMES - prebuilt genomes to be installed on your system, join multiple by comma
                   hg19, hg38, mm9, mm10, rn6, dm3, dm6, danRer10
         
         Optional keys:

         URL     - URL of your PP server, to be inserted into public/bin/proteinpaint.js
		           do not include trailing /bin/
                   default: http://localhost:3000/
         PORT    - port number for the node server
                   default: 3000
         USER    - secure your server with specified logins
                   join pairs of user name & password by comma, e.g. user1,pass1,user2,pass2
         BINPATH - full path to a directory for storing dependent binary files and programs
                   Docker image user should not use this option, as the binaries are already available via the image

-v       Validate all the file URLs

The script automates some installation procedures, including:
- dependencies, without compilation
- reference files for supported genomes
- building the server configuration file

Requires Node.js (10 or higher), wget, and sed.
Certain reference files are large and may take a while to download.
Use "-v" to see the size of each file (in #bytes) from each genome.
My apologies that I do not know how to print download progress, as wget does.
If the downloading process is interrupted, you can always rerun the script to resume the downloading.

This script is available from https://proteinpaint.stjude.org/utils/install.pp.js
`)
	process.exit()
}

// user config
let UC = {}

if (arg.has('c')) {
	// load config file
	for (const line of fs.readFileSync(arg.get('c'), { encoding: 'utf8' }).trim().split('\n')) {
		if (!line) continue
		if (line[0] == '#') continue
		const l = line.split('\t')
		UC[l[0].trim()] = l[1] ? l[1].trim() : true
	}
}

const validateurlmode = arg.has('v')

if (validateurlmode) {
	// contains all genomes for validating urls
	UC = {
		MAC: 1,
		TP: '/',
		CACHE: '/',
		BINPATH: '/',
		GENOMES: new Set(['hg19', 'hg38', 'mm9', 'mm10', 'dm3', 'dm6', 'danRer10'])
	}
} else {
	// check arg

	if (!UC.TP) abort('TP directory is undefined')
	mkdir(UC.TP)
	if (!UC.CACHE) abort('CACHE directory is undefined')
	mkdir(UC.CACHE)

	// create folder CACHE/ssid/
	mkdir(path.join(UC.CACHE, 'ssid'))

	if (UC.BINPATH) mkdir(UC.BINPATH)
	if (!UC.PYTHON3) abort('PYTHON3 command is undefined')
	if (!UC.GENOMES) abort('GENOMES is undefined')
	UC.GENOMES = new Set(UC.GENOMES.replace(/ /g, '').split(','))

	// arguments look good
	if (fs.existsSync('serverconfig.json')) {
		abort(
			'\n"serverconfig.json" found in the current directory. Installer will not overwrite it to avoid accidents.\nPlease back it up and delete it from the current location.'
		)
	}
}

// server config json object, to be serialized to the file "serverconfig.json"
const SC = {
	genomes: [],
	tpmasterdir: UC.TP,
	cachedir: UC.CACHE,
	port: UC.PORT || 3000
}

if (UC.USER) {
	SC.users = {}
	const l = UC.USER.split(',')
	for (let i = 0; i < l.length; i += 2) SC.users[l[i]] = l[i + 1]
}

// replace url in js bundle
if (UC.URL) {
	SC.URL = UC.URL
	if (fs.existsSync('public/bin/template.js')) {
		exec("sed 's%__PP_URL__%" + path.join(UC.URL, 'bin/') + "%' public/bin/template.js > public/bin/proteinpaint.js")
	} else {
		console.log("public/bin/template.js is missing; won't update URL.")
	}
}

// if binpath is provided, will download binaries
if (UC.BINPATH) {
	{
		const a = path.join(UC.BINPATH, 'bigWigSummary')
		trydownload(
			a,
			UC.MAC
				? 'http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/bigWigSummary'
				: 'http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bigWigSummary'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.bigwigsummary = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'bigBedNamedItems')
		trydownload(
			a,
			UC.MAC
				? 'http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/bigBedNamedItems'
				: 'http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bigBedNamedItems'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.bigBedNamedItems = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'bigBedToBed')
		trydownload(
			a,
			UC.MAC
				? 'http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/bigBedToBed'
				: 'http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bigBedToBed'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.bigBedToBed = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'gfClient')
		trydownload(
			a,
			UC.MAC
				? 'http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/blat/gfClient'
				: 'http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/blat/gfClient'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.gfClient = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'gfServer')
		trydownload(
			a,
			UC.MAC
				? 'http://hgdownload.soe.ucsc.edu/admin/exe/macOSX.x86_64/blat/gfServer'
				: 'http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/blat/gfServer'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.gfServer = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'clustalo')
		trydownload(
			a,
			UC.MAC
				? 'https://proteinpaint.stjude.org/ppSupport/static/pp-support/mac/clustalo'
				: 'https://proteinpaint.stjude.org/ppSupport/static/pp-support/linux/clustalo'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.clustalo = a
		}
	}
	{
		const a = path.join(UC.BINPATH, 'straw')
		trydownload(
			a,
			UC.MAC
				? 'https://proteinpaint.stjude.org/ppSupport/static/pp-support/mac/straw'
				: 'https://proteinpaint.stjude.org/ppSupport/static/pp-support/linux/straw'
		)
		if (!validateurlmode) {
			exec('chmod +x ' + a)
			SC.hicstraw = a
		}
	}
}

// tp
const path_tpanno = path.join(UC.TP, 'anno/')
mkdir(path_tpanno)
const path_tpannodb = path.join(path_tpanno, 'db/')
mkdir(path_tpannodb)
const path_tpgenome = path.join(UC.TP, 'genomes/')
mkdir(path_tpgenome)

SC.genomes = []

if (UC.GENOMES.has('hg19')) add_hg19()
if (UC.GENOMES.has('hg38')) add_hg38()
if (UC.GENOMES.has('mm9')) add_mm9()
if (UC.GENOMES.has('mm10')) add_mm10()
if (UC.GENOMES.has('dm3')) add_dm3()
if (UC.GENOMES.has('dm6')) add_dm6()
if (UC.GENOMES.has('danRer10')) add_danRer10()
if (UC.GENOMES.has('rn6')) add_rn6()

if (validateurlmode) {
	console.log('Done validating all URLs')
} else {
	// export to serverconfig.json
	fs.writeFileSync('serverconfig.json', JSON.stringify(SC, null, 2))
	console.log(`
	Configurations written to ./serverconfig.json.
	Done installing.
	Run "node server" at the current directory to test run the server.
	`)
}

//////////////////// helpers

function add_rn6() {
	trydownload(path.join(path_tpgenome, 'rn6.gz'), 'https://proteinpaint.stjude.org/ppGenomes/rn6.gz')
	trydownload(path.join(path_tpgenome, 'rn6.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/rn6.gz.fai')
	trydownload(path.join(path_tpgenome, 'rn6.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/rn6.gz.gzi')
	trydownload(
		path.join(path_tpanno, 'ncbiRefSeq.rn6.gz'),
		'https://proteinpaint.stjude.org/ppSupport/ncbiRefSeq.rn6.gz'
	)
	trydownload(
		path.join(path_tpanno, 'ncbiRefSeq.rn6.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/ncbiRefSeq.rn6.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.rn6.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.rn6.gz')
	trydownload(path.join(path_tpanno, 'rmsk.rn6.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.rn6.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.rn6.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.rn6.db')
	SC.genomes.push({
		name: 'rn6',
		species: 'rat',
		file: './genome/rn6.js'
	})
}

function add_danRer10() {
	trydownload(path.join(path_tpgenome, 'danRer10.gz'), 'https://proteinpaint.stjude.org/ppGenomes/danRer10.gz')
	trydownload(path.join(path_tpgenome, 'danRer10.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/danRer10.gz.fai')
	trydownload(path.join(path_tpgenome, 'danRer10.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/danRer10.gz.gzi')
	trydownload(
		path.join(path_tpanno, 'ncbiRefSeq.danRer10.gz'),
		'https://proteinpaint.stjude.org/ppSupport/ncbiRefSeq.danRer10.gz'
	)
	trydownload(
		path.join(path_tpanno, 'ncbiRefSeq.danRer10.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/ncbiRefSeq.danRer10.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.danRer10.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.danRer10.gz')
	trydownload(
		path.join(path_tpanno, 'rmsk.danRer10.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/rmsk.danRer10.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'genes.danRer10.db'),
		'https://proteinpaint.stjude.org/ppSupport/genes.danRer10.db'
	)
	SC.genomes.push({
		name: 'danRer10',
		species: 'fruit fly',
		file: './genome/danRer10.js'
	})
}

function add_dm3() {
	trydownload(path.join(path_tpgenome, 'dm3.gz'), 'https://proteinpaint.stjude.org/ppGenomes/dm3.gz')
	trydownload(path.join(path_tpgenome, 'dm3.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/dm3.gz.fai')
	trydownload(path.join(path_tpgenome, 'dm3.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/dm3.gz.gzi')
	trydownload(path.join(path_tpanno, 'refGene.dm3.gz'), 'https://proteinpaint.stjude.org/ppSupport/refGene.dm3.gz')
	trydownload(
		path.join(path_tpanno, 'refGene.dm3.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/refGene.dm3.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'ensGene.dm3.gz'), 'https://proteinpaint.stjude.org/ppSupport/ensGene.dm3.gz')
	trydownload(
		path.join(path_tpanno, 'ensGene.dm3.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/ensGene.dm3.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.dm3.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.dm3.gz')
	trydownload(path.join(path_tpanno, 'rmsk.dm3.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.dm3.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.dm3.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.dm3.db')
	SC.genomes.push({
		name: 'dm3',
		species: 'fruit fly',
		file: './genome/dm3.js'
	})
}

function add_dm6() {
	trydownload(path.join(path_tpgenome, 'dm6.gz'), 'https://proteinpaint.stjude.org/ppGenomes/dm6.gz')
	trydownload(path.join(path_tpgenome, 'dm6.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/dm6.gz.fai')
	trydownload(path.join(path_tpgenome, 'dm6.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/dm6.gz.gzi')
	trydownload(path.join(path_tpanno, 'refGene.dm6.gz'), 'https://proteinpaint.stjude.org/ppSupport/refGene.dm6.gz')
	trydownload(
		path.join(path_tpanno, 'refGene.dm6.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/refGene.dm6.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'ensGene.dm6.gz'), 'https://proteinpaint.stjude.org/ppSupport/ensGene.dm6.gz')
	trydownload(
		path.join(path_tpanno, 'ensGene.dm6.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/ensGene.dm6.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.dm6.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.dm6.gz')
	trydownload(path.join(path_tpanno, 'rmsk.dm6.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.dm6.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.dm6.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.dm6.db')
	SC.genomes.push({
		name: 'dm6',
		species: 'fruit fly',
		file: './genome/dm6.js'
	})
}

function add_mm9() {
	trydownload(path.join(path_tpgenome, 'mm9.gz'), 'https://proteinpaint.stjude.org/ppGenomes/mm9.gz')
	trydownload(path.join(path_tpgenome, 'mm9.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/mm9.gz.fai')
	trydownload(path.join(path_tpgenome, 'mm9.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/mm9.gz.gzi')
	trydownload(path.join(path_tpanno, 'refGene.mm9.gz'), 'https://proteinpaint.stjude.org/ppSupport/refGene.mm9.gz')
	trydownload(
		path.join(path_tpanno, 'refGene.mm9.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/refGene.mm9.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.vM9.mm9.gz'),
		'https://proteinpaint.stjude.org/ppSupport/gencode.vM9.mm9.gz'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.vM9.mm9.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/gencode.vM9.mm9.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.mm9.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.mm9.gz')
	trydownload(path.join(path_tpanno, 'rmsk.mm9.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.mm9.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.mm9.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.mm9.db')
	{
		const a = path.join(path_tpanno, 'hicFragment')
		mkdir(a)
		trydownload(
			path.join(a, 'hic.DpnII.mm9.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm9.gz'
		)
		trydownload(
			path.join(a, 'hic.DpnII.mm9.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm9.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.mm9.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm9.gz'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.mm9.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm9.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.HindIII.mm9.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm9.gz'
		)
		trydownload(
			path.join(a, 'hic.HindIII.mm9.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm9.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.MboI.mm9.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm9.gz'
		)
		trydownload(
			path.join(a, 'hic.MboI.mm9.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm9.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.NcoI.mm9.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm9.gz'
		)
		trydownload(
			path.join(a, 'hic.NcoI.mm9.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm9.gz.tbi'
		)
	}
	SC.genomes.push({
		name: 'mm9',
		species: 'mouse',
		file: './genome/mm9.js'
	})
}

function add_mm10() {
	trydownload(path.join(path_tpgenome, 'mm10.gz'), 'https://proteinpaint.stjude.org/ppGenomes/mm10.gz')
	trydownload(path.join(path_tpgenome, 'mm10.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/mm10.gz.fai')
	trydownload(path.join(path_tpgenome, 'mm10.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/mm10.gz.gzi')
	trydownload(path.join(path_tpanno, 'refGene.mm10.gz'), 'https://proteinpaint.stjude.org/ppSupport/refGene.mm10.gz')
	trydownload(
		path.join(path_tpanno, 'refGene.mm10.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/refGene.mm10.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.mm10.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.mm10.gz')
	trydownload(path.join(path_tpanno, 'rmsk.mm10.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.mm10.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.mm10.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.mm10.db')
	{
		const a = path.join(path_tpanno, 'hicFragment')
		mkdir(a)
		trydownload(
			path.join(a, 'hic.DpnII.mm10.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm10.gz'
		)
		trydownload(
			path.join(a, 'hic.DpnII.mm10.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.mm10.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.mm10.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm10.gz'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.mm10.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.mm10.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.HindIII.mm10.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm10.gz'
		)
		trydownload(
			path.join(a, 'hic.HindIII.mm10.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.mm10.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.MboI.mm10.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm10.gz'
		)
		trydownload(
			path.join(a, 'hic.MboI.mm10.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.mm10.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.NcoI.mm10.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm10.gz'
		)
		trydownload(
			path.join(a, 'hic.NcoI.mm10.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.mm10.gz.tbi'
		)
	}
	SC.genomes.push({
		name: 'mm10',
		species: 'mouse',
		file: './genome/mm10.js'
	})
}

function add_hg38() {
	trydownload(path.join(path_tpgenome, 'hg38.gz'), 'https://proteinpaint.stjude.org/ppGenomes/hg38.gz')
	trydownload(path.join(path_tpgenome, 'hg38.gz.fai'), 'https://proteinpaint.stjude.org/ppGenomes/hg38.gz.fai')
	trydownload(path.join(path_tpgenome, 'hg38.gz.gzi'), 'https://proteinpaint.stjude.org/ppGenomes/hg38.gz.gzi')
	trydownload(path.join(path_tpanno, 'refGene.hg38.gz'), 'https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz')
	trydownload(
		path.join(path_tpanno, 'refGene.hg38.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/refGene.hg38.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.v38.hg38.gz'),
		'https://proteinpaint.stjude.org/ppSupport/gencode.v38.hg38.gz'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.v38.hg38.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/gencode.v38.hg38.gz.tbi'
	)
	trydownload(path.join(path_tpanno, 'rmsk.hg38.gz'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz')
	trydownload(path.join(path_tpanno, 'rmsk.hg38.gz.tbi'), 'https://proteinpaint.stjude.org/ppSupport/rmsk.hg38.gz.tbi')
	trydownload(path.join(path_tpanno, 'genes.hg38.db'), 'https://proteinpaint.stjude.org/ppSupport/genes.hg38.db')
	trydownload(
		path.join(path_tpannodb, 'proteindomain.db'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/proteindomain.db'
	)
	trydownload(path.join(path_tpannodb, 'dbsnp.hg38.bb'), 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/snp/dbSnp153.bb')

	{
		const a = path.join(path_tpanno, 'hicFragment')
		mkdir(a)
		trydownload(
			path.join(a, 'hic.DpnII.hg38.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.hg38.gz'
		)
		trydownload(
			path.join(a, 'hic.DpnII.hg38.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.hg38.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.hg38.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.hg38.gz'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.hg38.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.hg38.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.HindIII.hg38.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.hg38.gz'
		)
		trydownload(
			path.join(a, 'hic.HindIII.hg38.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.hg38.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.MboI.hg38.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.hg38.gz'
		)
		trydownload(
			path.join(a, 'hic.MboI.hg38.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.hg38.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.NcoI.hg38.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.hg38.gz'
		)
		trydownload(
			path.join(a, 'hic.NcoI.hg38.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.hg38.gz.tbi'
		)
	}
	// defaults to have clinvar dataset
	{
		const a = path.join(UC.TP, 'hg38/')
		mkdir(a)
		trydownload(path.join(a, 'clinvar.hg38.vcf.gz'), 'https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.vcf.gz')
		trydownload(
			path.join(a, 'clinvar.hg38.vcf.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/clinvar.hg38.vcf.gz.tbi'
		)
	}

	// human meme file is build-independent
	{
		const a = path.join(UC.TP, 'utils/meme/motif_databases/HUMAN/')
		mkdir(a)
		trydownload(
			path.join(a, 'HOCOMOCOv11_full_HUMAN_mono_meme_format.meme'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme'
		)
		trydownload(
			path.join(a, 'HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'
		)
	}

	SC.genomes.push({
		name: 'hg38',
		species: 'human',
		file: './genome/hg38.js',
		datasets: [{ name: 'ClinVar', jsfile: './dataset/clinvar.hg38.js' }]
	})
}

function add_hg19() {
	trydownload(path.join(path_tpgenome, 'hg19.gz'), 'https://proteinpaint.stjude.org/ppSupport/static/hg19/hg19.gz')
	trydownload(
		path.join(path_tpgenome, 'hg19.gz.fai'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/hg19.gz.fai'
	)
	trydownload(
		path.join(path_tpgenome, 'hg19.gz.gzi'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/hg19.gz.gzi'
	)
	trydownload(
		path.join(path_tpanno, 'refGene.hg19.gz'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/refGene.hg19.gz'
	)
	trydownload(
		path.join(path_tpanno, 'refGene.hg19.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/refGene.hg19.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.v38.hg19.gz'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/gencode.v38.hg19.gz'
	)
	trydownload(
		path.join(path_tpanno, 'gencode.v38.hg19.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/gencode.v38.hg19.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'rmsk.hg19.gz'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/rmsk.hg19.gz'
	)
	trydownload(
		path.join(path_tpanno, 'rmsk.hg19.gz.tbi'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/rmsk.hg19.gz.tbi'
	)
	trydownload(
		path.join(path_tpanno, 'genes.hg19.db'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/genes.hg19.db'
	)
	trydownload(
		path.join(path_tpannodb, 'proteindomain.db'),
		'https://proteinpaint.stjude.org/ppSupport/static/hg19/proteindomain.db'
	)
	trydownload(path.join(path_tpannodb, 'dbsnp.hg19.bb'), 'https://hgdownload.soe.ucsc.edu/gbdb/hg19/snp/dbSnp153.bb')

	{
		const a = path.join(path_tpanno, 'hicFragment')
		mkdir(a)
		trydownload(
			path.join(a, 'hic.DpnII.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.hg19.gz'
		)
		trydownload(
			path.join(a, 'hic.DpnII.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.DpnII.hg19.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.hg19.gz'
		)
		trydownload(
			path.join(a, 'hic.EcoRI.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.EcoRI.hg19.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.HindIII.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.hg19.gz'
		)
		trydownload(
			path.join(a, 'hic.HindIII.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.HindIII.hg19.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.MboI.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.hg19.gz'
		)
		trydownload(
			path.join(a, 'hic.MboI.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.MboI.hg19.gz.tbi'
		)
		trydownload(
			path.join(a, 'hic.NcoI.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.hg19.gz'
		)
		trydownload(
			path.join(a, 'hic.NcoI.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/hicFragment/hic.NcoI.hg19.gz.tbi'
		)
	}
	{
		const a = path.join(path_tpanno, 'hicTAD')
		mkdir(a)
		const b = path.join(a, 'aiden2014')
		mkdir(b)
		trydownload(
			path.join(b, 'GM12878.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/GM12878.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'GM12878.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/GM12878.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'HeLa.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HeLa.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'HeLa.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HeLa.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'HMEC.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HMEC.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'HMEC.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HMEC.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'HUVEC.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HUVEC.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'HUVEC.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/HUVEC.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'IMR90.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/IMR90.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'IMR90.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/IMR90.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'K562.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/K562.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'K562.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/K562.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'KBM7.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/KBM7.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'KBM7.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/KBM7.domain.hg19.gz.tbi'
		)
		trydownload(
			path.join(b, 'NHEK.domain.hg19.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/NHEK.domain.hg19.gz'
		)
		trydownload(
			path.join(b, 'NHEK.domain.hg19.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/tad-aiden2014/NHEK.domain.hg19.gz.tbi'
		)
	}

	// hg19 defaults to have clinvar dataset
	{
		const a = path.join(UC.TP, 'hg19/')
		mkdir(a)
		trydownload(
			path.join(a, 'clinvar.hg19.vcf.gz'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/clinvar.hg19.vcf.gz'
		)
		trydownload(
			path.join(a, 'clinvar.hg19.vcf.gz.tbi'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/clinvar.hg19.vcf.gz.tbi'
		)
	}
	SC.genomes.push({
		name: 'hg19',
		species: 'human',
		file: './genome/hg19.js',
		datasets: [{ name: 'ClinVar', jsfile: './dataset/clinvar.hg19.js' }]
	})

	// meme
	{
		const a = path.join(UC.TP, 'utils/meme/motif_databases/HUMAN/')
		mkdir(a)
		trydownload(
			path.join(a, 'HOCOMOCOv11_full_HUMAN_mono_meme_format.meme'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/HOCOMOCOv11_full_HUMAN_mono_meme_format.meme'
		)
		trydownload(
			path.join(a, 'HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'),
			'https://proteinpaint.stjude.org/ppSupport/static/hg19/HOCOMOCOv11_full_annotation_HUMAN_mono.tsv'
		)
	}
}

function abort(m) {
	console.log('\nERROR: ' + m)
	process.exit()
}

function mkdir(s) {
	if (validateurlmode) return

	// try to create a dir, if already exists, check RW access
	if (fs.existsSync(s)) {
		// has it
		try {
			fs.accessSync(s, fs.constants.R_OK)
		} catch (e) {
			abort('cannot read directory: ' + s)
		}
		try {
			fs.accessSync(s, fs.constants.W_OK)
		} catch (e) {
			abort('cannot write to directory: ' + s)
		}
		console.log('Directory exists: ' + s)
		return
	}
	try {
		fs.mkdirSync(s, { recursive: true })
		console.log('Directory created: ' + s)
	} catch (e) {
		abort('unable to create directory: ' + s)
	}
}

function trydownload(file, url) {
	if (validateurlmode) {
		// validate this url
		const urlsize = urlfilesize(url)
		console.log(urlsize + '\t' + url)
		return
	}

	// if a file does not exist, download from url; else check if is readable
	if (fs.existsSync(file)) {
		try {
			fs.accessSync(file, fs.constants.R_OK)
			console.log('File exists: ' + file)

			// compare size
			const thissize = fs.statSync(file).size
			const urlsize = urlfilesize(url)
			if (thissize >= urlsize) {
				// same size
				return
			}
			console.log('However it is incomplete: Local size=' + thissize + ', URL size=' + urlsize + ', redownload.')
		} catch (e) {
			abort('cannot read file: ' + file)
		}
	}

	console.log('Downloading file for ' + file + ' from ' + url)
	exec('wget -nv ' + url + ' -O ' + file)
	//process.stdout.write( spawn('wget',['-O',file,url]).stdout )
}

function urlfilesize(url) {
	const s = spawn('wget', ['--spider', url], { encoding: 'utf8' })
	const lines = s.stderr.split('\n')
	const line = lines[5]
	if (!line) abort('No line number 6 in wget/spider output!')
	const l = line.split(' ')
	if (l[0] != 'Length:') {
		console.log('Line 6 from wget/spider does not begin with "Length:"')
		console.log('Output:\n' + lines.join('\n'))
		process.exit()
	}
	return Number.parseInt(l[1])
}
/*
scp utils/install.pp.js $prp1:/home/genomeuser/static_files/genomepaint-support/
https://proteinpaint.stjude.org/ppSupport/static/genomepaint-support/install.pp.js
*/
