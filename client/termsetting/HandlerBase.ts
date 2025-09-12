import type { Handler } from './types'
import type { TermSetting } from './TermSetting.ts'
import type { TwBase } from '#tw'

export class HandlerBase implements Handler {
	termsetting: TermSetting
	tw: TwBase

	constructor(opts) {
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
	}

	showEditMenu() {
		//ignore
	}

	getPillStatus() {
		return this.termsetting.tw.getStatusText?.() || { text: '' }
	}

	// this is equivalent to getPillNameDefault()
	getPillName(d) {
		const self = this.termsetting
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}
}
