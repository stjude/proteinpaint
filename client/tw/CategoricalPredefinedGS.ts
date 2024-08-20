import { CatTWPredefinedGS, HandlerOpts } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { TwRouter } from './TwRouter.ts'

export class CategoricalPredefinedGS {
	tw: CatTWPredefinedGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: TwRouter

	constructor(fullTw: CatTWPredefinedGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}
}
