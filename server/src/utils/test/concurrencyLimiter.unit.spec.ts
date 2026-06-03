import tape from 'tape'
import { createConcurrencyLimiter } from '#src/utils/concurrencyLimiter.ts'

/*
test sections:

run resolves to fn's return value
run propagates fn's rejection and frees the slot for the next run
up to maxConcurrent tasks run at once; the next stays pending until one frees
a queued task runs once a slot frees, in FIFO order
queue full → run rejects synchronously with the default POOL_BUSY 429 error
a provided makeBusyError is used instead of the default
pool recovers: a new run succeeds after the busy queue drains
maxConcurrent=1 hands slots to waiters one at a time without over-decrementing
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

const tick = () => new Promise<void>(r => setTimeout(r, 0))

tape('\n', t => {
	t.comment('-***- utils/concurrencyLimiter specs -***-')
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
	}

	blocker.resolve()
	await Promise.all([running, waiting])
	t.end()
})

tape('a provided makeBusyError is used instead of the default', async t => {
	const makeBusyError = () => {
		const err: any = new Error('custom full')
		err.status = 429
		err.statusCode = 429
		err.code = 'RENDER_BUSY'
		return err
	}
	const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueued: 0, makeBusyError })
	const blocker = defer()
	const running = limiter.run(async () => {
		await blocker.promise
	})
	await tick()

	try {
		await limiter.run(async () => 'overflow')
		t.fail('expected rejection from the custom busy error')
	} catch (e: any) {
		t.equal(e.code, 'RENDER_BUSY', 'the caller-supplied error factory is used')
		t.equal(e.message, 'custom full', 'custom message is preserved')
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
