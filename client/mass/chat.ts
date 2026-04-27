import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'

class MassAiChatBot implements RxComponent {
	static type = 'chat'

	type: string
	opts: any
	app: MassAppApi
	dom: any
	state: any
	id!: string

	constructor(opts: any) {
		this.type = MassAiChatBot.type
		this.opts = opts
		this.app = opts.app
		this.dom = opts.subheader.append('div').attr('data-testid', 'sjpp-mass-nav-chat-holder')
	}

	async init() {}

	main() {
		//TODO: Required
	}
}

export const chatInit = getCompInit(MassAiChatBot)
