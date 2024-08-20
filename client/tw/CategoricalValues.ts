import { CatTWValues, HandlerOpts } from '#types'
import { CategoricalBase } from './CategoricalTW.ts'
import { RootTW } from './RootTW.ts'

export class CategoricalValues {
	tw: CatTWValues
	opts: Partial<HandlerOpts>
	base: CategoricalBase
	root: RootTW

	constructor(fullTw: CatTWValues, opts: HandlerOpts = {}) {
		this.tw = fullTw
		this.opts = opts
		this.base = opts.base
		this.root = opts.root
	}
}
