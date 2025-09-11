import type { Handler } from './types'
import type { TermSettingInner } from './TermSettingInner'

export class HandlerBase implements Handler {
	self: TermSettingInner

	constructor(opts) {
		this.self = opts.self
	}

	showEditMenu() {
		//ignore
	}

	getPillStatus() {
		return { text: '' }
	}

	getPillName(d) {
		const self = this.self
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}
}
