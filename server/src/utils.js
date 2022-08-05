const fs = require('fs'),
	path = require('path'),
	spawn = require('child_process').spawn,
	readline = require('readline'),
	common = require('#shared/common'),
	vcf = require('#shared/vcf'),
	fetch = require('node-fetch').default, // adding .default allows webpack bundle to work
	bettersqlite = require('better-sqlite3'),
	serverconfig = require('./serverconfig'),
	Readable = require('stream').Readable

exports.serverconfig = serverconfig
const tabix = serverconfig.tabix
const samtools = serverconfig.samtools
const bcftools = serverconfig.bcftools
const bigBedToBed = serverconfig.bigBedToBed
const bigBedNamedItems = serverconfig.bigBedNamedItems

/*********************** EXPORTED
cache_index
file_is_readable
init_one_vcf
validate_tabixfile
tabix_is_nochr
write_file
write_tmpfile
read_file
file_not_exist
file_not_readable
get_lines_bigfile
get_header_tabix
get_header_vcf
get_header_bcf
get_fasta
connect_db
loadfile_ssid
bam_ifnochr
********************** INTERNAL
*/

/*
-- for tabix files, if no indexURL is given, allow using either tbi or csi file at the same location

   await cache_index(gz_url, indexURL) // indexURL can be undefined

-- for bam, always use

   await cache_index(bam_url, indexURL || bam_url+'.bai')

*/
exports.cache_index = async (gzurl, indexurl) => {
	if (!gzurl) throw '.gz file URL missing'
	if (typeof gzurl != 'string') throw '.gz file URL not string'
	if (indexurl) {
		if (typeof indexurl != 'string') throw 'index URL not string'
	}
	const [e, protocol, body] = test_url(gzurl)
	if (e) throw '.gz file URL error: ' + e
	// build cache directory using gz file url and do not include index portion
	// e.g. cache/https/domain/path/to/file.gz/
	const dir = path.join(serverconfig.cachedir, protocol, body)
	try {
		await fs.promises.stat(dir)
	} catch (e) {
		if (e.code == 'ENOENT') {
			// make dir
			try {
				await fs.promises.mkdir(dir, { recursive: true })
			} catch (e) {
				throw 'url dir: cannot mkdir'
			}
		} else {
			throw 'stating gz url dir: ' + e.code
		}
	}
	// dir is ready
	if (indexurl) {
		// index url given, may download it
		const [e, protocol2, body2] = test_url(indexurl)
		if (e) throw 'indexl url error: ' + e
		// first, detect if the index file already exists in the dir+indexfile
		const path2file = path.join(dir, path.basename(body2))
		try {
			await fs.promises.stat(path2file)
			// index file exists
			return dir
		} catch (e) {
			if (e.code == 'ENOENT') {
				// download index file
				await download_index(indexurl, path2file)
				return dir
			} else {
				throw 'stating indexl url file: ' + e.code
			}
		}
	} else {
		// no url specified for index
		// assume the appropriate index exists under dir
		// let tabix 1.11 do the work of getting the tbi/csi file if missing
		return dir
	}
}
function test_url(u) {
	const tmp = u.split('://')
	if (tmp.length != 2) return ['improper url']
	if (tmp[0].length < 3) return ['protocol string length too short'] // ftp??
	if (tmp[1].length < 5) return ['body string length too short'] // a/b.gz at minimum
	return [null, tmp[0], tmp[1]]
}
async function download_index(url, tofile) {
	/* try to download the index file

	must detect following:
	- downloading throws an HTTPError (https://proteinpaint.stjude.org/invalid)
	- downloaded text data but not binary (https://pecan.stjude.cloud/invalid)

	if either is true, should not 
	*/
	try {
		const res = await fetch(url)
		if (res.status != 200) {
			throw 'index file not accessible from url with status code ' + res.status
		}
		await stream2file(res.body, tofile)
	} catch (e) {
		// fetch thrown, must be invalid url
		throw 'cannot download from url'
	}
}
function stream2file(from, file) {
	// TODO any error to catch here
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
		const fileInfo = serverconfig.debugmode ? `file='${file}'` : ''
		if (e.code == 'EACCES') throw `Permission denied ${fileInfo}`
		if (e.code == 'ENOENT') throw `No such file or directory ${fileInfo}`
		if (e.code == 'EPERM') throw `Operation not permitted ${fileInfo}`
		throw `cannot access file (' + e.code + ') ${fileInfo}`
	}
}

// set "isbcf" to true when tk.file points to a bcf file
exports.init_one_vcf = async function(tk, genome, isbcf) {
	let filelocation
	if (tk.file) {
		if (!tk.file.startsWith(serverconfig.tpmasterdir)) {
			tk.file = path.join(serverconfig.tpmasterdir, tk.file)
		}
		filelocation = tk.file
		await exports.validate_tabixfile(tk.file)
	} else if (tk.url) {
		filelocation = tk.url
		tk.dir = await utils.cache_index(tk.url, tk.indexURL)
	} else {
		throw 'no file or url given for vcf file'
	}

	const [info, format, samples, errors] = isbcf
		? await exports.get_header_bcf(filelocation, tk.dir)
		: await exports.get_header_vcf(filelocation, tk.dir)
	if (errors) {
		console.log(errors.join('\n'))
		throw 'got above errors parsing vcf'
	}
	tk.info = info
	tk.format = format
	tk.samples = samples
	if (await exports.tabix_is_nochr(filelocation, tk.dir, genome)) {
		tk.nochr = true
	}
}

/*
file is full path
url not accepted
also works for bcf
*/
exports.validate_tabixfile = async function(file) {
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

exports.tabix_is_nochr = async function(file, dir, genome) {
	// also works for bcf file!
	const lines = []
	await exports.get_lines_bigfile({
		args: ['-l', file],
		dir,
		callback: line => {
			lines.push(line)
		}
	})
	return common.contigNameNoChr(genome, lines)
}

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

exports.get_header_tabix = async (file, dir) => {
	// file is full path file or url
	const lines = []
	await exports.get_lines_bigfile({
		args: ['-H', file],
		dir,
		callback: line => {
			lines.push(line)
		}
	})
	return lines
}
exports.get_header_bcf = (file, dir) => {
	// file is full path or url
	return new Promise((resolve, reject) => {
		const ps = spawn(bcftools, ['view', '-h', file], { cwd: dir })
		const out = []
		ps.stdout.on('data', i => out.push(i))
		ps.on('close', () => {
			resolve(
				vcf.vcfparsemeta(
					out
						.join('')
						.trim()
						.split('\n')
				)
			)
		})
	})
}
exports.get_header_vcf = async (file, dir) => {
	return vcf.vcfparsemeta(await exports.get_header_tabix(file, dir))
}

/*
.isbcf: true
	big file is bcf file and will use the "bcftools" command
.isbam: true
	big file is bam and will use "samtools" command

** if neither isbcf or isbam is true, the file should be bgzip/tabix file and will use "tabix"
** "tabix -l" can also work on bcf files

.args: []
	argument array for spawn, includes file path or url, and coordinate position
	supports arbitrary use of tabix/bcftools/samtools command
	e.g.
	- tabix -l (list chrs for tabix/bcf files)
	- samtools density
	- samtools view -c (counts only)
	- samtools index

.dir: cache dir for custom file, undefined for native file

.callback(line, ps)
	function to process the line
	ps as the second arg so callback may choose to kill the process e.g. too many lines returned
*/
exports.get_lines_bigfile = function({ args, dir, callback, isbcf, isbam }) {
	if (!args) throw 'args is missing'
	if (!Array.isArray(args)) throw 'args[] is not array'
	if (args.length == 0) throw 'args[] empty array'
	if (!callback) throw 'callback is missing'
	if (typeof callback != 'function') throw 'callback() not a function'
	return new Promise((resolve, reject) => {
		const ps = spawn(isbcf ? bcftools : isbam ? samtools : tabix, args, { cwd: dir })
		const rl = readline.createInterface({ input: ps.stdout })
		const em = []
		rl.on('line', line => callback(line, ps))
		ps.stderr.on('data', d => em.push(d))
		ps.on('close', () => {
			const e = em.join('').trim()
			if (e && !tabixnoterror(e)) {
				reject(e)
			}
			resolve()
		})
	})
}

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

exports.get_fasta = async (gn, pos) => {
	// chr:start-stop, positions are 1-based
	const lines = []
	await exports.get_lines_bigfile({
		isbam: true, // so that samtools will be used for querying
		args: ['faidx', gn.genomefile, pos],
		callback: line => lines.push(line)
	})
	return lines.join('\n')
}

/*
inputs:
file=str
	half or full path; if not starting with '/', join with tp dir
override={}
	supplies overrides to default setting
returns:
	db connector
*/
exports.connect_db = function(file, override = {}) {
	return new bettersqlite(
		file[0] == '/' ? file : path.join(serverconfig.tpmasterdir, file),
		Object.assign({ readonly: true, fileMustExist: true }, override)
	)
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
	const text = await read_file(path.join(serverconfig.cachedir_ssid, id))
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
		const sp = spawn('Rscript', [path.join(serverconfig.binpath, 'utils/fdr.R'), infile, outfile])
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

exports.bam_ifnochr = async (file, genome, dir) => {
	const lines = []
	await exports.get_lines_bigfile({
		isbam: true,
		args: ['view', '-H', file],
		dir,
		callback: line => lines.push(line)
	})
	if (lines.length == 0) throw 'cannot list bam header lines'
	const chrlst = []
	for (const line of lines) {
		if (!line.startsWith('@SQ')) continue
		const tmp = line.split('\t')[1]
		if (!tmp) reject('2nd field missing from @SQ line')
		const l = tmp.split(':')
		if (l[0] != 'SN') reject('@SQ line 2nd field is not "SN" but ' + l[0])
		if (!l[1]) reject('@SQ line no value for SN')
		chrlst.push(l[1])
	}
	return common.contigNameNoChr(genome, chrlst)
}

exports.query_bigbed_by_coord = function(bigbed, chr, start, end) {
	// input coordinates need to be 0-based
	// output data is in bed format and output lines are split into an array
	return new Promise((resolve, reject) => {
		const ps = spawn(bigBedToBed, [`-chrom=${chr}`, `-start=${start}`, `-end=${end}`, bigbed, 'stdout'])
		const out = []
		const err = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => err.push(i))
		ps.on('close', code => {
			if (code !== 0) reject(`bigBed query exited with non-zero status and this standard error:\n${err.join('')}`)
			if (err.length > 0) reject(err.join(''))
			const str = out.join('').trim()
			// do not return array of one empty string ['']
			// if str is empty string, return blank array; otherwise split by newline
			resolve(str ? str.split('\n') : [])
		})
	})
}

exports.query_bigbed_by_name = function(bigbed, name) {
	// query bigbed by name field
	// output data is in bed format and output lines are split into an array
	return new Promise((resolve, reject) => {
		const ps = spawn(bigBedNamedItems, [bigbed, name, 'stdout'])
		const out = []
		const err = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => err.push(i))
		ps.on('close', code => {
			if (code !== 0) reject(`bigBed query exited with non-zero status and this standard error:\n${err.join('')}`)
			if (err.length > 0) reject(err.join(''))
			// same as above
			const str = out.join('').trim()
			resolve(str ? str.split('\n') : [])
		})
	})
}

exports.run_rust = function(binfile, input_data) {
	return new Promise((resolve, reject) => {
		const binpath = path.join(serverconfig.binpath, '/utils/rust/target/release/', binfile)
		const ps = spawn(binpath)
		const stdout = []
		const stderr = []
		Readable.from(input_data).pipe(ps.stdin)
		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			console.log('stderr:', stderr)
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			else if (stdout.toString().includes('Cannot read bigWig file') == true) {
				// When bigfile is not found, the promise should be rejected with message given below
				reject(stdout.toString())
			} else {
				//console.log("stdout:",stdout)
				resolve(stdout.join('').toString())
			}
		})
	})
}

function tabixnoterror(s) {
	return s.startsWith('[E::idx_test_and_fetch]') // got this with htslib 1.15.1
}

// get random integer between two values
// both min and max are inclusive
// used for creating test data for test scripts
exports.getRandomInt = function(min, max) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1) + min)
}
