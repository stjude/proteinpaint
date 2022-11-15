import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'
import { Menu } from '#dom/menu'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			div.style('padding', '4px')
			const group2 = self.q.groups[1]
			if (group2.name === 'Others') {
				showSamples()

				function showSamples() {
					div.selectAll('*').remove()
					const values = self.q.groups[0].values
					const rows = []
					for (const value of values) rows.push([{ value: value }])
					const columns = [{ label: 'Sample' }]
					renderTable({
						rows,
						columns,
						div,
						deleteCallback: i => {
							group2.values.splice(i, 1)
							values.splice(i, 1)
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
