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
}

export type ConcurrencyLimiter = {
	/** Acquire a slot (waiting or rejecting per the caps), run `fn`, and
	 * release the slot in a `finally` so it can never leak — even if `fn`
	 * throws. Resolves/rejects with `fn`'s own result. */
	run<T>(fn: () => Promise<T>): Promise<T>
}
