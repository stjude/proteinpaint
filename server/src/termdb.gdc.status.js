import path from 'path'
import ky from 'ky'
import serverconfig from '#src/serverconfig.js'

/**
 * Tests the GDC API status and returns true if the status is OK.
 * If serverconfig.features.runRemainingWithoutAwait is false, it will throw an error if the status is not OK.
 * @param ds
 * @returns {Promise<boolean>}
 */
export async function testGDCApiStatus(ds) {
	try {
		const status = await getApiStatus(ds, 4)
		if (status?.status !== 'OK') {
			if (!serverconfig.features.runRemainingWithoutAwait) {
				throw new Error('GDC API status is not OK')
			} else {
				return false
			}
		}
	} catch (error) {
		if (serverconfig.features.runRemainingWithoutAwait) {
			return false
		} else {
			throw new Error('failed to get GDC API status: ' + (error.message || error))
		}
	}
	return true
}

export async function getApiStatus(ds, retry = 0, retryDelay = 1000) {
	const { host, headers } = ds.getHostHeaders()
	try {
		return await ky(path.join(host.rest, 'status'), { headers }).json()
	} catch (error) {
		if (retry > 0) {
			console.warn(`GDC status request failed. Retrying... (${retry} attempts left)`)
			await new Promise(resolve => setTimeout(resolve, retryDelay)) // Delay before retry
			return getApiStatus(ds, retry - 1, retryDelay)
		} else {
			console.error('Max retry attempts reached. Failing with error:', error)
			throw error
		}
	}
}
