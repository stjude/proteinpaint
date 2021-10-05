export function appear(d, display) {
	d.style('opacity', 0)
		.style('display', display || 'block')
		.transition()
		.style('opacity', 1)
}

export function disappear(d, remove) {
	d.style('opacity', 1)
		.transition()
		.style('opacity', 0)
		.call(() => {
			if (remove) {
				d.remove()
			} else {
				d.style('display', 'none').style('opacity', 1)
			}
		})
}
