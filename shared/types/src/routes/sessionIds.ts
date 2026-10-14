/** lists the credentials-scoped mass session ids, see massSession.ts */
export type SessionIdsRequest = {
	route: string
	dslabel: string
	embedder: string
}

export type SessionIdsResponse = {
	status?: 'ok'
	/** session file names under the credentials-scoped session dir */
	sessionIds?: string[]
	error?: string
}
