import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			div.selectAll('*').remove()
			const groups = self.q.groups

			for (const group of groups) {
				const groupDiv = div
					.append('div')
					.style('display', 'inline-block')
					.style('vertical-align', 'bottom')
				const callback = indexes => {
					group.values = group.values.filter((elem, index, array) => indexes.includes(index))
					self.runCallback()
				}
				addTable(groupDiv, group, callback)
			}
		},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

function addTable(div, group, callback) {
	const name = group.name == 'Others' ? 'Others will exclude these samples' : group.name
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${name}</b>.`)
	const rows = []
	for (const value of group.values) rows.push([{ value: value.sample }])
	const columns = [{ label: 'Sample' }]
	const buttons = callback
		? [
				{
					text: 'APPLY',
					callback,
					class: 'sjpp_apply_btn sja_filter_tag_btn'
				}
		  ]
		: []

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '25vw',
		maxHeight: '40vh',
		buttons,
		striped: false,
		showHeader: false,
		selectAll: true
	})
}

export function fillTW(tw, vocabApi) {}
