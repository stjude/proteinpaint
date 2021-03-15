import { select, selectAll } from 'd3-selection'

/*
	1. for each element, get the elements collide with it

	2. get the label with the least number of collisions (easiest to move)
		- when there are ties, get the bounding box for all the elements
			and start with the element that is closest to the border of
			that larger bounding box
	
	3. for the element that is selected to be moved:
		a: get the bounding box of all the elements that it collides with
		b. for each bbox side that the element collides with, move the element the (required distance to avoid the collission + padding) 
*/

const defaults = {
	waitTime: 200,
	pad: 5,
	nameKey: '',
	steps: [
		{
			type: 'restyle',
			applyTo: 'all', // or just the minColliders
			css: {
				selector: 'text',
				key: 'font-size',
				value: '11px'
			}
		},
		/*{
			type: 'restyle',
			css: {
				selector: 'text',
				key: 'text-anchor',
				value: 'start'
			}
		},*/
		{
			type: 'move',
			css: {
				selector: 'text'
			},
			boxSorter: (a, b) => {
				if (a.x1 > b.x1) return -1
				if (b.x1 > a.x1) return 1
				if (a.y1 > b.y1) return -1
				if (b.y1 > a.y1) return 1
				return 0
			}
		}
	]
}

export async function uncollide(labels, _opts = {}) {
	const opts = Object.assign({}, defaults, _opts)
	if (!opts.steps || !opts.steps.length) return
	if (!opts.svg) opts.svg = labels.node().closest('svg')
	await sleep(opts.waitTime)
	opts.svgBox = opts.svg.getBoundingClientRect()
	const boxes = getBoxes(labels, opts)
	const minNonZeroCollisions = trackCollisions(boxes)
	window.boxes = boxes
	if (minNonZeroCollisions) {
		const step = opts.steps.shift()
		const adjustees = step.applyTo == 'all' ? boxes : boxes.filter(b => b.collisions.length === minNonZeroCollisions)
		if (adjustees.length) {
			if (step.boxSorter) adjustees.sort(step.boxSorter)
			for (const box of adjustees) {
				trackOverlaps(box, boxes.filter(b => b != box))
				await adjusters[step.type](box, step, boxes, opts)
			}
		}
		if (opts.steps.length) setTimeout(() => uncollide(labels, opts), 0)
		//else boxes.forEach(showBox)
	} //else boxes.forEach(showBox)
}

function getBoxes(labels, opts) {
	const boxes = []
	labels.each(function(data) {
		const elem = this
		const bbox = elem.getBoundingClientRect()
		const box = {
			elem,
			label: select(elem),
			x1: bbox.x - opts.svgBox.x,
			x2: bbox.x - opts.svgBox.x + bbox.width,
			y1: bbox.y - opts.svgBox.y,
			y2: bbox.y - opts.svgBox.y + bbox.height,
			width: bbox.width,
			height: bbox.height,
			svgBox: opts.svgBox
		}
		box.maxFree = {
			n: box.y1,
			s: opts.svgBox.y + opts.svgBox.height - box.y2,
			e: opts.svgBox.x + opts.svgBox.width - box.x2,
			w: box.x1
		}
		if (opts.nameKey) box.name = data[opts.nameKey]
		boxes.push(box)
	})
	return boxes
}

function trackCollisions(boxes) {
	let minNonZeroCollisions = 0
	for (const box of boxes) {
		const nonZeroCollisions = trackOverlaps(box, boxes.filter(b => b != box))
		if (minNonZeroCollisions === 0 || nonZeroCollisions < minNonZeroCollisions) {
			minNonZeroCollisions = nonZeroCollisions
		}
	}
	boxes.sort(sortBoxes)
	return minNonZeroCollisions
}

function sortBoxes(a, b) {
	return a.collisions.length - b.collisions.length
}

function trackOverlaps(box, boxes) {
	box.collisions = []
	box.corners = {}
	box.overlapSum = 0
	box.maxOverlaps = {}
	const x1 = box.x1,
		x2 = box.x2
	const y1 = box.y1,
		y2 = box.y2
	for (const b of boxes) {
		if (b === box) continue
		const free = {}
		if (b.x2 < x1) {
			free.w = x1 - b.x2
		} else if (b.x1 > x2) {
			free.e = b.x1 - x2
		}
		if (b.y2 < y1) {
			free.n = y1 - b.y2
		} else if (b.y1 > y2) {
			free.s = b.y1 - y2
		}

		if (Object.keys(free).length) {
			if ('n' in free && free.n < box.maxFree.n) box.maxFree.n = free.n
			if ('s' in free && free.s < box.maxFree.s) box.maxFree.s = free.s
			if ('e' in free && free.e < box.maxFree.e) box.maxFree.e = free.e
			if ('w' in free && free.w < box.maxFree.w) box.maxFree.w = free.w
		} else {
			if (b.x1 <= x1 && x2 <= b.x2) {
				// this box' corners are both inside the other box
				if (b.x1 < x1 && x1 < b.x2) {
					const dx = b.x2 - x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'w' }
					if (b.y1 < y1 && y1 < b.y2) {
						box.maxFree.n = 0
						box.maxFree.w = 0
						if (!box.corners.nw) box.corners.nw = { against: [], sum: 0 }
						box.corners.nw.against.push(b)
						const dy = b.y2 - y1
						box.corners.nw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
					if (b.y1 < y2 && y2 < b.y2) {
						box.maxFree.s = 0
						box.maxFree.w = 0
						if (!box.corners.sw) box.corners.sw = { against: [], sum: 0 }
						box.corners.sw.against.push(b)
						const dy = y2 - b.y1
						box.corners.sw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
				}
				if (b.x1 < x2 && x2 < b.x2) {
					const dx = x2 - b.x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'e' }
					if (b.y1 < y1 && y1 < b.y2) {
						box.maxFree.n = 0
						box.maxFree.e = 0
						if (!box.corners.ne) box.corners.ne = { against: [], sum: 0, dx: 0, dy: 0 }
						box.corners.ne.against.push(b)
						const dy = b.y2 - y1
						box.corners.ne.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
					if (b.y1 < y2 && y2 < b.y2) {
						box.maxFree.s = 0
						box.maxFree.e = 0
						if (!box.corners.se) box.corners.se = { against: [], sum: 0 }
						box.corners.se.against.push(b)
						const dy = y2 - b.y1
						box.corners.se.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
				}
			} else {
				if (x1 < b.x1 && b.x1 < x2) {
					// the other box' corner is inside this box
					const dx = x2 - b.x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'e' }
					if (y1 < b.y1 && b.y1 < y2) {
						box.maxFree.s = 0
						box.maxFree.e = 0
						if (!box.corners.se) box.corners.se = { against: [], sum: 0 }
						box.corners.se.against.push(b)
						const dy = y2 - b.y1
						box.corners.se.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
					if (y1 < b.y2 && b.y2 < y2) {
						box.maxFree.n = 0
						box.maxFree.e = 0
						if (!box.corners.ne) box.corners.ne = { against: [], sum: 0 }
						box.corners.ne.against.push(b)
						const dy = b.y2 - y1
						box.corners.ne.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
				}

				if (x1 < b.x2 && b.x2 < x2) {
					const dx = b.x2 - x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'w' }
					if (y1 < b.y1 && b.y1 < y2) {
						box.maxFree.s = 0
						box.maxFree.w = 0
						if (!box.corners.sw) box.corners.sw = { against: [], sum: 0 }
						box.corners.sw.against.push(b)
						const dy = y2 - b.y1
						box.corners.sw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
					if (y1 < b.y2 && b.y2 < y2) {
						box.maxFree.n = 0
						box.maxFree.w = 0
						if (!box.corners.nw) box.corners.nw = { against: [], sum: 0 }
						box.corners.nw.against.push(b)
						const dy = b.y2 - y1
						box.corners.nw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
				}
			}
		}

		const corners = Object.keys(box.corners)
		if (corners.length) {
			box.collisions.push({ box: b, corners })
			for (const c in box.corners) {
				box.overlapSum += box.corners[c].sum
			}
		}
	}
	return box.collisions.length
}

async function restyle(box, step, boxes, opts) {
	const preAdjustedVal = new Map()
	box.label.selectAll(step.css.selector).each(function(d) {
		const s = select(this)
		preAdjustedVal.set(this, s.attr(step.css.key))
		s.attr(step.css.key, step.css.value)
	})
	await sleep(opts.waitTime)
	const adjustedBox = getBoxes(box.label, opts)[0]
	const i = boxes.indexOf(box)
	trackOverlaps(adjustedBox, boxes.filter(b => b != box))
	if (step.applyTo == 'all') {
		Object.assign(box, adjustedBox)
	} else {
		if (adjustedBox.overlapSum >= box.overlapSum) {
			box.label.selectAll(step.css.selector).each(function(d) {
				select(this).style(step.css.key, preAdjustedVal.get(this))
			})
		} else {
			Object.assign(box, adjustedBox)
		}
	}
}

async function move(box, step, boxes, opts) {
	const freeDirections = Object.keys(box.maxFree).filter(dir => box.maxFree[dir] > 0)
	if (!freeDirections.length) return

	const preAdjustedVal = new Map()
	if (box.maxOverlaps.y) {
		if (box.maxOverlaps.y.dir == 's' && freeDirections.includes('n')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('y') || 0)
				s.attr('y', box.maxOverlaps.y.val > box.maxFree.n ? -box.maxFree.n : -box.maxOverlaps.y.val)
			})
		}
		if (box.maxOverlaps.y.dir == 'n' && freeDirections.includes('s')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('y') || 0)
				s.attr('y', box.maxOverlaps.y.val > box.maxFree.s ? box.maxFree.s : box.maxOverlaps.y.val)
			})
		}
	}

	if (box.maxOverlaps.x) {
		if (box.maxOverlaps.x.dir == 'e' && freeDirections.includes('w')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('x') || 0)
				s.attr('x', box.maxOverlaps.x.val > box.maxFree.w ? -box.maxFree.w : -box.maxOverlaps.x.val)
			})
		}
		if (box.maxOverlaps.x.dir == 'w' && freeDirections.includes('e')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('x') || 0)
				s.attr('x', box.maxOverlaps.x.val > box.maxFree.e ? box.maxFree.e : box.maxOverlaps.x.val)
			})
		}
	}

	if (!preAdjustedVal.size) return
	await sleep(opts.waitTime)
	const adjustedBox = getBoxes(box.label, opts)[0]
	const i = boxes.indexOf(box)
	trackOverlaps(adjustedBox, boxes.filter(b => b != box))
	if (adjustedBox.overlapSum >= box.overlapSum) {
		box.label.selectAll(step.css.selector).each(function(d) {
			select(this).style(step.css.key, preAdjustedVal.get(this))
		})
	} else {
		Object.assign(box, adjustedBox)
	}
}

const adjusters = { restyle, move }

function showBox(box) {
	const rect = select(box.elem.closest('svg'))
		.append('rect')
		.attr('x', box.x1)
		.attr('y', box.y1)
		.attr('width', box.width)
		.attr('height', box.height)
		.style('stroke', 'blue')
		.style('fill', 'transparent')
}

function resetBoxes(boxes, opts) {
	boxes.forEach(function(box) {
		const bbox = box.elem.getBoundingClientRect()
		box.x1 = bbox.x - opts.svgBox.x
		box.x2 = bbox.x - opts.svgBox.x + bbox.width
		box.y1 = bbox.y - opts.svgBox.y
		box.y2 = bbox.y - opts.svgBox.y + bbox.height
		box.width = bbox.width
		box.height = bbox.height
	})
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
