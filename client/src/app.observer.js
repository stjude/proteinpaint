import { select as d3select } from 'd3-selection'

export const clickableSjClasses = [
	'sja_menuoption',
	'sja_clb',
	'sja_clbtext',
	'sja_clbtext2',
	'sjpp-dslabel',
	'sjpp-active-tiny-button',
	'sja_inset_a',
	'sjpp-matrix-label',
	'sjpp-matrix-divide-by-label',
	'sjpp-matrix-legend-g'
]

// buttons, inputs, a (link) and other elements have native support
// for tab and Enter-to-click keyboard navigation; the tagNames below
// are for elements that do not natively support keyboard navigation,
// and will be detected as requiring support if they have one of the
// clickableSjClasses
const svgClickable = new Set(['text' /*, 'rect'*/])
const targetTagNames = new Set(['DIV', 'SPAN', 'TEXT', 'LABEL', 'g', ...[...svgClickable]])

export const renderWait = 500
const observedElems = new WeakSet()

/*
  observeElem() will monitor for added DOM elements, so that the
  MutationObserver callback can detect elements that should have
  certain attributes and/or event handlers to satisfy portal 
  requirements such as Section 508 or style guides.

  elem: 
    should just be the .sja_root_holder element,
    no need to monitor child elements, call once in src/app.js
    in runproteinpaint() function

  NOTE: When called on .sja_root_holder, the menu divs will not
  be observed since those are attached directly on the document.body.
  The 'client/menu.js' code has `setTabNavigation()` for this reason.
*/
export function observeElem(elem) {
	if (observedElems.has(elem)) return
	observedElems.add(elem)
	observer.observe(elem, { childList: true, subtree: true })
}

const observer = new MutationObserver(function (mutationsList, observer) {
	const relevantElems = new Set()
	for (const mutation of mutationsList) {
		for (const elem of mutation.addedNodes) {
			// Check if the elem is an Element (not a text node, etc.)
			if (elem.nodeType === Node.ELEMENT_NODE) {
				if (!targetTagNames.has(elem.tagName) || elem.tabIndex !== -1) continue
				relevantElems.add(elem)
			}
		}
		// TODO: may automate other behavior to satisfy Section 508 or other requirements
	}

	if (!relevantElems.size) return
	// give time for the added elements to have their attributes set
	setTimeout(() => {
		for (const elem of relevantElems) {
			if (elem.getAttribute('tabindex') !== null) continue
			const selem = d3select(elem)
			if (
				!svgClickable.has(elem.tagName) &&
				!clickableSjClasses.find(cls => elem.classList?.contains(cls)) &&
				!selem.on('click')
			)
				continue
			//console.log(36, elem.tabIndex, elem.getAttribute('tabindex'))
			selem
				// svg elems will be grouped
				.attr('tabindex', 0) //svgClickable.has(elem.tagName) ? -1 : 0)
				.on('keyup.root_observer', event => {
					if (event.key == 'Enter') {
						const box = event.target.getBoundingClientRect()
						const clientX = box.x + 0.5 * box.width
						const clientY = box.y + box.height
						//event.target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }))
						event.target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX, clientY }))
						event.target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX, clientY }))
						event.target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }))
					}
				})
		}
		relevantElems.clear()
	}, renderWait)
})
