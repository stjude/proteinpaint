import { validateDsCredentials } from './auth/auth.dsCredentials.ts'
import { AuthApiOpen } from './auth/AuthApiOpen.ts'
import { AuthApi } from './auth/AuthApi.ts'

export interface AuthInterface {
	// credentialed embedders, using an array which can be frozen with Object.freeze(), unlike a Set()
	credEmbedders: string[]
	maySetAuthRoutes: (app, genomes, basepath: string, serverconfig: any) => void | Promise<void>
	//getJwtPayload, // declared below
	canDisplaySampleIds: (req, ds) => boolean
	// these open-acces, default methods may be replaced by maySetAuthRoutes()
	getDsAuth: (req) => any[]
	getNonsensitiveInfo: (_) => { forbiddenRoutes: string[] }
	isUserLoggedIn: (req, ds, protectedRoutes) => boolean
	getRequiredCredForDsEmbedder: (dslabel: string, embedder: string) => any
	getPayloadFromHeaderAuth: (req, res) => any
	getHealth: () => any | Promise<any>
	mayAdjustFilter: (q, ds, routeTwLst) => void
}

// The authApi variable will be filled when the server/app.ts calls getAuthApi().
// This is exported as a read-only live-binding where the importer sees the latest value.
export let authApi

// key: express app, value: authApi instance
// will ensure that an app will be set up only once with auth middleware
const authApiByApp = new WeakMap()

// these may be overriden within maySetAuthRoutes()
export async function getAuthApi(app, genomes, _serverconfig = null, assignSharedApi = false) {
	if (assignSharedApi && authApi) {
		throw `The shared authApi reference has already been assigned.`
	}
	// reuse an existing authApi if it already exists for an app
	if (authApiByApp.has(app)) return authApiByApp.get(app)

	const serverconfig = _serverconfig || (await import('./serverconfig.js')).default
	const creds = serverconfig.dsCredentials || {}
	// !!! do not expose the loaded dsCredentials to other code that imports serverconfig.json !!!
	delete serverconfig.dsCredentials

	const credEmbedders = await validateDsCredentials(creds)
	// no need to set up auth middleware and routes if there are no dsCredential entries
	const _authApi = credEmbedders.size ? new AuthApi(creds, app, genomes, serverconfig) : AuthApiOpen
	//console.log(44, credEmbedders, authApi === AuthApiProtected)
	_authApi.credEmbedders.push(...credEmbedders)
	if (!serverconfig.debugmode || !app.doNotFreezeAuthApi) {
		Object.freeze(_authApi)
		Object.freeze(_authApi.credEmbedders)
	}
	// IMPORTANT: only set the exported authApi value once, expected to be at the
	// beginning of server launch. Unit tests should not set the assignSharedApi argument
	// to true when the imports are persisted into integration tests, such as when running
	// combined coverage scripts.
	if (assignSharedApi) authApi = _authApi
	// track each authApi by app
	authApiByApp.set(app, _authApi)
	// Return the generated authApi. It is more reliable for consumer code
	// to use this returned authApi directly, than to import the authApi
	// with live-binding.
	return _authApi
}
