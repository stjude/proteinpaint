import tape from 'tape'
import { createConcurrencyLimiter, DEFAULT_TASK_TIMEOUT_MS } from '#src/utils/concurrencyLimiter.ts'

/*
test sections:

run resolves to fn's return value
run propagates fn's rejection and frees the slot for the next run
up to maxConcurrent tasks run at once; the next stays pending until one frees
a queued task runs once a slot frees, in FIFO order
queue full → run rejects synchronously with the default POOL_BUSY 429 error
taskName names the gated resource in the busy error message
pool recovers: a new run succeeds after the busy queue drains
maxConcurrent=1 hands slots to waiters one at a time without over-decrementing
task timeout: hung task evicted with TASK_TIMEOUT 504, slot freed for the queue
task timeout: AbortSignal fires so a cooperative task can bail
task timeout: a task finishing in time is not evicted and the timer is cleared
task timeout: taskName names the gated resource in the timeout error message
task timeout: Infinity disables eviction; invalid values rejected at construction
*/

/** Tests for the generic concurrency gating device. Concurrency is driven
 * with manually-resolved deferred promises rather than timers so task
 * ordering is exact and the tests are not flaky. */

/** A promise plus its resolver, so a test can hold a task "in-flight" inside
 * the limiter and release it on demand. */
function defer<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
	let resolve!: (v: T) => void
	const promise = new Promise<T>(r => (resolve = r))
	return { promise, resolve }
}

/** Yield one microtask checkpoint. The limiter's handoffs all resume via
 * promise microtasks (`acquire` awaits a queued resolver; `release` resolves
 * it), so a single microtask drain lets every ready continuation run, in order
 * — no macrotask timer needed, which keeps ordering exact and deterministic. */
const tick = () => Promise.resolve()

/** Real-time delay. The timeout feature is inherently time-based, so the
 * timeout cases below use small real timers (~15–40ms); the microtask-driven
 * tests above don't. */
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

tape('\n', t => {
	t.comment('-***- utils/concurrencyLimiter specs -***-')
	t.end()
})

tape('rejects invalid caps at construction', t => {
	for (const bad of [0, -1, 2.5, NaN, Infinity]) {
		t.throws(
			() => createConcurrencyLimiter({ maxConcurrent: bad, maxQueued: 5 }),
			/maxConcurrent must be an integer >= 1/,
			`maxConcurrent=${bad} is rejected`
		)
	}
	for (const bad of [-1, 1.5, NaN, Infinity]) {
		t.throws(
			() => createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: bad }),
			/maxQueued must be an integer >= 0/,
			`maxQueued=${bad} is rejected`
		)
	}
	t.doesNotThrow(
		() => createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0 }),
		'maxQueued=0 (no waiting room) is allowed'
	)
	t.end()
})

tape('run resolves to fn’s return value', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 2, maxQueued: 2 })
	const out = await limiter.run(async () => 42)
	t.equal(out, 42, 'run forwards the resolved value of fn')
	t.end()
})

tape('run propagates fn’s rejection and frees the slot for the next run', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0 })
	try {
		await limiter.run(async () => {
			throw new Error('boom')
		})
		t.fail('expected run to reject')
	} catch (e: any) {
		t.equal(e.message, 'boom', 'run rejects with fn’s own error')
	}
	// If the slot leaked on the error path, this second run would hang/reject
	// busy. It resolving proves the slot was released in the finally.
	const out = await limiter.run(async () => 'ok')
	t.equal(out, 'ok', 'a follow-up run succeeds — no slot leaked on the error path')
	t.end()
})

tape('up to maxConcurrent tasks run at once; the next stays pending until one frees', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 2, maxQueued: 5 })
	let started = 0
	const gates = [defer(), defer(), defer()]
	const task = (i: number) =>
		limiter.run(async () => {
			started++
			await gates[i].promise
			return i
		})

	const p0 = task(0)
	const p1 = task(1)
	const p2 = task(2)
	await tick()
	t.equal(started, 2, 'exactly maxConcurrent (2) tasks have started; the 3rd waits')

	gates[0].resolve() // free a slot
	await p0
	await tick()
	t.equal(started, 3, 'the queued 3rd task starts once a slot frees')

	gates[1].resolve()
	gates[2].resolve()
	const results = await Promise.all([p1, p2])
	t.deepEqual(results, [1, 2], 'all tasks resolve to their own values')
	t.end()
})

tape('a queued task runs once a slot frees, in FIFO order', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 5 })
	const order: number[] = []
	const blocker = defer()

	// First task occupies the single slot until we release `blocker`.
	const first = limiter.run(async () => {
		order.push(0)
		await blocker.promise
	})
	await tick()
	// These three queue up behind it; they must run in enqueue order.
	const queued = [1, 2, 3].map(n =>
		limiter.run(async () => {
			order.push(n)
		})
	)
	await tick()
	t.deepEqual(order, [0], 'only the first task has run while the slot is held')

	blocker.resolve()
	await Promise.all([first, ...queued])
	t.deepEqual(order, [0, 1, 2, 3], 'queued tasks ran FIFO after the slot freed')
	t.end()
})

tape('queue full → run rejects synchronously with the default POOL_BUSY 429 error', async t => {
	// 1 running + 1 queued is the whole capacity; the 3rd must be shed.
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 1 })
	const blocker = defer()
	const running = limiter.run(async () => {
		await blocker.promise
	})
	const waiting = limiter.run(async () => 'queued') // fills the single queue slot
	await tick()

	try {
		await limiter.run(async () => 'overflow')
		t.fail('expected the overflow run to reject')
	} catch (e: any) {
		t.equal(e.code, 'POOL_BUSY', 'default busy error code is POOL_BUSY')
		t.equal(e.status, 429, 'default busy error carries status 429')
		t.equal(e.statusCode, 429, 'default busy error carries statusCode 429')
		t.match(e.message, /\btask pool is full\b/, 'default taskName "task" names the pool in the message')
	}

	blocker.resolve()
	await Promise.all([running, waiting])
	t.end()
})

tape('taskName names the gated resource in the busy error message', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskName: 'volcano render' })
	const blocker = defer()
	const running = limiter.run(async () => {
		await blocker.promise
	})
	await tick()

	try {
		await limiter.run(async () => 'overflow')
		t.fail('expected rejection from the busy error')
	} catch (e: any) {
		t.equal(e.code, 'POOL_BUSY', 'code stays the fixed POOL_BUSY')
		t.equal(e.statusCode, 429, 'status stays the fixed 429')
		t.equal(
			e.message,
			'The volcano render pool is full. Please try again shortly.',
			'taskName is woven into the message'
		)
	}

	blocker.resolve()
	await running
	t.end()
})

tape('pool recovers: a new run succeeds after the busy queue drains', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0 })
	const blocker = defer()
	const running = limiter.run(async () => {
		await blocker.promise
	})
	await tick()

	// While the single slot is held and the queue cap is 0, this is rejected.
	let rejected = false
	try {
		await limiter.run(async () => 'overflow')
	} catch {
		rejected = true
	}
	t.ok(rejected, 'run is shed while the pool is saturated')

	// Drain the pool, then a fresh run must succeed (no negative caching of busy).
	blocker.resolve()
	await running
	const out = await limiter.run(async () => 'recovered')
	t.equal(out, 'recovered', 'a new run succeeds once the slot frees')
	t.end()
})

tape('maxConcurrent=1 hands slots to waiters one at a time without over-decrementing', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 10 })
	let concurrent = 0
	let maxObserved = 0
	const N = 6

	const tasks = Array.from({ length: N }, (_, i) =>
		limiter.run(async () => {
			concurrent++
			maxObserved = Math.max(maxObserved, concurrent)
			// Yield so any over-decrement bug would let a second task in here.
			await tick()
			concurrent--
			return i
		})
	)

	const results = await Promise.all(tasks)
	t.equal(maxObserved, 1, 'never more than one task ran at a time')
	t.deepEqual(
		results,
		Array.from({ length: N }, (_, i) => i),
		'every task completed exactly once with its own value'
	)
	t.end()
})

/* -------------------------------- timeouts -------------------------------- */

tape('DEFAULT_TASK_TIMEOUT_MS is 30s', t => {
	t.equal(DEFAULT_TASK_TIMEOUT_MS, 30000, 'documented safety default')
	t.end()
})

tape('a hung task is evicted with TASK_TIMEOUT (504) and its slot is freed', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 5, taskTimeoutMs: 15 })
	const hung = defer() // never resolved → the task hangs
	let queuedRan = false

	// This run holds the only slot and will time out at 15ms.
	const hungRun = limiter.run(() => hung.promise)
	// This run is queued behind it; it can only proceed once the slot frees.
	const queuedRun = limiter.run(async () => {
		queuedRan = true
		return 'ok'
	})

	try {
		await hungRun
		t.fail('expected the hung run to reject')
	} catch (e: any) {
		t.equal(e.code, 'TASK_TIMEOUT', 'default timeout error code')
		t.equal(e.status, 504, 'status 504')
		t.equal(e.statusCode, 504, 'statusCode 504')
		t.match(e.message, /\btask exceeded its time limit\b/, 'default taskName "task" names the work in the message')
	}

	t.equal(await queuedRun, 'ok', 'the queued task ran after the hung one was evicted')
	t.ok(queuedRan, 'the freed slot let the queue advance')
	t.end()
})

tape('the AbortSignal is aborted on timeout, letting a cooperative task bail', async t => {
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskTimeoutMs: 15 })
	let observedAbort = false
	try {
		await limiter.run(
			({ signal }) =>
				new Promise((_, reject) => {
					signal.addEventListener('abort', () => {
						observedAbort = true
						reject(new Error('aborted by signal'))
					})
				})
		)
		t.fail('expected rejection')
	} catch {
		t.ok(observedAbort, 'fn observed the abort signal firing on timeout')
	}
	t.end()
})

tape('a task finishing before the timeout is not evicted and the timer is cleared', async t => {
	// 15ms timeout, but the task resolves immediately. If the timer were not
	// cleared it would abort the signal at 15ms; we wait 40ms and assert it didn't.
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskTimeoutMs: 15 })
	let abortedLater = false
	const out = await limiter.run(({ signal }) => {
		signal.addEventListener('abort', () => {
			abortedLater = true
		})
		return Promise.resolve('done')
	})
	t.equal(out, 'done', 'returns fn’s value with no spurious timeout rejection')
	await delay(40)
	t.notOk(abortedLater, 'signal was not aborted after a clean finish (timer cleared)')
	t.end()
})

tape('taskName names the gated resource in the timeout error message', async t => {
	const limiter = createConcurrencyLimiter({
		maxConcurrent: 1,
		maxQueued: 0,
		taskTimeoutMs: 15,
		taskName: 'volcano render'
	})
	const hung = defer()
	try {
		await limiter.run(() => hung.promise)
		t.fail('expected timeout rejection')
	} catch (e: any) {
		t.equal(e.code, 'TASK_TIMEOUT', 'code stays the fixed TASK_TIMEOUT')
		t.equal(e.statusCode, 504, 'status stays the fixed 504')
		t.equal(
			e.message,
			'The volcano render exceeded its time limit and was evicted.',
			'taskName is woven into the message'
		)
	}
	t.end()
})

tape('taskTimeoutMs: Infinity disables eviction; invalid values rejected at construction', async t => {
	for (const bad of [0, -1, NaN]) {
		t.throws(
			() => createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskTimeoutMs: bad }),
			/taskTimeoutMs must be a positive number or Infinity/,
			`taskTimeoutMs=${bad} is rejected`
		)
	}
	t.doesNotThrow(
		() => createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskTimeoutMs: Infinity }),
		'Infinity (disabled) is allowed'
	)

	// With the timeout disabled, a long-running task is NOT evicted.
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, taskTimeoutMs: Infinity })
	const gate = defer<string>()
	let settled = false
	const p = limiter
		.run(() => gate.promise)
		.then(v => {
			settled = true
			return v
		})
	await delay(40) // longer than any of the small timeouts above
	t.notOk(settled, 'task still in-flight, not evicted, well past a normal timeout window')
	gate.resolve('late')
	t.equal(await p, 'late', 'the task completes normally once it finally resolves')
	t.end()
})
