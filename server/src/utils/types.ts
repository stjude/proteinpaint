/** Subdirs of serverconfig.cachedir that the cacheOrRecompute module is
 * allowed to write to. Each entry must also be configured in
 * `CacheManager.ts` so the eviction lifecycle (TTL + max-size) still
 * applies. Add new analysis types here. */
export type CacheSubdir = 'de' | 'dm' | 'gsea' | 'grin2' | 'topve'

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
