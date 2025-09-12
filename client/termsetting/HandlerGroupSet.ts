import { HandlerBase } from './HandlerBase.ts'
import type { Handler } from './index.ts'
import type { CatValues, CatPredefinedGS, CatCustomGS } from '#tw'

export class HandlerGroupSet extends HandlerBase implements Handler {
	tw: CatValues | CatPredefinedGS | CatCustomGS

	constructor(opts) {
		super(opts)
		this.tw = opts.tw
	}

	getPillStatus() {
		if (self.usecase?.target == 'regression') {
			return self.q.mode == 'binary' ? { text: 'binary' } : { text: 'categorical' }
		}
		return self.validateGroupsetting()
	}
}
