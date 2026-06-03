import type { CacheSubdir } from '#src/utils/cacheOrRecompute.ts'

export type CacheOrRecomputeOpts<TArgs, TResult> = {
	/** Hashed to derive the cacheId. Pass the subset of the request whose
	 * identity determines the cache key — usually request fields that
	 * change the result, with rendering/view-only params excluded so
	 * changing them still hits cache. */
	computeArgument: TArgs

	/** Subdir under serverconfig.cachedir. Must match a CacheManager-known
	 * subdir so eviction applies. */
	cacheSubdir: CacheSubdir

	/** Compute fresh and return the result. `cacheOrRecompute` persists
	 * the returned value to the canonical JSON path automatically — the
	 * callback only needs to return. `cacheId` is provided for
	 * logging/debug; the file path is intentionally not exposed so
	 * callers can't write to it out-of-band. */
	computeFresh: (ctx: { cacheId: string }) => Promise<TResult>
}

export type CacheOrRecomputeResult<TResult> = {
	result: TResult
	cacheId: string
	cacheFilePath: string
}

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

	/** Per-task execution timeout (ms). A task that holds its slot longer than
	 * this has its slot released (so the queue advances) and its `run()`
	 * rejected with the timeout error; the `AbortSignal` passed to `fn` is
	 * aborted so cooperative tasks can stop. A non-cooperative task keeps
	 * running orphaned — JS can't force-kill it — but it no longer holds a slot.
	 * Defaults to `DEFAULT_TASK_TIMEOUT_MS` (30000) when omitted; pass `Infinity`
	 * to disable (unbounded) for legitimately long-running tasks. */
	taskTimeoutMs?: number

	/** Optional factory for the error thrown when a task times out. Defaults to
	 * a 504 (`code: 'TASK_TIMEOUT'`). Supply your own for a caller-specific
	 * code/message (e.g. volcano's `RENDER_TIMEOUT`). */
	makeTimeoutError?: () => Error
}

/** Context handed to each `run()` callback. `signal` is aborted if the task
 * exceeds the limiter's `taskTimeoutMs`, letting cooperative tasks bail early. */
export type ConcurrencyLimiterRunContext = { signal: AbortSignal }

export type ConcurrencyLimiter = {
	/** Acquire a slot (waiting or rejecting per the caps), run `fn`, and
	 * release the slot in a `finally` so it can never leak — even if `fn`
	 * throws or times out. Resolves/rejects with `fn`'s own result. */
	run<T>(fn: (ctx: ConcurrencyLimiterRunContext) => Promise<T>): Promise<T>
}
