import { getPillNameDefault } from '../utils.ts'
import type { PillData } from '../types'
import { renderTable } from '#dom'

// self is the termsetting instance
export function getHandler(self) {
	return {
		showEditMenu(div: any) {
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
					self.q.numerators = terms.filter(term => term.checked).map(t => t.id)
					self.api.runCallback!()
				})
		},
		getPillStatus() {
			//ignnore
		},
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		}
	}
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
