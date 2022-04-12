import { getCompInit } from './rx.js'

class PortalBanner {
	constructor(opts) {
		this.type = 'banner'
		this.dom = {
			holder: opts.holder.style('font-size', '2em').style('font-weight', 600)
		}
	}

	init(appState) {
		this.dom.holder.html(appState.banner).on('click', () => {
			const title = window.prompt('Enter a new banner title: ')
			this.app.dispatch({
				type: 'set_banner',
				title
			})
		})
	}

	getState(appState) {
		return {
			banner: appState.banner
		}
	}

	main() {
		this.dom.holder.html(this.state.banner)
	}
}

export const portalBannerInit = getCompInit(PortalBanner)
