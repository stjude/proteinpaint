import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import { renderTable } from '#dom'
import type { CollectionBase } from '#tw'
import type { TermCollectionQCont } from '#types'
import type { TermSetting } from '../TermSetting.ts'
import { mayHydrateDictTwLst } from '#termsetting'

// self is the termsetting instance
export class TermCollectionHandler extends HandlerBase implements Handler {
	tw: CollectionBase
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
			self.vocabApi.termdbConfig.termCollections?.find(c => c.name === self.term.collectionId)?.termIds || []
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
		const callback =
			this.tw.term.memberType == 'numeric'
				? addNumericTable(self, groupDiv, terms, noButtonCallback)
				: addCategoricalTable(self, groupDiv, terms, noButtonCallback)

		div
			.append('div')
			.append('div')
			.style('float', 'right')
			.style('padding', '6px 20px')
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
			.text('Apply')
			.on('click', callback)
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}

	// inherited from HanlderBase
	// getPillName(d: PillData) {}
}

function addNumericTable(self, div: any, terms: any, noButtonCallback: any) {
	const rows: any = []
	for (const term of terms) {
		const checked = self.q.numerators?.find(tid => tid === term.id) ? 'checked' : ''
		rows.push([{ value: term.name }, { html: `<input type='checkbox' ${checked} />` }])
	}
	const selectedRows: number[] = terms
		.map((term, index) => (self.term.termlst.find(t => t.id === term.id) ? index : -1))
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

	return () => {
		const q: TermCollectionQCont = self.q
		const trs = div.select('table').select('tbody').node().querySelectorAll('tr')

		self.term.termlst = terms.filter((_, i) => trs[i].querySelectorAll('td')[1].querySelector('input')?.checked)

		q.numerators = terms
			.filter((term, i) => {
				const checked = trs[i].querySelectorAll('td')[1].querySelector('input')?.checked
				return checked === true
			})
			.map(t => t.id)

		self.api.runCallback()
	}
}

function addCategoricalTable(self, div: any, terms: any, noButtonCallback: any) {
	const rows: any = []
	for (const term of terms) {
		rows.push([{ value: term.name }])
	}
	const selectedRows: number[] = terms
		.map((term, index) => (self.term.termlst.find(t => t.id === term.id) ? index : -1))
		.filter(index => index !== -1)

	const columns: any = [{ label: 'Terms' }]

	renderTable({
		rows,
		columns,
		div: div.append('div'),
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: true, //false,
		selectedRows,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})

	const categoryDiv = div.append('div')
	// Merge .values from all termlst entries; safe when termlst is empty or entries lack .values
	const values = Object.assign({}, ...(self.tw.term.termlst?.map((t: any) => t.values || {}) ?? []))
	categoryDiv.append('div').style('margin', '5px').style('padding', '5px').html('Category keys')
	const categoryTable = categoryDiv.append('div')
	renderTable({
		columns: [{ label: 'Terms' }],
		rows: self.tw.term.categoryKeys.map(key => {
			return [{ value: values[key]?.label ?? key, checked: self.term.categoryKeys?.includes(key) }]
		}),
		div: categoryTable,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback: () => {}, // FIXME to supply a real callback
		striped: false,
		showHeader: true, //false,
		selectAll: true,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})

	return () => {
		//const q = self.q as TermCollectionQValues
		const trs = div.select('table').select('tbody').node().querySelectorAll('tr')

		// this should be in self.q ???
		self.term.termlst = terms.filter((term, i) => {
			const checked = trs[i].querySelectorAll('td')[1].querySelector('input')?.checked
			return checked === true
		})

		const catTrs = categoryTable.select('table').select('tbody').node().querySelectorAll('tr')
		self.q.categoryKeys = self.tw.term.categoryKeys.filter((term, i) => {
			const checked = catTrs[i].querySelectorAll('td')[1].querySelector('input')?.checked
			return checked === true
		})

		self.api.runCallback()
	}
}

export function fillTW(tw) {
	if (!tw.type) tw.type = 'termCollection'
	// TODO: when more termCollection types needed, should assign different q.type here.
	if (!tw.q) tw.q = { mode: 'continuous', type: 'compositePercentage' }
	else tw.q.mode = 'continuous'
	return tw
}
