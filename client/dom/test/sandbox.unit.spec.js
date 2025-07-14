import tape from 'tape'
import * as d3s from 'd3-selection'
import { newSandboxDiv, renderSandboxFormDiv } from '../sandbox.ts'
import { detectOne } from '../../test/test.helpers.js'

/*
Tests:
	newSandboxDiv(), holder arg only and empty
	newSandboxDiv(), with opts and content
	Insert new sandbox at top
	Expand, collapse, and close buttons
	renderSandboxFormDiv() 
*/

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getSandboxOpts(sandbox) {
	sandbox.header.append('span').text('Test Header')
	sandbox.body.append('div').html(`Test Content`)
	return sandbox
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- dom/sandbox -***-')
	test.end()
})

tape('newSandboxDiv(), holder arg only and empty', async test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox = new newSandboxDiv(holder)

	test.ok(sandbox.header_row, `Should have .header_row`)
	test.ok(sandbox.header, `Should have .header`)
	test.ok(sandbox.body, `Should have .body`)
	test.ok(sandbox.app_div, `Should have .app_div`)
	test.ok(!sandbox.id, `Should not have .id`)

	let elem
	elem = await detectOne({ elem: holder.node(), selector: '.sjpp-sandbox' })
	//If failing, test will timeout before this finishes
	test.ok(elem, `Should render basic sandbox`)

	elem = holder.select('.sjpp-output-sandbox-close-bt').node()
	test.ok(elem, `Should render destroy/delete button`)

	elem = holder.select('.sjpp-output-sandbox-collapse-btn').node()
	test.notEqual(elem.style.display, 'none', `Should render collapse button by default`)

	elem = holder.select('.sjpp-output-sandbox-expand-btn').node()
	test.equal(elem.style.display, 'none', `Should not render expand button by default`)

	elem = holder.select('.sjpp-output-sandbox-header').nodes()
	test.equal(elem.length, 1, `Should render empty header`)

	elem = holder.select('.sjpp-output-sandbox-content').nodes()
	test.ok(elem.length && !elem.innerHTML, `Should render empty content div`)

	if (test._ok) holder.remove()
	test.end()
})

tape('newSandboxDiv(), with opts and content', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox = new newSandboxDiv(holder, { plotId: 1 })
	test.ok(sandbox.id, `Should have sandbox.id`)

	getSandboxOpts(sandbox)
	let elem

	elem = sandbox.header.node()
	test.equal(elem.outerText, 'Test Header', `Should display text in header`)

	elem = sandbox.body.node()
	test.equal(elem.outerText, 'Test Content', `Should display text in body`)

	if (test._ok) holder.remove()
	test.end()
})

tape('Insert new sandbox at top', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox1 = new newSandboxDiv(holder, { plotId: 1 })
	const sandbox2 = new newSandboxDiv(holder, { plotId: 2 })

	let sandboxes

	sandboxes = holder.selectAll(`.sjpp-sandbox`).nodes()
	test.ok(
		sandbox2.id == sandboxes[0].id && sandbox1.id == sandboxes[1].id,
		`Should insert second sandbox before the first sandbox`
	)

	const sandbox3 = new newSandboxDiv(holder, { plotId: 3 })
	sandboxes = holder.selectAll(`.sjpp-sandbox`).nodes()
	test.ok(
		sandbox3.id == sandboxes[0].id && sandbox2.id == sandboxes[1].id && sandbox1.id == sandboxes[2].id,
		`Should insert new, third sandbox before the second and first sandbox`
	)

	if (test._ok) holder.remove()
	test.end()
})

tape('Expand, collapse, and close buttons', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox = new newSandboxDiv(holder)
	getSandboxOpts(sandbox)

	let elem
	elem = holder.select('.sjpp-output-sandbox-collapse-btn').node()
	elem.click()
	test.ok(sandbox.body.node().style.display == 'none', `Sandbox content no longer visible after collapse button click`)

	elem = holder.select('.sjpp-output-sandbox-expand-btn').node()
	elem.click()
	test.ok(sandbox.body.node().style.display == 'block', `Sandbox content visiable again after expand button click`)

	elem = holder.select('.sjpp-output-sandbox-close-bt').node()
	elem.click()
	elem = holder.select('.sjpp-sandbox').node()
	test.ok(
		elem.outerHTML == '<div class="sjpp-sandbox"></div>',
		`Should remove all content from sandbox, leaving an empty div`
	)

	if (test._ok) holder.remove()
	test.end()
})

tape('renderSandboxFormDiv()', async test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const genomes = { hg19: {}, hg38: {} }
	let inputdiv, gselect, filediv, saydiv, visualdiv
	;[inputdiv, gselect, filediv, saydiv, visualdiv] = new renderSandboxFormDiv(holder, genomes)
	const testText = 'Additional input div content'
	inputdiv.append('span').text(testText)
	filediv.append('span').text('File Div')
	saydiv.append('span').text('Say Div')
	visualdiv.append('span').text('Visual Div')

	let elem
	elem = await detectOne({ elem: holder.node(), selector: '.sjpp-sandbox-form-inputDiv' })
	test.ok(elem.childNodes[0].className == 'sjpp-sandbox-form-gselect', `Should render genomes dropdown inside inputdiv`)
	test.ok(elem.childNodes[1].className == 'sjpp-sandbox-form-fileDiv', `Should render fileDiv inside inputdiv`)
	test.equal(elem.childNodes[2].innerText, testText, `Should render test content at the end of inputdiv`)

	elem = holder.select('.sjpp-sandbox-form-gselect').node()
	test.equal(elem.childNodes[0].innerHTML, 'Genome&nbsp;', `Should render 'Genome' prompt first`)
	const gOptions = elem.childNodes[1].childNodes
	const g = Object.keys(genomes)
	test.ok(gOptions[0].innerText == g[0] && gOptions[1].innerText == g[1], `Should render genome options in order`)

	elem = holder.select('.sjpp-sandbox-form-sayDiv').node()
	test.ok(elem, `Should render sayDiv`)

	elem = holder.select('.sjpp-sandbox-form-visualDiv').node()
	test.ok(elem, `Should render visualDiv`)

	if (test._ok) holder.remove()
	test.end()
})
