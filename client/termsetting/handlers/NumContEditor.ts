import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../types.ts'
import type { TermSetting } from '../TermSetting.ts'
import type { NumCont } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import type { ContinuousNumericQ } from '#types'
import { make_one_checkbox } from '#dom'

export class NumContEditor extends HandlerBase implements Handler {
	tw: NumCont
	q: ContinuousNumericQ
	termsetting: TermSetting
	handler: NumericHandler
	dom: {
		[name: string]: any
	} = {}
	draggedItem: any
	removedGrp: any
	editedName: any

	constructor(opts, handler) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.handler = handler
		this.q = this.setDefaultQ()
	}

	setDefaultQ() {
		if (this.tw.q.mode == 'continuous') return JSON.parse(JSON.stringify(this.tw.q))
		return { mode: 'continuous' }
	}

	async showEditMenu(div: any) {
		this.tw = this.handler.tw as NumCont
		this.q = this.setDefaultQ()
		if (this.dom.inputsDiv) {
			if (div.node().contains(this.dom.inputsDiv.node())) return
			else delete this.dom.inputsDiv
		}

		this.dom.density_div = div.append('div')
		await this.handler.density.showViolin(this.dom.density_div)

		this.dom.inputsDiv = div.append('div')
		this.mayShowValueconversionMsg(this.dom.inputsDiv)
		if (this.termsetting.opts.usecase?.target == 'matrix') {
			this.dom.convert2ZCheckbox = await make_one_checkbox({
				holder: this.dom.inputsDiv.append('div'),
				labeltext: 'Convert to Z-score',
				checked: this.q.convert2ZScore ? true : false,
				divstyle: { display: 'inline-block', padding: '3px 10px' },
				callback: checked => {
					this.q.convert2ZScore = checked
					if (checked) {
						// set the Scale values option to "No Scaling"
						this.dom.scaleSelect.property('value', '1')
						this.setScale('1')
					}
				}
			})
		}

		const selectDiv = this.dom.inputsDiv.append('div').style('display', 'inline-block')
		selectDiv.append('div').style('display', 'inline-block').style('padding', '3px 10px').html('Scale values')

		this.dom.scaleSelect = selectDiv.append('select').on('change', (event: any) => {
			this.setScale(event.target.value)
			// uncheck the convert to z-score checkbox
			if (event.target.value != '1' && this.dom.convert2ZCheckbox) this.dom.convert2ZCheckbox.property('checked', false)
		})

		const options = [
			{ html: 'No Scaling', value: '1' },
			{ html: 'Per 10', value: '10' },
			{ html: 'Per 100', value: '100' },
			{ html: 'Per 1000', value: '1000' }
		]
		/* server getData() takes the log of the term's stored value, but a term with valueConversion is shown in
		its converted unit by multiplying a value, which would turn a log of days into a meaningless number of years */
		if (!this.tw.term.valueConversion) options.push({ html: 'log10(X+1)', value: 'log10p1' })
		const selected = this.q.transform || String(this.q.scale || 1)

		this.dom.scaleSelect
			.selectAll('option')
			.data(options)
			.enter()
			.append('option')
			.attr('value', d => d.value)
			.html(d => d.html)
			.property('selected', d => d.value == selected)
	}

	/* a "Scale values" option is either a divisor in q.scale or a transform in q.transform,
	so that choosing one removes the other */
	setScale(value: string) {
		delete this.q.scale
		delete this.q.transform
		if (value == 'log10p1') this.q.transform = value
		else if (value != '1') this.q.scale = Number(value)
	}

	getEditedQ() {
		this.setScale(this.dom.scaleSelect.property('value'))
		if (this.dom.convert2ZCheckbox) this.q.convert2ZScore = this.dom.convert2ZCheckbox.property('checked')
		return this.q
	}

	destroy() {
		for (const name of Object.keys(this.dom)) {
			this.dom[name].remove()
			delete this.dom[name]
		}
	}
}
