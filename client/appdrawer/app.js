import { getAppInit } from '#rx'
import { mainBtnInit } from './mainBtn'
import { appDrawerStoreInit } from './store'

/*
.opts{}
    .holder
    .genomes{}
        - client-side genome object
	.drawerRow
	.sandboxDiv
	.genome_browser_btn
	.debugmode
	.headbox
	.padw_sm

TODOs: 

Questions: 
*/

class AppDrawerApp {
	constructor(opts) {
		this.type = 'app'

		const drawerDiv = opts.drawerRow
			.append('div')
			.style('position', 'relative')
			.style('margin', '0 20px')
			.style('padding', `0 ${opts.padw_sm}`)
			.style('display', 'inline-block')
			.style('overflow', 'hidden')
			.style('border-radius', '0px 0px 5px 5px')
			.style('width', '93vw')
			.classed('sjpp-drawer-div', true)

		const btnWrapper = opts.headbox
			.append('div')
			.style('position', 'relative')
			.style('display', 'inline-block')
			.style('margin-left', '5px')
			.style('margin-right', '5px')
			.style('border-radius', '5px')
			.classed('sjpp-apps-btn-wrapper', true)

		this.dom = {
			drawerRow: opts.drawerRow,
			drawerDiv,
			sandboxDiv: opts.sandboxDiv,
			btnWrapper,
			btn: btnWrapper.append('div'),
			drawerHint: btnWrapper.append('div'),
			drawerArrow: btnWrapper.append('div'),
			drawerArrowOpen: btnWrapper.append('div'),
			wrapper: drawerDiv.append('div')
		}
	}

	preApiFreeze(api) {
		api.cardsPath = this.opts.cardsPath
	}

	async init() {
		try {
			this.store = await appDrawerStoreInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.components = {
				mainBtn: await mainBtnInit({
					app: this.api,
					dom: this.dom,
					state: this.state,
					indexJson: this.indexJson
				})
			}
			await this.api.dispatch()
		} catch (e) {
			throw e
		}
	}

	main() {}
}

export const appDrawerInit = getAppInit(AppDrawerApp)
