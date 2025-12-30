import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import { renderTable } from '#dom'
import type { TermCollectionValues } from '#tw'
import type { TermCollectionQValues } from '#types'
import type { TermSetting } from '../TermSetting.ts'

// self is the termsetting instance
export class TermCollectionHandler extends HandlerBase implements Handler {
	tw: TermCollectionValues
	termsetting: TermSetting
	dom: {
		[name: string]: any
	} = {} //main menu dom elements before drag and drop divs are added

	constructor(opts) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.dom.holder = opts.holder || this.termsetting.dom.tip.d
		//this.data = { groups: [], values: [], filters: [] }
	}

	showEditMenu(div: any) {
		const self = this.termsetting
		div.selectAll('*').remove()
		const terms = self.term.termlst
		const groupDiv = div.append('div')
		const noButtonCallback = (i: number, node: any) => {
			terms[i].checked = node.checked
		}
		const name = 'Terms used for sorting order'
		addTable(groupDiv, name, terms, noButtonCallback)
		div
			.append('div')
			.append('div')
			.style('float', 'right')
			.style('padding', '6px 20px')
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
			.text('Apply')
			.on('click', () => {
				const q = self.q as TermCollectionQValues
				q.numerators = terms.filter(term => term.checked).map(t => t.id)
				self.api.runCallback()
			})
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	// inherited from HanlderBase
	// getPillName(d: PillData) {}
}

function addTable(div: any, name: any, terms: any, noButtonCallback: any) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${name}</b>.`)
	const rows: any = []
	for (const term of terms) {
		rows.push([{ value: term.name }])
	}
	const selectedRows: number[] = terms.map((term, index) => (term.checked ? index : -1)).filter(index => index !== -1)

	const columns: any = [{ label: 'Terms' }]

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: false,
		selectedRows,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})
}

export function fillTW(tw) {
	if (!tw.type) tw.type = 'termCollection'
	// TODO: when more termCollection types needed, should assign different q.type here.
	if (!tw.q) tw.q = { mode: 'continuous', type: 'compositePercentage' }
	else tw.q.mode = 'continuous'
	return tw
}
