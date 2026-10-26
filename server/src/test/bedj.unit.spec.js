import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '../serverconfig.js'
import bedj_request_closure from '../bedj.js'

/*
Specs for the /tkbedj route, client-supplied item list branch and plain text file branch.

test sections:
- /tkbedj: list length limit
- /tkbedj: gene region
- /tkbedj: disableFeature_custombedjfile
- /tkbedj: plain text file
*/

const maxBedItems = 1000
const chrlen = 248956422
const genomes = {
	hg38: { name: 'hg38', chrlookup: { CHR1: { name: 'chr1', len: chrlen }, CHR2: { name: 'chr2', len: 242193529 } } }
}
const handler = bedj_request_closure(genomes)

function makeItems(count) {
	return Array.from({ length: count }, (_, i) => ({ chr: 'chr1', start: i, stop: i + 1 }))
}

// resolves with the res.send() payload
function send(query) {
	return new Promise(resolve => {
		const req = { query }
		const res = { send: resolve }
		Promise.resolve(handler(req, res)).catch(e => resolve({ error: String(e) }))
	})
}

tape('\n', test => {
	test.comment('-***- bedj specs -***-')
	test.end()
})

tape('/tkbedj: list length limit', async test => {
	const rglst = [{ chr: 'chr1', start: 0, stop: maxBedItems + 1 }]

	const atLimit = await send({ genome: 'hg38', getdata: 1, bedItems: makeItems(maxBedItems), rglst })
	test.equal(atLimit.error, undefined, 'should not error for a list at the maximum length')
	test.equal(atLimit.items?.length, maxBedItems, 'should return all items at the maximum length')

	const overLimit = await send({ genome: 'hg38', getdata: 1, bedItems: makeItems(maxBedItems + 1), rglst })
	test.ok(overLimit.error, 'should reject a list over the maximum length')

	test.end()
})

tape('/tkbedj: gene region', async test => {
	const sendGm = gmregion =>
		send({ genome: 'hg38', getdata: 1, bedItems: makeItems(1), rglst: [{ chr: 'chr1', start: 0, stop: 10 }], gmregion })

	const valid = await sendGm({ chr: 'chr1', start: 0, stop: 10, width: 800 })
	test.equal(valid.error, undefined, 'should accept a gene region within the chromosome')

	const emptyRegion = await sendGm({ chr: 'chr1', start: 0, stop: 0 })
	test.ok(String(emptyRegion.error).includes('stop < start'), 'should reject a gene region with stop not after start')

	const pastEnd = await sendGm({ chr: 'chr1', start: 0, stop: chrlen + 1 })
	test.ok(String(pastEnd.error).includes('stop out of bound'), 'should reject a gene region past the chromosome end')

	const unknownChr = await sendGm({ chr: 'chrZ', start: 0, stop: 10 })
	test.ok(String(unknownChr.error).includes('invalid chr name'), 'should reject a gene region on an unknown chromosome')

	test.end()
})

tape('/tkbedj: disableFeature_custombedjfile', async test => {
	const trackFile = 'anno/refGene.hg38.test.gz'
	const nativeHandler = bedj_request_closure({
		hg38: { ...genomes.hg38, tracks: [{ type: 'bedj', name: 'RefGene', file: trackFile }] }
	})
	const sendNative = query =>
		new Promise(resolve => {
			const q = { genome: 'hg38', getdata: 1, rglst: [{ chr: 'chr1', start: 0, stop: 10000 }], ...query }
			Promise.resolve(nativeHandler({ query: q }, { send: resolve })).catch(e => resolve({ error: String(e) }))
		})

	serverconfig.features.disableFeature_custombedjfile = true
	try {
		const native = await sendNative({ file: trackFile })
		test.equal(native.error, undefined, 'should read a genome track file')
		test.ok(Array.isArray(native.items), 'should return the items of a genome track file')

		const other = await sendNative({ file: 'anno/gencode.v41.hg38.test.gz' })
		test.equal(other.error, 'file is not a track of this genome', 'should reject a file that is not a genome track')

		const cache = await sendNative({ file: 'x.gz', isCache: true })
		test.equal(cache.error, 'custom track file is not allowed', 'should reject a cache file')

		const url = await sendNative({ url: 'https://example.org/x.gz' })
		test.equal(url.error, 'custom track file is not allowed', 'should reject a url')

		const items = await sendNative({ bedItems: makeItems(1) })
		test.equal(items.error, undefined, 'should still accept client-supplied items, which read no file')
	} finally {
		delete serverconfig.features.disableFeature_custombedjfile
	}

	const custom = await sendNative({ file: 'anno/gencode.v41.hg38.test.gz' })
	test.equal(custom.error, undefined, 'should read another tp file when the flag is not set')
	test.end()
})

tape('/tkbedj: plain text file', async test => {
	const file = `bedjSpec-${process.pid}.txt`
	const filepath = path.join(serverconfig.cachedir, 'bedj', file)
	fs.mkdirSync(path.dirname(filepath), { recursive: true })
	// sorted by chr and start, in an order of chrs that is not lexical
	fs.writeFileSync(
		filepath,
		[
			'# comment',
			'chr2\t10\t99\t{"name":"c"}',
			'chr1\t100\t200\t{"name":"a"}',
			'chr1\t150\t400\t{"name":"b"}',
			'chr1\t500\t600\t{"name":"d"}',
			'chr1\t5000\t5100\tnot json',
			/* out of order on purpose, so that a line is returned only if the read goes on past a line
			that starts after the region, or past the lines of the chr of the region */
			'chr1\t200\t300\t{"name":"late"}',
			'chr2\t20\t30\t{"name":"late"}',
			''
		].join('\n')
	)
	const names = items => (items || []).map(i => i.name).sort()
	const query = o => send({ genome: 'hg38', getdata: 1, isCache: true, file, ...o })

	const a = await query({ rglst: [{ chr: 'chr1', start: 180, stop: 450 }] })
	test.equal(a.error, undefined, 'should not error')
	test.deepEqual(
		names(a.items),
		['a', 'b'],
		'should return the items that overlap the region, and stop at the first line that starts past it'
	)

	const b = await query({
		rglst: [
			{ chr: 'chr1', start: 0, stop: 120 },
			{ chr: 'chr2', start: 0, stop: 1000 }
		]
	})
	test.deepEqual(
		(b.items || []).map(i => `${i.name}:${i.rglst[0].idx}`).sort(),
		['a:0', 'c:1'],
		'should read each region, including a chr earlier in the file, and stop at the end of its chr'
	)

	const c = await query({
		gmregion: { chr: 'chr1', start: 120, stop: 160 },
		rglst: [{ chr: 'chr1', start: 120, stop: 160 }]
	})
	test.deepEqual(names(c.items), ['a', 'b'], 'should return the items that overlap the gene region')

	const d = await query({ rglst: [{ chr: 'chr1', start: 4000, stop: 6000 }] })
	test.ok(d.error?.startsWith('Line with invalid JSON'), 'should reject a line with invalid JSON in the region')

	const e = await query({ file: 'bedjSpec-missing.txt', rglst: [{ chr: 'chr1', start: 0, stop: 100 }] })
	test.equal(e.error, 'file not found', 'should reject a missing file without its path')

	fs.rmSync(filepath, { force: true })
	test.end()
})
