import tape from 'tape'
import fs from 'fs'
import http from 'http'
import path from 'path'
import type { AddressInfo } from 'net'
import serverconfig from '#src/serverconfig.js'
import { readBigwigBins, read_limits } from '#src/bigwig.ts'

/*
test sections:

readBigwigBins(): the mean of each bin, from the base data
readBigwigBins(): the mean of each bin, from a zoom level
readBigwigBins(): bins without data
rejected arguments
a url file

The expected means are what pyBigWig bw.stats(chr, start, end, nBins=n, type="mean") returns for
files/hg38/TermdbTest/trackLst/bw1.bw, which has data on chr17 near TP53 and zoom levels with reductions 4144, 16576
and 66304.
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const dir = 'files/hg38/TermdbTest/trackLst'
const bw = path.join(tp, dir, 'bw1.bw')
const tp53 = { chr: 'chr17', start: 7666657, end: 7688274 }
const tp53Means = [
	2.192503470615456, 2.3584643848288622, 0.6896392229417206, 1.5256825543729755, 0.862627197039778, 1.2335800185013877,
	1.6385932438685793, 3.5314523589269196, 31.965309898242367, 167.53092783505156
]

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

function closeTo(test, actual: number[] | null, expected: number[], relTol: number, msg: string) {
	test.ok(
		actual?.length == expected.length &&
			actual.every((v, i) =>
				Number.isNaN(expected[i])
					? Number.isNaN(v)
					: Math.abs(v - expected[i]) <= relTol * Math.max(1, Math.abs(expected[i]))
			),
		msg
	)
}

tape('\n', test => {
	test.comment('-***- bigwig specs -***-')
	test.end()
})

tape('readBigwigBins(): the mean of each bin, from the base data', async test => {
	test.deepEqual(
		await readBigwigBins(bw, tp53.chr, tp53.start, tp53.end, 10),
		tp53Means,
		'should read the same means as pyBigWig for bins that are too narrow for a zoom level'
	)
	test.deepEqual(
		await readBigwigBins(bw, tp53.chr, tp53.start, tp53.end, 4),
		[1.9022945965951148, 1.1491487786824575, 1.3821243523316062, 69.96684045881126],
		'should read the same means as pyBigWig for bins that do not end on a whole base'
	)
	test.deepEqual(
		await readBigwigBins(path.join(dir, 'bw1.bw'), tp53.chr, tp53.start, tp53.end, 10),
		tp53Means,
		'should read a file by a path under tp'
	)
	test.end()
})

tape('readBigwigBins(): the mean of each bin, from a zoom level', async test => {
	const expected = new Array(100).fill(NaN)
	// pyBigWig weighs a zoom value by its bases with data, which @gmod/bbi does not give, and its mean is not rounded
	// to a float
	expected[9] = 13.950090639102095
	closeTo(
		test,
		await readBigwigBins(bw, 'chr17', 0, 83257441, 100),
		expected,
		1e-6,
		'should read close to the means of pyBigWig from the zoom level for bins of a chromosome'
	)
	test.end()
})

tape('readBigwigBins(): bins without data', async test => {
	test.deepEqual(
		await readBigwigBins(bw, 'chr17', 7666657, 7666660, 6),
		[NaN, 2, NaN, 2, NaN, 2],
		'should read NaN for a bin of no base, when there are more bins than bases'
	)
	test.deepEqual(
		await readBigwigBins(bw, 'chr17', 83257000, 83258441, 3),
		[NaN, NaN, NaN],
		'should read NaN for bins without data, including bins past the chromosome end'
	)
	test.equal(await readBigwigBins(bw, 'chrX', 0, 10, 3), null, 'should read null for a chromosome not in the file')
	test.end()
})

tape('rejected arguments', async test => {
	const cases: [string, () => Promise<unknown>, RegExp][] = [
		['a chr that is an option', () => readBigwigBins(bw, '-o', 0, 1, 1), /invalid chr/],
		['a chr with a space', () => readBigwigBins(bw, 'chr17 ', 0, 1, 1), /invalid chr/],
		['a start that is a string', () => readBigwigBins(bw, 'chr17', '0' as any, 1, 1), /invalid start or end/],
		['a negative start', () => readBigwigBins(bw, 'chr17', -1, 1, 1), /invalid start or end/],
		['a fractional end', () => readBigwigBins(bw, 'chr17', 0, 1.5, 1), /invalid start or end/],
		['an end that is the start', () => readBigwigBins(bw, 'chr17', 5, 5, 1), /invalid start or end/],
		['no bins', () => readBigwigBins(bw, 'chr17', 0, 1, 0), /invalid number of bins/],
		['a fractional number of bins', () => readBigwigBins(bw, 'chr17', 0, 10, 1.5), /invalid number of bins/],
		['a file outside tp and cachedir', () => readBigwigBins('/etc/hosts', 'chr17', 0, 1, 1), /invalid file/],
		['a path that leaves tp', () => readBigwigBins(`${dir}/../../../../x.bw`, 'chr17', 0, 1, 1), /invalid file/],
		['a missing file', () => readBigwigBins(path.join(tp, dir, 'none.bw'), 'chr17', 0, 1, 1), /cannot open/],
		[
			'a text file',
			() => readBigwigBins(path.join(tp, dir, 'facet.json'), 'chr17', 0, 1, 1),
			/not a BigWig\/BigBed file/
		],
		[
			'a bigBed file',
			() => readBigwigBins(path.join(tp, 'files/hg38/bigbed/test.bb'), 'chr1', 0, 1, 1),
			/not a bigWig file/
		]
	]
	for (const [label, fn, pattern] of cases) await rejects(test, fn, pattern, `should reject ${label}`)

	const maxBytes = read_limits.maxBytes
	read_limits.maxBytes = 10
	try {
		await rejects(
			test,
			() => readBigwigBins(bw, tp53.chr, tp53.start, tp53.end, 10),
			/too much data in view range/,
			'should reject a read of more data than read_limits.maxBytes'
		)
	} finally {
		read_limits.maxBytes = maxBytes
	}
	test.end()
})

tape('a url file', async test => {
	const requests: string[] = []
	const server = http.createServer((req, res) => {
		const url = new URL(req.url!, 'http://x')
		requests.push(url.pathname)
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
	const host = `127.0.0.1:${(server.address() as AddressInfo).port}`
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	const urlHosts = serverconfig.urlHosts
	try {
		const url = `http://${host}/${dir}/bw1.bw`
		features.ALLOW_remotefilefromurl = false
		await rejects(
			test,
			() => readBigwigBins(url, tp53.chr, tp53.start, tp53.end, 10),
			/invalid file/,
			'should reject a url by default'
		)
		test.deepEqual(requests, [], 'should not request a url by default')

		features.ALLOW_remotefilefromurl = true
		// the local server is a loopback address, which is not allowed unless listed
		serverconfig.urlHosts = ['127.0.0.1']
		test.deepEqual(
			await readBigwigBins(url, tp53.chr, tp53.start, tp53.end, 10),
			tp53Means,
			'should read the means of a url file'
		)
		await rejects(
			test,
			() => readBigwigBins(`http://${host}/${dir}/none.bw`, tp53.chr, tp53.start, tp53.end, 10),
			/404/,
			'should reject a missing url file'
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
