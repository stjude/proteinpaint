import { select } from 'd3-selection'
import { brushX } from 'd3-brush'
import { roundValueAuto } from '#shared/roundValue'

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
	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue
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
	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue

	brush.d3brush = brushX()
		.extent([
			[0, 0],
			[plot_size.width, plot_size.height]
		])
		.on('brush', function (event, d) {
			const s = event.selection
			if (!s) return // not an event triggered by brush dragging
			const inputRange = brush.rangeInput.getRange()
			if (inputRange.value != undefined) {
				brush.range = inputRange
				return
			}
			//update temp_ranges
			range.start = Number(xscale.invert(s[0]))
			range.stop = Number(xscale.invert(s[1]))
			let min = Number(minvalue)
			let max = Number(maxvalue)
			range.start = roundValueAuto(range.start)
			range.stop = roundValueAuto(range.stop)
			min = roundValueAuto(min)
			max = roundValueAuto(max)
			range.startunbounded = min == range.start && inputRange.startunbounded //Limit by the brush, not by the user
			range.stopunbounded = max == range.stop && inputRange.stopunbounded
			if (!range.startunbounded && !range.stopunbounded && self.tvs.term.type == 'integer') {
				range.start = range.start.toFixed(0)
				range.stop = range.stop.toFixed(0)
			}
			const start = range.startunbounded ? '' : inputRange.startinclusive ? `${range.start} <=` : `${range.start} <`
			const stop = range.stopunbounded ? '' : inputRange.stopinclusive ? `<= ${range.stop}` : `< ${range.stop}`
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
