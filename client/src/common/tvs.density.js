import { select, event } from 'd3-selection'
import { brushX } from 'd3-brush'

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
	range_brushes.each(function(d, i) {
		select(this)
			.selectAll('.overlay')
			.style('pointer-events', 'all')
	})

	range_brushes
		.enter()
		.append('g')
		.attr('class', 'range_brush')
		.each(function(brush, i) {
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
		.extent([[plot_size.xpad, 0], [plot_size.width - plot_size.xpad, plot_size.height]])
		.on('brush', function(d) {
			const s = event.selection
			if (!s) return // not an event triggered by brush dragging
			//update temp_ranges
			range.start = Number(xscale.invert(s[0]).toFixed(1))
			range.stop = Number(xscale.invert(s[1]).toFixed(1))
			const a_range = JSON.parse(JSON.stringify(brush.orig))
			if (range.startunbounded) a_range.start = Number(minvalue.toFixed(1))
			if (range.stopunbounded) a_range.stop = Number(maxvalue.toFixed(1))
			const similarRanges = JSON.stringify(range) == JSON.stringify(a_range)
			// update inputs from brush move
			brush.start_input
				.style('color', a_range.start == range.start ? '#000' : '#23cba7')
				.style('display', similarRanges ? 'none' : 'inline-block')
			brush.start_input.node().value = range.start == minvalue.toFixed(1) ? '' : range.start

			brush.stop_input
				.style('color', a_range.stop == range.stop ? '#000' : '#23cba7')
				.style('display', similarRanges ? 'none' : 'inline-block')
			brush.stop_input.node().value = range.stop == maxvalue.toFixed(1) ? '' : range.stop

			brush.start_select
				.style('display', similarRanges ? 'none' : 'inline-block')
				.property('selectedIndex', range.start == minvalue.toFixed(1) ? 2 : range.startinclusive ? 0 : 1)
			brush.stop_select
				.style('display', similarRanges ? 'none' : 'inline-block')
				.property('selectedIndex', range.stop == maxvalue.toFixed(1) ? 2 : range.stopinclusive ? 0 : 1)

			//update 'edit', 'apply' and 'reset' buttons based on brush change
			brush.edit_btn.style(
				'display',
				!similarRanges || a_range.start === '' || a_range.stop === '' ? 'none' : 'inline-block'
			)
			brush.apply_btn.style('display', similarRanges ? 'none' : 'inline-block')
			brush.reset_btn.style(
				'display',
				similarRanges || a_range.start === '' || a_range.stop === '' ? 'none' : 'inline-block'
			)

			// hide start and stop text and relation symbols if brush moved
			brush.start_text.style('display', !similarRanges ? 'none' : 'inline-block')
			brush.stop_text.style('display', !similarRanges ? 'none' : 'inline-block')
			brush.start_relation_text.style('display', !similarRanges ? 'none' : 'inline-block')
			brush.stop_relation_text.style('display', !similarRanges ? 'none' : 'inline-block')

			// make brush green if changed
			brush.elem.selectAll('.selection').style('fill', !similarRanges ? '#23cba7' : '#777777')
		})
		.on('end', function() {
			//diable pointer-event for multiple brushes
			brush.elem.selectAll('.overlay').style('pointer-events', 'none')
		})

	const brush_start = range.startunbounded ? minvalue : range.start
	const brush_stop = range.stopunbounded ? maxvalue : range.stop
	brush.init = () => {
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
