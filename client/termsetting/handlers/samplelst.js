import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'
import { Menu } from '#dom/menu'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			const group1 = self.q.groups[0]
			const group2 = self.q.groups[1]

			div
				.style('padding', '4px')
				.append('div')
				.html('&nbsp;' + group1.name)
				.style('font-size', '0.7rem')
			const tableDiv = div.append('div')
			div
				.append('div')
				.html('<b>Others</b> group excludes these samples')
				.style('font-size', '0.7rem')
			if (group2.name === 'Others') {
				showSamples()

				function showSamples() {
					tableDiv.selectAll('*').remove()
					const rows = []
					for (const value of group1.values) rows.push([{ value: value }])
					const columns = [{ label: 'Sample' }]
					renderTable({
						rows,
						columns,
						div: tableDiv,
						deleteCallback: i => {
							group2.values.splice(i, 1)
							group1.values.splice(i, 1)
							showSamples()
							self.runCallback()
						}
					})
				}
			}
		},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

export function fillTW(tw, vocabApi) {}
