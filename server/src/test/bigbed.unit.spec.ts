import tape from 'tape'
import fs from 'fs'
import http from 'http'
import path from 'path'
import type { AddressInfo } from 'net'
import serverconfig from '#src/serverconfig.js'
import { readBigbedLines, readBigbedByteSize, readBigbedByName, isBigbedFile } from '#src/bigbed.ts'

/*
test sections:

readBigbedLines(): the items of a range, as bigBedToBed prints them
readBigbedByName(): the items of a name, as bigBedNamedItems prints them
readBigbedByteSize(): the compressed bytes of a read
isBigbedFile()
rejected arguments
a changed file is opened again
a url file

files/hg38/bigbed/test.bb is made from test.bed with bedToBigBed -type=bed6 -extraIndex=name, and bed3.bb from
bed3.bed with bedToBigBed -type=bed3, both with test.chrom.sizes. The expected lines below are what bigBedToBed and
bigBedNamedItems print for these files.
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
const dir = 'files/hg38/bigbed'
const bb = path.join(tp, dir, 'test.bb')
const bed3 = path.join(tp, dir, 'bed3.bb')
const bw = 'files/hg38/TermdbTest/trackLst/bw1.bw'
const chr1 = [
	'chr1\t10\t20\ta\t0\t+',
	'chr1\t15\t15\tins1\t0\t+',
	'chr1\t30\t40\tb\t0\t-',
	'chr1\t50\t60\tdup\t0\t+',
	'chr1\t100\t100\tins2\t0\t+',
	'chr1\t200\t300\tdup\t0\t-'
]

let server: http.Server, host: string
const requests: string[] = []

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

tape('\n', test => {
	test.comment('-***- bigbed specs -***-')
	test.end()
})

tape('readBigbedLines(): the items of a range, as bigBedToBed prints them', async test => {
	test.deepEqual(await readBigbedLines(bb, 'chr1', 0, 1000), chr1, 'should read every item of a chromosome')
	test.deepEqual(
		await readBigbedLines(bb, 'chr1', 15, 15),
		[chr1[0], chr1[1]],
		'should read an item that contains an empty range, and an item without a base at it'
	)
	test.deepEqual(await readBigbedLines(bb, 'chr1', 20, 30), [], 'should not read an item that ends at the start')
	test.deepEqual(
		await readBigbedLines(bb, 'chr1', 100, 150),
		[chr1[4]],
		'should read an item without a base at the start of the range'
	)
	test.deepEqual(
		await readBigbedLines(bb, 'chr1', 90, 100),
		[chr1[4]],
		'should read an item without a base at the end of the range'
	)
	test.deepEqual(await readBigbedLines(bb, 'chr1', 40, 0), chr1.slice(3), 'should read to the chromosome end for end=0')
	test.deepEqual(await readBigbedLines(bb, 'chr3', 0, 300), [], 'should read no item of a chromosome without items')
	test.deepEqual(await readBigbedLines(bb, 'chrX', 0, 10), [], 'should read no item of a chromosome not in the file')
	test.deepEqual(await readBigbedLines(bb, 'chrX', 5, 0), [], 'should read no item for end=0 of such a chromosome')
	test.deepEqual(await readBigbedLines(bed3, 'chr1', 0, 1000), ['chr1\t1\t5'], 'should read a bed3 line')
	test.end()
})

tape('readBigbedByName(): the items of a name, as bigBedNamedItems prints them', async test => {
	test.deepEqual(
		await readBigbedByName(bb, 'dup'),
		[chr1[3], chr1[5], 'chr2\t5\t10\tdup\t0\t+'],
		'should read every item of a name, on any chromosome'
	)
	test.deepEqual(await readBigbedByName(bb, 'ins1'), [chr1[1]], 'should read an item without a base')
	test.deepEqual(await readBigbedByName(bb, 'du'), [], 'should not read an item of a name that the name starts')
	test.deepEqual(await readBigbedByName(bb, 'none'), [], 'should read no item of a name that is not in the file')
	await rejects(
		test,
		() => readBigbedByName(bed3, 'a'),
		/no index of the name field/,
		'should reject a file without an index of the name field'
	)
	test.end()
})

tape('readBigbedByteSize(): the compressed bytes of a read', async test => {
	test.ok((await readBigbedByteSize(bb, 'chr1', 0, 1000)) > 0, 'should size the data of a range with items')
	test.ok((await readBigbedByteSize(bb, 'chr1', 40, 0)) > 0, 'should size the data to the chromosome end for end=0')
	test.equal(await readBigbedByteSize(bb, 'chrX', 0, 10), 0, 'should size no data for a chromosome not in the file')
	test.equal(await readBigbedByteSize(bb, 'chrX', 5, 0), 0, 'should size no data for end=0 of such a chromosome')
	await rejects(test, () => readBigbedByteSize(bb, '-o', 0, 1), /invalid chr/, 'should reject an invalid chr')
	await rejects(test, () => readBigbedByteSize(bb, 'chr1', -1, 1), /invalid start or end/, 'should reject a bad start')
	test.end()
})

tape('isBigbedFile()', async test => {
	test.equal(await isBigbedFile(bb), true, 'should detect a bigBed file')
	test.equal(await isBigbedFile(path.join(dir, 'bed3.bb')), true, 'should detect a bigBed file by a path under tp')
	test.equal(await isBigbedFile(path.join(tp, 'anno/refGene.hg38.test.gz')), false, 'should not detect a tabix file')
	test.equal(await isBigbedFile(path.join(tp, bw)), false, 'should not detect a bigWig file')
	test.equal(await isBigbedFile(path.join(tp, dir, 'test.bed')), false, 'should not detect a text file')
	test.equal(await isBigbedFile(path.join(tp, dir, 'none.bb')), false, 'should not detect a missing file')
	test.equal(await isBigbedFile('/etc/hosts'), false, 'should not detect a file outside tp and cachedir')
	test.end()
})

tape('rejected arguments', async test => {
	const cases: [string, () => Promise<unknown>, RegExp][] = [
		['a chr that is an option', () => readBigbedLines(bb, '-o', 0, 1), /invalid chr/],
		['a chr with a space', () => readBigbedLines(bb, 'chr1 ', 0, 1), /invalid chr/],
		['a start that is a string', () => readBigbedLines(bb, 'chr1', '0' as any, 1), /invalid start or end/],
		['a negative start', () => readBigbedLines(bb, 'chr1', -1, 1), /invalid start or end/],
		['a fractional end', () => readBigbedLines(bb, 'chr1', 0, 1.5), /invalid start or end/],
		['a name with shell syntax', () => readBigbedByName(bb, 'rs1;ls'), /invalid name/],
		['an empty name', () => readBigbedByName(bb, ''), /invalid name/],
		['a file outside tp and cachedir', () => readBigbedLines('/etc/hosts', 'chr1', 0, 1), /invalid file/],
		['a path that leaves tp', () => readBigbedByName(`${dir}/../../../../x.bb`, 'a'), /invalid file/],
		['a missing file', () => readBigbedLines(path.join(tp, dir, 'none.bb'), 'chr1', 0, 1), /cannot open/],
		['a text file', () => readBigbedLines(path.join(tp, dir, 'test.bed'), 'chr1', 0, 1), /not a BigWig\/BigBed file/],
		['a bigWig file', () => readBigbedLines(path.join(tp, bw), 'chr17', 0, 1), /not a bigBed file/]
	]
	for (const [label, fn, pattern] of cases) await rejects(test, fn, pattern, `should reject ${label}`)
	test.end()
})

tape('a changed file is opened again', async test => {
	const tmp = fs.mkdtempSync(path.join(cache, 'pp-bigbed-'))
	const file = path.join(tmp, 'a.bb')
	try {
		fs.copyFileSync(bb, file)
		test.deepEqual(await readBigbedLines(file, 'chr1', 0, 1000), chr1, 'should read the file')
		// another file in place of the first, with a later mtime so that it is not the same stamp
		const later = new Date(Date.now() + 5000)
		fs.copyFileSync(bed3, file)
		fs.utimesSync(file, later, later)
		test.deepEqual(await readBigbedLines(file, 'chr1', 0, 1000), ['chr1\t1\t5'], 'should read the new file')
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true })
	}
	test.end()
})

tape('a url file', async test => {
	server = http.createServer((req, res) => {
		const url = new URL(req.url!, 'http://x')
		requests.push(url.pathname)
		if (url.pathname.startsWith('/away/')) {
			res.writeHead(302, { location: `http://localhost:${(server.address() as AddressInfo).port}/${dir}/test.bb` })
			return res.end()
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
		res.writeHead(206, { 'content-range': `bytes ${start}-${end}/${data.length}`, 'content-length': end - start + 1 })
		res.end(data.subarray(start, end + 1))
	})
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	host = `127.0.0.1:${(server.address() as AddressInfo).port}`
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	const urlHosts = serverconfig.urlHosts
	try {
		const url = `http://${host}/${dir}/test.bb`
		features.ALLOW_remotefilefromurl = false
		await rejects(test, () => readBigbedLines(url, 'chr1', 0, 1000), /invalid file/, 'should reject a url by default')
		test.equal(await isBigbedFile(url), false, 'should not detect a url file by default')
		test.deepEqual(requests, [], 'should not request a url by default')

		features.ALLOW_remotefilefromurl = true
		// the local server is a loopback address, which is not allowed unless listed
		serverconfig.urlHosts = ['127.0.0.1']
		test.deepEqual(await readBigbedLines(url, 'chr1', 0, 1000), chr1, 'should read the items of a range of a url file')
		test.deepEqual(
			await readBigbedByName(url, 'dup'),
			await readBigbedByName(bb, 'dup'),
			'should read the items of a name of a url file'
		)
		test.equal(await isBigbedFile(url), true, 'should detect a url bigBed file')
		test.equal(await isBigbedFile(`http://${host}/${dir}/none.bb`), false, 'should not detect a missing url file')
		await rejects(
			test,
			() => readBigbedLines(`http://${host}/away/x.bb`, 'chr1', 0, 1000),
			/url host is not allowed/,
			'should not follow a redirect to a host that is not allowed'
		)
		await rejects(
			test,
			() => readBigbedLines('http://169.254.169.254/x.bb', 'chr1', 0, 1000),
			/invalid file/,
			'should reject a host that is not allowed'
		)
		await rejects(
			test,
			() => readBigbedLines('ftp://a.org/x.bb', 'chr1', 0, 1000),
			/ftp url is not supported/,
			'should reject an ftp url'
		)
	} finally {
		if (allow === undefined) delete features.ALLOW_remotefilefromurl
		else features.ALLOW_remotefilefromurl = allow
		if (urlHosts === undefined) delete serverconfig.urlHosts
		else serverconfig.urlHosts = urlHosts
		server.closeAllConnections()
		server.close()
	}
	test.end()
})
