import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from '../PlotBase'
import type { BasePlotConfig, MassState } from '#mass/types/mass'
import { Menu } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'

/**

 */

class Chat extends PlotBase implements RxComponent {
	static type = 'chat'
	readonly type = 'chat'
	components: { controls: any }

	constructor(opts: any, api) {
		super(opts, api)
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
			// div with bubbles to show chat history
			bubbleDiv: div
				.append('div')
				.attr('class', 'sjpp_show_scrollbar')
				.style('margin', '5px 20px 0px 20px')
				.style('height', '200px')
				.style('overflow', 'auto')
				.style('scroll-behavior', 'smooth')
		}
		if (opts.header) {
			this.dom.header = opts.header.text('CHAT').style('opacity', 0.7)
		}
		// show input box at bottom
		div
			.append('input')
			.style('margin', '15px')
			.style('padding', '17px')
			.style('border-radius', '34px')
			.attr('size', 70)
			.attr('placeholder', 'What are you looking for?')
			.on('keyup', async event => {
				if (!keyupEnter(event)) return
				const prompt = event.target.value.trim()
				if (!prompt) return // blank
				if (prompt.length < 5) return // do not compute on short string
				this.addBubble({ msg: prompt, me: 1 })
				const body = {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					prompt
				}
				event.target.value = '' // clear input
				const serverBubble = this.addBubble({ msg: '...' })

				try {
					const data = await dofetch3('termdb/chat', { body })
					if (data.error) throw data.error
					serverBubble.html('Got result..')
					console.log(data)
					/* may switch by data.type
					type=chat: server returns a chat msg
					type=plot: server returns a plot obj
					*/
				} catch (e: any) {
					if (e.stack) console.log(e.stack)
					serverBubble.html(`Error: ${e.message || e}`)
				}
			})
			.node()
			.focus()
	}
	addBubble(arg: { msg: string; me?: number }) {
		/* 
		{
			msg: add a chat bubble for this msg; msg is html as it might contain hyperlinks
			me: if 1, is me; otherwise is ai
		}

		return the created bubble and allow to be modified
		*/
		const bubble = this.dom.bubbleDiv
			.append('div')
			.style('padding', '10px')
			.html(`${arg.me ? '<span style="font-size:.7em">[ME]</span> ' : ''}${arg.msg}`)
		if (arg.me) bubble.style('background', '#f1f1f1')
		// set this to scroll to bottom
		const n = this.dom.bubbleDiv.node()
		n.scrollTop = n.scrollHeight
		return bubble
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
