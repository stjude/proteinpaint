import { select } from 'd3-selection'

const fakeWindows = {}

export function getWindow(name, opts = {}) {
	if (name in fakeWindows) return fakeWindows[name]

	fakeWindows[name] = {
		localStorage: getStorage(),
		sessionStorage: getStorage(),
		location: {
			href: '',
			protocol: '',
			host: '',
			port: '',
			pathname: '',
			search: '',
			hash: ''
		}
	}

	if (opts.location) {
		const loc = fakeWindows[name].location
		Object.assign(loc, opts.location)
		if (opts.location.href) {
			const [protocol, rest1] = opts.location.href.split('://')
			if (!loc.protocol) loc.protocol = protocol

			const [host, rest2] = rest1.split('/')
			const [hostname, port] = host.split(':')
			if (!loc.hostname) loc.hostname = hostname
			if (port && !loc.port) loc.port = port

			if (rest2) {
				const [pathname, rest3] = rest2.split('?')
				if (pathname && !loc.pathname) loc.pathname = pathname

				if (rest3) {
					const [search, hash] = rest3.split('#')
					if (search && !loc.search) loc.search = '?' + search
					if (hash && !loc.hash) loc.hash = '#' + hash
				}
			}
		}
	}

	return fakeWindows[name]
}

function getStorage(obj = {}) {
	const store = {
		length: 0,
		getItem(key) {
			return obj[key]
		},
		setItem(key, data) {
			obj[key] = data
			store.length += 1
		},
		removeItem(key) {
			delete obj[key]
			store.length += -1
		},
		clear() {
			for (const key in obj) {
				delete obj[key]
			}
			store.length = 0
		}
	}
	return store
}
