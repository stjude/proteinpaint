import { CatTWCustomGS, HandlerOpts } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { TwRouter } from './TwRouter.ts'

export class CategoricalCustomGS {
	tw: CatTWCustomGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: TwRouter

	constructor(fullTw: CatTWCustomGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}
}
