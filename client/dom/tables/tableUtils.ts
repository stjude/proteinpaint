/** striping color of every other row */
export const STRIPE = 'rgb(245,245,245)'

/** incremented id plus a random suffix: unique on the page even with several tables or other code using the same prefix */
let idIncr = 0
const randomSuffix = Math.random()
export function uniqueId(str: string) {
	return `sjpp-${str}-${idIncr++}-${randomSuffix}`
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** A cell.url is only made a link when it is a web or mail link. A javascript:, data: or vbscript: url would
 * run when clicked, and cell urls can come from data the table's caller does not control. Relative urls
 * resolve against the page and pass. */
export function isSafeUrl(url: string): boolean {
	try {
		return SAFE_URL_PROTOCOLS.has(new URL(url, window.location.href).protocol)
	} catch {
		return false
	}
}

/** Strips a <button> of the browser's button look, for icon buttons and menu items. Callers add what differs. */
export function plainButton(button: any) {
	return button
		.style('background', 'none')
		.style('border', 'none')
		.style('font', 'inherit')
		.style('cursor', 'pointer')
}
