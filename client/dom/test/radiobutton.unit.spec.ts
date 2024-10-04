import tape from 'tape'
import * as d3s from 'd3-selection'
import { make_radios } from '#dom'
import { Elem } from '../../types/d3'

/* Tests
    make_radios()
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
	test.pass('-***- dom/radiobutton -***-')
	test.end()
})

tape('default make_radios()', test => {
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
			//Comment so ts doesn't complain
		}
	}

	const { divs, labels, inputs, main } = make_radios(testArgs)

	/** Labels */
	const renderedLabels = labels.nodes()
	test.equal(renderedLabels.length, options.length, `Should create ${options.length} radio buttons`)
	const labelStyles = renderedLabels[0].style
	test.true(
		labelStyles.display == styles.display && labelStyles.color == styles.color && labelStyles.padding == styles.padding,
		'Should render labels with opts.styles'
	)

	/** Inputs */
	const renderedInputs = inputs.nodes()
	test.equal(renderedInputs[0].checked, true, `Should check the first button`)

	/** .main() */
	main(2)
	test.equal(renderedInputs[1].checked, true, `Should check the second button when main is called with it's value`)

	if (test['__ok']) holder.remove()
	test.end()
})
