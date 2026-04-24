// serverconfig.dsCredentials
//
// DsCredentials = {

// 	// NOTES:
// 	// 1. list keys in the desired matching order, for example, the catch-all '*' pattern should be entered last
// 	// 2. glob pattern: '*', '!', etc

// 	// the dslabel can be a glob pattern, to find any matching dslabel
// 	[dslabel: string]: {
// 		// the hostName can be a glob pattern, to find any matching embedder host name
// 		[serverRoute: string]: {
// 			// serverRoute can be a glob pattern, to find any matching server route name/path
// 			[hostName: string]:
//         { type: 'basic', password: '...'} |
//         {
//            type: 'jwt',
//            secret: string,
//            // optional list of cohort(s) that a user must have access to,
//            // to be matched against the jwt payload as signed by the embedder
//            dsnames?: [{id, label}],
//            demoToken?: {
//              roles: string[],
//              referers: string[]
//            }
//         } |
//         // TODO: support other credential types
// 		}
// 	}
// }

// Examples:

// dsCredentials: {
// 	SJLife: {
// 		termdb: {
// 			'viz.stjude.cloud': {
//         type: 'jwt',
//         secret: "something",  // pragma: allowlist secret
//         demoToken: {
//           roles: ['user', 'admin'],
//           referers: ['/some-path?param=value', 'obscure=randomString']
//         }
//      }
// 		},
// 		burden: {
// 			'*': 'burdenDemo'
// 		}
// 	},
// 	PNET: {
// 		'*': { // equivalent to /**/*
// 			'*': {
//         type: 'basic',
//         password: '...'
//      }
// 		}
// 	},
//
//  NOTE: if none of the above patterns were matched against the current request,
// 	then any credential with wildcards may be applied instead,
// 	but only if these 'default' protections are specified as a dsCredential (sub)entry
// 	'*': { // apply the following creds to all datasets
// 		'*': { // apply the following creds for all server routes
// 			'*': 'defaultCred'
// 		}
// 	}
// }

export async function validateDsCredentials(creds) {
	mayReshapeDsCredentials(creds)
	const key = 'secrets' // to prevent a detect-secrets hook issue
	if (typeof creds[key] == 'string') {
		throw `serverconfig {dsCredentials: {${key}: <string>}} has been deprecated. Use {dsCredentials: <abs filepath string>} instead.`
	}

	// track which domains are allowed to embed proteinpaint with credentials,
	// to be used by app middleware to set CORS response headers
	const credEmbedders: Set<string> = new Set()

	for (const dslabel in creds) {
		if (dslabel[0] == '#') continue
		const ds = creds[dslabel]
		if (ds['*']) {
			ds['/**'] = ds['*']
			delete ds['*']
		}
		const headerKey = ds.headerKey || 'x-ds-access-token'
		delete ds.headerKey

		for (const serverRoute in ds) {
			const route = ds[serverRoute]
			for (const embedderHost in route) {
				credEmbedders.add(embedderHost)

				// create a copy from the original in case it's shared across different dslabels/routes/embedders,
				// since additional properties may be added to the object that is specific to a dslabel/route/embedder
				route[embedderHost] = JSON.parse(JSON.stringify(route[embedderHost]))
				const cred = route[embedderHost]
				if (typeof cred == 'string')
					throw (
						`serverconfig {dsCredentials[dslabel][serverRoute][embedderHost]: <string>} has been deprecated. ` +
						`Instead, use {dsCredentials: <abs filepath string>} where the filepath points to a pre-built json file.`
					)
				// copy the server route pattern to easily obtain it from within the cred
				if (cred.type == 'basic') {
					if (!cred.secret) cred.secret = cred.password
					cred.authRoute = '/dslogin'
					// after a successful login, a session jwt is generated which requires a custom headerKey
					if (!cred.headerKey) cred.headerKey = headerKey
					// NOTE: an empty password will be considered as forbidden
					//if (!cred.password)
					//throw `missing password for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
				} else if (cred.type == 'jwt') {
					cred.authRoute = '/jwt-status'
					// NOTE: an empty secret will be considered as forbidden
					//if (!cred.secret)
					//throw `missing secret for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}], type: '${cred.type}'`
					// TODO: this headerKey should be unique to a dslabel + route, to avoid conflicts
					if (!cred.headerKey) cred.headerKey = headerKey
					if (cred.processor) cred.processor = (await import(cred.processor))?.default
				} else if (cred.type != 'forbidden' && cred.type != 'open') {
					throw `unknown cred.type='${cred.type}' for dsCredentials[${dslabel}][${embedderHost}][${serverRoute}]`
				}
				cred.dslabel = dslabel
				cred.route = serverRoute
				cred.cookieId = (serverRoute == 'termdb' && cred.headerKey) || `${dslabel}-${serverRoute}-${embedderHost}-Id`

				if (cred.looseIpCheck) {
					// convert to cred.ipCheck property, see checkIPaddress() function below for logic
					cred.ipCheck = 'loose'
					delete cred.looseIpCheck
				}

				if (cred.demoToken) {
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
			}
		}
	}

	return credEmbedders
}

function mayReshapeDsCredentials(creds) {
	// reshape legacy
	for (const dslabel in creds) {
		const cred = creds[dslabel]
		if (cred.type == 'login') {
			if (cred.embedders) throw `unexpected 'embedders' property`
			// known format where type: 'login' does not have the jwt-type properties below
			// apply to all routes and embedders
			cred['*'] = {
				'*': {
					type: 'basic',
					password: cred.password,
					secret: cred.secret
				}
			}
			delete cred.type
			delete cred.password
		} else if (cred.type == 'jwt') {
			// known format where type: 'jwt' does not have the login properties above
			for (const hostName in cred.embedders) {
				cred.termdb = {
					[hostName]: Object.assign({ type: cred.type }, cred.embedders[hostName])
				}
				if (cred.headerKey) {
					cred.termdb[hostName].headerKey = cred.headerKey
				}
			}
			delete cred.type
			delete cred.embedders
			delete cred.headerKey
		} else if (cred.type) {
			throw `unknown legacy credentials type='${cred.type}'`
		}
	}
}
