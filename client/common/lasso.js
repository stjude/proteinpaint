import { drag as d3drag } from 'd3-drag'
import { pointer } from 'd3-selection'

/*
********************** EXPORTED
make_lasso()
********************** INTERNAL
lasso() // Function to execute on call
	dragstart()
	dragmove()
	dragend()
	pointInPolygon() // check if point is inside selected lasso or not
lasso.items() // Set or get list of items for lasso to select
lasso.possibleItems() // Return possible items
lasso.selectedItems() // Return selected items
lasso.notPossibleItems() // Return not possible items
lasso.notSelectedItems() // Return not selected items
lasso.on() // Events
lasso.targetArea() // Area where lasso can be triggered from
*/

export function d3lasso() {
	let items = [],
		targetArea,
		on = { start: function() {}, draw: function() {}, end: function() {} }

	// Function to execute on call
	function lasso(_this) {
		// add a new group for the lasso
		const g = _this.append('g').attr('class', 'lasso')

		// add the drawn path for the lasso
		const drawn_path = g
			.append('path')
			.attr('class', 'drawn')
			.style('stroke', '#505050')
			.style('stroke-width', '2px')
			.style('fill-opacity', '.05')

		// add an origin node (circle to indicate start of lasso)
		const origin_node = g
			.append('circle')
			.attr('class', 'origin')
			.style('fill', '#3399FF')
			.style('fill-opacity', '.5')

		let tpath, // The transformed lasso path for rendering
			origin, // The lasso origin for calculations
			torigin, // The transformed lasso origin for rendering
			drawnCoords // Store off coordinates drawn

		// Apply drag behaviors
		let drag = d3drag()
			.on('start', dragstart)
			.on('drag', dragmove)
			.on('end', dragend)

		// Call drag
		targetArea.call(drag)

		function dragstart(event) {
			// Init coordinates
			drawnCoords = []

			// Initialize paths
			tpath = ''
			drawn_path.attr('d', null)

			// Set every item to have a false selection and reset their center point and counters
			items.nodes().forEach(function(e) {
				e.__lasso.possible = false
				e.__lasso.selected = false
				e.__lasso.loopSelect = false

				let box = e.getBoundingClientRect()
				e.__lasso.lassoPoint = [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]
			})

			// Run user defined start function
			on.start(event)
		}

		function dragmove(event) {
			// Get mouse position within body, used for calculations
			let x, y
			if (event.sourceEvent.type === 'touchmove') {
				x = event.sourceEvent.touches[0].clientX
				y = event.sourceEvent.touches[0].clientY
			} else {
				x = event.sourceEvent.clientX
				y = event.sourceEvent.clientY
			}

			// Get mouse position within drawing area, used for rendering
			let [tx, ty] = pointer(event, this)

			// Initialize the path or add the latest point to it
			if (tpath === '') {
				tpath = tpath + 'M ' + tx + ' ' + ty
				origin = [x, y]
				torigin = [tx, ty]
				// Draw origin node
				origin_node
					.attr('cx', tx)
					.attr('cy', ty)
					.attr('r', 7)
					.attr('display', null)
			} else {
				tpath = tpath + ' L ' + tx + ' ' + ty
			}

			drawnCoords.push([x, y])

			// Draw the lines
			drawn_path.attr('d', tpath)

			items.nodes().forEach(function(n) {
				n.__lasso.loopSelect = pointInPolygon(n.__lasso.lassoPoint, drawnCoords)
				n.__lasso.possible = n.__lasso.loopSelect
			})

			// Run user defined draw function
			on.draw(event)
		}

		function dragend(event) {
			// Remove mouseover tagging function
			items.on('mouseover.lasso', null)

			items.nodes().forEach(function(n) {
				n.__lasso.selected = n.__lasso.possible
				n.__lasso.possible = false
			})

			// Clear lasso
			drawn_path.attr('d', null)
			origin_node.attr('display', 'none')

			// Run user defined end function
			on.end(event)
		}

		// check if point is inside selected lasso or not
		// point: [x, y], polygon: [[x1,y1], [x2,y2], [x3,y3]...]
		function pointInPolygon(point, polygon) {
			let xi,
				xj,
				yi,
				yj,
				intersect,
				x = point[0],
				y = point[1],
				inside = false
			for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
				xi = polygon[i][0]
				yi = polygon[i][1]
				xj = polygon[j][0]
				yj = polygon[j][1]
				intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
				if (intersect) inside = !inside
			}
			return inside
		}
	}

	// Set or get list of items for lasso to select
	lasso.items = function(_) {
		if (!arguments.length) return items
		items = _
		const nodes = items.nodes()
		nodes.forEach(function(n) {
			n.__lasso = {
				possible: false,
				selected: false
			}
		})
		return lasso
	}

	// Return possible items
	lasso.possibleItems = function() {
		return items.filter(function() {
			return this.__lasso.possible
		})
	}

	// Return selected items
	lasso.selectedItems = function() {
		return items.filter(function() {
			return this.__lasso.selected
		})
	}

	// Return not possible items
	lasso.notPossibleItems = function() {
		return items.filter(function() {
			return !this.__lasso.possible
		})
	}

	// Return not selected items
	lasso.notSelectedItems = function() {
		return items.filter(function() {
			return !this.__lasso.selected
		})
	}

	// Events
	lasso.on = function(type, _) {
		if (!arguments.length) return on
		if (arguments.length === 1) return on[type]
		const types = ['start', 'draw', 'end']
		if (types.indexOf(type) > -1) {
			on[type] = _
		}
		return lasso
	}

	// Area where lasso can be triggered from
	lasso.targetArea = function(_) {
		if (!arguments.length) return targetArea
		targetArea = _
		return lasso
	}

	return lasso
}
