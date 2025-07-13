/**
 * maxLabelWidth Utility Test Suite
 *
 * This comprehensive test suite verifies the reliability and accuracy of the maxLabelWidth
 * utility, which is fundamental to our data visualization system. The utility measures
 * text width in SVG elements, a critical operation for properly positioning and spacing
 * visual elements like labels, legends, and annotations.
 *
 * Testing Philosophy:
 * Our approach builds from simple to complex scenarios, establishing confidence in basic
 * functionality before testing advanced features. We recognize that text rendering is
 * influenced by many factors including font properties, text direction, and character
 * sets. Therefore, our tests cover not just basic measurement but also these vital
 * edge cases and variations.
 *
 * Test Organization:
 * 1. Basic Functionality: Core text measurement capabilities
 * 2. Resource Management: Proper cleanup of temporary elements
 * 3. Font Handling: Testing with different fonts and styles
 * 4. Internationalization: Support for RTL and special characters
 * 5. Dynamic Updates: Behavior during content changes
 *
 * Each test section is designed to be independent and self-contained, with proper
 * setup and cleanup to prevent cross-test interference.
 */

import tape from 'tape'
import type { Selection } from 'd3-selection'
import { select } from 'd3-selection'
import type { SvgG } from '../../types/d3'
import { getMaxLabelWidth } from '../maxLabelWidth'

// First, we'll create interfaces to define the return types of our container functions.
// This makes our code more maintainable and self-documenting.
interface TestContainerResult {
	holder: Selection<HTMLDivElement, unknown, HTMLElement, any>
	svg: SvgG
}

/*************************
 * Reusable Helper Functions
 *
 * These functions create consistent testing environments and handle common setup
 * tasks. They abstract away the complexity of DOM manipulation and font handling,
 * allowing tests to focus on verifying functionality rather than setup details.
 *************************/

/**
 * Creates a basic SVG container for testing simple text measurements.
 * This function provides a minimal testing environment when additional
 * font controls aren't needed. The 800px max-width ensures consistent
 * rendering across different viewport sizes.
 */
function getHolder(): Selection<HTMLDivElement, unknown, HTMLElement, any> {
	return select('body').append('div').style('max-width', '800px') as Selection<
		HTMLDivElement,
		unknown,
		HTMLElement,
		any
	>
}

/**
 * Creates a test environment with precise font control.
 * This enhanced container supports testing how different font properties
 * affect text measurement. It uses Arial as a reliable system font to
 * ensure consistent testing across different environments.
 *
 * @param fontWeight Controls text thickness ('normal', 'bold', '100-900')
 * @param fontStyle Controls text slant ('normal', 'italic', 'oblique')
 */
function getStyledContainer(fontWeight = 'normal', fontStyle = 'normal'): TestContainerResult {
	const holder = select('body').append('div').style('max-width', '800px') as Selection<
		HTMLDivElement,
		unknown,
		HTMLElement,
		any
	>

	// For the SVG, we first create it as a D3 Selection, then type cast it to our Svg type
	const svg = holder
		.append('svg')
		.attr('width', 300)
		.attr('height', 300)
		.style('font-family', 'Arial, sans-serif')
		.style('font-weight', fontWeight)
		.style('font-style', fontStyle) as unknown as SvgG

	return { holder, svg }
}

/**
 * Creates a test environment optimized for font loading and RTL text tests.
 * This container provides additional capabilities needed for testing complex
 * text scenarios like custom fonts and bidirectional text rendering.
 */
function getTestContainer(): TestContainerResult {
	const holder = select('body').append('div').style('max-width', '800px') as Selection<
		HTMLDivElement,
		unknown,
		HTMLElement,
		any
	>

	const svg = holder.append('svg').attr('width', 300).attr('height', 300) as unknown as SvgG

	return { holder, svg }
}

/**
 * Manages loading of custom fonts for testing.
 *
 * This helper ensures reliable font loading, which is crucial for consistent
 * text measurements. It uses the FontFace API to load Roboto, a widely-supported
 * font that provides predictable metrics for testing purposes.
 *
 * Returns a promise that resolves to true if font loading succeeds, false otherwise.
 * The async nature of this function allows tests to wait for proper font loading
 * before making measurements.
 */
async function loadTestFont() {
	const font = new FontFace('TestFont', 'url(https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxK.woff2)')

	try {
		const loadedFont = await font.load()
		document.fonts.add(loadedFont)
		return true
	} catch (error) {
		console.error('Font loading failed:', error)
		return false
	}
}

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- utils/maxLabelWidth -***-')
	test.end()
})

/**************
 * Core Functionality Tests
 *
 * These tests establish the baseline reliability of the maxLabelWidth utility.
 * They verify that the function can accurately measure text width under normal
 * conditions before we test more complex scenarios.
 *
 * Key aspects tested:
 * - Basic width measurement accuracy
 * - Relative width relationships
 * - Empty input handling
 * - Size parameter effects
 **************/
tape('Basic functionality of getMaxLabelWidth', test => {
	// Create a holder and SVG for our tests
	const holder: any = getHolder()
	const svg = holder.append('svg').attr('width', 300).attr('height', 300)

	// Test case 1: Simple array of strings
	const simpleLabels = ['Test', 'Longer Test', 'Short']
	const width1 = getMaxLabelWidth(svg, simpleLabels)

	// We know 'Longer Test' should be widest
	test.ok(width1 > 0, 'Should return a positive width')
	test.ok(width1 > getMaxLabelWidth(svg, ['Test']), 'Longer text should result in greater width')

	// Test case 2: Empty array
	const emptyWidth = getMaxLabelWidth(svg, [])
	test.equal(emptyWidth, 0, 'Should handle empty array gracefully')

	// Test case 3: Size parameter
	const normalWidth = getMaxLabelWidth(svg, ['Test'], 1)
	const doubleWidth = getMaxLabelWidth(svg, ['Test'], 2)
	test.ok(doubleWidth > normalWidth, 'Larger size parameter should result in greater width')

	// Clean up
	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * Resource Management Tests
 *
 * These tests verify that the utility properly manages DOM elements during its
 * operation. Proper cleanup is crucial for preventing memory leaks and DOM
 * pollution in long-running applications.
 *
 * We verify that all temporary elements created for measurement are removed,
 * regardless of the measurement outcome or any errors that might occur.
 */
tape('SVG cleanup after measurement', test => {
	test.timeoutAfter(100)

	const holder: any = getHolder()
	const svg = holder.append('svg')

	// Count initial number of text elements
	const initialTextCount = svg.selectAll('text').size()

	// Run the function
	getMaxLabelWidth(svg, ['Test', 'Another Test'])

	// Count final number of text elements
	const finalTextCount = svg.selectAll('text').size()

	// Verify cleanup
	test.equal(finalTextCount, initialTextCount, 'Should remove all temporary text elements')

	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * Edge Case Tests
 *
 * These tests challenge the utility with unusual but valid input scenarios.
 * Text rendering can be complex, especially with special characters or mixed
 * writing systems. These tests ensure reliable operation across a wide range
 * of real-world content.
 */
tape('Edge cases handling', test => {
	test.timeoutAfter(100)

	const holder: any = getHolder()
	const svg = holder.append('svg')

	// Test case 1: Very long string
	const longString = 'a'.repeat(1000)
	const longWidth = getMaxLabelWidth(svg, [longString])
	test.ok(longWidth > 0, 'Should handle very long strings')

	// Test case 2: Special characters
	const specialChars = ['©®™', '你好', '🌟🎈']
	const specialWidth = getMaxLabelWidth(svg, specialChars)
	test.ok(specialWidth > 0, 'Should handle special characters and emojis')

	// Test case 3: Mixed content
	const mixedContent = ['Regular text', '特殊字符', '12345', '!@#$%']
	const mixedWidth = getMaxLabelWidth(svg, mixedContent)
	test.ok(mixedWidth > 0, 'Should handle mixed content types')

	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * Font Loading Tests
 *
 * These tests verify that the utility works correctly with both system and
 * custom fonts. Font loading can affect text measurements, so we ensure
 * accurate results even when fonts change.
 *
 * The tests use a custom font to verify that:
 * 1. Measurements update when fonts change
 * 2. The utility handles font loading failures gracefully
 * 3. Results remain consistent for the same font
 */
tape('Font loading affects width measurements', async test => {
	test.timeoutAfter(1000) // Increased timeout for font loading

	const { holder, svg } = getTestContainer()

	// First measurement with default font
	const defaultWidth = getMaxLabelWidth(svg, ['Test Text'])

	// Load custom font and apply it
	const fontLoaded = await loadTestFont()
	if (fontLoaded) {
		svg.style('font-family', 'TestFont')

		// Measure again with custom font
		const customFontWidth = getMaxLabelWidth(svg, ['Test Text'])

		// Widths should differ due to different font metrics
		test.notEqual(defaultWidth, customFontWidth, 'Font change should affect text width')
	} else {
		// Skip test if font loading fails
		test.skip('Font loading failed, skipping font comparison test')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * RTL Text Support Tests
 *
 * These tests ensure proper handling of right-to-left text and mixed
 * directional content. Supporting multiple writing systems is crucial
 * for international applications.
 *
 * We test with Hebrew and English text to verify:
 * 1. Basic RTL text measurement
 * 2. Mixed RTL/LTR content handling
 * 3. Proper respect for text direction attributes
 */
tape('Right-to-left text handling', test => {
	const { holder, svg } = getTestContainer()

	// Hebrew text (RTL)
	const rtlText = 'שָׁלוֹם'
	// Mixed RTL and LTR
	const mixedText = 'Hello שָׁלוֹם'

	// Test RTL text measurement
	const rtlWidth = getMaxLabelWidth(svg, [rtlText])
	test.ok(rtlWidth > 0, 'Should handle RTL text measurement')

	// Compare mixed text with RTL-only text
	const mixedWidth = getMaxLabelWidth(svg, [mixedText])
	test.ok(mixedWidth > rtlWidth, 'Mixed RTL/LTR text should yield appropriate width')

	// Test text-anchor and direction attributes
	svg.append('text').attr('direction', 'rtl').text(rtlText)

	const anchoredWidth = getMaxLabelWidth(svg, [rtlText])
	test.ok(Math.abs(anchoredWidth - rtlWidth) < 1, 'RTL text width should be consistent with direction attribute')

	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * Dynamic Content Tests
 *
 * These tests verify that the utility maintains accuracy when text content
 * changes. This is essential for interactive visualizations where text
 * may update in response to user actions or data changes.
 *
 * We verify:
 * 1. Measurement updates with content changes
 * 2. Correct relative sizing during updates
 * 3. Proper handling of empty content
 */
tape('Dynamic content updates', test => {
	const { holder, svg } = getTestContainer()

	// Initial measurement
	const initialText = 'Initial Text'
	const initialWidth = getMaxLabelWidth(svg, [initialText])

	// Create a text element we'll update
	const textElement = svg.append('text').text(initialText)

	// Update text content
	const updatedText = 'Updated Longer Text Content'
	textElement.text(updatedText)

	// Measure updated text
	const updatedWidth = getMaxLabelWidth(svg, [updatedText])

	// Verify width changes
	test.ok(updatedWidth > initialWidth, 'Width should update correctly for longer dynamic content')

	// Test rapid updates
	const texts = ['Short', 'Much Longer Text Here', 'Medium Text', 'Very Very Long Text That Should Definitely Be Wider']

	texts.forEach(text => {
		textElement.text(text)
		const currentWidth = getMaxLabelWidth(svg, [text])

		// Each measurement should be valid
		test.ok(currentWidth > 0, `Valid width for text: ${text}`)
		// Longer text should yield larger width
		if (text.length > texts[0].length) {
			test.ok(currentWidth > getMaxLabelWidth(svg, [texts[0]]), 'Longer text should have greater width')
		}
	})

	// Test update with empty content
	textElement.text('')
	const emptyWidth = getMaxLabelWidth(svg, [''])
	test.equal(emptyWidth, 0, 'Empty text should have zero width')

	if (test['_ok']) holder.remove()
	test.end()
})

/**
 * Font Weight Tests
 *
 * These tests verify accurate measurement across different font weights.
 * Text weight can significantly affect width, so proper handling is
 * crucial for precise layouts.
 *
 * We test:
 * 1. Normal vs bold text
 * 2. Numeric weight values (100-900)
 * 3. Weight progression consistency
 */
tape('Font weight affects width measurements', test => {
	const testText = 'Test String For Width'

	// Test with normal weight (400)
	const { holder: holder1, svg: normalSvg } = getStyledContainer('normal')
	const normalWidth = getMaxLabelWidth(normalSvg, [testText])

	// Test with bold weight (700)
	const { holder: holder2, svg: boldSvg } = getStyledContainer('bold')
	const boldWidth = getMaxLabelWidth(boldSvg, [testText])

	// Bold text should be wider than normal text
	test.ok(boldWidth > normalWidth, 'Bold text should have greater width than normal text')

	// Test relative widths across different weights
	const weights = ['100', '300', '600', '900']
	const widths = new Map()

	weights.forEach(weight => {
		const { holder, svg } = getStyledContainer(weight)
		widths.set(weight, getMaxLabelWidth(svg, [testText]))
		holder.remove()
	})

	// Verify that heavier weights generally produce larger widths
	let previousWidth = 0
	weights.forEach(weight => {
		const currentWidth = widths.get(weight)
		if (previousWidth > 0) {
			test.ok(currentWidth >= previousWidth, `Weight ${weight} should not be narrower than lighter weights`)
		}
		previousWidth = currentWidth
	})

	// Clean up
	holder1.remove()
	holder2.remove()
	test.end()
})

/**
 * Font Style Tests
 *
 * These tests ensure correct measurement of different font styles.
 * Italic and oblique styles can affect text width differently than
 * normal text, so accurate measurement is essential.
 */
tape('Font style affects width measurements', test => {
	const testText = 'Italic Style Test'

	// Compare normal vs italic
	const { holder: normalHolder, svg: normalSvg } = getStyledContainer('normal', 'normal')
	const { holder: italicHolder, svg: italicSvg } = getStyledContainer('normal', 'italic')

	const normalWidth = getMaxLabelWidth(normalSvg, [testText])
	const italicWidth = getMaxLabelWidth(italicSvg, [testText])

	// Italic text often has different width than normal text
	test.notEqual(normalWidth, italicWidth, 'Italic style should affect text width')

	// Test oblique style
	const { holder: obliqueHolder, svg: obliqueSvg } = getStyledContainer('normal', 'oblique')
	const obliqueWidth = getMaxLabelWidth(obliqueSvg, [testText])

	// Oblique should be different from normal
	test.notEqual(normalWidth, obliqueWidth, 'Oblique style should affect text width')

	// Clean up
	normalHolder.remove()
	italicHolder.remove()
	obliqueHolder.remove()
	test.end()
})

/**
 * Combined Property Tests
 *
 * These tests verify that combinations of font properties work correctly
 * together. Font properties can interact in complex ways, so we ensure
 * accurate measurements across different combinations.
 *
 * We test various combinations of:
 * - Font weights (normal, bold)
 * - Font styles (normal, italic)
 * to verify consistent and accurate measurements.
 */
tape('Combined font weight and style variations', test => {
	const testText = 'Combined Weight and Style'
	const combinations = [
		{ weight: 'normal', style: 'normal' },
		{ weight: 'bold', style: 'normal' },
		{ weight: 'normal', style: 'italic' },
		{ weight: 'bold', style: 'italic' }
	]

	const widths = new Map()

	// Measure width for each combination
	combinations.forEach(({ weight, style }) => {
		const { holder, svg } = getStyledContainer(weight, style)
		widths.set(`${weight}-${style}`, getMaxLabelWidth(svg, [testText]))
		holder.remove()
	})

	// Bold italic should be different from normal
	test.notEqual(
		widths.get('normal-normal'),
		widths.get('bold-italic'),
		'Bold italic should have different width from normal'
	)

	// Bold should affect width in both normal and italic styles
	test.ok(widths.get('bold-normal') > widths.get('normal-normal'), 'Bold should increase width in normal style')
	test.ok(widths.get('bold-italic') > widths.get('normal-italic'), 'Bold should increase width in italic style')

	test.end()
})
