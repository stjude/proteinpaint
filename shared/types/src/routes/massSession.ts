/** credentials-scoped session file, in place of a generated session id in the shared massSession cache dir */
export type MassSessionFor = {
	/** name of the session file to save */
	filename: string
	route: string
	dslabel: string
	embedder: string
}

/** POST body is the mass app state to save, which is otherwise not constrained by the server */
export type MassSessionSaveRequest = {
	__sessionFor__?: MassSessionFor
	[stateKey: string]: any
}

export type MassSessionSaveResponse = {
	/** session id, same as __sessionFor__.filename when provided */
	id?: string
	error?: string
}

/** a session in the shared massSession cache dir */
type MassSessionGetUnscoped = {
	/** session id */
	id: string
	route?: never
	dslabel?: never
	embedder?: never
}

/** a credentials-scoped session, which requires all of route, dslabel, embedder */
type MassSessionGetScoped = {
	/** session id */
	id: string
	route: string
	dslabel: string
	embedder: string
}

export type MassSessionGetRequest = MassSessionGetUnscoped | MassSessionGetScoped

export type MassSessionGetResponse = {
	/** the saved mass app state */
	state?: any
	/** number of days before an unscoped session file will be deleted */
	sessionDaysLeft?: number
	massSessionDuration?: number
	error?: string
}

export type MassSessionDeleteRequest = {
	/** session ids to delete */
	ids: string[]
	route: string
	dslabel: string
	embedder: string
}

export type MassSessionDeleteResponse = {
	status?: 'ok'
	error?: string
	/** session ids that could not be deleted */
	failedIds?: string[]
}
