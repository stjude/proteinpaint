async function logout(dslabel) {
	const body = JSON.stringify({ dslabel, route: 'termdb' })
	await fetch(`/dslogout`, { method: 'POST', body })
		.then(r => r.json())
		.then(console.log)
		.catch(console.error)
}

async function login(dataset) {
	const jwt = await getJwt(dataset)
	if (!jwt) return
	return jwt
}

async function getJwt(dataset) {
	const params = getParams()
	if (!params.role) params.role = 'public'

	let jwt = JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}').fakeTokens?.[dataset]?.[params.role] //; console.log(params.role, jwt)
	// !!! NOTE: to clear/refresh the stored fake jwt's, force this condition to true !!!
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
