import { getAppInit } from '#rx'
import { storeInit } from './store'
import { compLayoutInit } from './layout'
import { cardInit } from './card'
import { buttonInit } from './dsButton'
import { select } from 'd3-selection'

/*
.opts{}
    .holder
    .apps_sandbox_div
    .apps_off()
    .genomes{}
        - client-side genome object
    .indexJson{}

TODOs: 
- Update and add documentation link

Questions: 
*/

class AppDrawerApp {
	constructor(opts) {
		this.type = 'app'
		this.opts = this.validateOpts(opts)
		;(this.dom = {
			holder: this.opts.holder,
			wrapper: this.opts.holder.append('div')
		}),
			(this.elements = this.opts.indexJson.elements.filter(e => !e.hidden))
	}

	validateOpts(opts) {
		if (!opts.indexJson.elements || opts.indexJson.elements.length == 0) throw `Missing elements to render`
		return opts
	}

	async init() {
		try {
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			// this.state = await this.store.copyState()
			this.components = {
				layout: await compLayoutInit({ app: this.api, dom: this.dom, index: this.opts.indexJson })
			}
			await this.api.dispatch()
		} catch (e) {
			throw e
		}
	}

	async main() {
		loadElements(this)
	}
}

export const appDrawerInit = getAppInit(AppDrawerApp)

function loadElements(self) {
	self.elements.forEach(element => {
		//Still assumes the columnLayout
		const holder = select(`#${element.section} > .sjpp-element-list`)
		if (element.type == 'card' || element.type == 'nestedCard') {
			cardInit({
				app: self.api,
				holder: holder
					.style('display', 'grid')
					.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
					.style('gap', '10px')
					.style('list-style', 'none')
					.style('margin', '15px 0px'),
				element,
				pageArgs: self.opts
			})
		} else if (element.type == 'dsButton') {
			buttonInit({
				app: self.api,
				holder,
				element,
				pageArgs: self.opts
			})
		}
	})
}
