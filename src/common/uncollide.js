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
				value: '11px'
			}
		},
		/*{
			type: 'restyle',
			applyTo: 'all', // or just the minColliders
			css: {
				selector: 'text',
				key: 'y',
				value: '10'
			}
		},*/
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
			for (const adj of adjustees) {
				await adjusters[step.type](adj, step, boxes, opts)
			}
		}
		if (opts.steps.length) setTimeout(() => uncollide(labels, opts), 0)
		else boxes.forEach(showBox)
	}
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
		if (opts.nameKey) box.name = data[opts.nameKey]
		boxes.push(box)
	})
	return boxes
}

function trackCollisions(boxes) {
	let minNonZeroCollisions = 0
	for (const box of boxes) {
		const nonZeroCollisions = trackOverlaps(box, boxes)
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
	const x1 = box.x1,
		x2 = box.x2
	const y1 = box.y1,
		y2 = box.y2
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

async function restyle(box, step, boxes, opts) {
	const preAdjustedVal = new Map()
	box.label.selectAll(step.css.selector).each(function(d) {
		const s = select(this)
		preAdjustedVal.set(this, s.attr(step.css.key))
		s.attr(step.css.key, step.css.value)
	})
	await sleep(opts.waitTime)
	const adjustedBox = getBoxes(box.label, opts)[0]
	trackOverlaps(adjustedBox, [adjustedBox, ...boxes.slice(1)])
	if (step.applyTo != 'all' && (!adjustedBox || adjustedBox.collisions.length > box.collisions.length)) {
		if (adjustedBox.overlapSum > box.overlapSum) {
			box.label.selectAll(step.css.selector).each(function(d) {
				select(this).style(step.css.key, preAdjustedVal.get(this))
			})
		} else {
			Object.assign(box, adjustedBox)
		}
	} else {
		Object.assign(box, adjustedBox)
	}
}

function move(boxes) {}

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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
