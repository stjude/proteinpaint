import { showTermsTree } from '../mass/groups'
import { Menu } from '#dom/menu'

export function addDynamicScatterForm(tip, app) {
	const tip2 = new Menu({ padding: '5px', offsetX: 30, offsetY: -20 })
	const coordsDiv = tip.d.append('div').attr('class', 'sja_menuoption sja_sharp_border')
	coordsDiv.append('div').html('Select terms to build a new plot').style('font-size', '0.7rem')
	let xterm, yterm
	const xDiv = coordsDiv.append('div').style('padding-top', '5px').html('&nbsp;X&nbsp;&nbsp;')
	const xtermDiv = xDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', (e) => {
			getTreeTerm(xtermDiv, (term) => (xterm = term))
		})

	const yDiv = coordsDiv.append('div').html('&nbsp;Y&nbsp;&nbsp;')
	const ytermDiv = yDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', (e) => {
			getTreeTerm(ytermDiv, (term) => (yterm = term))
		})

	coordsDiv
		.append('div')
		.insert('button')
		.style('margin-left', '100px')
		.text('Submit')
		.on('click', () => {
			app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'sampleScatter',
					term: xterm,
					term2: yterm,
					name: 'Dynamic scatter',
				},
			})
			tip.hide()
		})

	function getTreeTerm(div, callback) {
		const state = { tree: { usecase: { detail: 'term', target: 'sampleScatter' } } }
		//state.nav = {header_mode: 'hide_search'}

		showTermsTree(
			div,
			(term) => {
				callback(term)
				tip2.hide()
				div.selectAll('*').remove()
				div.text(term.name)
			},
			app,
			tip,
			state,
			false
		)
	}
}
