// these are route type definitions that are only known on the server-side,
// the client does not know about them, so do not put this in shared/types

// these req.query key-values are not submitted from the client
export type ReqQueryAddons = {
	__protected__?: {
		sessionId?: string
		clientAuthResult?: any
		ignoredTermIds?: any
	}
	__abortSignal?: AbortSignal
}
