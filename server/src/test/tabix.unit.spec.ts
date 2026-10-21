import tape from 'tape'
import fs from 'fs'
import http from 'http'
import path from 'path'
import zlib from 'zlib'
import type { AddressInfo } from 'net'
import serverconfig from '#src/serverconfig.js'
import { readTabixLines, readTabixHeader, listTabixChrs } from '#src/tabix.ts'
import { urlRequest } from '#src/indexedFile.ts'
import { cache_index, get_header_bcf } from '#src/utils.js'

/*
test sections:

readTabixLines(), readTabixHeader(), listTabixChrs(): a local file
readTabixLines(): the coordinates of a region, as tabix reads them
readTabixLines(): rejected arguments
a bcf file, and get_header_bcf()
a changed file is opened again, and an index older than its file is rejected
the limits of a bcf header, and an error without a server path
a url file
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
// a file with 26 lines on chr17, which start at 7668421 and end at 7675244 or after, as 1-based coordinates
const refGene = path.join(tp, 'anno/refGene.hg38.test.gz')
const itd = path.join(tp, 'files/hg38/TermdbTest/TermdbTest_ITD.gz')
const bcf = path.join(tp, 'files/hg38/TermdbTest/TermdbTest.bcf.gz')

async function read(file: string, regions: any[], dir?: string | null): Promise<string[]> {
	const lines: string[] = []
	await readTabixLines({ file, dir, regions, callback: line => lines.push(line) })
	return lines
}

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

/** a bgzf block of data, which is a gzip member with the BC extra field of its size */
function bgzfBlock(data: Buffer): Buffer {
	const gz = zlib.gzipSync(data)
	const header = Buffer.from([31, 139, 8, 4, 0, 0, 0, 0, 0, 255, 6, 0, 66, 67, 2, 0, 0, 0])
	header.writeUInt16LE(header.length + gz.length - 10 - 1, 16)
	return Buffer.concat([header, gz.subarray(10)])
}

/** the start of a bcf file, with the header text length and the text */
function bcfStart(textLength: number, text = ''): Buffer {
	const b = Buffer.alloc(9)
	b.write('BCF\x02\x02', 'latin1')
	b.writeUInt32LE(textLength, 5)
	return Buffer.concat([b, Buffer.from(text)])
}

/** a temp dir under cachedir, which is a root of a local file */
function tempDir() {
	return fs.mkdtempSync(path.join(cache, 'pp-tabix-'))
}

tape('\n', test => {
	test.comment('-***- tabix specs -***-')
	test.end()
})

tape('readTabixLines(), readTabixHeader(), listTabixChrs(): a local file', async test => {
	const lines = await read(itd, [{ chr: 'chr17', start: 1, stop: 100000000 }])
	test.equal(lines.length, 2, 'should read the lines of a region')
	test.deepEqual(
		await read('files/hg38/TermdbTest/TermdbTest_ITD.gz', [{ chr: 'chr17', start: 1, stop: 100000000 }]),
		lines,
		'should read a relative path under tp'
	)
	test.deepEqual(await listTabixChrs(itd), ['chr17'], 'should list the chromosomes')
	// a caller of a local file may give an empty dir, such as mds.svcnv.js and handle_mdssvcnv_expression.js
	test.deepEqual(
		await read(itd, [{ chr: 'chr17', start: 1, stop: 100000000 }], ''),
		lines,
		'should read the lines of a local file with an empty dir'
	)
	test.deepEqual(await readTabixHeader(itd, ''), await readTabixHeader(itd), 'should read the header with an empty dir')
	test.deepEqual(await listTabixChrs(itd, ''), ['chr17'], 'should list the chromosomes with an empty dir')
	test.ok((await readTabixHeader(itd))[0]?.startsWith('#sample'), 'should read the header lines')
	test.deepEqual(await readTabixHeader(refGene), [], 'should read no header lines of a file without a header')
	test.deepEqual(await listTabixChrs(path.join(tp, 'anno/gencode.v41.hg38.test.gz')), [
		'chr17',
		'chr12',
		'chr22',
		'chr14'
	])

	const first: string[] = []
	await readTabixLines({
		file: refGene,
		regions: [{ chr: 'chr17', start: 0, stop: 0 }],
		callback: (line, stop) => (first.push(line), stop())
	})
	test.equal(first.length, 1, 'should stop reading when the callback calls stop()')
	const stopped: string[] = []
	await readTabixLines({
		file: refGene,
		regions: [
			{ chr: 'chr17', start: 0, stop: 0 },
			{ chr: 'chr17', start: 0, stop: 0 }
		],
		callback: (line, stop) => (stopped.push(line), stopped.length == 3 && stop())
	})
	test.equal(stopped.length, 3, 'should not read the next region after stop()')
	await rejects(
		test,
		() =>
			readTabixLines({
				file: refGene,
				regions: [{ chr: 'chr17', start: 0, stop: 0 }],
				callback: () => {
					throw 'bad line'
				}
			}),
		/^bad line$/,
		'should reject with the error of the callback'
	)
	test.end()
})

tape('readTabixLines(): the coordinates of a region, as tabix reads them', async test => {
	// the counts are from tabix 1.24, with chr:start-stop of each region
	for (const [start, stop, count] of [
		[0, 7668420, 0],
		[0, 7668421, 26],
		[7668420, 7668420, 0],
		[7668421, 7668421, 26],
		[7675244, 7675244, 26],
		[7675245, 7675245, 20],
		// a stop of 0 is the end of the chromosome
		[0, 0, 26],
		[5, 0, 26],
		// a stop before the start has no lines
		[7675245, 7675200, 0],
		// a coordinate before 0 is read as 0, a fractional start is rounded down and a stop up, and a numeric string is read as a number
		[-5, -1, 26],
		[7668421.9, 7668420.1, 26],
		['7668421', '7668421', 26]
	] as const) {
		test.equal(
			(await read(refGene, [{ chr: 'chr17', start, stop }])).length,
			count,
			`should read ${count} lines from chr17:${start}-${stop}`
		)
	}
	test.deepEqual(
		await read(refGene, [{ chr: 'chrNone', start: 0, stop: 0 }]),
		[],
		'should read no lines of another chr'
	)
	const all = await read(refGene, [{ chr: 'chr17', start: 0, stop: 0 }])
	const end = await read(refGene, [{ chr: 'chr17', start: 7675245, stop: 7675245 }])
	test.deepEqual(
		await read(refGene, [
			{ chr: 'chr17', start: 0, stop: 0 },
			{ chr: 'chr17', start: 7675245, stop: 7675245 }
		]),
		[...all, ...end],
		'should read each region in order, and a line again for each region that it overlaps'
	)
	test.end()
})

tape('readTabixLines(): rejected arguments', async test => {
	const region = { chr: 'chr17', start: 1, stop: 2 }
	for (const [label, arg, pattern] of [
		['no region', { regions: [] }, /regions\[\] missing/],
		['too many regions', { regions: Array(1001).fill(region) }, /too many regions/],
		['a coordinate that is not a number', { regions: [{ ...region, start: '1;ls' }] }, /invalid region coordinate/],
		['an infinite coordinate', { regions: [{ ...region, stop: Infinity }] }, /invalid region coordinate/],
		['a chr that is not a string', { regions: [{ ...region, chr: 17 }] }, /invalid region chr/],
		['no callback', { callback: undefined }, /callback\(\) not a function/],
		['a file outside tp and cachedir', { file: '/etc/passwd' }, /invalid file/],
		['a file with a .. segment', { file: 'anno/../../x.gz' }, /invalid file/],
		['a relative file under cachedir', { file: path.relative(tp, path.join(cache, 'x.gz')) }, /invalid file/],
		['a file that does not exist', { file: 'anno/none.gz' }, /cannot open the tabix file/],
		['a file without an index', { file: 'files/hg38/TermdbTest/trackLst/facet.json' }, /cannot find the index/],
		['a dir outside cachedir', { dir: '/tmp' }, /invalid dir/],
		['a relative dir', { dir: 'https/a.org' }, /invalid dir/],
		['a dir with a .. segment', { dir: path.join(cache, 'a/../../x') }, /invalid dir/],
		['a url, which is not allowed by default', { file: 'https://a.org/x.gz' }, /invalid file/]
	] as const) {
		const base = { file: refGene, regions: [region], callback: () => {} }
		await rejects(test, () => readTabixLines({ ...base, ...arg } as any), pattern, `should reject ${label}`)
	}
	test.end()
})

tape('a bcf file, and get_header_bcf()', async test => {
	// as tabix -l and -H of tabix 1.24
	test.deepEqual(
		await listTabixChrs(bcf),
		[...Array.from({ length: 22 }, (_, i) => String(i + 1)), 'X', 'Y', 'MT'],
		'should list the contigs of the header'
	)
	const header = await readTabixHeader(bcf)
	test.equal(header.length, 37, 'should read the header lines')
	test.equal(header[0], '##fileformat=VCFv4.2', 'should read ##fileformat first')
	test.equal(header[1], '##FILTER=<ID=PASS,Description="All filters passed">', 'should read the PASS filter second')
	test.equal(header.filter(l => l.startsWith('##FILTER=<ID=PASS,')).length, 1, 'should read the PASS filter once')
	test.notOk(
		header.some(l => l.includes('IDX=')),
		'should leave out the IDX of each line'
	)
	test.ok(header.at(-1)?.startsWith('#CHROM\tPOS\tID'), 'should read the column header last')
	// get_header_bcf() parses the header as it parsed the output of bcftools view -h
	const [info, format, samples, errors]: any = await get_header_bcf(bcf)
	test.deepEqual(Object.keys(info).sort(), ['CLNSIG', 'CSQ'], 'should parse the INFO fields of a bcf file')
	test.deepEqual(
		Object.keys(format).sort(),
		['dna_assay', 'origin', 'tumor_DNA_WGS'],
		'should parse the FORMAT fields of a bcf file'
	)
	test.deepEqual(
		samples.map(s => s.name),
		header.at(-1)!.split('\t').slice(9),
		'should parse the samples of a bcf file'
	)
	test.equal(samples.length, 7, 'should parse the 7 samples of a bcf file')
	test.notOk(errors, 'should parse the header of a bcf file without errors')
	await rejects(
		test,
		() => read(bcf, [{ chr: '1', start: 0, stop: 0 }]),
		/bcf file is not supported/,
		'should reject the lines of a bcf file, which bcftools reads'
	)
	test.end()
})

tape('a changed file is opened again, and an index older than its file is rejected', async test => {
	const dir = tempDir()
	const file = path.join(dir, 'a.gz')
	try {
		fs.copyFileSync(itd, file)
		fs.copyFileSync(itd + '.tbi', file + '.tbi')
		test.deepEqual(await listTabixChrs(file), ['chr17'], 'should read the file')
		// another file in place of the first, with a later mtime so that it is not the same second
		const later = new Date(Date.now() + 5000)
		fs.copyFileSync(refGene, file)
		fs.copyFileSync(refGene + '.tbi', file + '.tbi')
		fs.utimesSync(file, later, later)
		fs.utimesSync(file + '.tbi', later, later)
		test.equal(
			(await read(file, [{ chr: 'chr17', start: 0, stop: 0 }])).length,
			26,
			'should read the lines of the new file'
		)
		// an index that is older than its file, by the second, as tabix warns about
		const earlier = new Date(later.getTime() - 2000)
		fs.utimesSync(file + '.tbi', earlier, earlier)
		await rejects(
			test,
			() => read(file, [{ chr: 'chr17', start: 0, stop: 0 }]),
			/the index file is older than the data file/,
			'should reject an index that is older than its file'
		)
		// the same second, which tabix does not warn about
		const sameSecond = new Date(Math.floor(later.getTime() / 1000) * 1000)
		fs.utimesSync(file, new Date(sameSecond.getTime() + 900), new Date(sameSecond.getTime() + 900))
		fs.utimesSync(file + '.tbi', sameSecond, sameSecond)
		test.equal(
			(await read(file, [{ chr: 'chr17', start: 0, stop: 0 }])).length,
			26,
			'should read a file with an index of the same second'
		)
		fs.rmSync(file + '.tbi')
		fs.copyFileSync(bcf + '.csi', file + '.csi')
		fs.copyFileSync(bcf, file)
		fs.utimesSync(file, later, later)
		fs.utimesSync(file + '.csi', later, later)
		test.equal((await listTabixChrs(file)).length, 25, 'should use a .csi index when there is no .tbi')
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('the limits of a bcf header, and an error without a server path', async test => {
	const dir = tempDir()
	// a bcf file, which a csi index without the tabix header is of
	const writeBcf = (name: string, data: Buffer) => {
		const file = path.join(dir, name)
		fs.writeFileSync(file, data)
		fs.copyFileSync(bcf + '.csi', file + '.csi')
		return file
	}
	try {
		const text = '##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n\0'
		test.equal(
			(await readTabixHeader(writeBcf('ok.bcf.gz', bgzfBlock(bcfStart(text.length, text)))))[2],
			'#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
			'should read the header of a bcf file that is made here'
		)
		await rejects(
			test,
			() => readTabixHeader(writeBcf('long.bcf.gz', bgzfBlock(bcfStart(17 * 2 ** 20)))),
			/bcf header is too long/,
			'should reject a bcf header that is longer than the limit'
		)
		// a header in one block that inflates to more than a bgzf block can hold
		const big = '##x=' + 'a'.repeat(100000) + '\n' + text
		await rejects(
			test,
			() => readTabixHeader(writeBcf('big.bcf.gz', bgzfBlock(bcfStart(big.length, big)))),
			/larger than|maxOutputLength|buffer/i,
			'should reject a bgzf block that inflates to more than 64KB'
		)
		// a file that the server cannot open, of which the error names the file
		if (process.getuid?.() !== 0) {
			const file = path.join(dir, 'locked.gz')
			fs.copyFileSync(refGene, file)
			fs.copyFileSync(refGene + '.tbi', file + '.tbi')
			fs.chmodSync(file, 0)
			try {
				await read(file, [{ chr: 'chr17', start: 0, stop: 0 }])
				test.fail('should reject a file that cannot be opened')
			} catch (e) {
				test.match(String(e), /EACCES.*locked\.gz/, 'should reject with the error and the file name')
				test.notOk(String(e).includes(dir), 'should not have the server path of the file in the error')
			}
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

/*
A local http server, which serves the files under tp/anno and tp/files with range requests, and redirects:
/redirect/x to /x, and /away/x to a host that is not allowed. /stall/x sends the first bytes of x and then nothing.
*/
let server: http.Server
let host = ''
const requests: string[] = []

async function startServer() {
	server = http.createServer((req, res) => {
		const url = new URL(req.url!, 'http://x')
		requests.push(url.pathname)
		if (url.pathname.startsWith('/redirect/')) {
			res.writeHead(302, { location: url.pathname.slice('/redirect'.length) })
			return res.end()
		}
		if (url.pathname.startsWith('/away/')) {
			res.writeHead(302, { location: `http://localhost:${(server.address() as AddressInfo).port}/anno/x` })
			return res.end()
		}
		if (url.pathname.startsWith('/stall/')) {
			res.writeHead(206, { 'content-length': 2 ** 20 })
			return res.write(Buffer.alloc(10))
		}
		const file = path.join(tp, decodeURIComponent(url.pathname))
		if (!file.startsWith(tp + path.sep) || !fs.existsSync(file)) {
			res.writeHead(404)
			return res.end()
		}
		const data = fs.readFileSync(file)
		const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')
		if (!m) {
			res.writeHead(200, { 'content-length': data.length })
			return res.end(data)
		}
		const start = Number(m[1])
		const end = Math.min(m[2] ? Number(m[2]) : data.length - 1, data.length - 1)
		res.writeHead(206, {
			'content-range': `bytes ${start}-${end}/${data.length}`,
			'content-length': end - start + 1
		})
		res.end(data.subarray(start, end + 1))
	})
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	host = `127.0.0.1:${(server.address() as AddressInfo).port}`
}

tape('a url file', async test => {
	await startServer()
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	const urlHosts = serverconfig.urlHosts
	features.ALLOW_remotefilefromurl = true
	// the local server is a loopback address, which is not allowed unless listed
	serverconfig.urlHosts = ['127.0.0.1']
	const dirs: string[] = []
	try {
		const url = `http://${host}/anno/refGene.hg38.test.gz`
		const dir = await cache_index(url, undefined)
		dirs.push(dir)
		const region = [{ chr: 'chr17', start: 0, stop: 0 }]
		const local = await read(refGene, region)
		test.deepEqual(await read(url, region, dir), local, 'should read the lines of a url file')
		test.ok(fs.existsSync(path.join(dir, 'refGene.hg38.test.gz.tbi')), 'should download the index into the cache dir')
		requests.length = 0
		test.deepEqual(await read(url, region, dir), local, 'should read the lines again')
		test.notOk(requests.includes('/anno/refGene.hg38.test.gz.tbi'), 'should not download the index again')
		test.deepEqual(
			await readTabixHeader(`http://${host}/files/hg38/TermdbTest/TermdbTest_ITD.gz`),
			await readTabixHeader(itd),
			'should read the header of a url file without a cache dir'
		)
		dirs.push(await cache_index(`http://${host}/files/hg38/TermdbTest/TermdbTest_ITD.gz`, undefined))
		test.deepEqual(
			await listTabixChrs(`http://${host}/files/hg38/TermdbTest/TermdbTest.bcf.gz`),
			await listTabixChrs(bcf),
			'should list the chromosomes of a url bcf file, with its .csi index'
		)
		dirs.push(await cache_index(`http://${host}/files/hg38/TermdbTest/TermdbTest.bcf.gz`, undefined))

		const redirected = `http://${host}/redirect/anno/refGene.hg38.test.gz`
		dirs.push(await cache_index(redirected, undefined))
		test.deepEqual(await read(redirected, region), local, 'should follow a redirect to an allowed host')
		const away = `http://${host}/away/anno/refGene.hg38.test.gz`
		await rejects(
			test,
			() => read(away, region),
			/cannot download the index|url host is not allowed/,
			'should not follow a redirect to a host that is not allowed'
		)
		const awayDir = await cache_index(away, undefined)
		dirs.push(awayDir)
		// with the index in the cache dir, the redirect is of a read of the url file
		fs.copyFileSync(refGene + '.tbi', path.join(awayDir, 'refGene.hg38.test.gz.tbi'))
		await rejects(
			test,
			() => read(away, region, awayDir),
			/url redirect error: url host is not allowed/,
			'should not follow a redirect of a read to a host that is not allowed'
		)
		await rejects(
			test,
			() => read(`http://${host}/anno/none.gz`, region),
			/cannot download the index/,
			'should reject a url without an index'
		)
		dirs.push(await cache_index(`http://${host}/anno/none.gz`, undefined))
		await rejects(test, () => read('ftp://a.org/x.gz', region), /ftp url is not supported/, 'should reject an ftp url')
		await rejects(
			test,
			() => read('http://169.254.169.254/x.gz', region),
			/invalid file/,
			'should reject a host that is not allowed'
		)
		await rejects(test, () => read('file:///etc/x.gz', region), /invalid file/, 'should reject a file url')

		// a url that stops sending, with the index in the cache dir so that the read of the url file is what stalls
		const stall = `http://${host}/stall/anno/refGene.hg38.test.gz`
		const stallDir = await cache_index(stall, undefined)
		dirs.push(stallDir)
		fs.copyFileSync(refGene + '.tbi', path.join(stallDir, 'refGene.hg38.test.gz.tbi'))
		const timeoutMs = urlRequest.timeoutMs
		urlRequest.timeoutMs = 300
		const t = Date.now()
		try {
			await rejects(
				test,
				() => read(stall, region, stallDir),
				/timeout|abort/i,
				'should reject a url that stops sending'
			)
		} finally {
			urlRequest.timeoutMs = timeoutMs
		}
		test.ok(Date.now() - t < 5000, 'should reject it by the time limit of a request')
	} finally {
		if (allow === undefined) delete features.ALLOW_remotefilefromurl
		else features.ALLOW_remotefilefromurl = allow
		if (urlHosts === undefined) delete serverconfig.urlHosts
		else serverconfig.urlHosts = urlHosts
		for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
		server.closeAllConnections()
		server.close()
	}
	test.end()
})
