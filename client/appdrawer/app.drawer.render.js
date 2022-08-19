import { dofetch3, sayerror } from '#src/client'
import { cardInit } from './card'
import { buttonInit } from './dsButton'
import { select } from 'd3-selection'
import { rgb } from 'd3-color'
import { defaultcolor } from '../shared/common'

export async function init_appDrawer(par) {
	const { holder, apps_sandbox_div, apps_off, genomes } = par
	const re = await dofetch3('/cardsjson')
	if (re.error) {
		sayerror(holder.append('div'), re.error)
		return
	}

	const wrapper = holder
		.append('div')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '20px 10px 10px 10px')

	const renderArgs = {
		columns: re.columns,
		elements: re.elements.filter(e => !e.hidden)
	}

	const pageArgs = {
		apps_sandbox_div,
		apps_off,
		// allow_mdsform: re.allow_mdsform, TODO: Decommission code altogether? no longer relevant
		genomes
	}

	makeParentGrid(wrapper, renderArgs)
	loadElements(renderArgs.elements, pageArgs)
}

/********** Main Layout Functions  ********* 
    - Allow user to create multiple columns in parent grid

    Questions: 
        1. Cap number of columns?
        2. Allow y overflow for >2 columns?
*/

function makeParentGrid(wrapper, renderArgs) {
	const parentGrid = wrapper
		.append('div')
		.style('display', 'grid')
		//*************TODO change responsive style to accomodate multiple columns
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('text-align', 'left')

	//Allow user to create multiple parent columns in columnsLayout
	const gridareas = []
	for (const column of renderArgs.columns) gridareas.push(column.gridarea)
	parentGrid.style('grid-template-areas', `"${gridareas.toString().replace(',', ' ')}"`)
	for (const col of renderArgs.columns) {
		const newCol = parentGrid
			.append('div')
			.style('grid-area', col.gridarea)
			.classed('.sjpp-track-cols', true)
		for (const section of col.sections) addSection(section, newCol)
	}
}

function addSection(section, parentGrid) {
	const newSection = parentGrid.append('div').attr('id', section.id)
	if (section.name)
		newSection
			.append('h5')
			.classed('sjpp-appdrawer-cols', true)
			.style('color', rgb(defaultcolor).darker())
			.text(section.name)
	newSection
		.append('div')
		.classed('sjpp-element-list', true)
		.style('padding', '10px')

	return newSection
}

function loadElements(elements, pageArgs) {
	elements.forEach(element => {
		const holder = select(`#${element.section} > .sjpp-element-list`)
		if (element.type == 'card' || element.type == 'nestedCard') {
			cardInit({
				holder: holder
					.style('display', 'grid')
					.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
					.style('gap', '10px')
					.style('list-style', 'none')
					.style('margin', '15px 0px'),
				element,
				pageArgs
			})
		} else if (element.type == 'dsButton') {
			buttonInit({
				holder,
				element,
				pageArgs
			})
		}
	})
}
