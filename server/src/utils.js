import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import readline from 'readline'
import * as common from '#shared/common.js'
import * as vcf from '#shared/vcf.js'
import fetch from 'node-fetch'
import bettersqlite from 'better-sqlite3'
import serverconfig from './serverconfig.js'
import { Readable } from 'stream'
import { minimatch } from 'minimatch'
export * from './cachedFetch.js'

const { tabix, samtools, bcftools, bigBedToBed, bigBedNamedItems, bigBedInfo } = serverconfig

/*********************** EXPORTED
cache_index
file_is_readable
init_one_vcf
init_one_vcfMaf
validate_tabixfile
validate_txtfile
tabix_is_nochr
write_file
write_tmpfile
read_file
file_not_exist
file_not_readable
get_lines_bigfile
get_lines_txtfile
query_bigbed_by_coord
query_bigbed_by_name
get_header_tabix
get_header_vcf
get_header_bcf
get_header_txt
get_fasta
connect_db
loadfile_ssid
bam_ifnochr
testIfFileIsBigbed
validateRglst
********************** INTERNAL
*/

/*
-- for tabix files, if no indexURL is given, allow using either tbi or csi file at the same location

   await cache_index(gz_url, indexURL) // indexURL can be undefined

-- for bam, always use

   await cache_index(bam_url, indexURL || bam_url+'.bai')

*/
export async function cache_index(gzurl, indexurl) {
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

export function fileurl(req, checkWhiteList = true) {
	// must use it to scrutinize every requested file path
	let file = null,
		isurl = false
	if (req.query.file) {
		file = req.query.file
		if (illegalpath(file, checkWhiteList, false)) return ['illegal file path']
		file = path.join(serverconfig.tpmasterdir, file)
	} else if (req.query.url) {
		file = req.query.url
		// avoid whitespace in case the url is supplied as an argument
		// to an exec script and thus execute arbitrary space-separated
		// commands within the url
		if (file.includes(' ')) return ['url must not contain whitespace']
		if (file.includes('"') || file.includes("'")) return ['url must not contain single or double quotes']
		isurl = true
	}
	if (!file) return ['file unspecified']
	return [null, file, isurl]
}

const fileExtensionBlackList = Object.freeze(['.bam', '.bai', '.gz', '.tbi', '.csi', '.bw', '.bb'])

export function illegalpath(s, checkWhiteList = false, checkBlackList = true) {
	if (s[0] == '/') return true // must not be relative to mount root
	if (s.includes('"') || s.includes("'")) return true // must not include quotes, apostrophe
	if (s.includes('|') || s.includes('&')) return true // must not include operator characters
	if (s.includes(' ')) return true // must not include whitespace
	if (s.indexOf('..') != -1) return true
	if (s.match(/(\<script|script\>)/i)) return true // avoid the potential for parsing injected code in client side error message
	if (checkWhiteList && serverconfig.whiteListPaths) {
		// as /textfile route is dangerous, this server whitelists path pattern for it.
		// only if the req.query.file begins with or glob-matches any of the path pattern then it's allowed
		let nomatch = true
		for (const p of serverconfig.whiteListPaths) {
			if (s.startsWith(p) || (p[0] != '!' && minimatch(s, p))) {
				nomatch = false
				break
			}
			if (p[0] == '!' && !minimatch(s, p)) {
				nomatch = true
				break
			}
		}
		if (nomatch) return true
	}
	/*** disable for now ***/
	if (checkBlackList) {
		for (const ext of fileExtensionBlackList) {
			if (ext === path.extname(s).toLowerCase()) return true
		}
	}

	return false
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

export async function file_is_readable(file) {
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
export async function init_one_vcf(tk, genome, isbcf) {
	let filelocation
	if (tk.file) {
		if (!tk.file.startsWith(serverconfig.tpmasterdir)) {
			tk.file = path.join(serverconfig.tpmasterdir, tk.file)
		}
		filelocation = tk.file
		await validate_tabixfile(tk.file)
	} else if (tk.url) {
		filelocation = tk.url
		tk.dir = await cache_index(tk.url, tk.indexURL)
	} else {
		throw 'no file or url given for vcf file'
	}

	const [info, format, samples, errors] = isbcf
		? await get_header_bcf(filelocation, tk.dir)
		: await get_header_vcf(filelocation, tk.dir)
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

/*
 set "isbcf" to true when tk.file points to a bcf file and tk.maffile points to a maf file
   samples and format information will be obtained from the header of maf file
   obtain the index for sample column and each format field from maf file
     ._tk = {}
            .info{}
            .samples[]
            .format{}
            .sampleIdx: int
            .formatIdx: Map
*/
export async function init_one_vcfMaf(tk, genome, isbcf) {
	let filelocation, maffilelocation, sampleIdx
	let formatIdx = new Map()
	if (tk.file) {
		if (!tk.file.startsWith(serverconfig.tpmasterdir)) {
			tk.file = path.join(serverconfig.tpmasterdir, tk.file)
		}
		filelocation = tk.file
		await validate_tabixfile(tk.file)
	} else {
		throw 'no file given for vcf file'
	}
	if (!tk.maffile) throw 'no file given for maf file'
	if (!tk.maffile.startsWith(serverconfig.tpmasterdir)) {
		tk.maffile = path.join(serverconfig.tpmasterdir, tk.maffile)
	}
	maffilelocation = tk.maffile
	await validate_tabixfile(tk.maffile)
	const [info, format, samples, errors] = isbcf
		? await get_header_bcf(filelocation, tk.dir)
		: await get_header_vcf(filelocation, tk.dir)
	if (errors) {
		console.log(errors.join('\n'))
		throw 'got above errors parsing vcf'
	}
	tk.info = info
	const [info_maf, format_maf, samples_maf, errors_maf] = await get_header_vcf(maffilelocation, tk.dir)
	if (errors_maf) {
		console.log(errors_maf.join('\n'))
		throw 'got above errors parsing vcf maf file'
	}
	tk.format = format_maf
	tk.samples = samples_maf
	if (await tabix_is_nochr(filelocation, tk.dir, genome)) {
		tk.nochr = true
	}
	// obtain the index of samples and format field
	const idxArgs = ['-H', maffilelocation]
	await get_lines_bigfile({
		args: idxArgs,
		dir: tk.dir,
		callback: line => {
			if (line.startsWith('#chr')) {
				const l = line.split('\t')
				for (const [i, colName] of l.entries()) {
					// hardcoded sample column name as 'sample'
					if (colName == 'sample') {
						sampleIdx = i
					} else if (tk.format.hasOwnProperty(colName)) {
						formatIdx.set(colName, i)
					}
				}
			}
		}
	})
	if (!sampleIdx) throw 'sample column missing from maf file'
	tk.sampleIdx = sampleIdx
	tk.formatIdx = formatIdx
}

/*
file is full path
url not accepted
also works for bcf
*/
export async function validate_tabixfile(file) {
	if (!file.endsWith('.gz')) throw 'tabix file not ending with .gz'
	if (await file_not_exist(file)) throw file + ' file not exist'
	if (await file_not_readable(file)) throw '.gz file not readable'

	const tbi = file + '.tbi'
	if (await file_not_exist(tbi)) {
		// tbi not found, try csi
		const csi = file + '.csi'
		if (await file_not_exist(csi)) throw 'neither .tbi .csi index file exist for ' + file
		if (await file_not_readable(csi)) throw '.csi index file not readable'
	} else {
		// tbi exists
		if (await file_not_readable(tbi)) throw '.tbi index file not readable'
	}

	// test to list chrs on the file, to detect the "index file is older than .gz file" issue early, and abort server launch
	try {
		await get_lines_bigfile({
			args: ['-l', file],
			callback: () => {}
		})
	} catch (e) {
		throw e
	}
}

export async function validate_txtfile(file) {
	if (await file_not_exist(file)) throw file + ' file not exist'
	if (await file_not_readable(file)) throw file + ' file not readable'
}

export async function tabix_is_nochr(file, dir, genome) {
	// also works for bcf file!
	const lines = []
	await get_lines_bigfile({
		args: ['-l', file],
		dir,
		callback: line => {
			lines.push(line)
		}
	})
	return common.contigNameNoChr(genome, lines)
}

export function file_not_exist(file) {
	return new Promise((resolve, reject) => {
		fs.access(file, fs.constants.F_OK, err => {
			if (err) resolve(true)
			resolve(false)
		})
	})
}

export function file_not_readable(file) {
	return new Promise((resolve, reject) => {
		fs.access(file, fs.constants.R_OK, err => {
			if (err) resolve(true)
			resolve(false)
		})
	})
}

export async function get_header_tabix(file, dir) {
	// file is full path file or url
	const lines = []
	await get_lines_bigfile({
		args: ['-H', file],
		dir,
		callback: line => {
			lines.push(line)
		}
	})
	return lines
}

// file is full path file; return one string of header line, trimmed
export async function get_header_txt(file, dir) {
	return new Promise((resolve, reject) => {
		const ps = spawn('head', ['-1', file], { cwd: dir })
		const out = []
		ps.stdout.on('data', i => out.push(i))
		ps.on('close', () => {
			resolve(out.join('').trim())
		})
	})
}
export function get_header_bcf(file, dir) {
	// file is full path or url
	return new Promise((resolve, reject) => {
		const ps = spawn(bcftools, ['view', '-h', file], { cwd: dir })
		const out = []
		ps.stdout.on('data', i => out.push(i))
		ps.on('close', () => {
			resolve(vcf.vcfparsemeta(out.join('').trim().split('\n')))
		})
	})
}
export async function get_header_vcf(file, dir) {
	return vcf.vcfparsemeta(await get_header_tabix(file, dir))
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
export function get_lines_bigfile({ args, callback, dir = null, isbcf = false, isbam = false }) {
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

export function get_lines_txtfile({ args, dir, callback }) {
	if (!args) throw 'args is missing'
	if (!Array.isArray(args)) throw 'args[] is not array'
	if (args.length == 0) throw 'args[] empty array'
	if (!callback) throw 'callback is missing'
	if (typeof callback != 'function') throw 'callback() not a function'
	return new Promise((resolve, reject) => {
		const ps = spawn('cat', args, { cwd: dir })
		const rl = readline.createInterface({ input: ps.stdout })
		const em = []
		rl.on('line', line => callback(line, ps))
		ps.stderr.on('data', d => em.push(d))
		ps.on('close', () => {
			const e = em.join('').trim()
			if (e) {
				reject(e)
			}
			resolve()
		})
	})
}

export function write_file(file, text) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, text, err => {
			if (err) reject('cannot write')
			resolve()
		})
	})
}

export async function write_tmpfile(text) {
	const tmp = Math.random().toString()
	await write_file(path.join(serverconfig.cachedir, tmp), text)
	return tmp
}

export function read_file(file) {
	return new Promise((resolve, reject) => {
		fs.readFile(file, { encoding: 'utf8' }, (err, txt) => {
			// must use reject in callback, not throw
			if (err) reject('cannot read file: ' + file)
			resolve(txt)
		})
	})
}

export async function get_fasta(gn, pos) {
	if (gn.genomefile == 'NA') {
		// not using a real fasta file, return Ns by the length of region
		const tmp = pos.split(/[:-]/)
		const fakent = []
		for (let i = Number(tmp[1]); i <= Number(tmp[2]); i++) fakent.push('N')
		return `>${pos}\n${fakent.join('')}` // must include fasta header line
	}

	// chr:start-stop, positions are 1-based
	const lines = []
	await get_lines_bigfile({
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
export function connect_db(file, override = {}) {
	const dbfile = file[0] == '/' ? file : path.join(serverconfig.tpmasterdir, file)
	try {
		return new bettersqlite(dbfile, Object.assign({ readonly: true, fileMustExist: true }, override))
	} catch (e) {
		throw `error connecting to ${dbfile}: ${e}`
	}
}

export const genotype_type_set = new Set(['Homozygous reference', 'Homozygous alternative', 'Heterozygous'])
export const genotype_types = {
	href: 'Homozygous reference',
	halt: 'Homozygous alternative',
	het: 'Heterozygous'
}

export const cachedir_ssid = serverconfig.cachedir_ssid || path.join(serverconfig.cachedir, 'ssid')
if (!fs.existsSync(cachedir_ssid)) fs.mkdirSync(cachedir_ssid)

export async function loadfile_ssid(id, samplefilterset) {
	/*
samplefilterset:
	optional Set of samples to restrict to
*/
	const text = await read_file(path.join(cachedir_ssid, id))
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

export async function run_fdr(plst) {
	// list of pvalues
	const infile = path.join(serverconfig.cachedir, Math.random().toString())
	const outfile = infile + '.out'
	await write_file(infile, plst.join('\t'))
	await run_fdr_2(infile, outfile)
	const text = await read_file(outfile)
	fs.unlink(infile, () => {})
	fs.unlink(outfile, () => {})
	return text.trim().split('\n').map(Number)
}

function run_fdr_2(infile, outfile) {
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', [path.join(serverconfig.binpath, 'utils/fdr.R'), infile, outfile])
		sp.on('close', () => resolve())
		sp.on('error', () => reject(e))
	})
}

export function stripJsScript(text) {
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

// fileIsTruncated=true when the bam file is truncated, e.g. from gdc slicing
export async function bam_ifnochr(file, genome, dir, fileIsTruncated) {
	const lines = []

	try {
		await get_lines_bigfile({
			isbam: true,
			args: ['view', '-H', file],
			dir,
			callback: line => lines.push(line)
		})
	} catch (e) {
		/*
		if fileIsTruncated=true, samtools view -H will print one line to stderr while continue to output all header lines
		in such case must ignore the err, for truncated gdc slice to work
		*/
		if (fileIsTruncated && e.endsWith(SAMTOOLS_ERR_MSG.view)) {
			// expected. ignore this err and continue to parse header lines
		} else {
			// unexpected err
			throw e
		}
	}

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

export function query_bigbed_by_coord(bigbed, chr, start, end) {
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

export function query_bigbed_by_name(bigbed, name) {
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

export function tabixnoterror(s) {
	return s.startsWith('[E::idx_test_and_fetch]') // got this with htslib 1.15.1
}

// get random integer between two values
// both min and max are inclusive
// used for creating test data for test scripts
export function getRandomInt(min, max) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1) + min)
}

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/*
input: full file path
output:
	boolean
	TODO change to resolve({isbb:boolean, message:str, index:...})
*/
export async function testIfFileIsBigbed(file) {
	return new Promise((resolve, reject) => {
		const ps = spawn(bigBedInfo, [file])
		const out = []
		const err = []
		ps.stdout.on('data', i => out.push(i))
		ps.stderr.on('data', i => err.push(i))
		ps.on('close', code => {
			const e = err.join('')
			if (e) {
				// two types of known error
				// do not print file name in the error message to guard against attack string
				if (e.includes('is not a big bed file')) {
					//reject('File is not a bigBed file')
					resolve(false)
				} else if (e.includes("Couldn't open")) {
					//reject('Invalid file')
					resolve(false)
				} else {
					//reject('Error detecting if file is bigbed')
					resolve(false)
				}
			}
			// no error from stderr. if there are text in stdout, then file should be bb
			const text = out.join('').trim()
			if (text.startsWith('version')) resolve(true)
			// TODO also test extraIndexCount. return object but not true/false
		})
		ps.on('error', e => {
			if (e.code === 'ENOENT') throw `cannot find bigBedInfo binary='${bigBedInfo}'`
			// reject('Error detecting if file is bigbed')
			console.log('\n--- testIfFileIsBigbed() error ---\n', e, '\n')
			resolve(false)
		})
	})
}

/* 
q is req.query
	q.rglst=stringified json
		will update q.rglst in-place to maintain existing usage pattern
	or
	q.rglst=properly formed array
genome is used for validating chr names. when routes are fixed, genome should become required param for best chr name validation

throws on any err. makes no return. may update q
*/
export function validateRglst(q, genome) {
	if (typeof q.rglst == 'string') {
		try {
			q.rglst = JSON.parse(q.rglst)
		} catch (e) {
			throw 'invalid JSON in q.rglst="[]"'
		}
	}
	if (!Array.isArray(q.rglst)) throw 'q.rglst[] not array'
	if (q.rglst.length == 0) throw 'q.rglst[] blank array'
	for (const r of q.rglst) {
		if (typeof r != 'object') throw 'element of q.rglst[] not object'
		if (typeof r.chr != 'string') throw 'q.rglst[].chr not string'
		let c // allow case when not able to supply genome for the moment
		if (genome) {
			c = genome.chrlookup[r.chr.toUpperCase()]
			if (!c) throw 'q.rglst[].chr invalid chr name'
		}
		if (!Number.isFinite(r.start)) throw 'q.rglst[].start not number' // client may assign decimal number and tabix allows it
		if (r.start < 0) throw 'q.rglst[].start<0'
		if (c && r.start > c.len) throw 'q.rglst[].start out of bound'
		if (!Number.isFinite(r.stop)) throw 'q.rglst[].stop not number'
		if (r.stop < 0) throw 'q.rglst[].stop<0'
		if (c && r.stop > c.len) throw 'q.rglst[].stop out of bound'
		if (r.stop <= r.start) throw 'q.rglst[].stop < start'
	}
}

export function mayCopyFromCookie(q, cookies) {
	if (cookies.sessionid) {
		if ('sessionid' in q) throw 'q.sessionid already exists so cannot copy from cookies.sessionid'
		// sessionid is available after user logs into gdc portal
		q.sessionid = cookies.sessionid
	}
}

export function boxplot_getvalue(lst, removeOutliers = false) {
	/* ascending order
    each element: {value}
    */
	const l = lst.length
	if (l < 5) {
		// less than 5 items, won't make boxplot
		return { out: lst }
	}
	const p50 = lst[Math.floor(l / 2)].value
	const p25 = lst[Math.floor(l / 4)].value
	const p75 = lst[Math.floor((l * 3) / 4)].value
	const p05 = lst[Math.floor(l * 0.05)].value
	const p95 = lst[Math.floor(l * 0.95)].value
	// const p01 = lst[Math.floor(l * 0.01)].value
	const iqr = p75 - p25

	let w1, w2
	if (iqr == 0) {
		w1 = p25
		w2 = p25
	} else {
		const i = lst.findIndex(i => i.value > p25 - iqr * 1.5)
		w1 = lst[i == -1 ? 0 : i].value
		const j = lst.findIndex(i => i.value > p75 + iqr * 1.5)
		w2 = lst[j == -1 ? l - 1 : j - 1].value
	}
	let out = []
	if (!removeOutliers) out = lst.filter(i => i.value < p25 - iqr * 1.5 || i.value > p75 + iqr * 1.5)
	return { w1, w2, p05, p25, p50, p75, p95, iqr, out }
}

const RecoverableErrorCodes = new Set([
	'ECONNRESET',
	//'ECONNREFUSED', // retry will continue to be refused, so not recoverable?
	'ENOTFOUND',
	'ENETDOWN',
	'ENETUNREACH',
	'EHOSTDOWN',
	'EHOSTUNREACH'
	//'EPIPE',
	//'UND_ERR_SOCKET'
])

// see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#server_error_responses
const RecoverableHTTPcodes = new Set([500, 502, 503, 504])

// for convenience, combine custom pp status strings with http status number codes
export const nonFatalStatus = new Set(['done', 'nonblocking', 'recoverableError', ...RecoverableHTTPcodes])

// only use this helper when catching errors that may be due to
// external API server errors or network connection failures;
// the `e` argument is expected to have a network-related error code, some of which
// may be recovered from (temp maintenance or disconnect), others are fatal
export function isRecoverableError(e) {
	// detect if status maps to a known HTTP 5xx server error code
	if (typeof e.status == 'number') return RecoverableHTTPcodes.has(e.status)
	if (e.status == 'recoverableError') return true

	const code = e.code || e.error?.code || e.cause?.code || ''
	// assume that not found is not due to using the wrong hostname,
	// typically a public API like GDC will use error status code 4xx (client-side error)
	// where retries with the same payload/headers will always fail and is not
	// recoverable.
	//
	// code=ENOTFOUND, ETIMEDOUT, etc below are from undici when network is down,
	// it's not an HTTP response status code from an API
	if (e.cause?.errors) console.log(e.cause.code, e.cause.errors)
	return RecoverableErrorCodes.has(code)
}

//////////////////////////////
//         fragile!!        //
//////////////////////////////
// these error messages are printed by samtools 1.19.2 and are required for detecting and using truncated gdc bams.
// if in a new version they change such messages on a whim, our gdc bam tk features will break!!
export const SAMTOOLS_ERR_MSG = {
	// from "samtools view"
	view: 'EOF marker is absent. The input is probably truncated',
	// from "samtools quickcheck"
	quickcheck: 'was missing EOF block when one should be present.'
}
