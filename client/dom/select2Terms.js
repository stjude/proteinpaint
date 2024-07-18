import { showTermsTree } from '../mass/groups'
import { Menu } from '#dom/menu'

export function select2Terms(tip, app, chartType, detail, callback) {
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
			getTreeTerm(ytermDiv, term => (yterm = term), detail)
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
