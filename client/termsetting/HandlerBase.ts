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

	/* a term with valueConversion{} stores its values in fromUnit (e.g. day) but shows them to
	users in toUnit (e.g. year). the inputs of the numeric edit menus (bin boundaries, knots) are
	in the stored unit, so tell the user which unit they are typing in */
	mayShowValueconversionMsg(div: any) {
		const vc = (this.termsetting.tw as any)?.term?.valueConversion
		if (!vc) return
		div
			.append('div')
			.style('margin', '0px 0px 10px 10px')
			.style('opacity', 0.6)
			// the editors show and read values in the user-facing unit, so that is the unit to name
			.text(`Note: using values by the unit of ${vc.toUnit}.`)
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
