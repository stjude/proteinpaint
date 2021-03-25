import { drag as d3drag, event, mouse } from 'd3'

export function make_lasso() {
	let items = [],
		closePathDistance = 75,
		closePathSelect = true,
		isPathClosed = false,
		targetArea,
		on = { start: function() {}, draw: function() {}, end: function() {} }

	// Function to execute on call
	function lasso(_this) {
		// add a new group for the lasso
		const g = _this.append('g').attr('class', 'lasso')

		// add the drawn path for the lasso
		const dyn_path = g.append('path').attr('class', 'drawn')

		// add a closed path
		const close_path = g.append('path').attr('class', 'loop_close')

		// add an origin node
		const origin_node = g.append('circle').attr('class', 'origin')

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

		function dragstart() {
			// Init coordinates
			drawnCoords = []

			// Initialize paths
			tpath = ''
			dyn_path.attr('d', null)
			close_path.attr('d', null)

			// Set every item to have a false selection and reset their center point and counters
			items.nodes().forEach(function(e) {
				e.__lasso.possible = false
				e.__lasso.selected = false
				e.__lasso.loopSelect = false

				let box = e.getBoundingClientRect()
				e.__lasso.lassoPoint = [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]
			})

			// Run user defined start function
			on.start()
		}

		function dragmove() {
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
			let tx = mouse(this)[0]
			let ty = mouse(this)[1]

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

			// Calculate the current distance from the lasso origin
			const distance = Math.sqrt(Math.pow(x - origin[0], 2) + Math.pow(y - origin[1], 2))

			// Set the closed path line
			const close_draw_path = 'M ' + tx + ' ' + ty + ' L ' + torigin[0] + ' ' + torigin[1]

			// Draw the lines
			dyn_path.attr('d', tpath)

			close_path.attr('d', close_draw_path)

			// Check if the path is closed
			isPathClosed = distance <= closePathDistance ? true : false

			// If within the closed path distance parameter, show the closed path. otherwise, hide it
			if (isPathClosed && closePathSelect) {
				close_path.attr('display', null)
			} else {
				close_path.attr('display', 'none')
			}

			items.nodes().forEach(function(n) {
				n.__lasso.loopSelect = pointInPolygon(n.__lasso.lassoPoint, drawnCoords)
				n.__lasso.possible = n.__lasso.loopSelect
			})

			on.draw()
		}

		function dragend() {
			// Remove mouseover tagging function
			items.on('mouseover.lasso', null)

			items.nodes().forEach(function(n) {
				n.__lasso.selected = n.__lasso.possible
				n.__lasso.possible = false
			})

			// Clear lasso
			dyn_path.attr('d', null)
			close_path.attr('d', null)
			origin_node.attr('display', 'none')

			// Run user defined end function
			on.end()
		}

		function pointInPolygon(point, vs) {
			let xi,
				xj,
				yi,
				yj,
				i,
				intersect,
				x = point[0],
				y = point[1],
				inside = false
			for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
				;(xi = vs[i][0]),
					(yi = vs[i][1]),
					(xj = vs[j][0]),
					(yj = vs[j][1]),
					(intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
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

	// Distance required before path auto closes loop
	lasso.closePathDistance = function(_) {
		if (!arguments.length) return closePathDistance
		closePathDistance = _
		return lasso
	}

	// Option to loop select or not
	lasso.closePathSelect = function(_) {
		if (!arguments.length) return closePathSelect
		closePathSelect = _ === true ? true : false
		return lasso
	}

	// Not sure what this is for
	lasso.isPathClosed = function(_) {
		if (!arguments.length) return isPathClosed
		isPathClosed = _ === true ? true : false
		return lasso
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
