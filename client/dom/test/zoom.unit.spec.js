import tape from 'tape'
import { select } from 'd3-selection'
import { zoom } from '#dom/zoom'

/*
Tests:
	renders the expected elements
	value synchronization
 */

/**************
 test sections
**************/

tape('\n', test => {
	test.comment('-***- dom/zoompan -***-')
	test.end()
})

tape('renders the expected elements', test => {
	test.timeoutAfter(100)
	test.plan(3)
	const holder = select(document.body).append('div').style('margin', '20px').style('padding', '20px')
	let currentCallback
	const callback = value => currentCallback(value)
	const zoomApi = zoom({ holder, callback, debug: true, showJumpBtns: true })

	test.equal([...holder.node().querySelectorAll('button')].length, 2, 'should render two zoom buttons')

	test.equal([...holder.node().querySelectorAll('input[type=range]')].length, 1, 'should render a slider input')

	test.equal([...holder.node().querySelectorAll('input[type=number]')].length, 1, 'should render a number input')

	if (test._ok) holder.remove()
	test.end()
})

tape('value synchronization', test => {
	test.timeoutAfter(100)
	test.plan(10)
	const holder = select(document.body).append('div').style('margin', '20px').style('padding', '20px')
	let currentCallback
	const callback = value => currentCallback(value)
	const zoomApi = zoom({ holder, callback, debug: true, showJumpBtns: true })
	const Z = zoomApi.Inner
	{
		const expectedValue = 33
		currentCallback = value => {
			test.equal(value, expectedValue, 'should supply the expected number input value to the callback')
			test.equal(
				+zoomApi.Inner.slider.property('value'),
				expectedValue,
				'slider should react to changes in the number input'
			)
		}
		zoomApi.Inner.number.property('value', expectedValue)
		zoomApi.Inner.number.node().dispatchEvent(new Event('change'))
	}
	{
		const expectedValue = 66
		currentCallback = value => {
			test.equal(value, expectedValue, 'should supply the expected slider input value to the callback')
			test.equal(
				+zoomApi.Inner.number.property('value'),
				expectedValue,
				'number should react to changes in the slider input'
			)
		}
		zoomApi.Inner.slider.property('value', expectedValue)
		zoomApi.Inner.slider.node().dispatchEvent(new Event('change'))
	}
	{
		currentCallback = expectedValue => {
			test.equal(
				0,
				expectedValue % Z.settings.step,
				'minus button should supply to the callback a number divisible by settings.step'
			)
			test.equal(
				+zoomApi.Inner.number.property('value'),
				expectedValue,
				'number should react to the minus button click'
			)
			test.equal(
				+zoomApi.Inner.slider.property('value'),
				expectedValue,
				'slider should react to the minus button click'
			)
		}
		zoomApi.Inner.minusBtn.node().click()
	}
	{
		currentCallback = expectedValue => {
			test.equal(
				0,
				expectedValue % Z.settings.step,
				'plus button should supply to the callback a number divisible by settings.step'
			)
			test.equal(+zoomApi.Inner.number.property('value'), expectedValue, 'number should react to the plus button click')
			test.equal(+zoomApi.Inner.slider.property('value'), expectedValue, 'slider should react to the plus button click')
		}
		zoomApi.Inner.plusBtn.node().click()
	}

	if (test._ok) holder.remove()
	test.end()
})
