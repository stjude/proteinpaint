const NS = 'http://www.w3.org/2000/svg'
// form controls and images are left out: an exported figure has no use for a checkbox or a button
const skipTags = new Set(['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'IMG', 'SCRIPT', 'STYLE'])

/* An HTML element as it is drawn on the page, as SVG elements: each text at its place, in its font and color, each
background (a color or a linear gradient) and full border as a rect, and each inline <svg> as a copy, with the opacity of
its ancestors. For a legend of HTML to go with an SVG export, e.g. the genome browser's, as vector shapes and editable
text rather than an image. Positions are of the page's layout, relative to the element, which must be shown.
Returns the group and the width and height it covers. */
export function htmlToSvg(root: HTMLElement): { g: SVGGElement; width: number; height: number } {
	const g = document.createElementNS(NS, 'g') as SVGGElement
	const defs = g.appendChild(document.createElementNS(NS, 'defs'))
	const box = root.getBoundingClientRect()
	let width = 0,
		height = 0,
		gradients = 0
	walk(root, 1)
	if (!defs.childNodes.length) defs.remove()
	return { g, width, height }

	function walk(el: Element, parentOpacity: number) {
		if (skipTags.has(el.tagName)) return
		const cs = getComputedStyle(el)
		if (cs.display == 'none' || cs.visibility == 'hidden') return
		const opacity = parentOpacity * Number(cs.opacity)
		if (!opacity) return
		const r = el.getBoundingClientRect()
		if (el instanceof SVGSVGElement) {
			if (!r.width || !r.height) return
			const c = el.cloneNode(true) as SVGSVGElement
			c.setAttribute('x', String(r.left - box.left))
			c.setAttribute('y', String(r.top - box.top))
			c.setAttribute('width', String(r.width))
			c.setAttribute('height', String(r.height))
			add(withOpacity(c, opacity), r)
			return
		}
		if (r.width && r.height) {
			const fill = background(cs)
			const stroke = border(cs)
			if (fill || stroke) {
				const rect = document.createElementNS(NS, 'rect')
				rect.setAttribute('x', String(r.left - box.left))
				rect.setAttribute('y', String(r.top - box.top))
				rect.setAttribute('width', String(r.width))
				rect.setAttribute('height', String(r.height))
				rect.setAttribute('fill', fill || 'none')
				if (stroke) {
					rect.setAttribute('stroke', stroke.color)
					rect.setAttribute('stroke-width', String(stroke.width))
				}
				add(withOpacity(rect, opacity), r)
			}
		}
		for (const n of el.childNodes) {
			if (n.nodeType == Node.TEXT_NODE) text(n as Text, cs, opacity)
			else if (n.nodeType == Node.ELEMENT_NODE) walk(n as Element, opacity)
		}
	}

	// a text node as one <text> per line it is drawn on
	function text(n: Text, cs: CSSStyleDeclaration, opacity: number) {
		const s = n.textContent || ''
		if (!s.trim()) return
		const range = document.createRange()
		const lines = new Map<number, { left: number; top: number; bottom: number; words: string[] }>()
		for (const m of s.matchAll(/\S+/g)) {
			range.setStart(n, m.index!)
			range.setEnd(n, m.index! + m[0].length)
			const r = range.getBoundingClientRect()
			if (!r.width) continue
			const key = Math.round(r.top)
			if (!lines.has(key)) lines.set(key, { left: r.left, top: r.top, bottom: r.bottom, words: [] })
			const line = lines.get(key)!
			line.left = Math.min(line.left, r.left)
			line.words.push(m[0])
			width = Math.max(width, r.right - box.left)
			height = Math.max(height, r.bottom - box.top)
		}
		const size = parseFloat(cs.fontSize)
		for (const line of lines.values()) {
			const t = document.createElementNS(NS, 'text')
			t.setAttribute('x', String(line.left - box.left))
			// the baseline, from the line box: centered text of that size, its descent below
			t.setAttribute('y', String((line.top + line.bottom) / 2 - box.top + size * 0.35))
			t.setAttribute('font-family', cs.fontFamily)
			t.setAttribute('font-size', cs.fontSize)
			if (cs.fontWeight != '400' && cs.fontWeight != 'normal') t.setAttribute('font-weight', cs.fontWeight)
			if (cs.fontStyle != 'normal') t.setAttribute('font-style', cs.fontStyle)
			const [color, alpha] = colorAndAlpha(cs.color)
			t.setAttribute('fill', color)
			if (alpha < 1) t.setAttribute('fill-opacity', String(alpha))
			t.textContent = line.words.join(' ')
			g.appendChild(withOpacity(t, opacity))
		}
	}

	// a color, or a gradient made from the colors of a CSS linear-gradient, evenly spaced; none when transparent
	function background(cs: CSSStyleDeclaration): string | undefined {
		const img = cs.backgroundImage
		if (img.startsWith('linear-gradient(')) {
			const colors = img.match(/rgba?\([^)]*\)/g) || []
			if (colors.length) {
				const id = `htmlToSvg-gradient-${Date.now()}-${gradients++}`
				const lg = defs.appendChild(document.createElementNS(NS, 'linearGradient'))
				lg.setAttribute('id', id)
				// CSS defaults to top to bottom; 'to right' and 'to left' run across
				const across = /to (right|left)/.test(img)
				const reverse = /to (left|top)/.test(img)
				lg.setAttribute('x2', across ? '1' : '0')
				lg.setAttribute('y2', across ? '0' : '1')
				const stops = reverse ? [...colors].reverse() : colors
				stops.forEach((c, i) => {
					const stop = lg.appendChild(document.createElementNS(NS, 'stop'))
					stop.setAttribute('offset', String(stops.length > 1 ? i / (stops.length - 1) : 0))
					const [color, alpha] = colorAndAlpha(c)
					stop.setAttribute('stop-color', color)
					if (alpha < 1) stop.setAttribute('stop-opacity', String(alpha))
				})
				return `url(#${id})`
			}
		}
		const [color, alpha] = colorAndAlpha(cs.backgroundColor)
		if (!alpha) return
		return alpha < 1 ? color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`) : color
	}

	// a border on all four sides, of one width and color
	function border(cs: CSSStyleDeclaration): { color: string; width: number } | undefined {
		const sides = ['Top', 'Right', 'Bottom', 'Left']
		const w = sides.map(s => parseFloat(cs[`border${s}Width`]))
		const c = sides.map(s => cs[`border${s}Color`])
		const style = sides.map(s => cs[`border${s}Style`])
		if (!w[0] || style.some(s => s == 'none') || w.some(x => x != w[0]) || c.some(x => x != c[0])) return
		if (!colorAndAlpha(c[0])[1]) return
		return { color: c[0], width: w[0] }
	}

	function add(e: SVGElement, r: DOMRect) {
		g.appendChild(e)
		width = Math.max(width, r.right - box.left)
		height = Math.max(height, r.bottom - box.top)
	}
}

function withOpacity(e: SVGElement, opacity: number): SVGElement {
	if (opacity < 1) e.setAttribute('opacity', String(opacity))
	return e
}

/** a computed CSS color, rgb() or rgba(), as an rgb() color and its alpha */
export function colorAndAlpha(css: string): [string, number] {
	const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/)
	if (!m) return [css, css == 'transparent' ? 0 : 1]
	return [`rgb(${m[1]},${m[2]},${m[3]})`, m[4] === undefined ? 1 : Number(m[4])]
}
