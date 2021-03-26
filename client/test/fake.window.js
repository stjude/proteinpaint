import { select } from 'd3-selection'

const fakeWindows = {}

/*
	Simulate a browser window, in order to avoid
	conflicts when testing URL path/route-based
	component tests, where changing the actual 
	browser window's URL or storage items 
	during a test will affect unrelated test specs 
	that also use the URL or storage items
*/
export function getWindow(name, opts = {}) {
	if (name in fakeWindows) return fakeWindows[name]

	const fwin = {
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
		},
		history: {
			replaceState(a, b, c) {
				const [pathname, params] = c.split('?')
				fwin.location.pathname = pathname
				fwin.location.search = '?' + params
				fwin.dom.addressbar.property('value', c)
			}
		},
		dom: {
			body: select('body').append('div')
		}
	}

	fwin.dom.addressbar = fwin.dom.body
		.append('input')
		.style('width', '80%')
		.style('margin', '20px 10px')
		.style('background', '#ececec')
		.on('change', () => {
			const [pathname, params] = fwin.dom.addressbar.property('value').split('?')
			fwin.location.pathname = pathname
			fwin.location.search = '?' + params
			if (typeof opts.addressCallback == 'function') opts.addressCallback()
		})
	fwin.dom.holder = fwin.dom.body.append('div')

	if (opts.location) {
		const loc = fwin.location
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

	fwin.dom.addressbar.property('value', fwin.location.pathname + fwin.location.search + fwin.location.hash)
	fakeWindows[name] = fwin
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
