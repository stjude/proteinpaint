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

	if (window.location.hash.includes('dslogout')) return
	window.location.reload()
}

function getJwtByDsRoute(dslabel) {
	// jwtByDsRoute is a nested object that's saved to localStorage,
	// so that a user can stay logged-in when opening new tabs.
	// jwtByDsRoute{}
	// .<dslabel>
	//   .<route>: // <'termdb' | 'burden' | '*' | '/**'>
	//     value = jwt
	//
	const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
	const jwtByDsRoute = JSON.parse(jwtByDsRouteStr)
	return dslabel ? jwtByDsRoute[dslabel] : jwtByDsRoute
}

const fakeTokensByDsRole = {}

async function login(dslabel, role = '') {
	if (window.location.hash.includes('dslogout')) {
		logout(dslabel)
		return null
	}
	const jwt = await getJwt(dslabel, role)
	return jwt || undefined
}

async function getJwt(dslabel, _role = 'public') {
	const params = getParams()
	if (!params.role) params.role = _role
	const role = params.role

	if (!fakeTokensByDsRole[dslabel]) {
		fakeTokensByDsRole[dslabel] = {}
	} else if (fakeTokensByDsRole[dslabel][role]) {
		const jwt = fakeTokensByDsRole[dslabel][role]
		const payloadEncoded = jwt.split('.')[1]
		if (payloadEncoded) {
			try {
				const payloadStr = atob(payloadEncoded)
				const payload = JSON.parse(payloadStr)
				return jwt
			} catch (e) {
				console.log(e)
			}
		}
	}

	// The fakeTokens allows simulating valid, signed jwt by dslabel and role.
	// It assumes there is only one protected route entry for each dataset.demoJwtInput{[role]: {...}} entry,
	// and there can be 1 or more entries by role.
	//
	// see https://github.com/stjude/sjpp/wiki/Demo-token-and-auth-testing-for-datasets-with-access-control
	//
	// NOTE: Verified fake tokens will be passed to `setTokenByDsRoute()` in `dofetch()`, to be
	// saved in localStorage 'jwtByDsCredentials' and returned by getJwtByDsRoute() above.
	//

	// !!! NOTE: to clear/refresh the stored fake jwt's, use the logout(dslabel) function above or force the condition below to true !!!
	// otherwise, should reuse saved fake tokens that have not changed in serverconfig.features
	const genome = dslabel === 'ProtectedTest' ? 'hg38-test' : 'hg38'
	const body = JSON.stringify({ genome, dslabel, role })
	const res = await fetch('/demoToken', { method: 'POST', body })
		.then(r => r.json())
		.catch(console.error)
	if (res.error) {
		console.error(res.error)
		return null
	}
	if (!res.fakeTokensByRole) return null
	for (const [role, jwt] of Object.entries(res.fakeTokensByRole)) {
		fakeTokensByDsRole[dslabel][role] = jwt
	}
	return res.fakeTokensByRole[role]
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
