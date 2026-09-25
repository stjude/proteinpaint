import Control from 'ol/control/Control.js' // anchors the bar to the map's own viewport
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

/** Adds a scale bar (in micrometers) to the map's bottom-right corner, kept
 accurate as the user zooms: view resolution is level-0 px per screen px, so
 µm per screen px = resolution * mppX. A native OL Control, anchored to the
 map's own viewport — unlike the position:fixed legends elsewhere in this
 plot, it needs no scroll/resize tracking.

 No-op when mppX isn't a real, known value (wsitiles/meta answers mpp:[] when
 the slide reports no pixel size) — a bar drawn in raw pixels would be a
 false scale, so this shows nothing rather than something misleading.
 (exported for tests) */
export function addScaleBar(map: Map, mppX: number | undefined): void {
	if (!mppX || !Number.isFinite(mppX) || mppX <= 0) return

	const el = document.createElement('div')
	el.className = 'ol-unselectable ol-control sjpp-wsi-scalebar'
	el.style.cssText =
		'right:.5em; bottom:.5em; background:rgba(255,255,255,.8); padding:2px 6px; border-radius:3px; font:11px system-ui; color:#222;'
	const bar = document.createElement('div')
	bar.style.cssText = 'border:solid #222; border-width:0 2px 2px 2px; height:6px;'
	el.appendChild(bar)
	const label = document.createElement('div')
	label.style.cssText = 'text-align:center; margin-top:1px;'
	el.appendChild(label)
	map.addControl(new Control({ element: el }))

	const update = () => {
		const res = map.getView().getResolution() // level-0 px per screen px, current zoom
		if (!res) return
		const umPerScreenPx = res * mppX
		const lenUm = niceScaleLength(umPerScreenPx)
		bar.style.width = `${lenUm / umPerScreenPx}px`
		label.textContent = `${lenUm} µm`
	}
	map.getView().on('change:resolution', update)
	update() // initial size, before any zoom change fires
}
