import type { FetchHostpathOptions, FetchOptionsByHostpath } from '#types'

/*
The xfetch() options for a url substring, such as a host or a host and path, which a dataset sets as
ds.fetchOptionsByHostpath and mds3.init registers with setHostpathOptions() before its first request.
A server may load several datasets that request different APIs, so an option such as the network error
message applies only to the requests to its hostpath. A url that matches no registered hostpath uses the
xfetch() defaults.
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
		const registered = optionsByHostpath.get(hostpath)
		if (registered && registered.owner != owner) throw `${label} is already registered by ${registered.owner}`
	}

	const entries = [...optionsByHostpath].filter(([, r]) => r.owner != owner)
	for (const [hostpath, options] of Object.entries(byHostpath)) entries.push([hostpath, { owner, options }])
	optionsByHostpath = new Map(entries.sort((a, b) => b[0].length - a[0].length))
}

export function getHostpathOptions(url: string): FetchHostpathOptions | undefined {
	for (const [hostpath, { options }] of optionsByHostpath) {
		if (String(url).includes(hostpath)) return options
	}
	return undefined
}

// for tests only
export function clearHostpathOptions() {
	optionsByHostpath = new Map()
}
