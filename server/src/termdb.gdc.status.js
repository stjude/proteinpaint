import path from 'path'
import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

/**
 * Tests the GDC API status and returns true if the status is OK.
 * If serverconfig.features.runRemainingWithoutAwait is false, it will throw an error if the status is not OK.
 * If serverconfig.features.runRemainingWithoutAwait is true, it will retry the request up to maxRetry times.
 * @param ds
 * @param retryCallback
 * @param maxRetry
 * @returns {Promise<boolean>}
 */
let currentRetry = 0
let retryDelay = 5000 //

export async function testGDCApiStatus(ds, retryCallback = {}, maxRetry = 1000) {
	function retry() {
		if (currentRetry < maxRetry) {
			currentRetry++
			console.warn(`GDC status request failed. Retrying... (${maxRetry - currentRetry} attempts left)`)
			new Promise(resolve => setTimeout(resolve, retryDelay)).then(async () => {
				await retryCallback()
			})
			return false
		} else if (maxRetry > 0) {
			console.error('Max retry attempts reached. Failing with error:', error)
		}
	}

	try {
		const status = await getApiStatus(ds)
		if (status?.status !== 'OK') {
			if (!serverconfig.features.runRemainingWithoutAwait) {
				throw new Error('GDC API status is not OK')
			} else {
				retry()
				return false
			}
		}
		return true
	} catch (error) {
		if (serverconfig.features.runRemainingWithoutAwait) {
			retry()
			return false
		} else {
			throw new Error('failed to get GDC API status: ' + (error.message || error))
		}
	}
}

export async function getApiStatus(ds) {
	const { host, headers } = ds.getHostHeaders()
	try {
		return await ky(path.join(host.rest, 'status'), { headers }).json()
	} catch (error) {
		throw error
	}
}
