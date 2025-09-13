import { getCompInit, copyMerge } from '#rx'
import { RxComponent } from '../../types/rx.d'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
import { Menu, sayerror } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'

/**

 */

class Chat extends RxComponent {
	readonly type = 'chat'
	private components: { controls: any }
	constructor(opts: any) {
		super()
		this.opts = opts
		this.components = {
			controls: {}
		}
		this.initUi(opts)
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {}
	}

	//async init(appState: MassState) {}

	async main() {}

	initUi(opts) {
		const holder = opts.holder.classed('sjpp-chat-main', true)
		const div = holder.append('div').style('padding', '5px').style('display', 'inline-block')
		this.dom = {
			tip: new Menu({ padding: '' }),
			div,
			// error div on top
			error: div.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75),
			// chat message history
			chatMessageDiv: div.append('div')
		}
		if (opts.header) {
			this.dom.header = opts.header.text('CHAT').style('opacity', 0.7)
		}
		//////////
		// todo chat ui
		//////////
		div
			.append('input')
			.style('margin', '20px')
			.attr('size', 50)
			.attr('placeholder', 'What are you looking for?')
			.on('keyup', async event => {
				if (!keyupEnter(event)) return
				const prompt = event.target.value.trim()
				if (!prompt) return // blank
				const body = {
					prompt
				}
				try {
					const data = await dofetch3('termdb/chat', { body })
					if (data.error) throw data.error
					console.log(data)
					/* may switch by data.type
					type=chat: server returns a chat msg
					type=plot: server returns a plot obj
					*/
				} catch (e: any) {
					sayerror(this.dom.error, e.message || e)
					if (e.stack) console.log(e.stack)
				}
			})
			.node()
			.focus()
	}
}

export const chatInit = getCompInit(Chat)
export const componentInit = chatInit

export async function getPlotConfig(opts: any) {
	const config = {
		chartType: 'chat'
	}
	return copyMerge(config, opts)
}
