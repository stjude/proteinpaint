import tape from 'tape'
import { getPdfScale } from '#dom'

/**
 * Tests
 * 		getPdfScale()
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- get pdf scale specs -***-')
	test.end()
})

tape('getPdfScale()', function (test) {
	const ratio = 72 / 96 //0.75 convert px to pt
	let svgWidth = 800 //px
	let svgHeight = 600 //px
	const pageWidth = 585.28 //A4 width in pt
	const pageHeight = 831.89 //A4 height in pt

	const scale = getPdfScale(pageWidth, pageHeight, svgWidth, svgHeight)
	//svgWidth in pt 800 * 0.75 = 600, bigger than the page width, svgHeight in pt 600 * 0.75 = 450, smaller than the page height
	//It will scale to page width, will add some padding and will multiply by ratio to add the conversion to pt
	const expected = (pageWidth / (svgWidth * ratio)) * 0.9 * ratio
	test.equal(
		scale,
		expected,
		`Should return scale=${expected.toFixed(
			2
		)} for input svgWidth=${svgWidth}, svgHeight=${svgHeight}. The svg width is bigger than the page width. It will scale to page width, will add some padding and will multiply by ratio to add the conversion to pt`
	)

	svgWidth = 600
	svgHeight = 600
	const scale2 = getPdfScale(pageWidth, pageHeight, svgWidth, svgHeight)
	//svgWidth in pt 600 * 0.75 = 450, smaller than the page width, svgHeight in pt 600 * 0.75 = 450, smaller than the page height
	//It does not need to scale to page width, will add some padding and will multiply by ratio to add the conversion to pt
	const expected2 = 0.9 * ratio
	test.equal(
		scale2,
		expected2,
		`Should return scale=${expected2.toFixed(
			2
		)} for input svgWidth=${svgWidth}, svgHeight=${svgHeight}. Svg width and height are smaller than the page width and height. It does not need to scale to page width, will add some padding and will multiply by ratio to add the conversion to pt`
	)

	svgWidth = 800
	svgHeight = 1200
	const scale3 = getPdfScale(pageWidth, pageHeight, svgWidth, svgHeight)
	//svgWidth in pt 800 * 0.75 = 600, bigger than the page width, svgHeight in pt 1200 * 0.75 = 900, bigger than the page height
	//It will take the min scale that is the height scale, will add some padding and will multiply by ratio to add the conversion to pt
	const minScale = Math.min(pageHeight / (svgHeight * ratio), pageWidth / (svgWidth * ratio))
	const expected3 = minScale * 0.9 * ratio
	test.equal(
		scale3,
		expected3,
		`Should return scale=${expected3.toFixed(
			2
		)} for input svgWidth=${svgWidth}, svgHeight=${svgHeight}. Svg width and height are bigger than the page width and height. It will take the min scale that is the height scale, will add some padding and will multiply by ratio to add the conversion to pt`
	)

	test.end()
})
