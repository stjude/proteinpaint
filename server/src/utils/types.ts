/** Subdirs of serverconfig.cachedir that the cacheOrRecompute module is
 * allowed to write to. Each entry must also be configured in
 * `CacheManager.ts` so the eviction lifecycle (TTL + max-size) still
 * applies. Add new analysis types here. */
export type CacheSubdir = 'de' | 'dm' | 'gsea' | 'grin2'

export type CacheOrRecomputeOpts<TArgs, TResult> = {
	/** Hashed to derive the cacheId. Pass the subset of the request whose
	 * identity determines the cache key — usually request fields that
	 * change the result, with rendering/view-only params excluded so
	 * changing them still hits cache. */
	computeArgument: TArgs

	/** Subdir under serverconfig.cachedir. Must match a CacheManager-known
	 * subdir so eviction applies. */
	cacheSubdir: CacheSubdir

	/** Compute fresh and persist the result. Receives the fully resolved
	 * `cacheFilePath`; the callback is responsible for writing JSON to
	 * that path (typically via `writeJsonCache(cacheFilePath, result)`).
	 * All data the response builder needs on a cache hit must be
	 * contained in the JSON — no on-disk sibling artifacts. */
	computeFresh: (args: TArgs, cacheId: string, cacheFilePath: string) => Promise<TResult>
}

export type CacheOrRecomputeResult<TResult> = {
	result: TResult
	cacheId: string
	cacheFilePath: string
}
