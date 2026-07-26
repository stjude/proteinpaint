import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import { renderTable } from '#dom'
import type { CollectionBase } from '#tw'
import type { CategoryKey, TermCollectionQCont, TermCollectionQFraction } from '#types'
import { termItemType } from '#shared/terms.js'
import type { TermSetting } from '../TermSetting.ts'

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
		const terms = self.term.termlst
		const groupDiv = div.append('div')
		const callback =
			this.tw.term.memberType == 'numeric'
				? self.tw.type === 'TermCollectionTWFraction'
					? addFractionTable(self, groupDiv, terms)
					: addNumericTable(self, groupDiv, terms)
				: addCategoricalTable(self, groupDiv, terms)

		const buttons = div.append('div').style('padding', '6px 20px')
		if (self.data?.isStagedFractionSelection) {
			buttons.append('button').style('margin-right', '8px').text('Cancel').on('click', self.data.cancelStagedSelection)
		}
		buttons
			.append('button')
			.attr('data-testid', 'sjpp-term-collection-members-apply')
			.text('Apply')
			.on('click', callback)
	}

	async showBinsEditMenu(div: any) {
		const self = this.termsetting
		div.selectAll('*').remove()
		const { NumericHandler } = await import('./NumericHandler.ts')
		const { NumDiscreteEditor } = await import('./NumDiscreteEditor.ts')
		const numericHandler = new NumericHandler({ termsetting: self })
		// A fraction has a fixed numeric domain, so the bin editor does not need
		// to request a cohort density plot (which may also be unavailable for a
		// newly staged custom collection).
		const densityData = { min: 0, max: 1 }
		numericHandler.density_data = densityData
		numericHandler.density.density_data = densityData
		numericHandler.density.no_density_data = true
		numericHandler.density.showViolin = async div => {
			div.selectAll('*').remove()
			div.append('div').style('padding', '10px 5px').text('Fraction range is 0 to 1.')
			return densityData
		}
		numericHandler.density.setBinLines = async () => {}
		const editor = new NumDiscreteEditor({ termsetting: self }, numericHandler as any)
		await editor.showEditMenu(div.append('div'))
		const buttons = div.append('div').style('margin', '0px 0px 10px 12px')
		buttons
			.append('button')
			.attr('data-testid', 'sjpp-term-collection-bins-apply')
			.text('Apply')
			.on('click', () => {
				const editedQ: any = editor.getEditedQ()
				self.q = {
					...editedQ,
					denominators: (self.q as any).denominators,
					numerators: (self.q as any).numerators
				}
				self.dom.tip.hide()
				self.api.runCallback()
			})
		buttons
			.append('button')
			.style('margin-left', '8px')
			.text('Reset')
			.on('click', () => editor.undoEdits())
	}

	getPillStatus() {
		return this.tw.getStatus(this.termsetting.usecase)
	}
}

function addFractionTable(self, div: any, terms: any) {
	const selectedRows = getSelectedRows(self, terms)
	const rows = terms.map(term => [
		{},
		{
			html: `<input type='checkbox' data-testid='sjpp-term-collection-numerator' ${
				self.q.numerators?.includes(term.id) ? 'checked' : ''
			} ${self.q.denominators?.includes(term.id) ? '' : 'disabled'} />`
		}
	])
	const syncNumerators = () => {
		for (const tr of div.select('table').select('tbody').node().querySelectorAll('tr')) {
			const denominator = tr.querySelector(
				'input[type="checkbox"]:not([data-testid="sjpp-term-collection-numerator"])'
			) as HTMLInputElement | null
			const numerator = tr.querySelector('[data-testid="sjpp-term-collection-numerator"]') as HTMLInputElement | null
			if (!denominator || !numerator) continue
			numerator.disabled = !denominator.checked
			if (!denominator.checked) numerator.checked = false
		}
	}
	renderTable({
		rows,
		columns: [getTermNameColumn(self, terms), { label: 'Numerator' }],
		div,
		maxHeight: '40vh',
		noButtonCallback: syncNumerators,
		striped: false,
		showHeader: true,
		selectedRows,
		columnButtons: undefined,
		buttons: undefined
	})
	div
		.select('table')
		.select('thead')
		.select('[data-testid="sjpp-table-checkall"]')
		.node()
		?.parentElement?.append(' Denominator')

	return () => {
		const trs = div.select('table').select('tbody').node().querySelectorAll('tr')
		const lst = getSelectedTermIds(terms, trs)
		const numerators = terms
			.filter((_, i) => {
				const input = trs[i].querySelector('[data-testid="sjpp-term-collection-numerator"]') as HTMLInputElement | null
				return input?.checked === true
			})
			.map(term => term.id)
		if (!lst.length) return window.alert('Select at least one denominator.')
		if (!numerators.length) return window.alert('Select at least one numerator.')
		const q = self.q as TermCollectionQFraction
		q.denominators = lst
		q.numerators = numerators
		self.api.runCallback()
	}
}

function addNumericTable(self, div: any, terms: any) {
	const selectedRows = getSelectedRows(self, terms)
	const rows: any = []
	for (const [index, term] of terms.entries()) {
		const selected = selectedRows.includes(index)
		const checked = selected && self.q.numerators?.includes(term.id) ? 'checked' : ''
		const disabled = selected ? '' : 'disabled'
		rows.push([
			{},
			{
				html: `<input type='checkbox' data-testid='sjpp-term-collection-sort-member' ${checked} ${disabled} />`
			}
		])
	}

	const columns: any = [getTermNameColumn(self, terms), { label: 'Use for sorting' }]
	const noButtonCallback = () => {
		// Check-all reports both the member and custom sorting inputs. Resync every
		// row so this does not depend on the callback's interleaved input indexes.
		for (const tr of div.select('table').select('tbody').node().querySelectorAll('tr')) {
			const memberCheckbox = tr.querySelector(
				'input[type="checkbox"]:not([data-testid="sjpp-term-collection-sort-member"])'
			) as HTMLInputElement | null
			const sortingCheckbox = tr.querySelector(
				'[data-testid="sjpp-term-collection-sort-member"]'
			) as HTMLInputElement | null
			if (!memberCheckbox || !sortingCheckbox) continue
			sortingCheckbox.disabled = !memberCheckbox.checked
			if (!memberCheckbox.checked) sortingCheckbox.checked = false
		}
	}

	renderTable({
		rows,
		columns,
		div,
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

		q.lst = getSelectedTermIds(terms, trs)

		q.numerators = terms
			.filter((term, i) => {
				const checked = trs[i].querySelector('[data-testid="sjpp-term-collection-sort-member"]')?.checked
				return checked === true
			})
			.map(t => t.id)

		self.api.runCallback()
	}
}

function addCategoricalTable(self, div: any, terms: any) {
	const rows: any = []
	for (let i = 0; i < terms.length; i++) {
		rows.push([{}])
	}
	const selectedRows = getSelectedRows(self, terms)

	const columns: any = [getTermNameColumn(self, terms)]

	renderTable({
		rows,
		columns,
		div: div.append('div').style('margin-top', '10px'),
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback: () => {
			// TODO disable "Apply" btn when no terms are selected
		},
		striped: false,
		showHeader: true, //false,
		selectedRows,
		columnButtons: undefined, //Leave until table.js is typed
		buttons: undefined
	})

	const categoryDiv = div.append('div').style('margin-top', '15px')
	// Merge .values from all termlst entries; safe when termlst is empty or entries lack .values
	const values = Object.assign({}, ...(self.tw.term.termlst?.map((t: any) => t.values || {}) ?? []))
	const categoryTable = categoryDiv.append('div')
	const ckSource: CategoryKey[] = self.tw.q.categoryKeys || self.tw.term.categoryKeys || []
	renderTable({
		columns: [{ label: 'CATEGORIES' }],
		rows: ckSource.map((ck: CategoryKey) => {
			return [{ value: values[ck.key]?.label ?? ck.key, checked: ck.shown }]
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

		self.q.lst = getSelectedTermIds(terms, trs)

		const catTrs = categoryTable.select('table').select('tbody').node().querySelectorAll('tr')
		self.q.categoryKeys = ckSource.map((ck: CategoryKey, i: number) => {
			const checked = catTrs[i].querySelectorAll('td')[1].querySelector('input')?.checked
			return { key: ck.key, shown: !!checked }
		})

		self.api.runCallback()
	}
}

function getSelectedRows(self, terms) {
	if (self.tw.type === 'TermCollectionTWFraction') {
		const selectedIds = new Set(self.q.denominators || [])
		return terms.map((term, index) => (selectedIds.has(term.id) ? index : -1)).filter(index => index !== -1)
	}
	const selectedIds =
		self.q.lst?.length > 0
			? new Set(self.q.lst)
			: new Set(self.term.termIds?.length > 0 ? self.term.termIds : terms.map(term => term.id))
	return terms.map((term, index) => (selectedIds.has(term.id) ? index : -1)).filter(index => index !== -1)
}

function getSelectedTermIds(terms, trs) {
	return terms
		.filter((_, i) => trs[i].querySelectorAll('td')[1].querySelector('input')?.checked === true)
		.map(term => term.id)
}

function getTermNameColumn(self, terms) {
	if (!terms?.[0]) throw new Error('terms[0] missing')
	return {
		label: termItemType(terms[0]),
		fillCell(td, index) {
			const term = terms[index]
			const color = self.term.propsByTermId?.[term.id]?.color || term.color
			if (color) {
				td.append('span')
					.attr('data-testid', 'sjpp-term-collection-member-color')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('margin-right', '5px')
					.style('background-color', color)
			}
			td.append('span').text(term.name)
		}
	}
}

export function fillTW(tw) {
	if (!tw.type) tw.type = 'termCollection'
	// TODO: when more termCollection types needed, should assign different q.type here.
	if (!tw.q) tw.q = { mode: 'continuous', type: 'compositePercentage' }
	else tw.q.mode = 'continuous'
	return tw
}
