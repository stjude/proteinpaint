const fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	readline = require('readline'),
	common = require('../src/common'),
	vcf = require('../src/vcf'),
	fetch = require('node-fetch'),
	bettersqlite = require('better-sqlite3')

// do not assume that serverconfig.json is in the same dir as server.js
// for example, when using proteinpaint as an npm module or binary
const serverconfigfile = (process.cwd() || '.') + '/serverconfig.json'
// when unit testing, __non_webpack_require might not be available
// since a spec might be directly requiring an unpacked or unbundled module
const serverconfig =
	(typeof __non_webpack_require__ == 'function' && __non_webpack_require__(serverconfigfile)) ||
	require(serverconfigfile)
Object.freeze(serverconfig)
exports.serverconfig = serverconfig

const tabix = serverconfig.tabix || 'tabix'
const samtools = serverconfig.samtools || 'samtools'

/* p4 ready
********************** EXPORTED
file_is_readable
init_one_vcf
validate_tabixfile
tabix_is_nochr
get_lines_tabix
write_file
write_tmpfile
read_file
file_not_exist
file_not_readable
get_header_vcf
get_fasta
connect_db
loadfile_ssid
run_fishertest
run_fishertest2x3
********************** INTERNAL
*/

/* call it as:

bam can only have .bai index
await cache_index(bam_url+'.bai')

tabix file index is uncertain and can be either tbi or csi
await cache_index([vcf_url+'.tbi', vcf_url+'.csi']) 
*/
exports.cache_index = async arg => {
	for (const _url of Array.isArray(arg) ? arg : [arg]) {
		const tmp = _url.split('://')
		if (tmp.length != 2) throw 'improper URL for an index file'
		const dir = path.join(serverconfig.cachedir, tmp[0], tmp[1])
		const indexfile = path.basename(tmp[1])
		try {
			await fs.promises.stat(dir)
		} catch (e) {
			if (e.code == 'ENOENT') {
				// make dir
				try {
					await fs.promises.mkdir(dir, { recursive: true })
				} catch (e) {
					throw 'index url dir: cannot mkdir'
				}
			} else {
				throw 'stating index url dir: ' + e.code
			}
		}
		// dir is ready
		const path2file = path.join(dir, indexfile)
		try {
			await fs.promises.stat(path2file)
			// index file exists
			return dir
		} catch (e) {
			if (e.code == 'ENOENT') {
				// download index file
				if (await try_downloadIndexFile(_url, path2file)) {
					return dir
				}
				// failed to download a binary file, try the next url
			} else {
				throw 'stating indexl url file: ' + e.code
			}
		}
	}
	// a valid index file cannot be found from given urls
	return null
}
async function try_downloadIndexFile(url, tofile) {
	/* try to download the index file

	must detect following:
	- downloading throws an HTTPError (https://proteinpaint.stjude.org/invalid)
	- downloaded text data but not binary (https://pecan.stjude.cloud/invalid)

	if either is true, should not 
	*/
	try {
		const res = await fetch(url)
		if (res.status != 200) {
			// resource missing
			console.log('wrong status', res.status)
			return false
		}
		const contentType = res.headers.get('content-type')
		if (!contentType) {
			// missing content type
			console.log('missing content type from header')
			return false
		}
		if (!contentType.toLowerCase().includes('gzip')) {
			// "gzip" must be included
			console.log('wrong content type: ' + contentType)
			return false
		}
		await stream2file(res.body, tofile)
		return true
	} catch (e) {
		// fetch thrown, must be invalid url
		return false
	}
}
function stream2file(from, file) {
	return new Promise((resolve, reject) => {
		const f = fs.createWriteStream(file)
		from.pipe(f)
		from.on('end', () => resolve())
	})
}

exports.file_is_readable = async file => {
	// need full path to the file
	// see if file exists and readable
	// to replace file_not_exist file_not_readable
	try {
		await fs.promises.stat(file)
	} catch (e) {
		if (e.code == 'EACCES') throw 'Permission denied'
		if (e.code == 'ENOENT') throw 'No such file or directory'
		if (e.code == 'EPERM') throw 'Operation not permitted'
		throw 'cannot access file (' + e.code + ')'
	}
}

exports.init_one_vcf = async function(tk, genome) {
	let filelocation
	if (tk.file) {
		if (!tk.file.startsWith(serverconfig.tpmasterdir)) {
			tk.file = path.join(serverconfig.tpmasterdir, tk.file)
		}
		filelocation = tk.file
		await validate_tabixfile(tk.file)
	} else if (tk.url) {
		filelocation = tk.url
		tk.dir = await app.cache_index_promise(tk.indexURL || tk.url + '.tbi')
	} else {
		throw 'no file or url given for vcf file'
	}

	const [info, format, samples, errors] = await get_header_vcf(filelocation, tk.dir)
	if (errors) {
		console.log(errors.join('\n'))
		throw 'got above errors parsing vcf'
	}
	tk.info = info
	tk.format = format
	tk.samples = samples
	if (await tabix_is_nochr(filelocation, tk.dir, genome)) {
		tk.nochr = true
	}
}

async function validate_tabixfile(file) {
	/*
	file is full path
	url not accepted
	*/
	if (!file.endsWith('.gz')) throw 'tabix file not ending with .gz'
	if (await file_not_exist(file)) throw '.gz file not exist'
	if (await file_not_readable(file)) throw '.gz file not readable'

	const tbi = file + '.tbi'
	if (await file_not_exist(tbi)) {
		// tbi not found, try csi
		const csi = file + '.csi'
		if (await file_not_exist(csi)) throw 'neither .tbi .csi index file exist'
		if (await file_not_readable(csi)) throw '.csi index file not readable'
	} else {
		// tbi exists
		if (await file_not_readable(tbi)) throw '.tbi index file not readable'
	}
}
exports.validate_tabixfile = validate_tabixfile

async function tabix_is_nochr(file, dir, genome) {
	const lines = []
	await get_lines_tabix([file, '-l'], dir, line => {
		lines.push(line)
	})
	return common.contigNameNoChr(genome, lines)
}
exports.tabix_is_nochr = tabix_is_nochr

function file_not_exist(file) {
	return new Promise((resolve, reject) => {
		fs.access(file, fs.constants.F_OK, err => {
			if (err) resolve(true)
			resolve(false)
		})
	})
}

function file_not_readable(file) {
	return new Promise((resolve, reject) => {
		fs.access(file, fs.constants.R_OK, err => {
			if (err) resolve(true)
			resolve(false)
		})
	})
}
exports.file_not_readable = file_not_readable
exports.file_not_exist = file_not_exist

async function get_header_vcf(file, dir) {
	/* file is full path file or url
	 */
	const lines = []
	await get_lines_tabix([file, '-H'], dir, line => {
		lines.push(line)
	})

	return vcf.vcfparsemeta(lines)
}

function get_lines_tabix(args, dir, callback) {
	return new Promise((resolve, reject) => {
		const ps = spawn(tabix, args, { cwd: dir })
		const rl = readline.createInterface({ input: ps.stdout })
		rl.on('line', line => {
			callback(line)
		})
		ps.on('close', () => {
			resolve()
		})
	})
}
exports.get_lines_tabix = get_lines_tabix

function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}
exports.write_file = write_file

async function write_tmpfile(text) {
	const tmp = Math.random().toString()
	await write_file(path.join(serverconfig.cachedir, tmp), text)
	return tmp
}
exports.write_tmpfile = write_tmpfile

function read_file(file) {
	return new Promise((resolve, reject) => {
		fs.readFile(file, { encoding: 'utf8' }, (err, txt) => {
			// must use reject in callback, not throw
			if (err) reject('cannot read file')
			resolve(txt)
		})
	})
}
exports.read_file = read_file

exports.get_fasta = function(gn, pos) {
	// chr:start-stop, positions are 1-based
	return new Promise((resolve, reject) => {
		const ps = spawn(samtools, ['faidx', gn.genomefile, pos])
		const out = []
		ps.stdout.on('data', i => out.push(i))
		ps.on('close', code => {
			resolve(out.join(''))
		})
	})
}

exports.connect_db = function(file, isfullpath) {
	/*
file: half or full path
isfullpath: true/false
*/
	return new bettersqlite(isfullpath ? file : path.join(serverconfig.tpmasterdir, file), {
		readonly: true,
		fileMustExist: true
	})
}

const genotype_type_set = new Set(['Homozygous reference', 'Homozygous alternative', 'Heterozygous'])
const genotype_types = {
	href: 'Homozygous reference',
	halt: 'Homozygous alternative',
	het: 'Heterozygous'
}
exports.genotype_type_set = genotype_type_set
exports.genotype_types = genotype_types

exports.loadfile_ssid = async function(id, samplefilterset) {
	/*
samplefilterset:
	optional Set of samples to restrict to
*/
	const text = await read_file(path.join(serverconfig.cachedir, 'ssid', id))
	const sample2gt = new Map()
	// k: sample, v: genotype str
	const genotype2sample = new Map()
	// k: genotype str, v: Set of samples
	for (const line of text.trim().split('\n')) {
		if (!line) continue
		const [genotype, samplesStr] = line.split('\t')
		if (!samplesStr) continue
		if (!genotype_type_set.has(genotype)) throw 'unknown hardcoded genotype label: ' + genotype
		const samples_original = samplesStr.split(',').map(d => Number(d))
		const samplelst = samplefilterset ? samples_original.filter(i => samplefilterset.has(i)) : samples_original
		for (const sample of samplelst) {
			sample2gt.set(sample, genotype)
		}
		genotype2sample.set(genotype, new Set(samplelst))
	}
	return [sample2gt, genotype2sample]
}

exports.run_fishertest = function(tmpfile) {
	const pfile = tmpfile + '.pvalue'
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', ['utils/fisher.R', tmpfile, pfile])
		sp.on('close', () => resolve(pfile))
		sp.on('error', () => reject(error))
	})
}
exports.run_fishertest2x3 = function(tmpfile) {
	const pfile = tmpfile + '.pvalue'
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', ['utils/fisher.2x3.R', tmpfile, pfile])
		sp.on('close', () => resolve(pfile))
		sp.on('error', () => reject(error))
	})
}

exports.run_fdr = async function(plst) {
	// list of pvalues
	const infile = path.join(serverconfig.cachedir, Math.random().toString())
	const outfile = infile + '.out'
	await write_file(infile, plst.join('\t'))
	await run_fdr_2(infile, outfile)
	const text = await read_file(outfile)
	fs.unlink(infile, () => {})
	fs.unlink(outfile, () => {})
	return text
		.trim()
		.split('\n')
		.map(Number)
}

function run_fdr_2(infile, outfile) {
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', ['utils/fdr.R', infile, outfile])
		sp.on('close', () => resolve())
		sp.on('error', () => reject(e))
	})
}

exports.stripJsScript = function stripJsScript(text) {
	return text.replace(/\<script|\bon[\w]{1,38}\b[\ \t\n]*\=/gi, ' _')
	/*
    Explanation:
    \<script           find script tag

    |                  OR
		
    \b                 start of word
      on               starts with "on"
      [\w]{1,40}       followed by 1 or more word-allowed characters [a-zA-Z_], up to 40 max length
    \b                 end of word
    [\ \t\n]*          preceding word followed by zero or more space, tabs, or newlines
    \=                 followed by the 'equal' character

    /gi                globally, case insensitive
	*/
}
