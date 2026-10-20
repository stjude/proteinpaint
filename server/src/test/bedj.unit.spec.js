import tape from 'tape'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import serverconfig from '../serverconfig.js'
import bedj_request_closure from '../bedj.js'

/*
Specs for the /tkbedj route, client-supplied item list branch and plain text file branch.

test sections:
- /tkbedj: list length limit
- /tkbedj: plain text file
*/

const maxBedItems = 1000
const genomes = { hg38: { name: 'hg38' } }
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

// the route runs bigBedInfo on a file, which some environments do not have
const hasBigBedInfo = !spawnSync(serverconfig.bigBedInfo, []).error

tape('/tkbedj: plain text file', async test => {
	if (!hasBigBedInfo) {
		test.comment('bigBedInfo not found, skipped')
		return test.end()
	}
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
