export class ColorizeElement {
	async colorizeElement(
		lead: number,
		follow: number,
		v: number,
		obj: any,
		width: number,
		height: number,
		min: number,
		max: number,
		currView: any
	) {
		const bpMinV = min
		const bpMaxV = max

		if (v >= 0) {
			// positive or zero, use red
			const p = v >= bpMaxV ? 0 : v <= bpMinV ? 255 : Math.floor((255 * (bpMaxV - v)) / bpMaxV)
			const positiveFill = `rgb(255, ${p}, ${p})`
			if (currView === 'genome') {
				obj.ctx.fillStyle = positiveFill
				obj.ctx2.fillStyle = positiveFill
			} else {
				/** ctx for the chrpair and detail view */
				obj.fillStyle = positiveFill
			}
		} else {
			// negative, use blue
			const p = v <= bpMinV ? 255 : Math.floor((255 * (bpMaxV + v)) / bpMaxV)
			const negativeFill = `rgb(${p}, ${p}, 255)`
			if (currView === 'genome') {
				obj.ctx.fillStyle = negativeFill
				obj.ctx2.fillStyle = negativeFill
			} else {
				obj.fillStyle = negativeFill
			}
		}

		if (currView === 'genome') {
			obj.ctx.fillRect(follow, lead, width, height)
			obj.ctx2.fillRect(lead, follow, width, height)
		} else {
			obj.fillRect(lead, follow, width, height)
		}
	}
}
