import { event as d3event } from 'd3-selection'
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
	const inputdiv = holder.append('div').style('margin', '40px 20px 20px 20px')
	const p = inputdiv.append('p')
	p.append('span').html('Genome&nbsp;')
	const gselect = p.append('select')
	for (const n in genomes) {
		gselect.append('option').text(n)
	}
	const filediv = inputdiv.append('div').style('margin', '20px 0px')
	const saydiv = holder.append('div').style('margin', '10px 20px')
	const visualdiv = holder.append('div').style('margin', '20px')
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
		.html('&times;')
		.on('mousedown', () => {
			document.body.dispatchEvent(new Event('mousedown'))
			d3event.stopPropagation()
		})
		.on('click', () => {
			// clear event handlers
			header_row.on('click', null).on('mousedown', null)
			app_div.selectAll('*').remove()
			if (typeof opts.close === 'function') opts.close()
		})

	const header = header_row
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '5px 10px')

	const body = app_div
		.append('div')
		.attr('class', 'sjpp-output-sandbox-content')
		.style('width', opts.style?.width || '95vw')

	return { header_row, header, body, app_div, id: sandboxId }
}
