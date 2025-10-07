import { appInit } from '#termdb/app'
import { Menu } from '#dom'

/*
FIXME return tw but not term

a ui to select two terms from termdb tree and submit them to a callback
example usage: dynamic scatter using two numeric terms, facet table using any two terms

args:
	tip
		in which this ui is shown
	app
		.getState()
	chartType:string
	detail{}
		optional, filters both X & Y terms
	callback
	detail2{}
		if provided, only filters the Y term.
		Used for the run chart that requires date for the first time and a numeric term for the second value that is not a date.
*/
export function select2Terms(tip, app, chartType, detail, callback, detail2) {
	const tip2 = new Menu({
		// creates tip2 on every launch
		padding: '5px',
		parent_menu: tip.d.node() // uses tip as parent to avoid hiding tip when toggling tabs inside tip2
	})

	// registers each selected terms FIXME use tw
	let xterm, yterm

	// label for each term. tailor by chartType
	let xlab = 'X',
		ylab = 'Y'
	if (chartType == 'facet') {
		ylab = 'Row&nbsp;&nbsp;&nbsp;' // spaces for equal width
		xlab = 'Column'
	}

	const d0 = tip.d.append('div').style('margin', '10px')
	{
		const row = d0.append('div')
		row
			.append('span')
			.html(xlab + '&nbsp;')
			.style('font-family', 'Courier')
		const xdiv = row
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.text('+')
			.on('click', e => {
				getTreeTerm(xdiv, term => (xterm = term), detail)
			})
	}
	{
		const row = d0.append('div').style('margin', '1px 0px 5px 0px')
		row
			.append('span')
			.html(ylab + '&nbsp;')
			.style('font-family', 'Courier')
		const ydiv = row
			.append('div')
			.attr('class', 'sja_filter_tag_btn add_term_btn')
			.text('+')
			.on('click', e => {
				getTreeTerm(ydiv, term => (yterm = term), detail2 || detail)
			})
	}

	const row = d0.append('div')
	const submitBtn = row
		.append('button')
		.text('Submit')
		.property('disabled', true)
		.on('click', () => {
			callback(xterm, yterm)
			tip.hide()
		})
	row.append('span').html('&nbsp;Select two variables to plot').style('opacity', 0.6).style('font-size', '.7em')

	function getTreeTerm(div, callback, detail) {
		const disable_terms = []
		if (xterm) disable_terms.push(xterm)
		if (yterm) disable_terms.push(yterm)
		appInit({
			holder: tip2.clear().showunder(div.node()).d,
			vocabApi: app.vocabApi,
			state: {
				activeCohort: app.getState().activeCohort,
				tree: { usecase: { detail, target: chartType } }
			},
			tree: {
				disable_terms,
				click_term: term => {
					/////////////////////////////////////////
					// note! geneVariant yields a tw but not term; future fix is for this ui to return tw but not term
					/////////////////////////////////////////
					const t = term.term || term
					callback(t)
					tip2.hide()
					div.text(t.name)
					if (xterm != null && yterm != null) submitBtn.property('disabled', false)
				}
			}
		})
	}
}
