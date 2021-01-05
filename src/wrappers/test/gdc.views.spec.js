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
	test.timeoutAfter(8000)
	test.plan(1)
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
	test.end()
})
