import type {
	ConcurrencyLimiterOpts,
	ConcurrencyLimiter,
	ConcurrencyLimiterRunContext,
	MapConcurrentOpts
} from './types.ts'

/** Default per-task execution timeout. A task holding its slot longer than this
 * is evicted (slot freed, caller rejected) so one hung task can't stall the
 * whole queue. 30s is deliberately generous — orders of magnitude above any
 * healthy task — so it only ever fires on a genuine hang, not a merely slow
 * task. Callers with legitimately long-running work pass `taskTimeoutMs:
 * Infinity` to disable, or a tuned value to override. */
export const DEFAULT_TASK_TIMEOUT_MS = 30000

/** A shared, never-aborted signal handed to `fn` when a limiter's timeout is
 * disabled (`Infinity`), so the run context always carries a real `AbortSignal`
 * without allocating an AbortController per call on the no-timeout fast path. */
const NEVER_ABORT = new AbortController().signal

/** A generic concurrency gating device. `createConcurrencyLimiter` returns a
 * limiter that runs at most `maxConcurrent` async tasks at once; further tasks
 * wait in a bounded FIFO queue, and once that queue is full the limiter sheds
 * load by throwing a 429 busy error rather than letting the queue grow without
 * bound (an unbounded queue is a memory/DoS risk and holds callers open
 * indefinitely under sustained overload).
 *
 * Each limiter is an independent instance holding all of its state in a
 * closure, so one process can gate several distinct resources with separate
 * caps. See utils/cacheOrRecompute.ts for the sibling
 * pattern that gates concurrent compute jobs. The `ConcurrencyLimiterOpts` and
 * `ConcurrencyLimiter` types live in utils/types.ts alongside cacheOrRecompute's. */

export function createConcurrencyLimiter(opts: ConcurrencyLimiterOpts): ConcurrencyLimiter {
	const { maxConcurrent, maxQueued, taskName = 'task', taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS } = opts

	// Closured error builders — `taskName` names the gated resource so the
	// message identifies which pool is full / what timed out, while the status
	// and code stay fixed (429 "retry later", 504 "took too long"). Both read as
	// transient server states, not client request errors. If a caller ever needs
	// a custom statusCode, add it to opts rather than reintroducing a factory.
	function busyError(): Error {
		const err: any = new Error(`The ${taskName} pool is full. Please try again shortly.`)
		err.status = 429
		err.statusCode = 429
		err.code = 'POOL_BUSY'
		return err
	}
	function timeoutError(): Error {
		const err: any = new Error(`The ${taskName} exceeded its time limit and was evicted.`)
		err.status = 504
		err.statusCode = 504
		err.code = 'TASK_TIMEOUT'
		return err
	}
	// Validate the caps at construction — these are programmer config, not
	// request input, so fail fast and loudly rather than degrading silently:
	// a non-integer or <1 maxConcurrent would never let tasks run (or drive
	// `active` negative), and a negative/non-integer maxQueued would shed or
	// queue unpredictably. maxQueued === 0 is allowed (no waiting room: shed
	// immediately once all slots are busy).
	if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1)
		throw new Error(`createConcurrencyLimiter: maxConcurrent must be an integer >= 1 (got ${maxConcurrent})`)
	if (!Number.isInteger(maxQueued) || maxQueued < 0)
		throw new Error(`createConcurrencyLimiter: maxQueued must be an integer >= 0 (got ${maxQueued})`)
	// `Infinity` disables the timeout; otherwise require a positive finite ms.
	// Reject 0/negative/NaN so a misconfigured value can't silently evict every
	// task immediately (0) or behave unpredictably.
	if (taskTimeoutMs !== Infinity && (!Number.isFinite(taskTimeoutMs) || taskTimeoutMs <= 0))
		throw new Error(
			`createConcurrencyLimiter: taskTimeoutMs must be a positive number or Infinity (got ${taskTimeoutMs})`
		)
	let active = 0
	const queue: Array<() => void> = []

	async function acquire(): Promise<void> {
		if (active < maxConcurrent) {
			active++
			return
		}
		if (queue.length >= maxQueued) throw busyError()
		await new Promise<void>(resolve => queue.push(resolve))
	}

	function release(): void {
		const next = queue.shift()
		// Hand the slot straight to the next waiter without decrement/increment;
		// only drop `active` when the queue is empty.
		if (next) next()
		else active--
	}

	async function run<T>(fn: (ctx: ConcurrencyLimiterRunContext) => Promise<T>): Promise<T> {
		await acquire()

		// Disabled-timeout fast path: no timer, no AbortController — hand `fn` a
		// shared never-aborted signal and just release the slot when it settles.
		if (taskTimeoutMs === Infinity) {
			try {
				return await fn({ signal: NEVER_ABORT })
			} finally {
				release()
			}
		}

		// Bounded path: race `fn` against a timer. `releaseOnce` guarantees the
		// slot is released exactly once — by the timer on timeout, otherwise by
		// the `finally`. On timeout we free the slot immediately so the queue can
		// advance even though the orphaned task may keep running (JS can't kill
		// it); the AbortSignal lets a cooperative task stop itself.
		const controller = new AbortController()
		let released = false
		const releaseOnce = () => {
			if (released) return
			released = true
			release()
		}
		let timer: ReturnType<typeof setTimeout> | undefined
		try {
			const task = fn({ signal: controller.signal })
			// The orphaned task may reject after we've already timed out; swallow
			// that late rejection so it can't surface as an unhandledRejection.
			task.catch(() => {})
			const timeout = new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort()
					releaseOnce()
					reject(timeoutError())
				}, taskTimeoutMs)
			})
			return await Promise.race([task, timeout])
		} finally {
			if (timer) clearTimeout(timer)
			releaseOnce()
		}
	}

	return { run }
}

/** Bounded-concurrency map over a *known, finite* collection — the sibling of
 * `createConcurrencyLimiter` for the other concurrency shape.
 *
 * Use `createConcurrencyLimiter` when many independent callers contend for a
 * shared resource and you want a bounded queue + load shedding (a long-lived
 * gate). Use `mapConcurrent` when a single caller has a fixed list of work and
 * just wants at most `concurrency` items in flight at once.
 *
 * It runs a worker pool: `min(concurrency, items.length)` workers each pull the
 * next item from a shared cursor until the list is exhausted. So exactly
 * `concurrency` tasks run at a time with O(concurrency) memory — there is no
 * upfront queue of N pending tasks, and nothing is ever shed. (Feeding N items
 * through a gating limiter's `run()` would instead enqueue N-`maxConcurrent`
 * resolvers at once, which is why that tool is the wrong fit for batches.)
 *
 * Settled semantics, like `Promise.allSettled`: a thrown `fn` becomes a
 * `rejected` entry rather than failing the whole batch, so one bad item can't
 * abort the rest. `results[i]` aligns with `items[i]`. Items left unstarted by
 * `opts.stopWhen`/`opts.signal` are holes (unset) in the returned array.
 *
 * `fn` receives `(item, index)`; if it needs the abort signal it can close over
 * `opts.signal`. Side-effecting `fn`s that return void are fine — just ignore
 * the results. */
export async function mapConcurrent<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
	opts: MapConcurrentOpts = {}
): Promise<PromiseSettledResult<R>[]> {
	// Same fail-fast validation as the gating limiter: a non-integer or <1
	// concurrency is programmer config, not request input.
	if (!Number.isInteger(concurrency) || concurrency < 1)
		throw new Error(`mapConcurrent: concurrency must be an integer >= 1 (got ${concurrency})`)

	const { signal, stopWhen } = opts
	const results: PromiseSettledResult<R>[] = new Array(items.length)
	let nextIndex = 0

	async function worker(): Promise<void> {
		// Pull the next index off the shared cursor until a caller-side stop fires
		// (signal aborted / stopWhen) or the list is drained. The `nextIndex++`
		// read+increment is atomic in single-threaded JS (no await between them),
		// so two workers never grab the same index.
		while (!(signal?.aborted || stopWhen?.())) {
			const i = nextIndex++
			if (i >= items.length) return
			try {
				results[i] = { status: 'fulfilled', value: await fn(items[i], i) }
			} catch (reason) {
				results[i] = { status: 'rejected', reason }
			}
		}
	}

	const workerCount = Math.min(concurrency, items.length)
	await Promise.all(Array.from({ length: workerCount }, () => worker()))
	return results
}
