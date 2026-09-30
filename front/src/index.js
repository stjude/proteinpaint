import { runproteinpaint } from '@sjcrh/proteinpaint-client'
export { runproteinpaint }

// this entry is only bundled as the PP server's /bin/proteinpaint.js, and so
// the startup check of this page's client version against the served bundle applies
runproteinpaint.enableBundleCheck?.()
mayRetryChunkLoads()

/*
	Chunk filenames have a content hash (see webpack.config.js). A chunk request may fail when:
	- a new deployment has replaced the chunks that an already loaded page expects, or
	- during a rolling deployment, an updated page requests a new chunk from a host that
	  still serves the previous version

	Retry a failed chunk load, which may reach an updated host in the second case,
	then notify the user if it still fails.
*/
function mayRetryChunkLoads() {
	// __webpack_require__ is replaced by webpack with its runtime, which has
	// .e() to load a chunk and .u() to get a chunk's filename
	if (typeof __webpack_require__ != 'function' || !__webpack_require__.e || !__webpack_require__.u) return
	const ensureChunk = __webpack_require__.e
	const getChunkFilename = __webpack_require__.u
	const retryDelays = [1000, 3000] // milliseconds
	const retries = {} // {chunkId: number of retries}

	// a retried chunk URL has a query parameter, so that a failed response is not reused from a cache
	__webpack_require__.u = chunkId => getChunkFilename(chunkId) + (retries[chunkId] ? `?retry=${retries[chunkId]}` : '')

	__webpack_require__.e = async (chunkId, ...args) => {
		for (let i = 0; ; i++) {
			try {
				return await ensureChunk(chunkId, ...args)
			} catch (e) {
				if (e?.name != 'ChunkLoadError') throw e
				if (i >= retryDelays.length) {
					runproteinpaint.onChunkLoadError?.(e)
					throw e
				}
				retries[chunkId] = i + 1
				await new Promise(resolve => setTimeout(resolve, retryDelays[i]))
			}
		}
	}
}
