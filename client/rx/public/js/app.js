import { getAppInit, multiInit } from './rx.js'
import { storeInit } from './store.js'
import { portalBannerInit } from './banner.js'
import { myButtonInit } from './button.js'
import { counterInit } from './counter.js'

class MyApp {
	constructor(opts) {
		opts.type = 'app'
		const holder = d3.select(opts.holder)
		this.dom = {
			holder,

			banner: holder.append('div'),

			errdiv: holder
				.append('div')
				.style('display', 'none')
				.style('background-color', 'rgba(100,0,0,0.3)')
				.on('click', () => this.dom.errdiv.style('display', 'none')),

			buttons: holder.append('div'),
			counter: holder.append('div')
		}
	}

	validateOpts(o = {}) {
		if (!o.holder) throw `missing opts.holder in the MassApp constructor argument`
		return o
	}

	async init() {
		// catch initialization error
		try {
			// may rehydrate using server data
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = await multiInit({
				banner: portalBannerInit({ app: this.api, holder: this.dom.banner }),
				buttons: Promise.all(
					this.state.buttons.map((btnState, index) => {
						return myButtonInit({ app: this.api, holder: this.dom.buttons.append('div'), id: index })
					})
				),
				counter: counterInit({ app: this.api, holder: this.dom.counter })
			})
			// launch the app
			await this.api.dispatch()
		} catch (e) {
			this.printError(e)
			throw e
		}
	}

	main() {
		this.dom.errdiv.style('display', 'none')
	}

	printError(e) {
		this.dom.errdiv.style('display', 'block').html(e + ' (click to close)')
		throw e
	}
}

export const appInit = getAppInit(MyApp)
