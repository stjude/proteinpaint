import { select } from 'd3-selection'
import { brushX } from 'd3-brush'
import { roundValueAuto } from '#shared/roundValue.js'

/*
********************** EXPORTED
addBrushes()// add brushed to densityplot from self.num_obj.brushes and 
            // new brush at end or center of plot
addNewBrush() // add new brush either at end (with existing ranges) or in center (no ranges)

********************** INTERNAL
applyBrush() // main function to define and init d3 brushes, 
             // it will handle events such as brush move, drag
             // and will update input elements attached to brush, e.g. brush.rangeInput

*/

export function addBrushes(self, new_brush_location) {
	// const ranges = self.num_obj.ranges
	const brushes = self.num_obj.brushes
	const maxvalue = self.num_obj.density_data.max
	const minvalue = self.num_obj.density_data.min
	const rawDecile = (maxvalue - minvalue) / 10
	const decile = self.tvs.term.type == 'integer' ? Math.floor(rawDecile) : rawDecile

	for (const [i, r] of self.num_obj.ranges.entries()) {
		const _b = brushes.find(b => b.orig === r)
		let brush
		if (!_b) {
			brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
			brushes.push(brush)
		} else {
			brush = _b
		}
		// strict equality to not have false positive with start=0
		if (r.start === '') {
			if (new_brush_location == 'center') brush.range.start = minvalue + decile * 4
			else brush.range.start = minvalue + decile * 8
		}
		if (r.stop === '') {
			if (new_brush_location == 'center') brush.range.stop = minvalue + decile * 6
			else brush.range.stop = Math.floor(maxvalue)
		}
	}

	const range_brushes = self.num_obj.brush_g.selectAll('.range_brush').data(brushes, d => brushes.indexOf(d))

	range_brushes.exit().remove()

	// add update to brush if required
	range_brushes.each(function (d, i) {
		select(this).selectAll('.overlay').style('pointer-events', 'all')
	})

	range_brushes
		.enter()
		.append('g')
		.attr('class', 'range_brush')
		.each(function (brush, i) {
			applyBrush(self, this, brush, i)
		})
}

function applyBrush(self, elem, brush) {
	if (!brush.elem) brush.elem = select(elem)
	const range = brush.range
	const plot_size = self.num_obj.plot_size
	const xscale = self.num_obj.xscale
	const maxvalue = self.num_obj.density_data.max
	const minvalue = self.num_obj.density_data.min

	brush.d3brush = brushX()
		.extent([
			[0, 0],
			[plot_size.width, plot_size.height]
		])
		.on('brush', function (event, d) {
			const s = event.selection
			if (!s) return // not an event triggered by brush dragging
			const inputRange = brush.rangeInput.getRange()
			if (inputRange?.value != undefined) {
				brush.range = inputRange
				return
			}
			//update temp_ranges
			updateTempRanges(xscale, s, range, inputRange, minvalue, maxvalue, self.tvs.term.type)

			const [start, stop] = setStartStopDisplays(range, inputRange)
			// update inputs from brush move
			brush.rangeInput.getInput().node().value = `${start} x ${stop}`
		})
		.on('end', function () {
			//diable pointer-event for multiple brushes
			brush.elem.selectAll('.overlay').style('pointer-events', 'none')
		})

	const brush_start = range.startunbounded ? minvalue : range.start
	const brush_stop = range.stopunbounded ? maxvalue : range.stop
	brush.init = () => {
		if (range.value == undefined)
			brush.elem.call(brush.d3brush).call(brush.d3brush.move, [brush_start, brush_stop].map(xscale))
	}

	if (range.startunbounded) delete range.start
	if (range.stopunbounded) delete range.stop
	brush.elem
		.selectAll('.selection')
		.style(
			'fill',
			(brush.orig.start === '' && brush.orig.stop === '') || JSON.stringify(range) != JSON.stringify(brush.orig)
				? '#23cba7'
				: '#777777'
		)
}

/** Updates the number range returned from the brushing into
 * rounded values or integers.  Encapsulated and exported to verify
 * usage via testing and CI.
 *
 * xscale: d3 scale for x-axis
 * s: selection from brush, [start, stop]
 * range: range object to update
 * inputRange: input range object
 * minValue: min value of the density plot
 * maxValue: max value of the density plot
 * termType: term type
 */
export function updateTempRanges(xscale, s, range, inputRange, minvalue, maxvalue, type) {
	range.start = convertRangeValue(xscale, s[0])
	range.stop = convertRangeValue(xscale, s[1])
	const min = roundValueAuto(Number(minvalue))
	const max = roundValueAuto(Number(maxvalue))
	//If the user inputs a value outside the brush, limit it to the brush
	//Otherwise the input displays a calculated position closest to the value.
	if (range.start < min) range.start = min
	if (range.stop > max) range.stop = max
	//Limit by the brush, not by the user
	range.startunbounded = min == range.start && inputRange.startunbounded
	range.stopunbounded = max == range.stop && inputRange.stopunbounded
	//Do not show decimals for integer types
	if (type == 'integer') {
		range.start = range.startunbounded ? '' : Math.round(range.start)
		range.stop = range.stopunbounded ? '' : Math.round(range.stop)
	}
}

/** Set the start and stop displayed to the user
 * Encapsulated and exported to verify usage via testing and CI.
 *
 * range: range object to update. Note this is already altered by updateTempRanges
 * inputRange: input range object
 */

export function setStartStopDisplays(range, inputRange) {
	const start = range.startunbounded ? '' : inputRange.startinclusive ? `${range.start} <=` : `${range.start} <`
	const stop = range.stopunbounded ? '' : inputRange.stopinclusive ? `<= ${range.stop}` : `< ${range.stop}`

	return [start, stop]
}

function convertRangeValue(xscale, sidx) {
	const value = Number(xscale.invert(sidx))
	return roundValueAuto(value)
}

//Add new blank range temporary, save after entering values
export function addNewBrush(self, new_brush_location = 'end', callback) {
	const new_range = { start: '', stop: '', index: self.tvs.ranges.length }
	self.num_obj.ranges.push(new_range)
	const brush = { orig: new_range, range: JSON.parse(JSON.stringify(new_range)) }
	self.num_obj.brushes.push(brush)
	addBrushes(self, new_brush_location)
	if (callback) callback()
	brush.init()
}
