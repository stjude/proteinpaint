/** A generic concurrency gating device. `createConcurrencyLimiter` returns a
 * limiter that runs at most `maxConcurrent` async tasks at once; further tasks
 * wait in a bounded FIFO queue, and once that queue is full the limiter sheds
 * load by throwing a 429 busy error rather than letting the queue grow without
 * bound (an unbounded queue is a memory/DoS risk and holds callers open
 * indefinitely under sustained overload).
 *
 * Each limiter is an independent instance holding all of its state in a
 * closure, so one process can gate several distinct resources with separate
 * caps. This was lifted verbatim from the volcano render gate that previously
 * lived in renderVolcano.ts; see utils/cacheOrRecompute.ts for the sibling
 * pattern that gates concurrent compute jobs. */

export type ConcurrencyLimiterOpts = {
	/** Max tasks allowed to run at the same time. */
	maxConcurrent: number

	/** Max tasks allowed to wait for a slot. Past this, `run` rejects
	 * immediately with the busy error instead of enqueuing. */
	maxQueued: number

	/** Optional factory for the error thrown when the wait-queue is full.
	 * Defaults to a generic 429 (`code: 'POOL_BUSY'`). Supply your own to
	 * carry a caller-specific code/message (e.g. volcano's `RENDER_BUSY`). */
	makeBusyError?: () => Error
}

export type ConcurrencyLimiter = {
	/** Acquire a slot (waiting or rejecting per the caps), run `fn`, and
	 * release the slot in a `finally` so it can never leak — even if `fn`
	 * throws. Resolves/rejects with `fn`'s own result. */
	run<T>(fn: () => Promise<T>): Promise<T>
}

/** Generic 429 so it reads as "retry later", not a client error in the
 * request shape. Mirrors the busy-error shape in utils/cacheOrRecompute.ts. */
function defaultBusyError(): Error {
	const err: any = new Error('Concurrency pool is full. Please try again shortly.')
	err.status = 429
	err.statusCode = 429
	err.code = 'POOL_BUSY'
	return err
}

export function createConcurrencyLimiter(opts: ConcurrencyLimiterOpts): ConcurrencyLimiter {
	const { maxConcurrent, maxQueued, makeBusyError = defaultBusyError } = opts
	let active = 0
	const queue: Array<() => void> = []

	async function acquire(): Promise<void> {
		if (active < maxConcurrent) {
			active++
			return
		}
		if (queue.length >= maxQueued) throw makeBusyError()
		await new Promise<void>(resolve => queue.push(resolve))
	}

	function release(): void {
		const next = queue.shift()
		// Hand the slot straight to the next waiter without decrement/increment;
		// only drop `active` when the queue is empty.
		if (next) next()
		else active--
	}

	async function run<T>(fn: () => Promise<T>): Promise<T> {
		await acquire()
		try {
			return await fn()
		} finally {
			release()
		}
	}

	return { run }
}
