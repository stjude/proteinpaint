import { getAppInit } from './rx.js'
import { storeInit } from './store.js'
import { portalBannerInit } from './banner.js'
import { myButtonInit } from './button.js'

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

			button: holder.append('div')
		}
	}

	async init() {
		// catch initialization error
		try {
			// may rehydrate using server data
			this.store = await storeInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = {
				banner: await portalBannerInit({ app: this.api, holder: this.dom.banner }),
				button: await myButtonInit({ app: this.api, holder: this.dom.button })
			}
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
