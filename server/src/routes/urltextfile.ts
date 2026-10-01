import type { RouteApi } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

// the server fetches a url given in the request, so the route is only set up when remote files are allowed,
// see utils.fileurl()
export const isDisabled = !serverconfig.features?.ALLOW_remotefilefromurl

export const api: RouteApi = {
	// fetches a text file from a url
	endpoint: 'urltextfile',
	methods: {
		post: {
			init: isDisabled ? null : () => handle_urltextfile,
			request: { typeId: 'UrltextfileRequest' },
			response: { typeId: 'UrltextfileResponse' }
		}
	}
}

// redirects of a /urltextfile url that are followed by handle_urltextfile(), see there
const MAX_URLTEXTFILE_REDIRECTS = 5
// only these statuses are redirects, as in fetch(); another 3xx, such as 300 or 304, is returned as an error
const URLTEXTFILE_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/*
	fetch a text file from req.query.url and return its text

	the url is fetched by this server and the response is returned to the requester, so the url and the
	destination of each redirect must pass utils.checkRemoteUrl(), and utils.requestRemoteUrl() rejects a
	hostname that resolves to a non-public address; otherwise a request could read from the internal network
	of the server (SSRF)

	a url that starts with serverconfig.URL, the public url of this server, is fetched from the loopback
	address instead. This fixed a loopback request issue on prp1, where https links were not properly
	downgrading to http. A relative redirect is resolved against the public url, not the loopback url,
	and then rewritten again.
*/
export async function handle_urltextfile(req, res) {
	const url = req.query.url
	try {
		let [e, fetchUrl] = urltextfileFetchUrl(url)
		if (e) return res.send({ error: 'invalid url: ' + e })
		let publicUrl = url
		let response
		for (let redirects = 0; ; redirects++) {
			response = await utils.requestRemoteUrl(fetchUrl)
			if (!URLTEXTFILE_REDIRECT_STATUSES.has(response.statusCode)) break
			const location = response.headers.location
			// destroy, not resume(), since draining would keep reading a body that the server may trickle endlessly
			response.destroy()
			if (!location) break
			if (redirects >= MAX_URLTEXTFILE_REDIRECTS) return res.send({ error: 'url has too many redirects' })
			publicUrl = new URL(location, publicUrl).href
			;[e, fetchUrl] = urltextfileFetchUrl(publicUrl)
			if (e) return res.send({ error: 'invalid url redirect: ' + e })
		}
		switch (response.statusCode) {
			case 200:
				res.send({ text: utils.stripJsScript(await utils.readResponseText(response)) })
				return
			case 404:
				response.destroy()
				res.send({ error: 'File not found: ' + url })
				return
			default:
				response.destroy()
				res.send({ error: 'unknown status code: ' + response.statusCode })
		}
	} catch (e: any) {
		if (e.code == 'ENOTPUBLIC') return res.send({ error: 'invalid url: ' + e.message })
		return res.send({ error: 'Error downloading file: ' + url })
	}
}

/*
	returns [error] if url must not be fetched, or [null, url to fetch]; the url is validated before
	a url of this server is rewritten to the loopback address
*/
function urltextfileFetchUrl(url) {
	const loopbackUrl = selfLoopbackUrl(url)
	const e = utils.checkRemoteUrl(url, !!loopbackUrl)
	if (e) return [e]
	return [null, loopbackUrl || url]
}

/*
	returns the loopback url for a url of this server, or undefined if url is not under serverconfig.URL;
	only an exact prefix match that is followed by a path, query, or nothing is rewritten, so that a url
	like https://pp.org.evil.com or https://pp.org@evil.com is not treated as this server
*/
function selfLoopbackUrl(url) {
	const self = serverconfig.URL
	if (!self || typeof url != 'string' || !url.startsWith(self)) return
	const rest = url.slice(self.length)
	if (rest && rest[0] != '/' && rest[0] != '?') return
	// the rest must not change the host once it is appended to the loopback origin
	const loopback = `http://127.0.0.1:${serverconfig.port}`
	const rewritten = loopback + rest
	try {
		if (new URL(rewritten).origin != new URL(loopback).origin) return
	} catch (_) {
		return
	}
	return rewritten
}
