import { dofetch, dofetch2, dofetch3, sayerror, tab_wait, appear } from '#src/client'
import { cardInit } from './ad.card'
import { buttonInit } from './ad.dsButton'
import { event, select, selectAll } from 'd3-selection'
// import {rgb} from 'd3-color'

export async function init_appDrawer(par) {
	const { holder, apps_sandbox_div, apps_off, genomes } = par
	const re = await dofetch2('/cardsjson')
	if (re.error) {
		sayerror(holder.append('div'), re.error)
		return
	}

	const wrapper = holder
		.append('div')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')

	const render_args = {
		columns: re.columns,
		elements: re.elements.filter(e => !e.hidden)
	}

	const pageArgs = {
		apps_sandbox_div,
		apps_off,
		// allow_mdsform: re.allow_mdsform, TODO: Decommission code altogether? no longer relevant
		genomes
	}

	makeParentGrid(wrapper, render_args)
	loadElements(render_args.elements, pageArgs)
}

/********** Main Layout Functions  ********* 
    - Allow user to create multiple columns in parent grid

    Questions: 
        1. Cap number of columns?
        2. Allow y overflow for >2 columns?
*/

function makeParentGrid(wrapper, render_args) {
	const parentGrid = wrapper
		.append('div')
		.style('display', 'grid')
		//*************TODO change responsive style to accomodate multiple columns
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('gap', '10px')
		// .style('background-color', '#f5f5f5')
		.style('padding', '10px 20px')
		.style('text-align', 'left')

	//Allow user to create multiple parent columns in columnsLayout
	const gridareas = []
	for (const column of render_args.columns) gridareas.push(column.gridarea)
	parentGrid.style('grid-template-areas', `"${gridareas.toString().replace(',', ' ')}"`)
	for (const col of render_args.columns) {
		const newCol = parentGrid
			.append('div')
			.style('grid-area', col.gridarea)
			.classed('.sjpp-appdrawer-col', true)
		for (const section of col.sections) addSection(section, newCol)
	}
}

function addSection(section, parentGrid) {
	const newSection = parentGrid.append('div').attr('id', section.id)
	section.name ? newSection.append('h3').text(section.name) : ''
	newSection
		.append('ul')
		.classed('sjpp-element-list', true)
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('list-style', 'none')
		.style('padding', '10px')
	return newSection
}

function loadElements(elements, pageArgs) {
	elements.forEach(element => {
		const holder = select(`#${element.section} > .sjpp-element-list`)
		if (element.type == 'card' || element.type == 'nestedCard') {
			cardInit({
				holder,
				element,
				pageArgs
			})
		} else if (element.type == 'button') {
			buttonInit({
				holder,
				element
			})
		}
	})
}
