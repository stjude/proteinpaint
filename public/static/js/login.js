async function logout(dslabel, route = 'termdb') {
	const jwtByDsRoute = getJwtByDsRoute()
	if (jwtByDsRoute[dslabel]?.[route]) {
		// Deleting this entry means there will be no dofetch() request header.Authorization
		// that the backend may use to reestablish user sessions that have expired
		delete jwtByDsRoute[dslabel][route]
		localStorage.setItem('jwtByDsRoute', JSON.stringify(jwtByDsRoute))
	}

	const body = JSON.stringify({ dslabel, route })
	// this will clear any active user session in the backend
	await fetch(`/dslogout`, { method: 'POST', body })
		.then(r => r.json())
		.then(console.log)
		.catch(console.error)

	window.location.reload()
}

function getJwtByDsRoute() {
	// jwtByDsRoute is a nested object that's saved to localStorage,
	// so that a user can stay logged-in when opening new tabs.
	// jwtByDsRoute{}
	// .<dslabel>
	//   .<route>: // <'termdb' | 'burden' | '*' | '/**'>
	//     value = jwt
	//
	const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
	return JSON.parse(jwtByDsRouteStr)
}

async function login(dataset, role = 'public') {
	const jwt = await getJwt(dataset, role)
	if (!jwt) return
	return jwt
}

async function getJwt(dataset, role) {
	const params = getParams()
	if (!params.role) params.role = role

	// The fakeTokens allows simulating valid, signed jwt by dataset and role.
	// It assumes there is only one protected route entry for serverconfig.features.fakeTokens[<dslabel>],
	// and there can be 1 or more role:jwt key-values nested under it.
	//
	// NOTE: Verified fake tokens will be passed to `setTokenByDsRoute()` in `dofetch()`, to be
	// saved in localStorage 'jwtByDsCredentials' and returned by getJwtByDsRoute() above.
	//
	let jwt = JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}').fakeTokens?.[dataset]?.[params.role] //; console.log(params.role, jwt)
	// !!! NOTE: to clear/refresh the stored fake jwt's, use the dslogout() function above or force the condition below to true !!!
	// otherwise, should reuse saved fake tokens that have not changed in serverconfig.features
	if (!jwt) {
		await fetch(`/genomes`, {})
			.then(r => r.json())
			.then(async data => {
				if (data.features) {
					sessionStorage.setItem('optionalFeatures', JSON.stringify(data.features))
					jwt = data.features.fakeTokens?.[dataset]?.[params.role]
				}
			})
			.catch(console.error)
	}

	return jwt
}

// URL search params can be used to trigger user roles or other behaviour
function getParams() {
	const params = {}
	if (!window.location.search.length) return params
	window.location.search
		.substr(1)
		.split('&')
		.forEach(kv => {
			const [key, value] = kv.split('=')
			params[key] = value
		})
	return params
}
