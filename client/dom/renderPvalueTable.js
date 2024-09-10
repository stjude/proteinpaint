import { select } from 'd3-selection'

/*
render a table of p-values

used by survival plot and cuminc plot

input parameter:
{
	title: 'str' value specified by user,
    holder: holder div,
    plot: plot type ('survial' or 'cuminc'),
    tests: [] chart tests,
    s: {} self.settings,
    bins: [] self.refs.bins,
    tip: self.app.tip,
    setActiveMenu: callback for setting self.activeMenu,
    updateHiddenPvalues: callback for updating s.hiddenPvalues
}
*/

export function renderPvalues({ title, holder, plot, tests, s, bins, tip, setActiveMenu, updateHiddenPvalues }) {
	let fontSize

	if (s.axisTitleFontSize) {
		fontSize = s.axisTitleFontSize - 2
	} else fontSize = 15
	const maxPvalsToShow = 10

	holder.selectAll('*').remove()

	// title div
	if (!plot) {
		throw `plot type '${plot}' not recognized`
	}

	holder
		.append('div')
		.style('padding-bottom', '5px')
		.style('font-size', fontSize + 'px')
		.style('font-weight', 'bold')
		.text(title)

	// table div
	// need separate divs for title and table
	// to support table scrolling
	const tablediv = holder.append('div').style('border', '1px solid #ccc')
	if ((plot == 'violin' && tests.pvalues.length > maxPvalsToShow) || tests.length > maxPvalsToShow) {
		tablediv.style('overflow', 'auto').style('height', '220px')
	}
	// in survival plot, individual tests can be hidden by s.hiddenPvalues
	// in cuminc plot, s.hiddenPvalues is not defined
	const visibleTests = s.hiddenPvalues
		? tests.filter(t => !s.hiddenPvalues.find(p => p.series1.id === t.series1.id && p.series2.id === t.series2.id))
		: tests

	if (plot == 'violin' ? visibleTests.pvalues.length : visibleTests.length) {
		const binOrder = bins && bins.length > 0 ? bins.map(b => b.label) : null
		if (binOrder) {
			// series are numeric bins
			// the tests of these series should be sorted as follows

			// within each test, series 1 should have a smaller bin
			// value than series 2
			for (const test of visibleTests) {
				const orderedSeries = [test.series1.id, test.series2.id].sort(
					(a, b) => binOrder.indexOf(a) - binOrder.indexOf(b)
				)
				if (test.series2.id == orderedSeries[0]) {
					test.series1_new = test.series2
					test.series2_new = test.series1
					test.series1 = test.series1_new
					test.series2 = test.series2_new
					delete test.series1_new
					delete test.series2_new
				}
			}

			// then sort tests first by series1 then by series2
			visibleTests.sort(
				(a, b) =>
					binOrder.indexOf(a.series1.id) - binOrder.indexOf(b.series1.id) ||
					binOrder.indexOf(a.series2.id) - binOrder.indexOf(b.series2.id)
			)
		}

		// table
		const table = tablediv.append('table').style('width', '100%')

		// table header
		table
			.append('thead')
			.append('tr')
			.selectAll('td')
			.data(['Group 1', 'Group 2', 'P-value'])
			.enter()
			.append('td')
			.style('padding', '1px 8px 1px 2px')
			.style('color', '#858585')
			.style('position', 'sticky')
			.style('top', '0px')
			.style('background', 'white')
			.style('font-size', fontSize + 'px')
			.text(column => column)

		// table rows
		const tbody = table.append('tbody')

		const tr = tbody
			.selectAll('tr')
			.data(plot == 'violin' ? visibleTests.pvalues : visibleTests)
			.enter()
			.append('tr')
			.attr('class', `pp-${plot}-chartLegends-pvalue`)

		if (plot == 'survival') {
			tr.on('click', (event, t) => {
				const hiddenPvalues = s.hiddenPvalues.slice()
				hiddenPvalues.push(t)
				updateHiddenPvalues(hiddenPvalues)
			})
		}

		// table cells
		tr.selectAll('td')
			.data(d => [d.series1, d.series2, d.pvalue])
			.enter()
			.append('td')
			.attr('aria-label', plot ? 'Click to hide a p-value' : '')
			.style('color', plot == 'violin' ? 'black' : d => d.color)
			.style('padding', '1px 8px 1px 2px')
			.style('font-size', fontSize + 'px')
			.style('cursor', plot == 'survival' ? 'pointer' : 'auto')
			.text(d => (plot == 'violin' ? d : d.text))

		// footnote div
		if (plot == 'cuminc') {
			if (visibleTests.find(test => test.permutation)) {
				holder
					.append('div')
					.style('margin-top', '10px')
					.style('font-size', fontSize - 2 + 'px')
					.text("*computed by permutation of Gray's test statistic")
			}
		}
	}

	if (plot == 'survival') {
		// features specific to survival plot
		const hiddenTests = tests.filter(t =>
			s.hiddenPvalues.find(p => p.series1.id === t.series1.id && p.series2.id === t.series2.id)
		)
		if (hiddenTests.length) {
			holder
				.append('div')
				.style('color', '#aaa')
				.style('cursor', 'pointer')
				.html(`<span style='color:#aaa; font-weight:400'><span>Hidden tests (${hiddenTests.length})</span>`)
				.on('click', event => {
					tip.clear()
					const divs = tip.d
						.append('div')
						.selectAll('div')
						.data(hiddenTests)
						.enter()
						.append('div')
						.each(function (d) {
							setActiveMenu(true)
							const div = select(this)
							div.append('input').attr('type', 'checkbox').style('margin-right', '5px')
							div.append('span').html(`${d.series1.id} vs ${d.series2.id}`)
						})

					tip.d
						.append('button')
						.html('Show checked test(s)')
						.on('click', () => {
							const hiddenPvalues = []
							divs
								.filter(function () {
									return !select(this.firstChild).property('checked')
								})
								.each(d => hiddenPvalues.push(d))
							updateHiddenPvalues(hiddenPvalues)
							tip.hide()
						})

					tip.show(event.clientX, event.clientY)
				})
		}
	}
}
