import { dofetch3, isInSession } from '#common/dofetch'
import { isDictionaryType } from '#shared/common'

export class Vocab {
	constructor(opts) {
		this.app = opts.app
		this.opts = opts
		this.state = opts.state
		this.vocab = opts.state.vocab
		this.currAnnoData = { samples: {}, refs: { byTermId: {} }, lastTerms: [], lastFilter: {} }
		/*
            some categorical terms may not have an initial term.values object,
            but is expected to be filled from data requests such as nestedChartSeriesData()
            TODO: 
            - add values-filling logic to other data requests besides nestedChartSeriesData()
            - instead of this workaround, should query all available values in getterm()
        */
		this.missingCatValsByTermId = {}
		const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
		this.jwtByDsRoute = JSON.parse(jwtByDsRouteStr)
		const dslabel = this.vocab?.dslabel || this.state?.dslabel
		this.jwtByRoute = this.jwtByDsRoute[dslabel] || {}
	}

	async main(stateOverride = null) {
		if (stateOverride) Object.assign(this.state, stateOverride)
		else this.state = structuredClone(this.app?.getState?.() || this.opts.state)

		// frontend vocab may replace the vocab object reference
		if (this.state.vocab) this.vocab = this.state.vocab
		// may or may not need a verified token for a dslabel, based on genome response.dsAuth
		const dslabel = this.state.dslabel || this.state.vocab.dslabel
		this.verifiedToken = !this.state.termdbConfig?.requiredAuth?.length || isInSession(dslabel, 'termdb')
		// secured plots need to confirm that a verified token exists
		if (dslabel) await this.maySetVerifiedToken(dslabel)
	}

	async maySetVerifiedToken(dslabel) {
		// strict true boolean value means no auth required
		if (this.verifiedToken === true) return this.verifiedToken
		let token = this.opts.getDatasetAccessToken?.()
		if (!token) token = this.jwtByRoute['termdb']
		if (this.verifedToken && token === this.verifiedToken) return this.verifiedToken
		try {
			// TODO: do not hardcode 'termdb' here, assume that Vocab is only called within a termdb or mass app
			const auth = this.state.termdbConfig?.requiredAuth.find(a => a.route == 'termdb')
			if (!auth) {
				this.verifiedToken = true
				return
			}
			if (auth.type === 'jwt') {
				if (!token) {
					delete this.verifiedToken
					return
				}
				const headers = {
					[auth.headerKey]: token
				}
				const route = 'termdb'
				if (!headers.authorization && this.jwtByRoute[route])
					headers.authorization = `Bearer ${btoa(this.jwtByRoute[route])}`
				const data = await dofetch3('/jwt-status', {
					method: 'POST',
					headers,
					body: {
						dslabel,
						route,
						embedder: location.hostname
					}
				})
				// TODO: later may check against expiration time in response if included
				this.verifiedToken = data.status === 'ok' && token
				if (data.error) {
					this.tokenVerificationPayload = data
					throw data.error
				} else {
					// TODO: remove the need for legacy support of hardcoded session names
					this.sessionId =
						(auth.headerKey && data[auth.headerKey]) || data['x-sjppds-sessionid'] || data['x-ds-access-token']
					delete this.tokenVerificationMessage
					delete this.tokenVerificationPayload
					if (data.jwt) {
						if (!this.jwtByDsRoute[dslabel]) {
							this.jwtByDsRoute[dslabel] = {}
							this.jwtByRoute = this.jwtByDsRoute[dslabel]
						}
						this.jwtByDsRoute[dslabel][data.route] = data.jwt
						localStorage.setItem('jwtByDsRoute', JSON.stringify(this.jwtByDsRoute))
					}
				}
			} else {
				throw `unsupported requiredAuth='${auth.type}'`
			}
		} catch (e) {
			this.tokenVerificationMessage = e.message || e.reason || e
			if (typeof e == 'object') console.log(e)
		}
	}

	hasVerifiedToken() {
		// should not return the string token value, only a boolean
		return this.verifiedToken && true
	}

	mayGetAuthHeaders(route = '') {
		const auth = this.state.termdbConfig?.requiredAuth
		if (!auth) return {}
		if (!this.verifiedToken) {
			this.tokenVerificationMessage = `requires login for this data`
			return
		}
		const headers = {}
		if (auth.headerKey) headers[auth.headerKey] = this.verifiedToken
		// in cases where CORS prevents an http-domain based session cookie from being passed to the PP server,
		// then this header will be used by the PP server
		if (this.sessionId) headers['x-sjppds-sessionid'] = this.sessionId
		// may use jwt to verify against a random server process in a farm
		if (route && this.jwtByRoute[route]) {
			const jwt = this.jwtByRoute[route]
			headers.authorization = `Bearer ${btoa(jwt)}`
		}
		return headers
	}

	async trackDsAction({ action, details }) {
		const headers = { 'x-sjppds-sessionid': this.sessionId }
		// NOTE: do not hardcode the .termdb route here, there may be more tracked actions later
		const jwt = this.jwtByRoute.termdb
		if (jwt) headers.authorization = 'Bearer ' + btoa(jwt)
		await dofetch3('/authorizedActions', {
			method: 'POST',
			credentials: 'include',
			headers,
			body: Object.assign({
				dslabel: this.vocab.dslabel,
				action,
				details,
				'x-sjppds-sessionid': this.sessionId
			})
		})
	}

	// get a minimum copy of tw
	// for better GET caching by the browser
	getTwMinCopy(tw) {
		const copy = { $id: tw.$id, term: {}, q: tw.q }
		copy.term.id = tw.term?.id
		copy.term.name = tw.term?.name
		copy.term.type = tw.term?.type
		if (isDictionaryType(tw.term?.type)) {
			copy.term.values = tw.term?.values
		} else {
			if (tw.term.gene) {
				copy.term.gene = tw.term.gene
			} else if (tw.term.type.startsWith('gene')) {
				//quick fix that should be fixed later
				copy.term.chr = tw.term.chr
				copy.term.start = tw.term.start
				copy.term.stop = tw.term.stop
			} /* else {
				// TODO: minimize other non-dictionary term types
			}*/
		}
		return copy
	}

	cacheTermQ(term, q) {
		// only save q with a user or automatically assigned name
		if (!q.reuseId) throw `missing term q.reuseId for term.id='${term.id}'`
		this.app.dispatch({
			type: 'cache_termq',
			termId: term.id,
			q
		})
	}

	async uncacheTermQ(term, q) {
		await this.app.dispatch({
			type: 'uncache_termq',
			term,
			q
		})
	}

	getCustomTermQLst(term) {
		if (term.id) {
			const cache = this.state.reuse.customTermQ.byId[term.id] || {}
			const qlst = Object.values(cache).map(q => JSON.parse(JSON.stringify(q)))
			// find a non-conflicting reuseId for saving a new term.q
			for (let i = qlst.length + 1; i < 1000; i++) {
				const nextReuseId = `Setting #${i}`
				if (!qlst.find(q => q.reuseId === nextReuseId)) {
					qlst.nextReuseId = nextReuseId
					break
				}
			}
			// last resort to use a random reuseId that is harder to read
			if (!qlst.nextReuseId) {
				qlst.nextReuseId = btoa((+new Date()).toString()).slice(10, -3)
			}
			return qlst
		} else return []
	}

	async addCustomTerm(obj) {
		// save one custom term
		// obj = { name:str, term:{} }
		await this.app.dispatch({
			type: 'add_customTerm',
			obj
		})
	}
	async deleteCustomTerm(name) {
		// delete by name
		await this.app.dispatch({
			type: 'delete_customTerm',
			name
		})
	}

	async getCustomTerms() {
		if (!Array.isArray(this.state.customTerms)) return [] // only mass state has this, here this instance is missing it. do not crash
		// return list of term{}; do not return whole object
		return this.state.customTerms.map(i => i.tw)
	}

	async addGroup(obj) {
		await this.app.dispatch({
			type: 'add_group',
			obj
		})
	}

	async deleteGroup(name) {
		await this.app.dispatch({
			type: 'delete_group',
			name
		})
	}

	async getGroups() {
		if (!Array.isArray(this.state.groups)) return [] // only mass state has this, here this instance is missing it. do not crash
		// return list of term{}; do not return whole object
		return this.state.groups
	}
}
