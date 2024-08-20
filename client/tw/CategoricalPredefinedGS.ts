import { CatTWPredefinedGS, HandlerOpts } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { RootTW } from './RootTW.ts'

export class CategoricalPredefinedGS {
	tw: CatTWPredefinedGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: RootTW

	constructor(fullTw: CatTWPredefinedGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}
}
