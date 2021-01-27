import React from 'react'
import ReactDOM from 'react-dom'
import { App, getUrlParams } from './App'
import tape from 'tape'
import { select } from 'd3-selection'
import { getWindow } from '../../../test/fake.window'
import serverconfig from '../../../serverconfig.json'

/*************************
 reusable helper functions
**************************/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- gdc/views.js -***-')
	select('#pp-test-runner-banner').text('$ npm run test-react')
	test.end()
})

tape('lolliplot', async test => {
	test.timeoutAfter(30000)
	test.plan(4)
	const windowObj = getWindow('test', {
		href: window.location.href,
		location: { pathname: '/genes/ENSG00000142208' },
		addressCallback: () => portal.resetParamsFromUrl()
	})
	const holder = windowObj.dom.holder
	const portal = ReactDOM.render(
		<App basepath={`http://localhost:${serverconfig.port}`} window={windowObj} />,
		holder.node()
	)
	await sleep(5500)
	const numCircles = 256
	test.equal(
		holder.selectAll('circle').size(),
		numCircles,
		`should have ${numCircles} circles on initial load with gene='AKT1'`
	)

	// click set_id checkbox
	const set_id_checkbox = holder.selectAll('#set_switch')
	set_id_checkbox.node().click()
	await sleep(4000)
	const setCircles = 15
	test.equal(
		holder.selectAll('circle').size(),
		setCircles,
		`should have ${setCircles} circles after applying set_id filter`
	)

	// change gene
	const btns = holder.node().querySelectorAll('button')
	const alk_btn = btns[3]
	alk_btn.click()
	await sleep(4000)
	const alkCircles = 37
	test.equal(
		holder.selectAll('circle').size(),
		alkCircles,
		`should have ${alkCircles} circles after changing gene to 'ALK'`
	)

	// apply filter
	const projectFilter = {
		op: 'AND',
		content: [{ op: 'IN', content: { field: 'cases.project.project_id', value: 'TCGA-GBM' } }]
	}
	windowObj.dom.addressbar
		.property('value', windowObj.location.pathname + `?filters=${encodeURIComponent(JSON.stringify(projectFilter))}`)
		.on('change')()
	await sleep(4000)
	const filteredCircles = 51
	test.equal(
		holder.selectAll('circle').size(),
		filteredCircles,
		`should have ${filteredCircles} circles after applying filter`
	)
	// currently unable to test using a token via the submit button,
	// since it will reveal user specific token here, may
	// need a testing-only generic token if possible
	test.end()
})
