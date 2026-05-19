const day = 1000 * 60 * 60 * 24
const halfDay = day / 2

/** Subdirs of serverconfig.cachedir that the cacheOrRecompute module
 * writes JSON cache files to. CacheManager imports this object and
 * registers every entry automatically with the eviction policy below;
 * `maxSize` falls back to CacheManager's 5 GB per-subdir default when
 * omitted. To add a new analysis type, append a new entry here — no
 * other file needs to be edited. */
export const CACHE_OR_RECOMPUTE_SUBDIRS = {
	de: { maxAge: day * 60, skipMs: halfDay, maxPending: 5 },
	dm: { maxAge: day * 60, skipMs: halfDay, maxPending: 5 },
	gsea: { maxAge: day * 60, skipMs: halfDay, maxPending: 5 },
	grin2: { maxAge: day * 60, skipMs: halfDay, maxPending: 5 },
	topve: { maxAge: day * 60, skipMs: halfDay, maxPending: 5 }
} as const satisfies Record<string, { maxAge: number; skipMs: number; maxSize?: number; maxPending: number }>

export type CacheSubdir = keyof typeof CACHE_OR_RECOMPUTE_SUBDIRS

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
