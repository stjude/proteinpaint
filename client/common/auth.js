import { select } from 'd3-selection'

const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
const jwtByDsRoute = JSON.parse(jwtByDsRouteStr)

/*
	setTokenByDsRoute() sets this storage item:

	jwtByDsRoute = {
		[dslabel]: { // the dataset that is being protected, should match one of the serverconfig.dsCredentials key
			[route]:   // the route that is being protected, should match one of the serverconfig.dsCredentials[dslabel] key
				"...jwt...string..." // ProteinPaint-issued jwt from a `/jwt-status` or `/dslogin` response, 
				                     // which also includes dslabel and route to use as nested keys for this jwtByDsRoute
		}
	}
	
	Note that jwtByDsRoute does not have a nesting level of embedder, unlike serverconfig.dsCredentials, since
	the embedder is detected directly from the winddow.location.hostname.

	The stored token will be submitted as part of Vocab.mayGetAuthHeaders() or getSavedToken().
*/
export function setTokenByDsRoute(dslabel, route, jwt) {
	if (!jwtByDsRoute[dslabel]) jwtByDsRoute[dslabel] = {}
	if (jwt) jwtByDsRoute[dslabel][route] = jwt
	else delete jwtByDsRoute[dslabel][route]
	localStorage.setItem('jwtByDsRoute', JSON.stringify(jwtByDsRoute))
}

// get jwt string directly from localStorage/jwtByDsRoute tracking object
export function getSavedToken(dslabel, route) {
	return jwtByDsRoute[dslabel]?.[route] || jwtByDsRoute[dslabel]?.['/**']
}

export function mayAddJwtToRequest(init, body, url) {
	if (init.headers.authorization) return
	let dslabel = body?.dslabel // || body.mass?.vocab.dslabel || body.tracks?.find(t => t.dslabel)?.dslabel
	if (!dslabel) {
		const param = url
			.split('?')[1]
			?.split('&')
			.find(kv => kv.includes('dslabel'))
		if (!param) return
		let value = decodeURIComponent(param.split('=')[1])
		if (value.startsWith('{') && value.endsWith('}')) {
			value = JSON.parse(value)
			dslabel = value.dslabel || value.mass?.vocab.dslabel || value.tracks?.find(t => t.dslabel)?.dslabel
		} else {
			dslabel = value
		}
	}
	if (!dslabel || !jwtByDsRoute[dslabel]) return
	const h = url.split('//')
	const postProtocolStr = h[1] || h[0] // handle a url such as '://something.abc'
	const preQuestionMarkStr = postProtocolStr.split('?')[0]
	const pathSegments = preQuestionMarkStr.split('/')
	let route = pathSegments.find(p => p != '' && !p.includes(':') && !p.includes('.'))
	// TODO: should not have to do this hardcoded mapping, ideally routes that are
	//       protected together will share the same initial path segment

	const jwt = jwtByDsRoute[dslabel][route] || jwtByDsRoute[dslabel]['/**']
	if (jwt) init.headers.authorization = 'Bearer ' + btoa(jwt)
}

const dsAuthOk = new Set()
let dsAuth, authUi, authUiHolder

export let includeEmbedder = false

/*
	opts{}
	.dsAuth: required, array of dataset names that require login
	.authUi: optional, a custom login UI function to launch as needed
	.holder: optional, a d3-wrapped selection to hold the auth UI
*/
export async function setDsAuthOk(opts, dofetch3) {
	dsAuth = opts.dsAuth
	authUi = opts.ui || defaultAuthUi
	authUiHolder = opts.holder || select('body')
	for (const auth of dsAuth) {
		// fillin all the dslabels that has an active session
		// so that an unnecessary login form will not be shown
		if (auth.insession) dsAuthOk.add(auth)
		else {
			// check if there is a PP-server generated session token that has been saved from a previous login
			const { dslabel, route } = auth
			const jwt = getSavedToken(dslabel, route)
			if (jwt) {
				const payload = JSON.parse(atob(jwt.split('.')[1]))
				if (payload.exp && Math.ceil(Date.now() / 1000) > payload.exp) continue
				const data = await dofetch3('/jwt-status', {
					method: 'POST',
					headers: {
						//authorization: `Bearer ${btoa(jwt)}`
						[auth.headerKey]: jwt
					},
					body: {
						dslabel,
						route,
						embedder: location.hostname
					}
				})
				if (data.ok || data.status == 'ok') {
					dsAuthOk.add(auth)
					auth.insession = true
				}
			}
		}
	}
	includeEmbedder = opts.dsAuth?.length > 0 || false
}

export function getRequiredAuth(dslabel, route) {
	if (!dsAuth || !Array.isArray(dsAuth)) return
	for (const a of dsAuth) {
		// wildcard route '*' is transformed by server auth.js into '/**' to support glob-pattern matching,
		// since a single character '*' is interpreted by glob as a file, so need to also detect '/**' route
		if (a.dslabel == dslabel && (a.route == route || a.route == '*' || a.route == '/**')) return a
	}
}

// check if a user is logged in, usually checked together with requiredAuth in termdb/config,
// so access to unprotected ds/routes should not be affected by this check
export function isInSession(dslabel, route) {
	if (!dslabel) return false
	for (const a of dsAuthOk) {
		if (a.dslabel == dslabel && (a.route == route || a.route == '/**')) return true
	}
	// no matching sessions found for this dslabel and route
	return false
}

/* 
	mayShowAuthUi() is the client-side "gatekeeper"
	method to check if a dataset requires credentials
*/

export async function mayShowAuthUi(init, path, opts = {}) {
	const ok = { status: 'ok' }
	if (!dsAuth || path.endsWith('jwt-status')) return ok

	const body = JSON.parse(init.body || `{}`)
	const params = (path.split('?')[1] || '').split('&').reduce((obj, kv) => {
		const [key, value] = kv.split('=')
		obj[key] = value
		return obj
	}, {})
	const q = Object.assign({}, body, params)
	const route = ((path.split('?')[0] || '').split('//')[1] || '').split('/').slice(1).join('/')

	for (const a of dsAuth) {
		if (q.dslabel == a.dslabel && (a.route == '/**' || route == a.route)) {
			if (dsAuthOk.has(a)) return ok
			// dofetch should show the authUi only when all routes ('/**') are protected
			// otherwise, the authUi should be opened only when requesting data from a protected route,
			// that will be determined within feature code such as for 'termdb', 'burden', etc
			else if (a.route != '/**') return ok
			else if (a.type == 'basic') return await authUi(a.dslabel, a, opts)
			else if (a.type == 'jwt') {
				// assume the embedder/portal provides the login UI
				// so no need to do anything here
			} else if (a.type == 'forbidden') {
				alert('Forbidden access')
				// don't do anything
			} else throw `unsupported dsAuth type='${a.type}'`
		}
	}
	return ok
}

/*
	this is the default login UI, may be overriden
	by an optional different form, for example if PP 
	is embedded in another portal
*/
async function defaultAuthUi(dslabel, auth, opts = {}) {
	const mask = authUiHolder
		.append('div')
		.style('position', 'fixed')
		.style('top', 0)
		.style('left', 0)
		.style('height', '100%')
		.style('width', '100%')
		.style('margin', 0)
		.style('padding', '20px')
		.style('background-color', 'rgb(150,150,150)')

	const form = mask.append('div').style('opacity', 1)
	form.append('div').html(`Restricted dataset '${dslabel}'`)
	form.append('span').html('Please enter password ')

	const pwd = form.append('input').attr('type', 'password')
	pwd.node().focus()

	const btn = form.append('button').html('Submit')

	return new Promise((resolve, reject) => {
		function login() {
			fetch('/dslogin', {
				method: 'POST',
				headers: {
					authorization: `Basic ${btoa(pwd.property('value'))}`
				},
				body: JSON.stringify({ dslabel, route: auth.route, embedder: window.location.hostname })
			})
				.then(res => res.json())
				.then(res => {
					if (res.error) throw res.error

					mask.remove()
					dsAuthOk.add(auth)
					if (res.jwt) {
						setTokenByDsRoute(dslabel, res.route, res.jwt)
					}
					if (!opts.setDomRefs) window.location.reload()
					else resolve(dslabel)
				})
				.catch(e => {
					alert('login error: ' + e)
					// allow to reuse the login UI, do not hide or reject
					// mask.remove()
					// reject(e)
				})
		}
		btn.on('click', login)
		pwd.on('change', login)

		if (opts.setDomRefs)
			opts.setDomRefs({
				pwd,
				btn,
				mask,
				authUiHolder
			})
	})
}
