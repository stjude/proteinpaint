import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			div.selectAll('*').remove()
			const groups = self.q.groups
			const keys = Object.keys(self.term.values)
			for (const [i, group] of groups.entries()) {
				const groupDiv = div
					.append('div')
					.style('display', 'inline-block')
					.style('vertical-align', 'top')
				const noButtonCallback = (i, node) => {
					group.values[i].checked = node.checked
				}
				const name = group.in ? keys[i] : `${keys[i]} will exclude these samples`
				addTable(groupDiv, name, group, noButtonCallback)
			}
			div
				.append('div')
				.append('div')
				.style('display', 'inline-block')
				.style('float', 'right')
				.style('padding', '6px 20px')
				.append('button')
				.attr('class', 'sjpp_apply_btn sja_filter_tag_btn')
				.text('Apply')
				.on('click', () => {
					for (const group of groups)
						group.values = group.values.filter(value => !('checked' in value) || value.checked)
					self.runCallback()
				})
		},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

function addTable(div, name, group, noButtonCallback) {
	div
		.style('padding', '6px')
		.append('div')
		.style('margin', '10px')
		.style('font-size', '0.8rem')
		.html(`<b> ${name}</b>.`)
	const rows = []
	for (const value of group.values) rows.push([{ value: value.sample }])
	const columns = [{ label: 'Sample' }]

	renderTable({
		rows,
		columns,
		div,
		maxWidth: '30vw',
		maxHeight: '40vh',
		noButtonCallback,
		striped: false,
		showHeader: false,
		selectAll: true
	})
}

export function fillTW(tw, vocabApi) {}
