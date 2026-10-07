import type Map from 'ol/Map.js'

/** "nice" round bar lengths (µm) to choose from, so the shown number always
 reads cleanly instead of some arbitrary fraction */
const NICE_UM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]

/** Widest the bar is allowed to render, in screen px */
const MAX_BAR_PX = 140

/** The largest "nice" µm length whose bar still fits within MAX_BAR_PX at
 this zoom (µm per screen px). (exported for tests) */
export function niceScaleLength(umPerScreenPx: number): number {
	let lenUm = NICE_UM[0]
	for (const n of NICE_UM) {
		if (n / umPerScreenPx > MAX_BAR_PX) break
		lenUm = n
	}
	return lenUm
}

/** Adds a scale bar (in micrometers) kept accurate as the user zooms: view
 resolution is level-0 px per screen px, so µm per screen px = resolution *
 mppX.

 Pinned to whatever portion of the map is actually on screen, the same
 problem the position:fixed legends elsewhere in this plot solve (their own
 repin()) — a map taller than the browser's own viewport (90vh plus
 whatever chrome sits above it easily exceeds 100vh) pushes the map's own
 bottom-right corner below the fold, so a scale bar anchored there via a
 native OL Control (position:absolute within the map's own container,
 scrolling with the page) can end up permanently off-screen even though
 nothing is technically hiding it — this was reported as "I can't see the
 scale bar" when the bar was, in fact, present, styled, and visible, just
 scrolled out of view.

 Teardown is tied to the viewer's own, not to a later scroll/resize: the bar
 is appended as a CHILD of the map's own target element (position:fixed
 still positions it relative to the viewport regardless of DOM nesting), so
 a full re-render that clears the viewer's container (View.ts's
 `holder.selectAll('*').remove()`) removes the bar in the same stroke; a
 MutationObserver on the target's own parent notices that removal
 immediately (not on the next scroll/resize) and detaches the window-level
 scroll/resize listeners + itself right then, rather than leaving them as
 dead weight on `window`/`document` until some later event happens to fire.

 Repositioning isn't limited to scroll/resize either: the burger menu's
 settings panel toggles open/closed by changing its own height/visibility
 style (controls.config.js), which pushes the map down without firing
 either event — the same case `wsi.direct.ts`'s own legend `repin()` handles
 (see its `layoutObserver`, ~line 293) — so a second MutationObserver
 mirrors that here, catching any style/class change anywhere on the page
 and coalescing to one `reposition()` per animation frame.

 No-op when mppX isn't a real, known value (wsitiles/meta answers mpp:[] when
 the slide reports no pixel size) — a bar drawn in raw pixels would be a
 false scale, so this shows nothing rather than something misleading.
 (exported for tests) */
export function addScaleBar(map: Map, mppX: number | undefined): void {
	if (!mppX || !Number.isFinite(mppX) || mppX <= 0) return
	const target = map.getTargetElement() // the map's own container div
	if (!target || !target.parentNode) return

	const el = document.createElement('div')
	el.className = 'sjpp-wsi-scalebar'
	el.style.cssText =
		'position:fixed; z-index:10; display:none; background:rgba(255,255,255,.8); padding:2px 6px; border-radius:3px; font:11px system-ui; color:#222;'
	const bar = document.createElement('div')
	bar.style.cssText = 'border:solid #222; border-width:0 2px 2px 2px; height:6px;'
	el.appendChild(bar)
	const label = document.createElement('div')
	label.style.cssText = 'text-align:center; margin-top:1px;'
	el.appendChild(label)
	target.appendChild(el) // removed along with target by the viewer's own teardown; position:fixed is unaffected by DOM nesting

	const update = () => {
		const res = map.getView().getResolution() // level-0 px per screen px, current zoom
		if (!res) return
		const umPerScreenPx = res * mppX
		const lenUm = niceScaleLength(umPerScreenPx)
		bar.style.width = `${lenUm / umPerScreenPx}px`
		label.textContent = `${lenUm} µm`
	}

	// clamps the bar to the map's own bottom-right corner, OR the viewport's
	// if that corner is scrolled out of view; hides it only once there is no
	// visible map area left for it to sit in at all. right/bottom (not
	// left/top): the box's own width changes on every zoom (update()'s
	// bar.style.width -- a round µm length picks a different bar width at
	// each resolution), and right/bottom keep the SAME corner anchored as
	// that happens automatically, with no need to rerun reposition() on
	// every resolution change too -- left/top, fixed in place, would instead
	// let a widening bar grow past the map's or viewport's right edge.
	const reposition = () => {
		const r = target.getBoundingClientRect()
		const bottom = Math.min(r.bottom, window.innerHeight) - 8
		const right = Math.min(r.right, window.innerWidth) - 8
		if (bottom < r.top + 20 || right < r.left + 20) {
			el.style.display = 'none' // no visible map area left to anchor to
			return
		}
		el.style.display = 'block'
		el.style.bottom = `${window.innerHeight - bottom}px`
		el.style.right = `${window.innerWidth - right}px`
	}

	const destroy = () => {
		window.removeEventListener('scroll', reposition, true)
		window.removeEventListener('resize', reposition)
		teardownObserver.disconnect()
		layoutObserver.disconnect()
		// el itself is already gone (it was target's own child), nothing to remove here
	}
	// fires as soon as target is detached -- no need to wait for a scroll or
	// resize to notice the viewer tore down; observing the parent (not target
	// itself) because an already-detached node fires no further mutations
	const teardownObserver = new MutationObserver(() => {
		if (!target.isConnected) destroy()
	})
	teardownObserver.observe(target.parentNode, { childList: true })

	// coalesced to one reposition() per animation frame regardless of how
	// many mutations land in a tick (see this function's own doc comment)
	let repositionQueued = false
	const queueReposition = () => {
		if (repositionQueued) return
		repositionQueued = true
		requestAnimationFrame(() => {
			repositionQueued = false
			reposition()
		})
	}
	const layoutObserver = new MutationObserver(records => {
		// ignore anything inside `target` (the map's own container), not just
		// `el` itself: wsi.direct.ts's own legend repin() also lives in there
		// and reacts to THIS layoutObserver's target the same way this one
		// reacts to legend mutations -- excluding only `el` left the two
		// observers re-triggering each other's reposition()/repin() every
		// animation frame, forever, once either one fired even once
		if (records.some(r => !target.contains(r.target as Node))) queueReposition()
	})
	layoutObserver.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], subtree: true })

	map.getView().on('change:resolution', update)
	// capture phase: catches a scrolling ANCESTOR too, not just the window
	window.addEventListener('scroll', reposition, { capture: true, passive: true })
	window.addEventListener('resize', reposition)
	update() // initial size, before any zoom change fires
	reposition() // initial position, before any scroll/resize fires
}
