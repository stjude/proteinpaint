import { fillTermWrapper } from '#termsetting'

export class SummaryReport {
	type = 'summaryReport'
}

export async function makeChartBtnMenu(holder, chartsInstance) {
	const countryTW = { id: 'ISOcode' }
	await fillTermWrapper(countryTW, chartsInstance.app.vocabApi)

	const menuDiv = holder
		.append('div')
		.style('overflow', 'auto')
		.style('height', '400px')
		.attr('class', 'sjpp_show_scrollbar')
	menuDiv.append('div').style('padding', '5px').style('color', 'gray').text('Select country:')
	for (const value in countryTW.term.values) {
		const country = countryTW.term.values[value].label
		menuDiv
			.append('button')
			.style('margin', '5px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.style('display', 'block')
			.text(country)
			.on('click', () => {
				window.open('summary.html?country=' + country, '_blank')
				chartsInstance.dom.tip.hide()
			})
	}
}
