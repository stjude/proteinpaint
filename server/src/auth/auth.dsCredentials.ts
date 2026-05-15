import { addDemoTokenCred } from './auth.demoToken.ts'
import mm from 'micromatch'

const { isMatch } = mm

// NOTES:
// 1. list keys in the desired matching order, for example, the catch-all '*' pattern should be entered last
// 2. glob pattern: '*', '!', etc

export type ServerConfigDsCredentials = {
	[dslabelPattern: string]: {
		/** 
		routePattern could be one of the following: 
		  'termdb': A public view will be allowed by default for aggregated data, even without a jwt submitted
		            in the request header. Sample-level data will be hidden by default, unless the user is logged-in
		            or some dataset options are set to allow samples IDs to be displayed or specific charts to be shown.

		            For example, aggregated data for barchart or regression may be rendered,
		            but not sample-level data such as labeled matrix or scatter plots - these can be displayed
                if the samples are not labeled or if the dataset's isSupportedChartOverride() option allows
                these charts to be displayed. 

      '*' | '/**': no public view is allowed, termdb plots will always require a jwt to be issued

      'burden': specific to the personalized cumulative burden app

      todo: may support other route patterns as needed
		*/
		[routePattern: string]: {
			[embedderPattern: string]: BasicCredEntry | JwtCredEntry
		}
	}
}

type BasicCredEntry = {
	type: 'basic' // as-in Basic authorization in HTTP request header
	secret?: string
	password?: string // legacy, will be converted to secret
}

type JwtCredEntry = {
	type: 'jwt'
	secret: string
	// optional list of cohort(s) that a user must have access to,
	// to be matched against the jwt payload as signed by the embedder
	// TODO: should make dsnames legacy and migrate to cohort
	dsnames?: { id: string; label: string }[]
	/** see https://github.com/stjude/sjpp/wiki/Demo-token-and-auth-testing-for-datasets-with-access-control */
	demoToken?: {
		/** the roles is dataset demoJwtInput that are allowed in this server instance */
		roles: string[]
		/** the URL paths and/or param substring that are allowed to make a /demoToken request */
		referers: string[]
	}
}

// Examples:

// dsCredentials: {
// 	SJLife: {
// 		termdb: {
// 			'viz.stjude.cloud': { // this exact embedder will be allowed since there is no wildcard pattern
//         type: 'jwt',
//         secret: "something",  // pragma: allowlist secret
//         demoToken: {
//           roles: ['user', 'admin'],
//           referers: ['/some-path?param=value', 'obscure=randomString']
//         }
//      }
// 		},
// 		burden: {
// 			'*': {
//         		type: 'basic',
//         		password: '...'
//      	}
// 		}
// 	},
// 	PNET: {
// 		'*': { // equivalent to /** for a route path, all routes will be protected
// 			'*': { // any embedder
//         	type: 'basic',
//        	 password: '...'
//      	}
// 		}
// 	},
//
//  NOTE: if none of the above patterns were matched against the current request,
// 	then any credential with wildcards may be applied instead,
// 	but only if these 'default' protections are specified as a dsCredential (sub)entry
// 	'*': { // apply the following creds to all datasets
// 		'*': { // apply the following creds for all server routes
// 			'*': BasicCredEntry | JwtCredEntry
// 		}
// 	}
// }

export async function validateDsCredentials(creds: ServerConfigDsCredentials, genomes?: { [genomeName: string]: any }) {
	mayReshapeDsCredentials(creds)
	const key = 'secrets' // to prevent a detect-secrets hook issue
	if (typeof creds[key] == 'string') {
		throw `serverconfig {dsCredentials: {${key}: <string>}} has been deprecated. Use {dsCredentials: <abs filepath string>} instead.`
	}

	// track which domains are allowed to embed proteinpaint with credentials,
	// to be used by app middleware to set CORS response headers
	const credEmbedders: Set<string> = new Set()
	// detect loaded datasets in order to filter out credentials that are not matched and do not need to be loaded
	const loadedDslabels = Object.values(genomes || {}).reduce((loadedDs: string[], g: any) => {
		if (typeof g.datasets === 'object') loadedDs.push(...Object.keys(g.datasets))
		return loadedDs
	}, [])

	// dslabel may be exact or a pattern
	for (const [dslabel, _ds] of Object.entries(creds)) {
		if (dslabel[0] == '#') {
			// '#' is treated as a comment, no dslabel should start with this character in order to be loaded
			delete creds[dslabel]
			continue
		}
		// For dslabel exact strings or glob pattern, delete the credentials entry if:
		// - there is a genomes argument, so support legacy validateDsCredentials() without a second argument.
		// - that dslabel pattern is not detected as being loaded.
		// Preserve the catch-all '*' entry, but prune any other unmatched pattern to prevent
		// the /healthcheck route handler from processing credential test/checks for non-existent datasets.
		if (genomes && dslabel != '*' && !loadedDslabels.find(ds => ds === dslabel || isMatch(ds, dslabel))) {
			delete creds[dslabel]
			continue
		}
		const ds = _ds as any
		if (ds['*']) {
			ds['/**'] = ds['*']
			delete ds['*']
		}
		const headerKey = ds.headerKey || 'x-ds-access-token'
		delete ds.headerKey

		for (const serverRoute of Object.keys(ds)) {
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

				if (cred.demoToken) addDemoTokenCred(cred, dslabel)
			}
		}
	}

	return credEmbedders
}

type LegacyDsCredentials = {
	[dslabel: string]:
		| {
				type?: 'login'
				password?: string // will be converted as "secret" value
				secret?: string
				embedders?: undefined // indicates a mistake in the entry
		  }
		| {
				type?: 'jwt'
				termdb?: any // will be reshaped and checked as a (non-legacy) ServerConfigDsCredentials entry
				/** the request header key to submit with verified jwt token as the value */
				headerKey?: string
				embedders?: {
					[hostName: string]: any // will be reshaped and checked as a (non-legacy) ServerConfigDsCredentials entry
				}
		  }
}

function mayReshapeDsCredentials(creds: LegacyDsCredentials) {
	// reshape legacy
	for (const dslabel of Object.keys(creds)) {
		const cred = creds[dslabel]
		if (cred.type == 'login') {
			if (cred.embedders) throw `unexpected 'embedders' property`
			// known format where type: 'login' does not have the jwt-type properties below
			// apply to all routes and embedders
			cred['*'] = {
				'*': {
					type: 'basic',
					secret: cred.secret || cred.password
					//password: cred.password
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
