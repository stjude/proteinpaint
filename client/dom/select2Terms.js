import { showTermsTree } from '../mass/groups'
import { Menu } from '#dom/menu'

//This function builds an intermediate UI to select two terms from a tree.
//It receives a callback that will be called with the two terms selected.
//it is used, for example, to create a scatter plot using the two numeric terms selected as coordinates,
// and to create a facet table where the rows and columns are filled with the categories from the two terms selected.
//If detail2 is provided, it will be used to filter the second term based on this value. Used for the run chart that requires date for the first time
// and a numeric term for the second value that is not a date.
export function select2Terms(tip, app, chartType, detail, callback, detail2) {
	const tip2 = new Menu({ padding: '5px' })
	const coordsDiv = tip.d.append('div').style('padding', '5px') //.attr('class', 'sja_menuoption sja_sharp_border')
	coordsDiv.append('div').html('Select variables to plot').style('font-size', '0.9rem')
	let xterm, yterm
	const xDiv = coordsDiv.append('div').style('padding-top', '5px').html('&nbsp;X&nbsp;&nbsp;')
	const xtermDiv = xDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', e => {
			getTreeTerm(xtermDiv, term => (xterm = term), detail)
		})

	const yDiv = coordsDiv.append('div').html('&nbsp;Y&nbsp;&nbsp;')
	const ytermDiv = yDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', e => {
			getTreeTerm(ytermDiv, term => (yterm = term), detail2 || detail)
		})

	const submitbt = coordsDiv
		.append('div')
		.style('float', 'right')
		.style('padding', '5px')
		.insert('button')
		.text('Submit')
		.property('disabled', true)
		.on('click', () => {
			callback(xterm, yterm)
			tip.hide()
		})

	function getTreeTerm(div, callback, detail) {
		const state = { tree: { usecase: { detail, target: chartType } } }
		//state.nav = {header_mode: 'hide_search'}
		const disable_terms = []
		if (xterm) disable_terms.push(xterm)
		if (yterm) disable_terms.push(yterm)
		showTermsTree(
			div,
			term => {
				callback(term)
				tip2.hide()
				div.selectAll('*').remove()
				div.text(term.name)
				if (xterm != null && yterm != null) submitbt.property('disabled', false)
			},
			app,
			tip,
			state,
			false,
			false,
			disable_terms
		)
	}
}
