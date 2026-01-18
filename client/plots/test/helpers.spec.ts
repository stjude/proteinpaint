import { detectLst } from '../../test/test.helpers'

/*
common helpers for various charts
*/

// detect given number of violin plots; each violin has two path.sjpp-vp-path, thus *2!!
export async function testViolinByCount(test: any, div: any, count: number): Promise<void> {
	const groups = await detectLst({ elem: div.node(), selector: 'path.sjpp-vp-path', count: count * 2 })
	test.ok(groups, `Detected ${count} violin <path class=sjpp-vp-path>`)
}

export function testSurvivalByCount(test: any, survival: any, count: number) {
	// todo change to detectLst()
	const survivalDiv = survival.Inner.dom.chartsDiv
	test.equal(survivalDiv.selectAll('.sjpp-survival-series').size(), count, `should render ${count} survival series <g>`)
}

export function testScatter(test: any, scatter: any, plotCount: number) {
	test.equal(scatter.Inner.model.charts.length, plotCount, `should render ${plotCount} scatter plots`)
	for (let i = 0; i < scatter.Inner.model.charts.length; i++) {
		const chart = scatter.Inner.model.charts[i]
		const scatterDiv = chart.chartDiv
		const serieG = scatterDiv.select('.sjpcb-scatter-series')
		const numSymbols = serieG.selectAll('path').size()
		test.equal(
			numSymbols,
			chart.data.samples.length,
			`In ${i}th plot, should be ${chart.data.samples.length}. Rendered ${numSymbols} symbols.`
		)
	}
}
