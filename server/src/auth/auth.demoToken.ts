import jsonwebtoken from 'jsonwebtoken'

export type DemoToken = {
	/** These are the roles that are allowed to get demo tokens,
	 the payload will be based on the dataset's demoJwtInputs{} */
	roles: string[]
	/** These are the strings to be matched against express req.headers.referer.
	 If matched, the demo token will be generated, otherwise it will be an error. 
	 TODO: may migrate to {[role: string]: string[]}, so that each role can have its
	 own obscure URL to use for testing, for example a non-admin will not be able to
	 preview/test the admin role with live data.*/
	referers: string[]
	/** These */
	secret?: string
}

//export const demoTokens: DemoToken[] = []

export function addCred(cred, dslabel) {
	// it's safe to not throw and block server startup on any of the errors below;
	// an invalid cred.demoToken means demo tokens will not be issued
	if (typeof cred.demoToken != 'object') {
		delete cred.demoToken
		console.warn(`(!) ${dslabel} cred.demoToken must be an object`)
	} else {
		// The demoToken secret should be different from the embedder's signing secret,
		// to make it simpler to invalidate demoToken and derived session tokens without
		// having to coordinate with the embedder portal maintainers. However, for now,
		// support reusing the embedder's secret for the demo token to minimize testing
		// issues in internal test sites.
		// prettier-ignore
		if (typeof cred.demoToken.secret != 'string') { // pragma: allowlist secret
			cred.demoToken.secret = cred.secret
			// delete cred.demoToken.secret
			// demoToken.secret cannot be randomly generated per server instance, 
			// since this PP server may be in a server farm that has to accept each other's issued jwt
			// console.warn(`(!) invalid ${dslabel} demoToken.secret, will not issue`)
		}
		if (!Array.isArray(cred.demoToken.roles)) {
			cred.demoToken.roles = [] // an empty roles array means no matching demoJwtInput role will be found
			console.warn(`(!) ${dslabel} demoToken.roles forced into an empty array`)
		}
		if (!Array.isArray(cred.demoToken.referers)) {
			cred.demoToken.referers = [] // an empty referers array means a req.headers.referer will not be matched
			console.warn(`(!) ${dslabel} demoToken.referers forced into an empty array`)
		}
		// this will track and reuse issued JWT's that are not close to expiring
		// key: role (public, user, admin, etc) as allowed in cred.demoTokens.roles[]
		// value: {
		//  jwt,
		//  exp: expiration time in milliseconds
		// }
		cred.demoToken.computedByRole = {}
	}
}

export function getApplicableSecret(headers, cred, rawToken) {
	if (rawToken) {
		const unverifiedPayload = typeof rawToken == 'object' ? rawToken : jsonwebtoken.decode(rawToken)
		if (!unverifiedPayload) return { secret: cred.secret, processor: {} }
		const { dslabel, embedder, route } = unverifiedPayload || {}
		if (dslabel && embedder && route) return { secret: cred.secret, processor: {} }
	}
	const referer = headers.referer || ''
	const secret = cred.demoToken?.referers.find(str => referer.includes(str)) ? cred.demoToken.secret : cred.secret
	return { secret, processor: cred.processor || {} }
}
