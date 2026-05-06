import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'
import { Menu } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse } from '#types'

class MassAiChatBot implements RxComponent {
	static type = 'chat'

	type: string
	opts: any
	app: MassAppApi
	dom!: any
	state: any
	id!: string

	constructor(opts: any) {
		this.type = MassAiChatBot.type
		this.opts = opts
		this.app = opts.app
	}

	async init() {
		this.initDom()
	}

	initDom() {
		this.dom = {
			tip: new Menu({ padding: '' }),
			div: this.opts.subheader,
			// error div on top
			error: this.opts.subheader.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75),
			// div with bubbles to show chat history
			bubbleDiv: this.opts.subheader
				.append('div')
				.attr('class', 'sjpp_show_scrollbar')
				.style('margin', '5px 20px 0px 20px')
				.style('height', '200px')
				.style('overflow', 'auto')
				.style('scroll-behavior', 'smooth')
		}

		this.dom.div
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
				const body: ChatRequest = {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					filter: this.app.vocabApi.state.termfilter?.filter,
					prompt
				}
				event.target.value = '' // clear input
				const serverBubble = this.addBubble({ msg: '...' })

				try {
					const data = await dofetch3('termdb/chat3', { body })
					if (data.error) throw data.error

					const result: ChatResponse = data
					if (result.type == 'text') {
						serverBubble.text(result.text)
					} else if (result.type == 'html') {
						serverBubble.html(result.html)
					} else if (result.type == 'plot') {
						this.app.dispatch({
							type: 'plot_create',
							config: result.plot
						})
						if (result.msg) serverBubble.text(result.msg + '.Please refer to the plot generated below.')
						else serverBubble.text('Please refer to the plot generated below.')
					}
					/** may switch by data.type
					 * type=chat: server returns a chat msg
					 * type=plot: server returns a plot obj */
				} catch (e: any) {
					if (e.stack) console.log(e.stack)
					serverBubble.html(`Error: ${e.message || e}`)
				}
			})
			.node()
			.focus()
	}

	addBubble(arg: { msg: string; me?: number }) {
		/** {
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

	main() {
		/** Comment because main() is required for RxComponent
		 * but chat does not have any main logic for now. May add in the future.*/
	}
}

export const chatInit = getCompInit(MassAiChatBot)
