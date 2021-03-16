import { select, selectAll } from 'd3-selection'

function getDefaults(opts) {
	const mover = {
		type: 'move',
		pad: 0,
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

	const defaults = {
		waitTime: 0, //200,
		pad: 5,
		nameKey: '',
		steps: [
			{
				type: 'restyle',
				applyTo: 'all', // or just the minColliders
				css: {
					selector: 'text',
					key: 'font-size',
					value: '12px'
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
			mover
			//mover,
			//mover
		]
	}
	return Object.assign(defaults, opts)
}

/*
	1. for each element, get the elements collide with it

	2. get the label with the least number of collisions (easiest to move)
		- when there are ties, get the bounding box for all the elements
			and start with the element that is closest to the border of
			that larger bounding box
	
	3. for the element that is selected to be moved:
		a: get the bounding box of all the elements that it collides with
		b. for box side that the element collides with, move the element the (required distance to avoid the collission + padding) 

	
*/

export async function uncollide(labels, _opts = {}) {
	if (!labels || !labels.size()) return
	const opts = getDefaults(_opts)
	if (!opts.steps || !opts.steps.length) return
	if (!opts.svg) opts.svg = labels.node().closest('svg')
	await sleep(opts.waitTime)
	opts.svgBox = opts.svg.getBoundingClientRect()
	const boxes = getBoxes(labels, opts)
	const minNonZeroCollisions = trackCollisions(boxes) //; console.log(66, minNonZeroCollisions)
	window.boxes = boxes
	if (minNonZeroCollisions) {
		const step = opts.steps.shift()
		const adjustees = step.applyTo == 'all' ? boxes : boxes.filter(b => b.collisions.length === minNonZeroCollisions)
		if (adjustees.length) {
			if (step.boxSorter) adjustees.sort(step.boxSorter)
			for (const box of adjustees) {
				const b = getBoxes(box.label, opts)[0]
				Object.assign(box, b)
				trackOverlaps(box, boxes.filter(b => b != box)) //; if (box.name.length >= 28) console.log(77, box)
				await adjusters[step.type](box, step, boxes, opts)
			}
		}
		if (opts.steps.length) setTimeout(() => uncollide(labels, opts), 0)
		else boxes.forEach(showBox)
	} else boxes.forEach(showBox)
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
			height: bbox.height
		}
		box.maxFree = {
			n: Math.max(box.y1, 0),
			s: Math.max(opts.svgBox.y + opts.svgBox.height - box.y2, 0),
			e: Math.max(opts.svgBox.x + opts.svgBox.width - box.x2, 0),
			w: Math.max(box.x1, 0)
		}
		// for tracking collisions
		box.corners = {}
		box.overlapSum = 0
		box.collisions = []
		box.maxOverlaps = {}
		detectSvgOverflow(box, opts.svgBox)
		if (opts.nameKey) box.name = data[opts.nameKey]
		// console.log(box.name, box.collisions.map(d=>d.corners), Object.values(box.maxFree))
		boxes.push(box)
	})
	return boxes
}

function trackCollisions(boxes) {
	let minNonZeroCollisions = 0
	for (const box of boxes) {
		const numCollisions = trackOverlaps(box, boxes.filter(b => b != box))
		if (minNonZeroCollisions === 0 || (numCollisions > 0 && numCollisions < minNonZeroCollisions)) {
			minNonZeroCollisions = numCollisions
		}
	}
	boxes.sort(sortBoxes)
	return minNonZeroCollisions
}

function sortBoxes(a, b) {
	return a.collisions.length - b.collisions.length
}

function trackOverlaps(box, boxes) {
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
				// this box' corners may be both inside the other box;
				// the other box's corner will be outside this box
				if (b.x1 <= x1 && x1 <= b.x2) {
					const dx = b.x2 - x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'w' }
					if (b.y1 <= y1 && y1 <= b.y2) {
						if (y1 < b.y1) box.maxFree.n = 0
						if (x1 > b.x1) box.maxFree.w = 0
						if (!box.corners.nw) box.corners.nw = { against: [], sum: 0 }
						box.corners.nw.against.push(b.name)
						const dy = b.y2 - y1
						box.corners.nw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
					if (b.y1 <= y2 && y2 <= b.y2) {
						if (y2 < b.y2) box.maxFree.s = 0
						if (x1 > b.x1) box.maxFree.w = 0
						if (!box.corners.sw) box.corners.sw = { against: [], sum: 0 }
						box.corners.sw.against.push(b.name)
						const dy = y2 - b.y1
						box.corners.sw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
				}
				if (b.x1 <= x2 && x2 <= b.x2) {
					const dx = x2 - b.x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'e' }
					if (b.y1 <= y1 && y1 <= b.y2) {
						if (y1 < b.y1) box.maxFree.n = 0
						if (x2 < b.x2) box.maxFree.e = 0
						if (!box.corners.ne) box.corners.ne = { against: [], sum: 0 }
						box.corners.ne.against.push(b.name)
						const dy = b.y2 - y1
						box.corners.ne.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
					if (b.y1 <= y2 && y2 <= b.y2) {
						if (y2 < b.y2) box.maxFree.s = 0
						if (x2 < b.x2) box.maxFree.e = 0
						if (!box.corners.se) box.corners.se = { against: [], sum: 0 }
						box.corners.se.against.push(b.name)
						const dy = y2 - b.y1
						box.corners.se.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
				}
			} else {
				if (x1 <= b.x1 && b.x1 <= x2) {
					// the other box' corner(s) may be inside this box
					const dx = x2 - b.x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'e' }
					if (y1 <= b.y1 && b.y1 <= y2) {
						if (y2 < b.y2) box.maxFree.s = 0
						if (x2 < b.x2) box.maxFree.e = 0
						if (!box.corners.se) box.corners.se = { against: [], sum: 0 }
						box.corners.se.against.push(b.name)
						const dy = y2 - b.y1
						box.corners.se.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
					if (y1 <= b.y2 && b.y2 <= y2) {
						if (y1 > b.y1) box.maxFree.n = 0
						if (x2 < b.x2) box.maxFree.e = 0
						if (!box.corners.ne) box.corners.ne = { against: [], sum: 0 }
						box.corners.ne.against.push(b.name)
						const dy = b.y2 - y1
						box.corners.ne.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
				}

				if (x1 <= b.x2 && b.x2 <= x2) {
					const dx = b.x2 - x1
					if (!('x' in box.maxOverlaps) || box.maxOverlaps.x.val < dx) box.maxOverlaps.x = { val: dx, dir: 'w' }
					if (y1 <= b.y1 && b.y1 <= y2) {
						if (y2 < b.y2) box.maxFree.s = 0
						if (x1 > b.x1) box.maxFree.w = 0
						if (!box.corners.sw) box.corners.sw = { against: [], sum: 0 }
						box.corners.sw.against.push(b.name)
						const dy = y2 - b.y1
						box.corners.sw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 's' }
					}
					if (y1 <= b.y2 && b.y2 <= y2) {
						if (y1 > b.y1) box.maxFree.n = 0
						if (x1 > b.x1) box.maxFree.w = 0
						if (!box.corners.nw) box.corners.nw = { against: [], sum: 0 }
						box.corners.nw.against.push(b.name)
						const dy = b.y2 - y1
						box.corners.nw.sum += dx * dy
						if (!('y' in box.maxOverlaps) || box.maxOverlaps.y.val < dy) box.maxOverlaps.y = { val: dy, dir: 'n' }
					}
				}
			}
		}

		const corners = Object.keys(box.corners)
		if (corners.length) {
			box.collisions.push({ box: b.name, corners })
			for (const c in box.corners) {
				box.overlapSum += box.corners[c].sum
			}
		}
	}
	// console.log(261, box.name, 'free=', Object.values(box.maxFree), 'collisions=', box.collisions && box.collisions.length)
	return box.collisions.length
}

function detectSvgOverflow(box, svgBox) {
	// detect collision against the svg borders
	const x1 = box.x1,
		x2 = box.x2
	const y1 = box.y1,
		y2 = box.y2
	const corners = []
	if (x1 < 0) {
		box.maxOverlaps.x = { val: Math.abs(x1), dir: 'w' }
		corners.push('w')
		box.corners.w = { against: [], sum: Math.abs(x1) * box.height }
		box.overlapSum += box.corners.w.sum
	}
	const dx = x2 - svgBox.width
	if (dx > 0 && (!box.maxOverlaps.x || box.maxOverlaps.x.val < dx)) {
		box.maxOverlaps.x = { val: dx, dir: 'e' }
		corners.push('e')
		box.corners.e = { against: ['svgbox'], sum: dx * box.height }
		box.overlapSum += box.corners.e.sum
	}
	if (y1 < 0) {
		box.maxOverlaps.y = { val: Math.abs(y1), dir: 'n' }
		corners.push('n')
		box.corners.n = { against: ['svgbox'], sum: Math.abs(y1) }
		box.overlapSum += box.corners.n.sum
	}
	const dy = y2 - svgBox.height
	if (dy > 0 && (!box.maxOverlaps.y || box.maxOverlaps.y.val < dy)) {
		box.maxOverlaps.y = { val: dy, dir: 's' }
		corners.push('s')
		box.corners.s = { against: ['svgbox'], sum: dy * box.height }
		box.overlapSum += box.corners.s.sum
	}
	if (corners.length) box.collisions.push({ box: 'svg', corners })
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
				select(this).attr(step.css.key, preAdjustedVal.get(this))
			})
		} else {
			Object.assign(box, adjustedBox)
		}
	}
}

async function move(box, step, boxes, opts) {
	const freeDirections = Object.keys(box.maxFree).filter(dir => box.maxFree[dir] > 0)
	//console.log(327, 'freeDirections', box.name, freeDirections)
	if (!freeDirections.length) return

	const preAdjustedVal = new Map()
	if (box.maxOverlaps.y) {
		if (box.maxOverlaps.y.dir == 's' && freeDirections.includes('n')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('y') || 0)
				s.attr('y', Math.max(-box.maxFree.n, -box.maxOverlaps.y.val) - step.pad)
			})
		}
		if (box.maxOverlaps.y.dir == 'n' && freeDirections.includes('s')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('y') || 0)
				s.attr('y', Math.min(box.maxFree.s, box.maxOverlaps.y.val) + step.pad)
			})
		}
	}

	if (preAdjustedVal.size) {
		await sleep(opts.waitTime)
		const adjustedBox = getBoxes(box.label, opts)[0]
		trackOverlaps(adjustedBox, boxes.filter(b => b != box))
		if (adjustedBox.overlapSum >= box.overlapSum) {
			box.label.selectAll(step.css.selector).each(function(d) {
				select(this).attr('y', preAdjustedVal.get(this))
			})
		} else {
			Object.assign(box, adjustedBox)
			if (!adjustedBox.collisions.length) return
		}
	}

	if (box.maxOverlaps.x) {
		if (box.maxOverlaps.x.dir == 'e' && freeDirections.includes('w')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('x') || 0)
				s.attr('x', Math.max(-box.maxFree.w, -box.maxOverlaps.x.val) - step.pad)
			})
		}
		if (box.maxOverlaps.x.dir == 'w' && freeDirections.includes('e')) {
			box.label.selectAll(step.css.selector).each(function(d) {
				const s = select(this)
				preAdjustedVal.set(this, s.attr('x') || 0)
				s.attr('x', Math.min(box.maxFree.e, box.maxOverlaps.x.val) + step.pad)
			})
		}
	}

	if (!preAdjustedVal.size) return
	await sleep(opts.waitTime)
	const adjustedBox = getBoxes(box.label, opts)[0]
	trackOverlaps(adjustedBox, boxes.filter(b => b != box))
	if (adjustedBox.overlapSum >= box.overlapSum) {
		//console.log(376, 'revert', adjustedBox.overlapSum, box.overlapSum)
		box.label.selectAll(step.css.selector).each(function(d) {
			select(this).attr('x', preAdjustedVal.get(this))
		})
	} else {
		Object.assign(box, adjustedBox)
	}
}

const adjusters = { restyle, move }

function showBox(box) {
	return
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
