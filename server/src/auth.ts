import { validateDsCredentials } from './auth/AuthDsCredentials.ts'
import { AuthApiOpen } from './auth/AuthApiOpen.ts'
import { AuthApi } from './auth/AuthApi.ts'

export interface AuthInterface {
	// credentialed embedders, using an array which can be frozen with Object.freeze(), unlike a Set()
	credEmbedders: string[]
	maySetAuthRoutes: (app, genomes, basepath: string, serverconfig: any) => void
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

// will fill this is in when the server/app.ts calls getAuthApi()
export let authApi

// these may be overriden within maySetAuthRoutes()
export async function getAuthApi(app, genomes, _serverconfig = null) {
	const serverconfig = _serverconfig || (await import('./serverconfig.js')).default
	const creds = serverconfig.dsCredentials || {}
	// !!! do not expose the loaded dsCredentials to other code that imports serverconfig.json !!!
	delete serverconfig.dsCredentials

	const credEmbedders = await validateDsCredentials(creds)
	// no need to set up auth middleware and routes if there are no dsCredential entries
	authApi = credEmbedders.size ? new AuthApi(creds, app, genomes, serverconfig) : AuthApiOpen
	//console.log(44, credEmbedders, authApi === AuthApiProtected)
	authApi.credEmbedders.push(...credEmbedders)
	if (!serverconfig.debugmode || !app.doNotFreezeAuthApi) {
		Object.freeze(authApi)
		Object.freeze(authApi.credEmbedders)
	}
	return authApi
}
