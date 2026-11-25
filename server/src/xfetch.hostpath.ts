import type { FetchHostpathOptions, FetchOptionsByHostpath, FetchRetry } from '#types'

/*
The xfetch() options for a url substring, such as a host or a host and path, which a dataset sets as
ds.fetchOptionsByHostpath and mds3.init registers with setHostpathOptions() before its first request.
A server may load several datasets that request different APIs, so an option such as the network error
message or the retry option applies only to the requests to its hostpath. A url that matches no registered
hostpath uses the xfetch() defaults, such as the ky retry defaults. A retry option is used as given, so it may
have functions such as delay(), jitter() or shouldRetry().
*/

// hostpath -> { owner, options }, with the longest hostpath first, so that the options of a host and path
// apply before the options of only its host
let optionsByHostpath: Map<string, { owner: string; options: FetchHostpathOptions }> = new Map()

/* register the options of an owner, such as a genome name and dataset label; a hostpath that another owner registered throws,
so that a dataset cannot change the options of another dataset's requests, and an owner that registers again,
such as after a dataset init retry, replaces its own options */
export function setHostpathOptions(byHostpath: FetchOptionsByHostpath, owner: string) {
	if (!byHostpath || typeof byHostpath != 'object' || Array.isArray(byHostpath))
		throw `${owner} fetchOptionsByHostpath must be an object`
	for (const [hostpath, options] of Object.entries(byHostpath)) {
		const label = `${owner} fetchOptionsByHostpath['${hostpath}']`
		if (!hostpath) throw `${owner} fetchOptionsByHostpath has an empty hostpath`
		if (!options || typeof options != 'object' || Array.isArray(options)) throw `${label} must be an object`
		const { networkErrorMessage } = options
		if (networkErrorMessage !== undefined && (typeof networkErrorMessage != 'string' || !networkErrorMessage.trim()))
			throw `${label}.networkErrorMessage must be a non-blank string`
		const { retry } = options
		if (retry !== undefined && (!retry || typeof retry != 'object' || Array.isArray(retry)))
			throw `${label}.retry must be an object`
		if (
			retry?.methods !== undefined &&
			(!Array.isArray(retry.methods) || retry.methods.some(m => typeof m != 'string'))
		)
			throw `${label}.retry.methods must be an array of method names`
		const registered = optionsByHostpath.get(hostpath)
		if (registered && registered.owner != owner) throw `${label} is already registered by ${registered.owner}`
	}

	const entries = [...optionsByHostpath].filter(([, r]) => r.owner != owner)
	for (const [hostpath, options] of Object.entries(byHostpath)) {
		// ky compares the request method in lowercase
		const methods = options.retry?.methods?.map(m => m.toLowerCase())
		const copy = options.retry
			? { ...options, retry: methods ? { ...options.retry, methods } : options.retry }
			: options
		entries.push([hostpath, { owner, options: copy }])
	}
	optionsByHostpath = new Map(entries.sort((a, b) => b[0].length - a[0].length))
}

export function getHostpathOptions(url: string): FetchHostpathOptions | undefined {
	for (const [hostpath, { options }] of optionsByHostpath) {
		if (String(url).includes(hostpath)) return options
	}
	return undefined
}

// the retry option of the longest matching hostpath, or undefined for the ky defaults
export function getRetry(url: string): FetchRetry | undefined {
	const retry = getHostpathOptions(url)?.retry
	// a shallow copy, since ky reassigns retry.methods in the object it is given; the functions are still shared
	return retry ? { ...retry } : undefined
}

// for tests only
export function clearHostpathOptions() {
	optionsByHostpath = new Map()
}
