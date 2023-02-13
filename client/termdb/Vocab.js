import { dofetch3, isInSession } from '../common/dofetch'

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
	}

	async main(stateOverride = null) {
		if (stateOverride) Object.assign(this.state, stateOverride)
		else this.state = this.app.getState ? this.app.getState() : this.opts.state

		// frontend vocab may replace the vocab object reference
		if (this.state.vocab) this.vocab = this.state.vocab
		// may or may not need a verified token for a dslabel, based on genome response.dsAuth
		const dslabel = this.state.dslabel || this.state.vocab.dslabel
		this.verifiedToken = !this.state.termdbConfig?.requiredAuth || isInSession(dslabel)
		// secured plots need to confirm that a verified token exists
		if (dslabel) await this.maySetVerifiedToken(dslabel)
	}

	async maySetVerifiedToken(dslabel) {
		// strict true boolean value means no auth required
		if (this.verifiedToken === true) return this.verifiedToken
		const token = this.opts.getDatasetAccessToken?.()
		if (this.verifedToken && token === this.verifiedToken) return this.verifiedToken
		try {
			const auth = this.state.termdbConfig?.requiredAuth
			if (!auth) {
				this.verifiedToken = true
				return
			}
			if (auth.type === 'jwt') {
				if (!token) {
					delete this.verifiedToken
					return
				}
				const data = await dofetch3('/jwt-status', {
					method: 'POST',
					headers: {
						[auth.headerKey]: token
					},
					body: {
						dslabel,
						embedder: location.hostname
					}
				})
				// TODO: later may check against expiration time in response if included
				this.verifiedToken = data.status === 'ok' && token
				if (data.error) {
					this.tokenVerificationPayload = data
					throw data.error
				} else {
					this.sessionId = data['X-SjPPDs-Sessionid']
					delete this.tokenVerificationMessage
					delete this.tokenVerificationPayload
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
		return !!this.verifiedToken
	}

	async trackDsAction({ action, details }) {
		await dofetch3('/authorizedActions', {
			method: 'POST',
			credentials: 'include',
			header: {
				'X-SjPPDs-Sessionid': this.sessionId
			},
			body: Object.assign({
				dslabel: this.vocab.dslabel,
				action,
				details,
				'X-SjPPDs-Sessionid': this.sessionId
			})
		})
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
}
