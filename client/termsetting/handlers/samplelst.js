import { getPillNameDefault } from '#termsetting'
import { renderTable } from '#dom/table'

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
				.html(`<b>Select ${group1.name}</b> samples. <br><b>Others</b> excludes these samples`)
			const tableDiv = div.append('div').style('font-size', '0.8rem')

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
					maxWidth: '210px',
					buttons: [
						{
							text: 'APPLY',
							callback: indexes => {
								values = values.filter((elem, index, array) => indexes.includes(index))
								group2.values = values
								group1.values = values
								self.runCallback()
							},
							class: 'sjpp_apply_btn sja_filter_tag_btn'
						}
					],
					striped: false,
					showHeader: false,
					selectAll: true
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
