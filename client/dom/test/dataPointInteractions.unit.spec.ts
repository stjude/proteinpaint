/**
 * dataPointInteractions Tests
 *
 * Unit tests for the `DataPointInteractions` class in
 * `client/dom/dataPointInteractions.ts`. Verifies the orchestration that
 * stitches together `findPointsInRadius`, `drawHoverShapes`,
 * `showResultsTable`, `openActionMenu`, and `openMultiHitClickMenu` for
 * cover-rect-based hit-testing on plot dots.
 *
 * The tests dispatch real `mousemove` / `mouseleave` / `click` events on a
 * cover element living in the DOM, with d3-selection wired up the same way
 * a plot would. Tooltip / menu side-effects are observed by inspecting the
 * Menu DOM and the hover layer's child paths.
 *
 * Tests:
 *   attach binds quadtree and event handlers
 *   detach removes handlers and clears hover state
 *   mousemove with no hits clears hover layer and hides tip
 *   mousemove with single hit calls renderSingleHoverTooltip and draws hover ring
 *   mousemove with multiple hits renders header + table + draws rings
 *   mousemove caps rows by maxTooltipRows and shows "and N more X..." footer
 *   mousemove is suppressed while click menu is open
 *   isHidden filter excludes hidden dots
 *   perDotRadius+perDotBuffer rejects candidates outside per-dot reach
 *   getCluster hook expands the candidate seed into a cluster
 *   hitRadius accepts a function and re-evaluates per call
 *   click with single hit invokes default openActionMenu (getActions called)
 *   click with single hit honours onSingleClick override
 *   click with multiple hits invokes onMultiClick override
 *   override can call ctx.dismiss() to release hover-suppression after no-menu click
 *   click menu onHide clears clickMenuIsShown flag and hover rings
 */

import tape from 'tape'
import { select } from 'd3-selection'
import { Menu, DataPointInteractions, type DataPointInteractionsOpts, type HoverShapeSpec } from '#dom'

/*************************
 reusable helper functions
**************************/

interface TestPoint {
	id: string
	x: number
	y: number
	hidden?: boolean
	r?: number
}

const TRIANGLE_PATH = 'M0,-8 L8,8 L-8,8 Z'

function getHolder() {
	return select('body').append('div').attr('class', 'test-dpi-holder')
}

function setupHarness() {
	const holder = getHolder()
	const svg = holder.append('svg').attr('width', 200).attr('height', 200)
	const cover = svg
		.append('rect')
		.attr('class', 'test-cover')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', 200)
		.attr('height', 200)
		.attr('fill', 'transparent')
		.style('pointer-events', 'all')
	const hoverLayer = svg.append('g').attr('class', 'test-hover').style('pointer-events', 'none')
	const hoverTip = new Menu({ padding: '' })
	return { holder, svg, cover, hoverLayer, hoverTip }
}

const TOOLTIP_RENDERERS = {
	single: (d: TestPoint, container: any) => {
		container.append('div').attr('class', 'single-tip').text(`single ${d.id}`)
	},
	multiTable: (dots: TestPoint[]) => ({
		columns: [{ label: 'Id' }, { label: 'X', sortable: true }],
		rows: dots.map(d => [{ value: d.id }, { value: d.x }])
	})
}

function defaultOpts(
	cover: any,
	hoverLayer: any,
	hoverTip: Menu,
	points: TestPoint[],
	overrides: Partial<DataPointInteractionsOpts<TestPoint>> = {}
): DataPointInteractionsOpts<TestPoint> {
	const base: DataPointInteractionsOpts<TestPoint> = {
		cover,
		hoverLayer,
		hoverTip,
		points,
		getX: d => d.x,
		getY: d => d.y,
		hitRadius: 10,
		toHoverSpec: (_d: TestPoint): HoverShapeSpec => ({ path: TRIANGLE_PATH, transform: 'translate(0,0)' }),
		renderSingleHoverTooltip: TOOLTIP_RENDERERS.single,
		buildMultiHitTableData: TOOLTIP_RENDERERS.multiTable,
		getRowKey: d => d.id,
		itemNoun: 'gene'
	}
	return { ...base, ...overrides }
}

function dispatchMouseEvent(node: any, type: string, clientX: number, clientY: number) {
	const evt = new MouseEvent(type, { bubbles: true, clientX, clientY })
	node.dispatchEvent(evt)
}

/**************
 test sections
***************/
tape('\n', t => {
	t.comment('-***- dom/dataPointInteractions -***-')
	t.end()
})

// Smoke: attach binds the quadtree (proven indirectly by a hit landing) and
// the three cover handlers (proven by mouseleave clearing hover state).
tape('attach binds quadtree and event handlers', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	const dpi = new DataPointInteractions<TestPoint>(defaultOpts(cover, hoverLayer, hoverTip, points))
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.equal(hoverLayer.selectAll('path').size(), 1, 'hover ring rendered after a successful hit')

	holder.remove()
	t.end()
})

// detach unwires events and clears hover state.
tape('detach removes handlers and clears hover state', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	const dpi = new DataPointInteractions<TestPoint>(defaultOpts(cover, hoverLayer, hoverTip, points))
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 1, 'precondition: ring drawn')

	dpi.detach()
	t.equal(hoverLayer.selectAll('path').size(), 0, 'hover layer cleared on detach')

	// After detach a mousemove should be a no-op (handler unbound).
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 0, 'mousemove after detach does not redraw rings')

	holder.remove()
	t.end()
})

// No hits: hover layer is empty and no tooltip body is rendered.
tape('mousemove with no hits clears hover layer and hides tip', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 5, y: 5 }]
	const dpi = new DataPointInteractions<TestPoint>(defaultOpts(cover, hoverLayer, hoverTip, points))
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 150, rect.top + 150)

	t.equal(hoverLayer.selectAll('path').size(), 0, 'no hover ring when out of range')
	t.equal(hoverTip.d.selectAll('.single-tip').size(), 0, 'no single-hit tooltip body')

	holder.remove()
	t.end()
})

// Single hit: renderSingleHoverTooltip is called with the hit dot, and one ring is drawn.
tape('mousemove with single hit calls renderSingleHoverTooltip and draws hover ring', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'only', x: 50, y: 50 }]
	let calledWith: TestPoint | null = null
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			renderSingleHoverTooltip: (d, container) => {
				calledWith = d
				container.append('span').attr('class', 'tip-marker').text(d.id)
			}
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.ok(calledWith && (calledWith as TestPoint).id === 'only', 'single-hit renderer received the hit dot')
	t.equal(hoverLayer.selectAll('path').size(), 1, 'one hover ring drawn')
	t.equal(hoverTip.d.selectAll('.tip-marker').size(), 1, 'single-hit tooltip body rendered')

	holder.remove()
	t.end()
})

// Multi-hit: header + table + one ring per shown row.
tape('mousemove with multiple hits renders header + table + draws rings', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [
		{ id: 'a', x: 50, y: 50 },
		{ id: 'b', x: 51, y: 51 },
		{ id: 'c', x: 52, y: 52 }
	]
	const dpi = new DataPointInteractions<TestPoint>(defaultOpts(cover, hoverLayer, hoverTip, points))
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.equal(hoverLayer.selectAll('path').size(), 3, 'three hover rings drawn (one per hit)')

	const headerText = hoverTip.d.select('div').text()
	t.ok(headerText.includes('3 genes'), `header reflects the cluster count and noun, got "${headerText}"`)
	// The table is rendered by showResultsTable into the inner holder
	t.ok(hoverTip.d.selectAll('table').size() >= 1, 'a table is rendered for the multi-hit body')

	holder.remove()
	t.end()
})

// maxTooltipRows + "and N more X..." footer.
tape('mousemove caps rows by maxTooltipRows and shows "and N more X..." footer', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, x: 50 + i * 0.1, y: 50 + i * 0.1 }))
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, { maxTooltipRows: 3, itemNoun: 'cohort' })
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.equal(hoverLayer.selectAll('path').size(), 3, 'rings drawn only for the capped set')
	const tipText = (hoverTip.d.node() as Element).textContent || ''
	t.ok(/and 5 more cohorts\.\.\./.test(tipText), 'footer text "and 5 more cohorts..." is present in tooltip')

	holder.remove()
	t.end()
})

// While click menu is open, mousemove should not run (no rings, no tooltip).
tape('mousemove is suppressed while click menu is open', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			getActions: () => [{ label: 'Act', onClick: () => {} }],
			renderSingleHitInfo: (_d, c) => c.append('span').text('info')
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	// Click first to open the click menu
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	const ringsAfterClick = hoverLayer.selectAll('path').size()

	// Now mousemove off the dot — should NOT clear rings (menu open => mousemove suppressed)
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 150, rect.top + 150)
	t.equal(hoverLayer.selectAll('path').size(), ringsAfterClick, 'rings persist while click menu is open')

	holder.remove()
	t.end()
})

// isHidden filters out dots regardless of geometric proximity.
tape('isHidden filter excludes hidden dots', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [
		{ id: 'visible', x: 50, y: 50 },
		{ id: 'hidden', x: 51, y: 51, hidden: true }
	]
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, { isHidden: d => !!d.hidden })
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.equal(hoverLayer.selectAll('path').size(), 1, 'hidden dot filtered out, only visible dot drawn')

	holder.remove()
	t.end()
})

// perDotRadius + buffer rejects dots whose per-dot reach excludes the cursor,
// even when they're inside the broad hitRadius.
tape('perDotRadius+perDotBuffer rejects candidates outside per-dot reach', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	// Cursor at (50,50). Dot at (58,50) — distance 8.
	// Broad hitRadius=20 includes it; per-dot radius=2 + buffer=1 = 3 excludes it.
	const points: TestPoint[] = [{ id: 'small', x: 58, y: 50, r: 2 }]
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			hitRadius: 20,
			perDotRadius: d => d.r ?? 0,
			perDotBuffer: 1
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.equal(hoverLayer.selectAll('path').size(), 0, 'small dot 8px away rejected by per-dot filter')

	holder.remove()
	t.end()
})

// getCluster hook is invoked with the seed and gets to choose what to show.
tape('getCluster hook expands the candidate seed into a cluster', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [
		{ id: 'a', x: 50, y: 50 },
		{ id: 'far', x: 150, y: 150 }
	]
	let seedSeen: TestPoint | null = null
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			getCluster: (seed, all) => {
				seedSeen = seed
				return all // override: return everything regardless of distance
			}
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)

	t.ok(seedSeen && (seedSeen as TestPoint).id === 'a', 'getCluster received the closest hit as seed')
	t.equal(hoverLayer.selectAll('path').size(), 2, 'cluster of all dots is rendered, including the far one')

	holder.remove()
	t.end()
})

// hitRadius can be a function and is re-read each call.
tape('hitRadius accepts a function and re-evaluates per call', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 80, y: 50 }]
	let radius = 5 // dot at (80,50), cursor at (50,50): distance 30. Radius 5 => miss.
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, { hitRadius: () => radius })
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 0, 'miss with radius=5')

	radius = 50 // bump it; same cursor position should now hit
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 1, 'hit after radius increased to 50 — function re-evaluated')

	holder.remove()
	t.end()
})

// Default click flow: openActionMenu is invoked, which means getActions was called.
tape('click with single hit invokes default openActionMenu (getActions called)', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	let getActionsCalls = 0
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			getActions: () => {
				getActionsCalls++
				return [{ label: 'Test action', onClick: () => {} }]
			},
			renderSingleHitInfo: (_d, c) => c.append('span').text('info')
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	t.equal(getActionsCalls, 1, 'getActions called once for the single hit')

	holder.remove()
	t.end()
})

// onSingleClick override replaces the default flow.
tape('click with single hit honours onSingleClick override', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	let overrideCalled = 0
	let getActionsCalls = 0
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			getActions: () => {
				getActionsCalls++
				return []
			},
			onSingleClick: () => {
				overrideCalled++
			}
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	t.equal(overrideCalled, 1, 'onSingleClick override invoked')
	t.equal(getActionsCalls, 0, 'default getActions not called when override present')

	holder.remove()
	t.end()
})

// onMultiClick override replaces the default multi-hit menu flow.
tape('click with multiple hits invokes onMultiClick override', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [
		{ id: 'a', x: 50, y: 50 },
		{ id: 'b', x: 51, y: 51 }
	]
	let multiCalls = 0
	let dotsSeen: TestPoint[] | null = null
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			onMultiClick: dots => {
				multiCalls++
				dotsSeen = dots
			}
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	t.equal(multiCalls, 1, 'onMultiClick called once')
	t.equal((dotsSeen as TestPoint[] | null)?.length, 2, 'override received both hits')

	holder.remove()
	t.end()
})

// Override that doesn't show a menu must call ctx.dismiss() to release the
// hover-suppression flag — otherwise subsequent mousemove would be ignored.
tape('override can call ctx.dismiss() to release hover-suppression after no-menu click', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			onSingleClick: (_d, _event, ctx) => {
				ctx.dismiss()
			}
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 0, 'rings cleared by ctx.dismiss()')

	// mousemove should resume (flag was reset by dismiss).
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 1, 'mousemove resumes after ctx.dismiss()')

	holder.remove()
	t.end()
})

// click menu onHide clears the in-flight flag and the hover rings.
tape('click menu onHide clears clickMenuIsShown flag and hover rings', t => {
	const { holder, cover, hoverLayer, hoverTip } = setupHarness()
	const points: TestPoint[] = [{ id: 'a', x: 50, y: 50 }]
	const dpi = new DataPointInteractions<TestPoint>(
		defaultOpts(cover, hoverLayer, hoverTip, points, {
			getActions: () => [{ label: 'Act', onClick: () => {} }],
			renderSingleHitInfo: (_d, c) => c.append('span').text('info')
		})
	)
	dpi.attach()

	const rect = (cover.node() as Element).getBoundingClientRect()
	dispatchMouseEvent(cover.node(), 'click', rect.left + 50, rect.top + 50)
	t.ok(hoverLayer.selectAll('path').size() >= 1, 'precondition: rings drawn after click')

	// Reach into the private clickMenu to fire its hide. The hide flow runs
	// the onHide callback, which is what we want to verify.
	;(dpi as any).clickMenu.hide()

	t.equal(hoverLayer.selectAll('path').size(), 0, 'rings cleared by clickMenu.onHide')
	// After the menu hides, mousemove should run again (flag was reset).
	dispatchMouseEvent(cover.node(), 'mousemove', rect.left + 50, rect.top + 50)
	t.equal(hoverLayer.selectAll('path').size(), 1, 'mousemove resumes after click menu dismissed')

	holder.remove()
	t.end()
})
