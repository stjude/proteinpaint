import { getAppInit } from '#rx'
import { mainBtnInit } from './mainBtn'
import { dofetch3, sayerror } from '#src/client'
import { appDrawerStoreInit } from './store'

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

		const drawerRow = opts.holder
			.append('div')
			.style('position', 'relative')
			.style('overflow-x', 'visible')
			.style('overflow-y', 'hidden')
			.classed('sjpp-drawer-row', true)

		const sandboxDiv = opts.holder
			.append('div')
			.style('margin-top', '15px')
			.classed('sjpp-drawer-sandbox', true)

		const drawerDiv = drawerRow
			.append('div')
			.style('position', 'relative')
			.style('margin', '0 20px')
			.style('padding', `0 ${opts.padw_sm}`)
			.style('display', 'inline-block')
			.style('overflow', 'hidden')
			.style('background-color', '#f5f5f5')
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

		this.dom = {
			drawerRow,
			sandboxDiv,
			btnWrapper,
			btn: btnWrapper.append('div'),
			drawerHint: btnWrapper.append('div'),
			drawerArrow: btnWrapper.append('div'),
			drawerArrowOpen: btnWrapper.append('div'),
			drawerDiv,
			wrapper: drawerDiv.append('div')
		}
	}

	async init() {
		this.drawerRendered = false
		try {
			this.store = await appDrawerStoreInit({ app: this.api, state: this.opts.state })
			this.state = await this.store.copyState()
			this.indexJson = await getCardsJson(this.dom.drawerDiv)
			this.components = {
				mainBtn: await mainBtnInit({
					app: this.api,
					dom: this.dom,
					state: this.state,
					drawerRendered: this.drawerRendered,
					indexJson: this.indexJson
				})
				// layout: await layoutInit({ app: this.api, dom: this.dom, state: this.state, index: this.indexJson })
			}
			await this.api.dispatch()
		} catch (e) {
			throw e
		}
	}

	main() {
		if (this.drawerRendered == true) return
		this.drawerRendered = true
	}
}

export const appDrawerInit = getAppInit(AppDrawerApp)

async function getCardsJson(holder) {
	const re = await dofetch3('/cardsjson')
	if (re.error) {
		sayerror(holder.append('div'), re.error)
		return
	}

	return re.json
}
