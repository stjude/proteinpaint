import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import tape from 'tape'
import { select } from 'd3-selection'

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
	test.timeoutAfter(6000)
	test.plan(1)
	const holder = select('body').append('div')
	// give time for browserify split-require plugin to set the bin path
	// before the App uses history.replaceState() to change the URL pathname
	await sleep(100)
	ReactDOM.render(<App />, holder.node())
	await sleep(4000)
	const numCircles = 256
	test.equal(
		holder.selectAll('circle').size(),
		numCircles,
		`should have ${numCircles} circles on initial load with gene='AKT1'`
	)
	window.history.replaceState('', null, '/testrun.html')
	test.end()
})
