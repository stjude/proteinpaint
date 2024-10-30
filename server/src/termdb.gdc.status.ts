import serverconfig from '#src/serverconfig.js'
import type { Mds3 } from '#types'

/**
 * Tests the GDC API status and returns true if the status is OK.
 * If serverconfig.features.runRemainingWithoutAwait is false, it will throw an error if the status is not OK.
 * If serverconfig.features.runRemainingWithoutAwait is true, it will retry the request up to maxRetry times.
 * @param ds
 * @param retryDelay
 * @param maxRetry
 */

export async function retryApiStatus(ds: Mds3, retryDelay = 5000, maxRetry = 1000): Promise<any> {
	if (!ds.getStatus) return { status: 'OK' }
	let currentRetry = 0
	try {
		// first try is not on a loop
		const response = await ds.getStatus(ds)
		if (response?.status !== 'OK') {
			console.log(`gdc api /status:`, response)
			throw new Error('status is not OK')
		}
		return response
	} catch (error: any) {
		if (!serverconfig.features.runRemainingWithoutAwait) {
			throw new Error('GDC API status error: ' + (error.message || error))
		} else {
			console.warn(`First GDC status request failed. (${maxRetry} attempts left)`)
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
						const response = (await ds.getStatus?.()) || { status: 'OK' }
						if (response.status == 'OK') {
							clearInterval(interval)
							resolve(response)
							return
						} else {
							throw response
						}
					} catch (response) {
						//console.log(89, response)
						console.warn(`GDC status request failed. Retrying... (${maxRetry - currentRetry} attempts left)`)
						if (currentRetry >= maxRetry) {
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
