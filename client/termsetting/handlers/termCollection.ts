import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import { renderTable } from '#dom'
import type { TermCollectionValues } from '#tw'
import type { TermCollectionQValues } from '#types'
import type { TermSetting } from '../TermSetting.ts'
import { mayHydrateDictTwLst } from '#termsetting'

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

	async showEditMenu(div: any) {
		const self = this.termsetting
		div.selectAll('*').remove()
		const termIds =
			self.vocabApi.termdbConfig.numericTermCollections?.find(c => c.name === self.term.collectionId)?.termIds || []
		const terms: any[] = []
		const toBeHydrated: any[] = []
		for (const id of termIds) {
			const term = self.term.termlst.find(t => t.id === id)
			if (term) terms.push(term)
			else toBeHydrated.push({ id })
		}
		if (toBeHydrated.length) {
			await mayHydrateDictTwLst(toBeHydrated, self.vocabApi)
			terms.push(...toBeHydrated.map(tw => tw.term))
		}
		const groupDiv = div.append('div')
		const noButtonCallback = (i: number, node: any) => {
			terms[i].checked = node.checked
		}
		const name = 'Terms used for sorting order'
		addTable(groupDiv, name, terms, noButtonCallback, self.term.termlst, (self.q as any).numerators)
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
				const trs = groupDiv.select('table').select('tbody').node().querySelectorAll('tr')

				self.term.termlst = terms.filter((term, i) => trs[i].querySelectorAll('td')[1].querySelector('input')?.checked)
				q.numerators = terms
					.filter((term, i) => trs[i].querySelectorAll('td')[3].querySelector('input')?.checked)
					.map(t => t.id)

				self.api.runCallback()
			})
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	// inherited from HanlderBase
	// getPillName(d: PillData) {}
}

function addTable(div: any, name: any, terms: any, noButtonCallback: any, termlst: any[], numerators: string[]) {
	const rows: any = []
	for (const term of terms) {
		const checked = numerators?.find(tid => tid === term.id) ? 'checked' : ''
		rows.push([{ value: term.name }, { html: `<input type='checkbox' ${checked} />` }])
	}
	const selectedRows: number[] = terms
		.map((term, index) => (termlst.find(t => t.id === term.id) ? index : -1))
		.filter(index => index !== -1)

	const columns: any = [{ label: 'Terms' }, { label: 'Use for sorting' }]

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: true, //false,
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
