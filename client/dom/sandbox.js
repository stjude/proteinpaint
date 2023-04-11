import { icons } from './control.icons'

/*
Creates sandbox divs, containers running proteinpaint calls, forms, etc. 
independent of one another. 

Required:
.holder
.genomes

****************
    EXPORTED
****************
renderSandboxFormDiv
newSandboxDiv
*/

export function renderSandboxFormDiv(holder, genomes) {
	//Classes for unit testing
	holder.classed('sjpp-sandbox-form', true)
	const inputdiv = holder
		.append('div')
		.style('margin', '40px 20px 20px 20px')
		.classed('sjpp-sandbox-form-inputDiv', true)
	const p = inputdiv.append('p').classed('sjpp-sandbox-form-gselect', true)
	p.append('span').html('Genome&nbsp;')
	const gselect = p.append('select')
	for (const n in genomes) {
		gselect.append('option').text(n)
	}
	//For file select, pathway input, etc.
	const filediv = inputdiv
		.append('div')
		.style('margin', '20px 0px')
		.classed('sjpp-sandbox-form-fileDiv', true)
	//For error messages
	const saydiv = holder
		.append('div')
		.style('margin', '10px 20px')
		.classed('sjpp-sandbox-form-sayDiv', true)
	//For displaying output
	const visualdiv = holder
		.append('div')
		.style('margin', '20px')
		.classed('sjpp-sandbox-form-visualDiv', true)
	return [inputdiv, gselect.node(), filediv, saydiv, visualdiv]
}

const plotIdToSandboxId = {}
const sandboxIdStr =
	Math.random()
		.toString()
		.slice(-6) +
	'-' +
	(+new Date()).toString().slice(-8)
let sandboxIdSuffix = 0

/*
	sandbox_holder: a d3-selection
	opts{}
	.close: optional callback to trigger when the sandbox is closed
	.plotId: optional plot.id, for which a sandbox div ID will be assigned, should not be an 'empty' value (null , undefined, 0)
	.beforePlotId: optional insertion position, a key in the plotIdToSandboxId tracker
*/
export function newSandboxDiv(sandbox_holder, opts = {}) {
	// NOTE: plotId=0 (Number) will not be tracked, assumes a non-empty plotId is used
	const insertSelector = opts.beforePlotId ? '#' + plotIdToSandboxId[opts.beforePlotId] : ':first-child'
	const app_div = sandbox_holder.insert('div', insertSelector).attr('class', 'sjpp-sandbox')
	let sandboxId
	if (opts.plotId) {
		sandboxId = `sjpp-sandbox-${sandboxIdStr}-${sandboxIdSuffix++}`
		app_div.attr('id', sandboxId)
		plotIdToSandboxId[opts.plotId] = sandboxId
	}

	const header_row = app_div
		.append('div')
		.attr('class', 'sjpp-output-sandbox-header')
		.style('width', opts.style?.width || '95vw')

	// close_btn
	header_row
		.append('div')
		.classed('sjpp-output-sandbox-close-bt', true)
		.classed('sja_menuoption', true)
		.style('vertical-align', 'middle')
		.html(
			`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000" class="bi bi-x-lg" viewBox="0 0 16 16">
		  <path stroke='#000' d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
		</svg>`
		)
		.on('mousedown', event => {
			document.body.dispatchEvent(new Event('mousedown'))
			event.stopPropagation()
		})
		.on('click', () => {
			// clear event handlers
			header_row.on('click', null).on('mousedown', null)
			app_div.selectAll('*').remove()
			if (typeof opts.close === 'function') opts.close()
		})

	// placeholder for collapse btn
	const collapseBtnDiv = header_row
		.append('div')
		.classed('sjpp-output-sandbox-collapse-btn', true)
		.classed('sja_menuoption', true)
		.style('vertical-align', 'middle')

	// placeholder for expand btn
	const expandBtnDiv = header_row
		.append('div')
		.classed('sjpp-output-sandbox-expand-btn', true)
		.classed('sja_menuoption', true)
		.style('display', 'none')
		.style('vertical-align', 'sub')

	const header = header_row
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '5px 10px')

	const body = app_div
		.append('div')
		.attr('class', 'sjpp-output-sandbox-content')
		.style('width', opts.style?.width || '95vw')

	let isSandboxContentVisible = true

	// Collapse btn
	icons['collapse'](collapseBtnDiv, {
		fontSize: '1.5em',
		padding: '4px 10px',
		color: 'black',
		handler: expandCollapse
	})
	// Expand btn
	icons['expand'](expandBtnDiv, {
		fontSize: '1.5em',
		padding: '4px 10px',
		color: 'black',
		display: 'none',
		handler: expandCollapse
	})

	function expandCollapse() {
		isSandboxContentVisible = !isSandboxContentVisible
		collapseBtnDiv.style('display', isSandboxContentVisible == true ? 'inline-block' : 'none')
		expandBtnDiv.style('display', isSandboxContentVisible == true ? 'none' : 'inline-block')
		body.style('display', isSandboxContentVisible == true ? 'block' : 'none')
	}

	return { header_row, header, body, app_div, id: sandboxId }
}
