import tape from 'tape'
import * as d3s from 'd3-selection'
import { make_radios } from '#dom'

/* Tests
	 - default radio button rendering
	 - Missing callbacks
	 - Duplicate callbacks
*/

/**************
 helper functions
***************/

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
	test.comment('-***- dom/radiobutton -***-')
	test.end()
})

tape('default radio button rendering', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

	const styles = {
		padding: '10px',
		display: 'inline-block',
		color: 'red'
	}

	const options = [
		{
			checked: true,
			label: 'Test button',
			title: 'test',
			value: 1
		},
		{
			checked: false,
			label: 'Test button 2',
			title: 'test',
			value: 2
		}
	]

	const testArgs = {
		holder,
		styles,
		options,
		callback: () => {
			//Comment so eslint doesn't complain
		}
	}

	const { divs, labels, inputs, main } = make_radios(testArgs)

	/** Divs */
	const divData = divs.nodes().map((d: any) => d.__data__)
	test.deepEqual(divData, options, 'Should create divs with the correct data')

	/** Labels */
	const renderedLabels = labels.nodes()
	test.equal(renderedLabels.length, options.length, `Should create ${options.length} radio buttons`)
	const divStyles = divs.nodes()[0].style
	test.true(
		divStyles.display == styles.display && divStyles.color == styles.color && divStyles.padding == styles.padding,
		'Should render divs with opts.styles'
	)

	/** Inputs */
	const renderedInputs = inputs.nodes()
	test.equal(renderedInputs[0].checked, true, `Should check the first button`)

	/** .main() */
	main(2)
	test.equal(renderedInputs[1].checked, true, `Should check the second button when main is called with it's value`)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Missing callbacks', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

	const options = [
		{
			checked: true,
			label: 'Test button',
			title: 'test',
			value: 1
		},
		{
			checked: false,
			label: 'Test button 2',
			title: 'test',
			value: 2
		}
	]

	const testArgs = {
		holder,
		options
	}

	const message = 'Should throw when no callback(s) provided'
	try {
		make_radios(testArgs)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Duplicate callbacks', test => {
	test.timeoutAfter(100)
	const holder = getHolder() as any

	const options = [
		{
			checked: true,
			label: 'Test button',
			title: 'test',
			value: 1
		},
		{
			checked: false,
			label: 'Test button 2',
			title: 'test',
			value: 2
		}
	]

	const testArgs = {
		holder,
		options,
		callback: () => {
			//Comment so eslint doesn't complain
		},
		listeners: {
			input: () => {
				//Comment so eslint doesn't complain
			}
		}
	}

	const message = 'Should throw when both callback() and listeners() provided'
	try {
		make_radios(testArgs)
		test.fail(message)
	} catch (e: any) {
		test.pass(`${message}: ${e.message || e}`)
	}

	if (test['_ok']) holder.remove()
	test.end()
})
