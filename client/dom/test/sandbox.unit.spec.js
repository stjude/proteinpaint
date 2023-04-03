import tape from 'tape'
import * as d3s from 'd3-selection'
import { newSandboxDiv } from '#dom/sandbox'
import { detectOne } from '../../test/test.helpers.js'

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

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- dom/sandbox -***-')
	test.end()
})

tape('newSandboxDiv(), holder arg only', async test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox = new newSandboxDiv(holder)

	test.ok(sandbox.header_row, `Should have .header_row`)
	test.ok(sandbox.header, `Should have .header`)
	test.ok(sandbox.body, `Should have .body`)
	test.ok(sandbox.app_div, `Should have .app_div`)
	test.ok(!sandbox.id, `Should not have .id`)

	const domSandbox = await detectOne({ elem: holder.node(), selector: '.sjpp-sandbox' })
	//Test will timeout before this finishes
	test.ok(domSandbox, `Should render basic sandbox`)
	const header = holder.select('.sjpp-output-sandbox-header').nodes()
	test.equal(header.length, 1, `Should render one header`)
	const content = holder.select('.sjpp-output-sandbox-content').nodes()
	test.ok(content.length && !content.innerHTML, `Should render empty content div`)

	if (test._ok) holder.remove()
	test.end()
})

tape.only('newSandboxDiv(), with opts', test => {
	test.timeoutAfter(500)

	const holder = getHolder()
	const sandbox = new newSandboxDiv(holder)

	if (test._ok) holder.remove()
	test.end()
})
