import { getCompInit } from '#rx'
import { rgb } from 'd3-color'
import { defaultcolor } from '../shared/common'

/*
.opts{}
    .index{}

TODOs: 
- Update and add documentation link

Questions: 
    For the column layout: 
        1. Cap number of columns?
        2. Allow y overflow for >2 columns (like Trello)?
*/

class AppDrawerLayoutComp {
	constructor(opts) {
		this.type = 'layout'
		this.opts = this.validateOpts(opts)
		this.dom = {
			holder: opts.dom.holder,
			wrapper: opts.dom.wrapper
		}
		setRenderers(this)
	}

	validateOpts(opts) {
		if (opts.index.columnsLayout) {
			if (opts.index.columnsLayout.length == 0) throw `Missing column objects`
			for (const col of opts.index.columnsLayout) {
				if (!col.name) throw `Missing column .name`
				if (!col.gridarea) throw `Missing column .gridarea for column = ${col.name}`
				if (!col.sections || col.sections.length == 0) throw `Missing section objects for column = ${col.name}`
				for (const section of col.sections) {
					if (!section.id)
						throw `Missing section .id in ${section.name ? `section = ${section.name}` : `column = ${col.name} array`}`
				}
			}
		}
		return opts
	}

	// init() {
	//     try {
	//         // this.dom = {
	//         //     holder: this.opts.dom.holder
	//         // }
	//     } catch (e) {
	//         throw e
	//     }
	// }

	main() {}
}

export const compLayoutInit = getCompInit(AppDrawerLayoutComp)

function setRenderers(self) {
	if (self.opts.index.columnsLayout) columnsLayout(self)
	if (!self.opts.index.columnsLayout) {
		//TODO: display in order
	}
}

function columnsLayout(self) {
	// - Allow user to create multiple columns in parent grid
	const parentGrid = self.dom.wrapper
		.append('div')
		.style('display', 'grid')
		//*************TODO change responsive style to accomodate multiple columns
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('text-align', 'left')

	//Allow user to create multiple parent columns in columnsLayout
	const gridareas = []
	for (const column of self.opts.index.columnsLayout) gridareas.push(column.gridarea)
	parentGrid.style('grid-template-areas', `"${gridareas.toString().replace(',', ' ')}"`)
	for (const col of self.opts.index.columnsLayout) {
		const newCol = parentGrid
			.append('div')
			.style('grid-area', col.gridarea)
			.classed('.sjpp-track-cols', true)
		for (const section of col.sections) addSection(section, newCol)
	}

	function addSection(section, newCol) {
		const newSection = newCol.append('div').attr('id', section.id)
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
}
