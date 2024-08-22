import { HandlerOpts, TermWrapper } from '#types'
import { TwRouter } from './TwRouter.ts'

export class Handler {
	// these properties are common to all derived handlers
	opts: Partial<HandlerOpts>
	root: TwRouter

	// declare optional methods that may be added to derived handler instance
	render?: (opts: any) => any

	constructor(fullTw: TermWrapper, opts: HandlerOpts = {}) {
		//this.tw = fullTw
		this.opts = opts
		//this.base = opts.base
		this.root = opts.root
	}
}
