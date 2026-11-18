import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { api, batchLimits } from '../hicdata.ts'

/*
Tests:
	hicdata returns the items of a single pos1/pos2 request
	hicdata returns the items of each pair of a batch, in the requested order
	hicdata reports the straw errors of a pair in a batch and keeps the data of the other pairs
	hicdata validates the pairs of a batch before straw is spawned
	hicdata skips the pairs of a batch over the data point limit, which may be requested again
	hicdata returns the data of some pairs when the output of the pairs over the limit is interleaved
	hicdata reports a pair that alone has more data points than the limit
	hicdata runs at most a fixed number of straw processes at once for a batch
*/

/* a fake straw binary: args are matrixType nmeth file pos1 pos2 unit resolution
- pos1 of chrN:0:<count> prints <count> lines
- pos1 of bad:0:1 prints malformed lines
- pos1 of err:0:1 prints to stderr
- pos2 of slow prints the <count> lines of pos1 in two halves after a delay, so that the output of pairs is interleaved,
  and does not exit until it is done when it is stopped
- when $STRAW_LOG is set, logs the start and end of each process to that file
*/
const fakeStraw = `#!/bin/sh
if [ -n "$STRAW_LOG" ]; then echo start >> "$STRAW_LOG"; fi
chr=\${4%%:*}
count=\${4##*:}
if [ "$chr" = "bad" ]; then
	printf '0\\t0\\n'
	printf 'a\\tb\\tc\\n'
elif [ "$chr" = "err" ]; then
	echo 'straw failed' >&2
elif [ "$5" = "slow" ]; then
	# exits on its own after printing, instead of when it is stopped
	trap '' TERM
	sleep 0.05
	awk -v n="$count" 'BEGIN { for (i = 0; i < n / 2; i++) printf "%d\\t0\\t1\\n", i }'
	sleep 0.2
	awk -v n="$count" 'BEGIN { for (i = n / 2; i < n; i++) printf "%d\\t0\\t1\\n", i }'
	sleep 0.1
else
	awk -v n="$count" -v p2="$5" 'BEGIN { for (i = 0; i < n; i++) printf "%d\\t%d\\t1\\n", i, length(p2) }'
fi
if [ -n "$STRAW_LOG" ]; then sleep 0.05; echo end >> "$STRAW_LOG"; fi
`

function getHandler() {
	const payload: any = api.methods.post
	return payload.init()
}

async function request(query) {
	return new Promise<any>(resolve => getHandler()({ query }, { send: resolve }))
}

const query = (q = {}) => ({ url: 'https://a.org/x.hic', resolution: 1000, nmeth: 'NONE', ...q })

// the specs request a url, which fileurl() only accepts when remote files are allowed
const allowRemoteFile = serverconfig.features.ALLOW_remotefilefromurl
const hicstraw = serverconfig.hicstraw
const limits = { ...batchLimits }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hicdata-'))
const straw = path.join(dir, 'straw')
fs.writeFileSync(straw, fakeStraw, { mode: 0o755 })

tape('\n', test => {
	test.comment('-***- routes/hicdata specs -***-')
	serverconfig.features.ALLOW_remotefilefromurl = true
	serverconfig.hicstraw = straw
	test.end()
})

tape('hicdata returns the items of a single pos1/pos2 request', async test => {
	const res = await request(query({ pos1: 'chr1:0:2', pos2: 'chr2:0:8' }))
	test.deepEqual(
		res,
		{
			items: [
				[0, 8, 1],
				[1, 8, 1]
			]
		},
		'should return the items of the pair'
	)
	test.end()
})

tape('hicdata returns the items of each pair of a batch, in the requested order', async test => {
	const pairs = [
		['chr1:0:3', 'chr1:0:3'],
		['chr2:0:0', 'chr2:0:0'],
		['chr3:0:1', 'chr1:0:300']
	]
	const res = await request(query({ pairs }))
	test.notOk(res.error, 'should not have an error')
	test.deepEqual(
		res.pairs,
		[
			{
				items: [
					[0, 8, 1],
					[1, 8, 1],
					[2, 8, 1]
				]
			},
			{ items: [] },
			{ items: [[0, 10, 1]] }
		],
		'should return the items of each pair in the requested order'
	)
	test.end()
})

tape('hicdata reports the straw errors of a pair in a batch and keeps the data of the other pairs', async test => {
	const pairs = [
		['bad:0:1', 'chr1'],
		['err:0:1', 'chr1'],
		['chr1:0:1', 'chr1']
	]
	const res = await request(query({ pairs }))
	test.notOk(res.error, 'should not have a request error')
	test.match(res.pairs[0].error, /1 lines have other than 3 fields/, 'should report malformed straw output')
	test.deepEqual(res.pairs[0].items, [], 'should not return the items of a pair with malformed output')
	test.match(res.pairs[1].error, /straw failed/, 'should report the straw stderr of a pair')
	test.deepEqual(res.pairs[2], { items: [[0, 4, 1]] }, 'should return the data of the other pair')
	test.end()
})

tape('hicdata validates the pairs of a batch before straw is spawned', async test => {
	// straw must not be spawned for an invalid request
	serverconfig.hicstraw = path.join(os.tmpdir(), 'no-such-straw-binary')
	try {
		const cases: [any, RegExp][] = [
			['chr1', /must be a non-empty array/],
			[[], /must be a non-empty array/],
			[Array(batchLimits.pairs + 1).fill(['chr1', 'chr1']), /must not have more than 200 items/],
			[[['chr1']], /must be \[pos1, pos2\]/],
			[[['chr1', 'chr1', 'chr1']], /must be \[pos1, pos2\]/],
			[[['chr1', 'chr1'], 'chr1'], /must be \[pos1, pos2\]/],
			[[['chr1', '-o']], /invalid chromosome name/],
			[[['chr1:5:1', 'chr1']], /start > stop/],
			[[['chr1:1-5', 'chr1']], /invalid position/],
			[[['chr1', 1]], /invalid position/]
		]
		for (const [pairs, error] of cases) {
			const res = await request(query({ pairs }))
			test.match(String(res.error), error, `should reject pairs=${JSON.stringify(pairs).slice(0, 40)}`)
			test.notOk(res.pairs, 'should not return pairs')
		}
		const res = await request(query({ pairs: [['chr1', 'chr1']], matrixType: 'x' }))
		test.equal(res.error, 'invalid matrixType', 'should reject an invalid straw argument as a message string')
	} finally {
		serverconfig.hicstraw = straw
	}
	test.end()
})

tape('hicdata skips the pairs of a batch over the data point limit, which may be requested again', async test => {
	batchLimits.items = 10
	try {
		const counts = [4, 3, 0, 4, 2, 6, 5, 1]
		const all = counts.map((n, i) => [`chr${i}:0:${n}`, 'chr1'])
		const found = new Map<number, number>()
		let pending = all.map((p, i) => ({ p, i }))
		let requests = 0
		while (pending.length) {
			if (++requests > 20) break
			const res = await request(query({ pairs: pending.map(t => t.p) }))
			test.notOk(res.error, 'should not have a request error')
			const total = res.pairs.reduce((sum, r) => sum + r.items.length, 0)
			test.ok(total <= 10, `should return at most 10 data points in a response, got ${total}`)
			const next: typeof pending = []
			for (const [k, r] of res.pairs.entries()) {
				test.notOk(r.error, 'should not have a pair error')
				if (r.skipped) {
					test.deepEqual(r.items, [], 'should not return the items of a skipped pair')
					next.push(pending[k])
				} else found.set(pending[k].i, r.items.length)
			}
			test.ok(next.length < pending.length, 'should return at least one pair per request')
			pending = next
		}
		test.ok(requests > 1, 'should need more than one request for more data points than the limit')
		test.deepEqual(
			counts.map((_, i) => found.get(i)),
			counts,
			'should return all data points of each pair after requesting the skipped pairs again'
		)
	} finally {
		batchLimits.items = limits.items
	}
	test.end()
})

tape(
	'hicdata returns the data of some pairs when the output of the pairs over the limit is interleaved',
	async test => {
		batchLimits.items = 10
		try {
			// each pair prints half of its 6 data points at about the same time as the other pairs, then the other half,
			// so that the running pairs reach the limit at about the same time
			const pairs = Array.from({ length: 4 }, (_, i) => [`chr${i}:0:6`, 'slow'])
			const res = await request(query({ pairs }))
			test.notOk(res.error, 'should not have a request error')
			const returned = res.pairs.filter(r => !r.skipped)
			test.ok(returned.length > 0, `should return at least one pair, returned ${returned.length}`)
			for (const r of returned) {
				test.notOk(r.error, 'should not have a pair error')
				test.equal(r.items.length, 6, 'should return all data points of a returned pair')
			}
			const total = res.pairs.reduce((sum, r) => sum + r.items.length, 0)
			test.ok(total <= 10, `should return at most 10 data points, got ${total}`)
		} finally {
			batchLimits.items = limits.items
		}
		test.end()
	}
)

tape('hicdata reports a pair that alone has more data points than the limit', async test => {
	batchLimits.items = 10
	try {
		const res = await request(query({ pairs: [['chr1:0:100000', 'chr1']] }))
		test.deepEqual(res.pairs, [{ items: [], error: 'more than 10 data points' }], 'should report the pair')
	} finally {
		batchLimits.items = limits.items
	}
	test.end()
})

tape('hicdata runs at most a fixed number of straw processes at once for a batch', async test => {
	const log = path.join(dir, 'log')
	process.env.STRAW_LOG = log
	try {
		const pairs = Array.from({ length: 20 }, (_, i) => [`chr${i}:0:1`, 'chr1'])
		const res = await request(query({ pairs }))
		test.equal(res.pairs.length, 20, 'should return all pairs')
		let running = 0,
			max = 0
		for (const line of fs.readFileSync(log, 'utf8').trim().split('\n')) {
			running += line == 'start' ? 1 : -1
			max = Math.max(max, running)
		}
		test.ok(max > 1 && max <= 8, `should run 2 to 8 straw processes at once, got ${max}`)
	} finally {
		delete process.env.STRAW_LOG
	}
	test.end()
})

tape('cleanup', test => {
	serverconfig.hicstraw = hicstraw
	if (allowRemoteFile === undefined) delete serverconfig.features.ALLOW_remotefilefromurl
	else serverconfig.features.ALLOW_remotefilefromurl = allowRemoteFile
	fs.rmSync(dir, { recursive: true, force: true })
	test.end()
})
