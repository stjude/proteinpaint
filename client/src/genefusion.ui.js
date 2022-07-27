import * as uiutils from '#dom/uiUtils'
import { select as d3select, selectAll as d3selectAll, event as d3event } from 'd3-selection'

/*
------ EXPORTED ------ 


------ Internal ------ 

*/

export function init_geneFusionUI(holder, genomes, debugmode) {
	const wrapper = holder.append('div')
	makeSectionHeader(wrapper, 'Gene Fusion')
}

function makeSectionHeader(div, text) {
	//maybe more this to uiutils?
	const header = uiutils.makePrompt(div, text)
	header
		.style('font-size', '1.5em')
		.style('color', '#003366')
		.style('margin', '20px 10px 40px 10px')
		.classed('sjpp-databrowser-section-header', true)
	const hr = div.append('hr')
	hr.style('color', 'ligthgrey')
		.style('margin', '-30px 0px 15px 0px')
		.style('width', '50vw')
		.style('opacity', '0.4')
}
