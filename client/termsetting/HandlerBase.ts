import type { Handler } from './types'
import type { TermSetting } from './TermSetting.ts'

export class HandlerBase implements Handler {
	termsetting: TermSetting

	constructor(opts) {
		this.termsetting = opts.termsetting
	}

	showEditMenu() {
		//ignore
	}

	getPillStatus() {
		return { text: '' }
	}

	getPillName(d) {
		const self = this.termsetting
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}
}
