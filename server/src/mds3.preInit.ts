import serverconfig from '#src/serverconfig.js'
import type { Mds3 } from '#types'

/**
 * Tests the dataset readiness for initialization and data queries,
 * for example checking if the GDC API is healthy before querying data for caching.
 * If a raw dataset entry (in serverconfig.genomes[].datasets[]) has
 * awaitMds3Init === true, it will throw an error if the status is not OK
 * otherwise, it will retry the request up to retryMax times.
 * @param ds
 * @param retryDelay
 * @param retryMax
 */

export async function mayRetryDsPreInit(ds: Mds3): Promise<any> {
	if (!ds.preInit) throw `missing ds.preInit{}`
	if (typeof ds.preInit.getStatus != 'function') throw `ds.preInit.getStatus must be a function`
	const retryDelay = ds.preInit.retryDelay || 5000
	const retryMax = ds.preInit.retryMax || 0

	let currentRetry = 0
	try {
		// first try is not on a loop
		const response = await ds.preInit.getStatus()
		if (response?.status !== 'OK') throw response
		return response
	} catch (response: any) {
		// may retry depending on ds.preInit configuration
		if (response.status != 'recoverableError') {
			// should not retry on fatal error
			console.log(`fatal error: ${ds.label} ds.preInit.getStatus()`, response)
			throw new Error('status is not OK: ' + response.message)
		}

		if (retryMax < 1) {
			console.log('35 mayRetryDsPreInit()', response)
			throw new Error('GDC API status error: ' + (response.message || response))
		} else {
			// ok to retry on recoverable error
			console.warn(`First ${ds.label} preInit.getStatus() request failed. (${retryMax} attempts left)`)
			// subsequent retries uses a loop via setInterval
			// NOTE: Using await with recursive function may have memory performance penalties,
			// since a new promise gets created with each recursion and its not clear how
			// garbage collection could affect the loop. By using setInterval, only one promise
			// is created and returned in the loop, which is assumed to lead to easier
			// promise resolution and garbage resolution.
			return new Promise((resolve, reject) => {
				const interval = setInterval(async () => {
					currentRetry++
					console.log(`Retrying GDC status check, attempt #${currentRetry} ...`)
					try {
						const response = (await ds.preInit?.getStatus?.()) || { status: 'OK' }
						if (response.status == 'OK') {
							clearInterval(interval)
							resolve(response)
							return
						} else {
							throw response
						}
					} catch (response) {
						//console.log(89, response)
						console.warn(`GDC status request failed. Retrying... (${retryMax - currentRetry} attempts left)`)
						if (currentRetry >= retryMax) {
							clearInterval(interval)
							console.error('Max GDC API status retry attempts reached. Failing with error:', response)
							if (ds.initErrorCallback) ds.initErrorCallback(response)
							else reject(response)
						}
					}
				}, retryDelay)
			})
		}
	}
}
