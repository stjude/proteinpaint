import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { api } from '../hicgenome.ts'

/*
Tests:
	hicgenome reports the straw errors of a chromosome pair and keeps the data of the other pairs
	hicgenome reports a straw binary that cannot be spawned
*/

// a fake straw binary: args are matrixType nmeth file pos1 pos2 BP resolution
const fakeStraw = `#!/bin/sh
if [ "$4" = "chr1" ] && [ "$5" = "chr1" ]; then
	printf '0\\t0\\t5\\n1000000\\t0\\t2\\n'
elif [ "$4" = "chr2" ] && [ "$5" = "chr1" ]; then
	printf '0\\t0\\n'
	printf 'a\\tb\\tc\\n'
else
	printf '0\\t0\\t1\\n'
fi
`

function getHandler() {
	const payload: any = api.methods.get
	return payload.init()
}

async function request(query) {
	return new Promise<any>(resolve => getHandler()({ query }, { send: resolve }))
}

const query = () => ({ url: 'https://a.org/x.hic', chrlst: ['chr1', 'chr2'], resolution: 1000000 })

tape('\n', test => {
	test.comment('-***- routes/hicgenome specs -***-')
	test.end()
})

tape('hicgenome reports the straw errors of a chromosome pair and keeps the data of the other pairs', async test => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hicgenome-'))
	const straw = path.join(dir, 'straw')
	fs.writeFileSync(straw, fakeStraw, { mode: 0o755 })
	const hicstraw = serverconfig.hicstraw
	serverconfig.hicstraw = straw
	try {
		const res = await request(query())
		const pair = (lead, follow) => res.data?.find(d => d.lead == lead && d.follow == follow)
		test.deepEqual(
			pair('chr1', 'chr1')?.items,
			[
				[0, 0, 5],
				[1000000, 0, 2]
			],
			'should return the data of a pair without straw errors'
		)
		test.deepEqual(pair('chr2', 'chr2')?.items, [[0, 0, 1]], 'should return the data of another pair')
		test.match(
			res.error,
			/chr2 - chr1: 1 lines have other than 3 fields, 1 lines have non-numerical values/,
			'should report the errors of the pair with malformed straw output'
		)
	} finally {
		serverconfig.hicstraw = hicstraw
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('hicgenome reports a straw binary that cannot be spawned', async test => {
	const hicstraw = serverconfig.hicstraw
	serverconfig.hicstraw = path.join(os.tmpdir(), 'no-such-straw-binary')
	try {
		const res = await request(query())
		test.match(res.error, /cannot run straw/, 'should report that straw cannot be run, instead of crashing')
	} finally {
		serverconfig.hicstraw = hicstraw
	}
	test.end()
})
