import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'
import { Menu } from '#dom/menu'

export function getHandler(self) {
	return {
		showEditMenu(div) {
			const group1 = self.q.groups[0]
			const group2 = self.q.groups[1]
			let values = [...group1.values]
			if (group2.name !== 'Others') return

			div
				.style('padding', '6px')
				.append('div')
				.style('margin', '10px')
				.style('font-size', '0.8rem')
				.html(`<b>Select ${group1.name}</b> samples. <b>Others</b> excludes these samples`)
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
						{
							text: 'Submit',
							callback: indexes => {
								values = values.filter((elem, index, array) => !(index in indexes))
								group2.values = values
								group1.values = values
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
