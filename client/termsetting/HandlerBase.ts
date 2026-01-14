import type { Handler, UseCase } from './types'
import type { TermSetting } from './TermSetting.ts'
import type { TwBase } from '#tw'

export class HandlerBase implements Handler {
	termsetting: TermSetting
	dom!: {
		[name: string]: any
	}
	//tw: TwBase

	constructor(opts) {
		this.termsetting = opts.termsetting
		//this.tw = opts.termsetting.tw
	}

	showEditMenu(_) {
		//ignore
	}

	getPillStatus(_?: UseCase) {
		const tw = this.termsetting.tw as any as TwBase
		return tw.getStatus?.() || { text: '' }
	}

	// this is equivalent to getPillNameDefault()
	getPillName(d) {
		const self = this.termsetting
		if (!self.opts.abbrCutoff) return d.name
		return d.name.length <= self.opts.abbrCutoff + 2
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
	}

	applyEdits() {
		// ignore
	}

	undoEdits() {
		// ignore
	}

	showLoading(_div?: any) {
		const self = this.termsetting
		const div = _div || self.dom.tip.d
		div.selectAll('*').remove()
		this.dom.loadingDiv = div.append('div').style('margin', '15px').text('Loading ...')
	}

	hideLoading() {
		this.dom.loadingDiv?.remove()
	}
}
