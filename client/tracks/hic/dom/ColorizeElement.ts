export class ColorizeElement {
	async colorizeElement(
		/** x coordinate */
		xCoord: number,
		/** y coordinate */
		yCoord: number,
		/** Value determines the color for the dot */
		v: number,
		/** Genome view: {ctx:.. ctx2:...}
		 * Detail view and chrpair view: obj == ctx
		 */
		obj: any,
		/** binpx for most views */
		width: number,
		/** binpx for most views */
		height: number,
		/** min, from parent component's this.min */
		bpMinV: number,
		/** max, from parent component's this.max */
		bpMaxV: number,
		/** func not used in horizontal view */
		currView: 'genome' | 'detail' | 'chrpair'
	) {
		if (v >= 0) {
			// positive or zero, use red
			const p = v >= bpMaxV ? 0 : v <= bpMinV ? 255 : Math.floor((255 * (bpMaxV - v)) / bpMaxV)
			const positiveFill = `rgb(255, ${p}, ${p})`
			if (currView === 'genome') {
				obj.ctx.fillStyle = positiveFill
				obj.ctx2.fillStyle = positiveFill
			} else {
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
			obj.ctx.fillRect(yCoord, xCoord, width, height)
			obj.ctx2.fillRect(xCoord, yCoord, width, height)
		} else {
			obj.fillRect(xCoord, yCoord, width, height)
		}
	}
}
