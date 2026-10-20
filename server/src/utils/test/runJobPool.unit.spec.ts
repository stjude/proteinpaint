import tape from 'tape'
import { runJobPool } from '../methylationMatrix.ts'

/*
test sections:
runs every job, at most `concurrency` at once
after a failure: no new job starts, and it settles only when the running job ends
*/

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

tape('runs every job, at most `concurrency` at once', async test => {
	let running = 0,
		most = 0
	const done: number[] = []
	await runJobPool([1, 2, 3, 4, 5], 2, async job => {
		most = Math.max(most, ++running)
		await wait(5)
		running--
		done.push(job)
	})
	test.deepEqual(done.sort(), [1, 2, 3, 4, 5], 'every job ran')
	test.equal(most, 2, 'never more than 2 at once')
	test.end()
})

tape('after a failure: no new job starts, and it settles only when the running job ends', async test => {
	const started: string[] = []
	let slowEnded = false
	try {
		await runJobPool(['fails', 'slow', 'never'], 2, async job => {
			started.push(job)
			if (job == 'fails') throw new Error('chr1 failed')
			await wait(30)
			slowEnded = true
		})
		test.fail('should rethrow the failure')
	} catch (e: any) {
		test.equal(e.message, 'chr1 failed', 'rethrows the first failure')
		// the caller's finally releases memory here, so the job still running must have ended first
		test.equal(slowEnded, true, 'settles only after the job still running has ended')
		test.deepEqual(started, ['fails', 'slow'], 'no job starts after the failure')
	}
	test.end()
})
