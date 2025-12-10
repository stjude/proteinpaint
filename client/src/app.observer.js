import { select as d3select } from 'd3-selection'

export const focusableSjClasses = [
	'sja_menuoption',
	'sja_clb',
	'sja_clbtext',
	'sja_clbtext2',
	'sjpp-dslabel',
	'sjpp-active-tiny-button',
	'sja_inset_a'
]
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

const targetTagNames = new Set(['DIV', 'SPAN', 'TEXT', 'LABEL'])

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
			if (!focusableSjClasses.find(cls => elem.classList.contains(cls))) continue
			//console.log(36, elem.tabIndex, elem.getAttribute('tabindex'))
			d3select(elem)
				.attr('tabindex', 0)
				.on('keyup', event => {
					if (event.key == 'Enter') elem.click()
				})
		}
	}, renderWait)
})
