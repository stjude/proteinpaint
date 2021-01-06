import React from 'react'
import ReactDOM from 'react-dom'
import { App, getUrlParams } from './App'
import tape from 'tape'
import { select } from 'd3-selection'
import { getWindow } from '../../../test/fake.window'

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
	test.timeoutAfter(20000)
	test.plan(3)
	const windowObj = getWindow('test', { href: window.location.href, location: { pathname: '/genes/ENSG00000142208' } })
	const holder = windowObj.dom.holder
	ReactDOM.render(<App dataKey="abc123" window={windowObj} />, holder.node())
	await sleep(5000)
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
	const alk_btn = btns[2]
	alk_btn.click()
	await sleep(4000)
	const alkCircles = 37
	test.equal(
		holder.selectAll('circle').size(),
		alkCircles,
		`should have ${alkCircles} circles after changing gene to 'ALK'`
	)

	test.end()
})
