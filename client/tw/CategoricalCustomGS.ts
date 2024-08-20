import { CatTWCustomGS, HandlerOpts } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { RootTW } from './RootTW.ts'

export class CategoricalCustomGS {
	tw: CatTWCustomGS
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: RootTW

	constructor(fullTw: CatTWCustomGS, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}
}
