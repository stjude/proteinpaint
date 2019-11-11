import * as rx from '../common/rx.core'
import { termsettingInit } from './termsetting'
import { storeInit } from './store'

class App {
	constructor(nouse, opts) {
		this.type = 'app'
		this.opts = opts
		this.api = rx.getAppApi(this)
		this.store = storeInit(this.api)
		this.ts = {} // key: term0/1/2, value: api of termsetting instance

		this.store.copyState().then(state => {
			this.state = state
			this.initUI(opts.holder)
			this.api.dispatch({ type: 'app_refresh' })
		})
	}
	initUI(holder) {
		/*
		only run once, must call after this.state is copied from store
		will also initiate termsetting instances for 3 terms
		and register them, but not via the .components{}
		*/
		this.dom = {}
		const table = holder
			.append('table')
			.style('border-spacing', '30px')
			.style('border-collapse', 'separate')
		{
			const tr = table.append('tr')
			tr.append('td').text('Term 0')
			tr.append('td').text('Term 1')
			tr.append('td').text('Term 2')
		}
		const tr = table.append('tr')
		{
			/* using this.opts.state as the state, but not this.state
			as store.copyState() is async
			so not convenient to set this.state=await this.store.copyState() in constructor
			*/
			const s = this.state
			{
				const td = tr.append('td')
				this.ts.term0 = termsettingInit(null, {
					holder: td,
					genome: s.genome,
					dslabel: s.dslabel,
					term: s.term0 ? s.term0.term : null,
					q: s.term0 ? s.term0.q : null,
					callbacks: {
						termChanged: async arg => {
							await this.api.dispatch({ type: 'term_change', term0: arg })
							await this.ts.term1.setInnerAttr([
								s.term0.term ? s.term0.term.id : null,
								s.term2.term ? s.term2.term.id : null
							])
							await this.ts.term2.setInnerAttr([
								s.term0.term ? s.term0.term.id : null,
								s.term1.term ? s.term1.term.id : null
							])
						}
					}
				})
			}
			{
				const td = tr.append('td')
				this.ts.term1 = termsettingInit(null, {
					holder: td,
					genome: s.genome,
					dslabel: s.dslabel,
					term: s.term1 ? s.term1.term : null,
					q: s.term1 ? s.term1.q : null,
					callbacks: {
						termChanged: async arg => {
							await this.api.dispatch({ type: 'term_change', term1: arg })
							await this.ts.term0.setInnerAttr([
								this.state.term1.term ? this.state.term1.term.id : null,
								this.state.term2.term ? this.state.term2.term.id : null
							])
							await this.ts.term2.setInnerAttr([
								this.state.term1.term ? this.state.term1.term.id : null,
								this.state.term0.term ? this.state.term0.term.id : null
							])
						}
					}
				})
			}
			{
				const td = tr.append('td')
				this.ts.term2 = termsettingInit(null, {
					holder: td,
					genome: s.genome,
					dslabel: s.dslabel,
					term: s.term2 ? s.term2.term : null,
					q: s.term2 ? s.term2.q : null,
					callbacks: {
						termChanged: async arg => {
							await this.api.dispatch({ type: 'term_change', term2: arg })
							await this.ts.term0.setInnerAttr([
								this.state.term1.term ? this.state.term1.term.id : null,
								this.state.term2.term ? this.state.term2.term.id : null
							])
							await this.ts.term1.setInnerAttr([
								this.state.term0.term ? this.state.term0.term.id : null,
								this.state.term2.term ? this.state.term2.term.id : null
							])
						}
					}
				})
			}
		}
		const td = table
			.append('tr')
			.append('td')
			.attr('colspan', 3)
			.style('border', 'solid 1px black')
		td.append('p').text('App state updated via dispatch()')
		this.dom.reportterm0 = td.append('p')
		this.dom.reportterm1 = td.append('p')
		this.dom.reportterm2 = td.append('p')
	}
	main() {
		this.dom.reportterm0.text('Term 0: ' + (this.state.term0.term ? this.state.term0.term.id : 'none'))
		this.dom.reportterm1.text('Term 1: ' + (this.state.term1.term ? this.state.term1.term.id : 'none'))
		this.dom.reportterm2.text('Term 2: ' + (this.state.term2.term ? this.state.term2.term.id : 'none'))
	}
}

exports.appInit = rx.getInitFxn(App)
