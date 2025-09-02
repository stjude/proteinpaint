import { icons } from './control.icons'
import type { ClientGenome } from '../types/clientGenome'
import type { Elem } from '../types/d3'
import type { RenderSandboxForm, NewSandboxOpts, NewSandbox } from './types/sandbox'

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

export function renderSandboxFormDiv(holder: Elem, genomes: ClientGenome[]): RenderSandboxForm {
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
	const filediv = inputdiv.append('div').style('margin', '20px 0px').classed('sjpp-sandbox-form-fileDiv', true)
	//For error messages
	const saydiv = holder.append('div').style('margin', '10px 20px').classed('sjpp-sandbox-form-sayDiv', true)
	//For displaying output
	const visualdiv = holder.append('div').style('margin', '20px').classed('sjpp-sandbox-form-visualDiv', true)
	return [inputdiv, gselect.node(), filediv, saydiv, visualdiv]
}

const plotIdToSandboxId = {}
const sandboxIdStr = Math.random().toString().slice(-6) + '-' + (+new Date()).toString().slice(-8)
let sandboxIdSuffix = 0

/*
	sandbox_holder: a d3-selection
*/

export function newSandboxDiv(sandbox_holder: Elem, opts: Partial<NewSandboxOpts> = {}): NewSandbox {
	// NOTE: plotId=0 (Number) will not be tracked, assumes a non-empty plotId is used
	const insertSelector = opts.beforePlotId
		? opts.beforePlotId in plotIdToSandboxId
			? '#' + plotIdToSandboxId[opts.beforePlotId]
			: `#${opts.beforePlotId}`
		: ':first-child'
	const app_div = sandbox_holder.insert('div', insertSelector).attr('class', 'sjpp-sandbox')
	let sandboxId: string
	if (opts.plotId) {
		sandboxId = `sjpp-sandbox-${sandboxIdStr}-${sandboxIdSuffix++}`
		app_div.attr('id', sandboxId)
		plotIdToSandboxId[opts.plotId] = sandboxId
	}

	const header_row = app_div
		.append('div')
		.attr('class', 'sjpp-output-sandbox-header')
		.style('width', opts.style?.width || '95vw')
		.style('border', '1px solid #ccc')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'left')

	const hoverInColor = 'blue'
	const hoverOutColor = 'black'

	// close_btn
	const closeBtn = header_row
		.append('div')
		.classed('sjpp-output-sandbox-close-bt', true)
		// .classed('sja_menuoption', true)
		.style('cursor', 'pointer')
		.style('vertical-align', 'middle')
		.on('mouseenter', () => {
			const path = closeBtn.select('path')
			path.attr('stroke', hoverInColor)
		})
		.on('mouseleave', () => {
			const path = closeBtn.select('path')
			path.attr('stroke', hoverOutColor)
		})
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
		.attr('title', 'Click to collapse or expand this chart sandbox')
		.classed('sjpp-output-sandbox-collapse-btn', true)
	// .classed('sja_menuoption', true)
	//.style('vertical-align', 'middle')

	// placeholder for expand btn
	const expandBtnDiv = header_row
		.append('div')
		.classed('sjpp-output-sandbox-expand-btn', true)
		// .classed('sja_menuoption', true)
		.style('display', 'none')
	//.style('vertical-align', 'sub')

	const header = header_row
		.append('div')
		.attr('id', 'sandbox-header-text')
		.style('display', 'inline-flex')
		.style('align-items', 'center')
		.style('justify-content', 'left')
		.style('padding', '5px 10px')

	const body = app_div
		.append('div')
		.attr('class', 'sjpp-output-sandbox-content sjpp_show_scrollbar')
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

	collapseBtnDiv
		.on('mouseenter', () => {
			const path = collapseBtnDiv.select('path')
			path.attr('stroke', hoverInColor)
		})
		.on('mouseleave', () => {
			const path = collapseBtnDiv.select('path')
			path.attr('stroke', hoverOutColor)
		})

	expandBtnDiv
		.on('mouseenter', () => {
			const path = expandBtnDiv.select('path')
			path.attr('stroke', hoverInColor)
		})
		.on('mouseleave', () => {
			const path = expandBtnDiv.select('path')
			path.attr('stroke', hoverOutColor)
		})

	function expandCollapse() {
		isSandboxContentVisible = !isSandboxContentVisible
		collapseBtnDiv.style('display', isSandboxContentVisible == true ? 'inline-block' : 'none')
		expandBtnDiv.style('display', isSandboxContentVisible == true ? 'none' : 'inline-block')
		body.style('display', isSandboxContentVisible == true ? 'block' : 'none')
	}

	return { header_row, header, body, app_div, id: sandboxId! }
}
