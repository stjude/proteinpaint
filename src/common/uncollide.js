import { select } from 'd3-selection'

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
	waitTime: 0,
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
		{
			type: 'restyle',
			css: {
				selector: 'text',
				key: 'text-anchor',
				value: 'start'
			}
		}
	]
}

export async function uncollide(labels, _opts = {}) {
	const opts = Object.assign({}, defaults, _opts) //; console.log(opts)
	if (!opts.steps || !opts.steps.length) return
	await sleep(opts.waitTime)
	const boxes = getBoxes(labels, opts)
	const minNonZeroCollisions = trackCollisions(boxes)
	if (minNonZeroCollisions) {
		const step = opts.steps.shift()
		const adjustees = step.applyTo == 'all' ? boxes : boxes.filter(b => b.collisions.length === minNonZeroCollisions)
		if (adjustees.length) {
			for (const adj of adjustees) {
				await adjusters[step.type](adj, step, boxes, opts)
			}
		}
		if (opts.steps.length) setTimeout(() => uncollide(labels, opts), 0)
	}
}

function getBoxes(labels, opts) {
	const boxes = []
	labels.each(function(data) {
		const elem = this
		const bbox = elem.getBBox()
		const matrix = elem.transform.baseVal.getItem(0).matrix
		const box = {
			elem,
			label: select(elem),
			x1: matrix.e - bbox.width,
			x2: matrix.e,
			y1: matrix.f - bbox.height,
			y2: matrix.f
		}
		if (opts.nameKey) box.name = data[opts.nameKey]
		boxes.push(box)

		select(elem.parentNode)
			.append('rect')
			.attr('x', box.x1)
			.attr('y', box.y1)
			.attr('width', box.width)
			.attr('height', box.height)
			.style('stroke', 'blue')
			.style('fill', 'transparent')
	})
	return boxes
}

function trackCollisions(boxes) {
	let minNonZeroCollisions = 0
	for (const box of boxes) {
		const nonZeroCollisions = trackOverlaps(box, boxes, box.x1, box.x2, box.y1, box.y2)
		if (minNonZeroCollisions === 0 || nonZeroCollisions < minNonZeroCollisions) {
			minNonZeroCollisions = nonZeroCollisions
		}
	}
	return minNonZeroCollisions
}

function trackOverlaps(box, boxes, x1, x2, y1, y2) {
	box.collisions = []
	box.corners = {}
	box.overlapSum = 0
	for (const b of boxes) {
		if (b === box) continue
		if (x1 < b.x1 && b.x1 < x2) {
			const dx = b.x1 - x1
			if (y1 < b.y1 && b.y1 < y2) {
				if (!box.corners.nw) box.corners.nw = { against: [], sum: 0 }
				box.corners.nw.against.push(b)
				box.corners.nw.sum += dx + y2 - b.y1 // perimeter instead of area
			}
			if (y1 < b.y2 && b.y2 < y2) {
				if (!box.corners.sw) box.corners.sw = { against: [], sum: 0 }
				box.corners.sw.against.push(b)
				box.corners.sw.sum += dx + b.y2 - y1 // perimeter instead of area
			}
		}
		if (x1 < b.x2 && b.x2 < x2) {
			const dx = b.x2 - x1
			if (y1 < b.y1 && b.y1 < y2) {
				if (!box.corners.ne) box.corners.ne = { against: [], sum: 0 }
				box.corners.ne.against.push(b)
				box.corners.ne.sum += dx + y2 - b.y1 // perimeter instead of area
			}
			if (y1 < b.y2 && b.y2 < y2) {
				if (!box.corners.se) box.corners.se = { against: [], sum: 0 }
				box.corners.se.against.push(b)
				box.corners.se.sum += dx + b.y2 - y1 // perimeter instead of area
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

function getAdjustee(minColliders) {
	let minNonZeroCorners = 0
	for (const m of minColliders) {
		const n = Object.keys(m.corners).length
		if (n && (minNonZeroCorners === 0 || n < minNonZeroCorners)) {
			minNonZeroCorners = n
		}
	}
	const adjustees = minColliders.filter(m => Object.keys(m.corners).length === minNonZeroCorners)
	if (adjustees.length == 1) return adjustees[0]
	// prefer to move a NW collider
	if (Array.isArray(step.applyTo)) {
		let filtered = adjustees
		for (const target of step.applyTo) {
			if (corners.includes(target)) {
				filtered = adju
			}
		}
	}
}

async function restyle(box, step, boxes, opts) {
	const preAdjustedVal = new Map()
	box.label.selectAll(step.css.selector).each(function(d) {
		const s = select(this)
		preAdjustedVal.set(this, s.style(step.css.key))
		s.style(step.css.key, step.css.value)
	})
	if (step.applyTo === 'all') return
	await sleep(opts.waitTime)
	const copy = Object.assign({}, box)
	const adjustedBox = getBoxes(box.label, opts)[0]
	trackOverlaps(adjustedBox, [adjustedBox, ...boxes.slice(1)], box.x1, box.x2, box.y1, box.y2)
	if (!adjustedBox || adjustedBox.collisions.length >= box.collisions.length) {
		//console.log(164, adjustedBox, box)
		if (adjustedBox.overlapSum > box.overlapSum) {
			box.label.selectAll(step.css.selector).each(function(d) {
				select(this).style(step.css.key, preAdjustedVal.get(this))
			})
		}
	}
}

function move(boxes) {}

const adjusters = { restyle, move }

/*
function getCorners(boxes) {
	const corners = {}
	for(const box of boxes) {
		if (!('x1' in corners) || corners.x1 > box.x1) {
			corners.x1 = box.x1
		}
		if (!('x2' in corners) || corners.x2 < box.x2) {
			corners.x2 = box.x2
		}
		if (!('y1' in corners) || corners.y1 > box.y1) {
			corners.y1 = box.y1
		}
		if (!('y2' in corners) || corners.y2 < box.y2) {
			corners.y2 = box.y2
		}
	}
	
	const width = corners.x2 - corners.x1
	const height = corners.y2 - corners.y1
	const rect = select(boxes[0].elem.parentNode)
		.append('rect')
		.attr('x', corners.x1)
		.attr('y', corners.y1)
		.attr('width', width)
		.attr('height', height)
		.style('stroke', 'red')
		.style('fill', 'transparent')
	return corners
}
*/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
