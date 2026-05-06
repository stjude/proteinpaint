/**
 * hoverShapes Tests
 *
 * Unit tests for the `drawHoverShapes` helper in `client/dom/hoverShapes.ts`.
 * The helper renders a list of SVG `<path>` shapes into a layer (used by
 * the cohort volcano in `proteinView.ts` and intended for reuse by other
 * plots that need shape-aware hover/highlight rings).
 *
 * Tests:
 *   empty specs array clears the layer
 *   single spec appends one path with the supplied path and transform
 *   multiple specs append one path per spec
 *   subsequent call replaces prior contents (not append)
 *   applies default styles when none specified
 *   caller-supplied styles override defaults
 *   nonScalingStroke=false omits the vector-effect style
 *   only paths in the layer are removed; other children are preserved
 */

import tape from 'tape'
import { select } from 'd3-selection'
import { drawHoverShapes } from '../hoverShapes'

/*************************
 reusable helper functions
**************************/
function getLayer() {
	const holder = select('body').append('div')
	const svg = holder.append('svg').attr('width', 100).attr('height', 100)
	const layer = svg.append('g').attr('class', 'test-hover-layer')
	return { holder, layer }
}

const TRIANGLE_PATH = 'M0,-8 L8,8 L-8,8 Z'
const SQUARE_PATH = 'M-8,-8 h16 v16 h-16 Z'

/**************
 test sections
***************/
tape('\n', t => {
	t.comment('-***- dom/hoverShapes -***-')
	t.end()
})

// Verifies that passing `[]` wipes existing paths from the layer — the
// "clear" code path used by mouseleave / no-hit mousemove.
tape('empty specs array clears the layer', t => {
	const { holder, layer } = getLayer()

	// Seed the layer with a stale path that should be wiped.
	layer.append('path').attr('class', 'stale').attr('d', 'M0,0 L1,1')
	t.equal(layer.selectAll('path').size(), 1, 'precondition: layer has one stale path')

	drawHoverShapes(layer, [])
	t.equal(layer.selectAll('path').size(), 0, 'empty specs removes all paths')

	holder.remove()
	t.end()
})

// One spec → one `<path>` with the caller's `d` and `transform` round-tripped.
tape('single spec appends one path with the supplied path and transform', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [{ path: TRIANGLE_PATH, transform: 'translate(50,50) scale(1.5)' }])

	const paths = layer.selectAll('path')
	t.equal(paths.size(), 1, 'one path appended')
	const node = paths.node() as SVGPathElement
	t.equal(node.getAttribute('d'), TRIANGLE_PATH, 'd attribute matches input path')
	t.equal(node.getAttribute('transform'), 'translate(50,50) scale(1.5)', 'transform matches input')

	holder.remove()
	t.end()
})

// N specs → N paths. The helper iterates and appends; nothing is deduped.
tape('multiple specs append one path per spec', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [
		{ path: TRIANGLE_PATH, transform: 'translate(10,10)' },
		{ path: SQUARE_PATH, transform: 'translate(20,20)' },
		{ path: TRIANGLE_PATH, transform: 'translate(30,30)' }
	])

	const paths = layer.selectAll('path')
	t.equal(paths.size(), 3, 'three paths appended')

	holder.remove()
	t.end()
})

// The contract that makes the helper safe to call on every mousemove:
// each invocation REPLACES prior paths instead of appending to them.
tape('subsequent call replaces prior contents (not append)', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [
		{ path: TRIANGLE_PATH, transform: 'translate(10,10)' },
		{ path: TRIANGLE_PATH, transform: 'translate(20,20)' }
	])
	t.equal(layer.selectAll('path').size(), 2, 'after first call: two paths')

	drawHoverShapes(layer, [{ path: SQUARE_PATH, transform: 'translate(30,30)' }])
	t.equal(layer.selectAll('path').size(), 1, 'second call replaces — only one path remains')
	const node = layer.selectAll('path').node() as SVGPathElement
	t.equal(node.getAttribute('d'), SQUARE_PATH, 'remaining path is from the second call, not the first')

	holder.remove()
	t.end()
})

// Pins the default visual style (black 1.5px stroke, no fill, non-scaling
// stroke). These are the values the cohort volcano relies on.
tape('applies default styles when none specified', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [{ path: TRIANGLE_PATH, transform: 'translate(0,0)' }])
	const node = layer.select('path').node() as SVGPathElement

	t.equal(node.getAttribute('fill'), 'none', 'default fill is none')
	t.equal(node.getAttribute('stroke'), 'black', 'default stroke is black')
	t.equal(node.getAttribute('stroke-width'), '1.5', 'default stroke-width is 1.5')
	t.equal(node.style.vectorEffect, 'non-scaling-stroke', 'non-scaling-stroke applied by default')
	t.notOk(node.hasAttribute('fill-opacity'), 'fill-opacity is omitted when not specified')

	holder.remove()
	t.end()
})

// Per-spec styling (stroke, strokeWidth, fill, fillOpacity) wins over defaults
// — important for callers that want, e.g., a filled orange highlight.
tape('caller-supplied styles override defaults', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [
		{
			path: TRIANGLE_PATH,
			transform: 'translate(0,0)',
			stroke: 'red',
			strokeWidth: 3,
			fill: 'orange',
			fillOpacity: 0.4
		}
	])
	const node = layer.select('path').node() as SVGPathElement

	t.equal(node.getAttribute('stroke'), 'red', 'stroke override applied')
	t.equal(node.getAttribute('stroke-width'), '3', 'stroke-width override applied')
	t.equal(node.getAttribute('fill'), 'orange', 'fill override applied')
	t.equal(node.getAttribute('fill-opacity'), '0.4', 'fill-opacity applied when specified')

	holder.remove()
	t.end()
})

// Opt-out path: a caller whose transform doesn't include a scale (so they
// don't need vector-effect protection) can suppress the style.
tape('nonScalingStroke=false omits the vector-effect style', t => {
	const { holder, layer } = getLayer()

	drawHoverShapes(layer, [{ path: TRIANGLE_PATH, transform: 'translate(0,0)', nonScalingStroke: false }])
	const node = layer.select('path').node() as SVGPathElement

	// Empty string means the inline style was never set.
	t.equal(node.style.vectorEffect, '', 'no vector-effect style applied when opted out')

	holder.remove()
	t.end()
})

// The clear step is `selectAll('path').remove()` — narrow on purpose so
// callers can put debug markers, labels, etc. into the same layer without
// having them wiped on every redraw.
tape('only paths in the layer are removed; other children are preserved', t => {
	const { holder, layer } = getLayer()

	// A non-path sibling that should be untouched (e.g., a debug label, a marker).
	layer.append('circle').attr('class', 'sibling').attr('r', 5)
	drawHoverShapes(layer, [
		{ path: TRIANGLE_PATH, transform: 'translate(10,10)' },
		{ path: SQUARE_PATH, transform: 'translate(20,20)' }
	])

	t.equal(layer.selectAll('path').size(), 2, 'two paths drawn')
	t.equal(layer.selectAll('circle').size(), 1, 'unrelated circle child is preserved')

	// And a re-draw should still leave the circle alone.
	drawHoverShapes(layer, [])
	t.equal(layer.selectAll('path').size(), 0, 'paths cleared on empty call')
	t.equal(layer.selectAll('circle').size(), 1, 'unrelated circle still preserved after clear')

	holder.remove()
	t.end()
})
