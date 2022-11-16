import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'
import { Menu } from '#dom/menu'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			const group1 = self.q.groups[0]
			const group2 = self.q.groups[1]
			const values = [...group1.values]
			if (group2.name !== 'Others') return

			div
				.style('padding', '6px')
				.append('div')
				.style('margin', '10px')
				.style('font-size', '0.8rem')
				.html(`<b> ${group1.name}</b> samples. <b>Others</b> excludes these samples`)
			const tableDiv = div.append('div').style('border', '1px solid gray')

			showSamples()

			function showSamples() {
				tableDiv.selectAll('*').remove()
				const rows = []
				for (const value of values) rows.push([{ value: value }])
				const columns = [{ label: 'Sample' }]
				renderTable({
					rows,
					columns,
					div: tableDiv,
					buttons: [
						// {
						// 	text: 'Delete samples',
						// 	callback: indexes => {
						// 		for (const i of indexes) {
						// 			values.splice(i, 1)
						// 		}
						// 		showSamples()
						// 	}
						// },
						{
							text: 'Submit',
							callback: indexes => {
								for (const i of indexes) {
									group2.values.splice(i, 1)
									group1.values.splice(i, 1)
								}
								self.runCallback()
							}
						}
					]
				})
			}
		},
		getPillStatus() {},
		getPillName(d) {
			return getPillNameDefault(self, d)
		}
	}
}

export function fillTW(tw, vocabApi) {}
