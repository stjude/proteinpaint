import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, brushX } from 'd3'
import * as client from '../client'

export function getNumericMethods(self) {
	/*** self is a TVS instance, see src/common/tvs.js ***/

	// hoisted functions can be returned out of code sequence
	return {
		term_name_gen,
		get_pill_label,
		getSelectRemovePos,
		fillMenu
	}

	/************************************
	 Functions that require access to 
	 the TVS instance are closured here
	*************************************/

	async function fillMenu(div, tvs) {
		//numerical range div
		const num_parent_div = div.append('div')
		self.num_obj = {}

		self.num_obj.num_heading = num_parent_div
			.append('div')
			.style('display', tvs.term.values ? 'block' : 'none')
			.style('font-size', '.9em')
			.style('color', '#888')
			.html('Numerical Ranges')

		self.num_obj.num_div = num_parent_div
			.append('div')
			.attr('class', 'num_div')
			.style('padding', '5px')
			.style('color', '#000')
			.style('border-style', 'solid')
			.style('border-width', '2px')
			.style('border-color', '#eee')

		// svg
		self.num_obj.svg = self.num_obj.num_div.append('svg')

		self.num_obj.range_table = self.num_obj.num_div
			.append('table')
			.style('table-layout', 'fixed')
			.style('border-collapse', 'collapse')

		const ranges = []

		for (const [index, range] of tvs.ranges.entries()) {
			if (range.value == undefined) {
				range.index = index
				ranges.push(range)
			}
		}

		self.num_obj.plot_size = {
			width: 500,
			height: 100,
			xpad: 10,
			ypad: 20
		}

		try {
			self.num_obj.density_data = await self.opts.vocabApi.getDensityPlotData(tvs.term.id, self.num_obj, self.filter)
		} catch (err) {
			console.log(err)
		}

		if (self.num_obj.density_data.error) throw self.num_obj.density_data.error

		makeDensityPlot(self.num_obj.density_data)
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		self.num_obj.xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

		self.num_obj.ranges = ranges
		self.num_obj.brushes = []
		addBrushes()
		addRangeTable()
		if (self.opts.add_tvs_brush) addNewBrush()
		self.num_obj.brushes.forEach(brush => brush.init())
		await showCheckList_numeric(tvs, div)
	}

	function makeDensityPlot(data) {
		const width = 500,
			height = 100,
			xpad = 10,
			ypad = 20,
			xaxis_height = 20

		const svg = self.num_obj.svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)

		//density data, add first and last values to array
		const density_data = data.density
		density_data.unshift([data.minvalue, 0])
		density_data.push([data.maxvalue, 0])

		// x-axis
		const xscale = scaleLinear()
			.domain([data.minvalue, data.maxvalue])
			.range([xpad, width - xpad])

		const x_axis = axisBottom().scale(xscale)

		// y-scale
		const yscale = scaleLinear()
			.domain([0, data.densitymax])
			.range([height + ypad, ypad])

		const g = svg.append('g').attr('transform', `translate(${xpad}, 0)`)

		// SVG line generator
		const line = d3line()
			.x(function(d) {
				return xscale(d[0])
			})
			.y(function(d) {
				return yscale(d[1])
			})
			.curve(curveMonotoneX)

		// plot the data as a line
		g.append('path')
			.datum(density_data)
			.attr('class', 'line')
			.attr('d', line)
			.style('fill', '#eee')
			.style('stroke', '#000')

		g.append('g')
			.attr('transform', `translate(0, ${ypad + height})`)
			.call(x_axis)

		g.append('text')
			.attr('transform', `translate( ${width / 2} ,  ${ypad + height + 32})`)
			.attr('font-size', '13px')
			.text(self.tvs.term.unit)

		self.num_obj.brush_g = svg
			.append('g')
			.attr('class', 'brush_g')
			.attr('transform', `translate(${self.num_obj.plot_size.xpad}, ${self.num_obj.plot_size.ypad})`)
	}

	function addBrushes() {
		// const ranges = self.num_obj.ranges
		const brushes = self.num_obj.brushes
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

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
				brush.range.start = Math.floor(maxvalue - (maxvalue - minvalue) / 10)
			}
			if (r.stop === '') {
				brush.range.stop = Math.floor(maxvalue)
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
			.each(applyBrush)
	}

	function addRangeTable() {
		const num_div = self.num_obj.num_div
		const ranges = self.num_obj.ranges
		const brushes = self.num_obj.brushes

		const range_divs = self.num_obj.range_table.selectAll('.range_div').data(brushes) //, d => brushes.indexOf(d))

		range_divs.exit().each(function() {
			select(this)
				.style('opacity', 1)
				.transition()
				.duration(100)
				.style('opacity', 0)
				.remove()
		})

		range_divs.each(function(d) {
			const div = select(this)
			d.start_text.html(d.range.start)
			d.stop_text.html(d.range.stop)
		})

		range_divs
			.enter()
			.append('tr')
			.attr('class', 'range_div')
			.style('white-space', 'nowrap')
			.style('padding', '2px')
			.transition()
			.duration(200)
			.each(enterRange)

		const add_range_btn = num_div.selectAll('.add_range_btn').size()
			? num_div.select('.add_range_btn')
			: num_div
					.append('div')
					.style('width', '100px')
					.attr('class', 'add_range_btn sja_menuoption')
					.style('border-radius', '13px')
					.style('padding', '7px 6px')
					.style('margin', '5px')
					.style('margin-left', '20px')
					.style('text-align', 'center')
					.style('font-size', '.8em')
					.text('Add a Range')
					.on('click', () => addNewBrush())

		add_range_btn.style(
			'display',
			ranges.length && ranges[ranges.length - 1].start === '' && ranges[ranges.length - 1].stop === ''
				? 'none'
				: 'inline-block'
		)
	}

	//Add new blank range temporary, save after entering values
	function addNewBrush() {
		const new_range = { start: '', stop: '', index: self.tvs.ranges.length }
		self.num_obj.ranges.push(new_range)
		const brush = { orig: new_range, range: JSON.parse(JSON.stringify(new_range)) }
		self.num_obj.brushes.push(brush)
		addBrushes()
		addRangeTable()
		brush.init()
	}

	function applyBrush(brush) {
		if (!brush.elem) brush.elem = select(this)
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

	function enterRange(brush, i) {
		if (!brush.range_tr) brush.range_tr = select(this)
		const range_tr = brush.range_tr
		const range = brush.range
		const orig_range = brush.orig
		const minvalue = self.num_obj.density_data.minvalue
		const maxvalue = self.num_obj.density_data.maxvalue
		const svg = self.num_obj.svg
		const xscale = self.num_obj.xscale

		range_tr
			.append('td')
			.append('td')
			.style('display', 'inline-block')
			.style('margin-left', '10px')
			.style('padding', '3px 10px')
			.style('font-size', '.9em')
			.text('Range ' + (i + 1) + ': ')

		brush.equation_td = range_tr.append('td').style('width', '150px')

		brush.start_text = brush.equation_td
			.append('div')
			.attr('class', 'start_text')
			.style('display', 'inline-block')
			.style('font-weight', 'bold')
			.style('text-align', 'center')
			.html(range.start)

		brush.start_input = brush.equation_td
			.append('input')
			.attr('class', 'start_input')
			.attr('type', 'number')
			.style('display', 'none')
			.style('width', '80px')
			.style('margin-left', '15px')
			.attr('value', range.start)
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				brush.start_input.property('disabled', true)
				try {
					if (brush.start_input.node().value < minvalue) throw 'entered value is lower than minimum value'
					update_input()
				} catch (e) {
					window.alert(e)
				}
				brush.start_input.property('disabled', false)
			})

		// select realation for start value
		brush.start_select = brush.equation_td
			.append('select')
			.attr('class', 'start_select')
			.style('display', 'none')
			.style('margin-left', '10px')
			.on('change', () => {
				// make changes based on start select
				const new_range = JSON.parse(JSON.stringify(brush.range))
				const value = brush.start_select.property('value')

				if (value == 'startunbounded') {
					range.startunbounded = true
					new_range.start = minvalue.toFixed(1)
					brush.start_input.property('disabled', true)
				} else {
					delete range.startunbounded
					new_range.start = brush.start_input.node().value || minvalue.toFixed(1)
					new_range.stop = brush.stop_input.node().value || maxvalue.toFixed(1)
					brush.start_input.property('disabled', false)
					range.startinclusive = value == 'startinclusive'
				}
				if (brush.stop_input.node().value != maxvalue.toFixed(1)) {
					new_range.stop = brush.stop_input.node().value
					delete range.stopunbounded
				}
				brush.elem.call(brush.d3brush).call(brush.d3brush.move, [new_range.start, new_range.stop].map(xscale))
			})

		brush.start_select
			.selectAll('option')
			.data([
				{
					label: '&le;',
					value: 'startinclusive'
				},
				{
					label: '&lt;',
					value: 'startexclusive'
				},
				{
					label: '&#8734;',
					value: 'startunbounded'
				}
			])
			.enter()
			.append('option')
			.attr('value', d => d.value)
			.property('selected', d => range[d.value] || (d.value == 'startexclusive' && !range.startinclusive))
			.html(d => d.label)

		// 'x' and relation symbols
		brush.start_relation_text = brush.equation_td
			.append('div')
			.attr('class', 'start_relation_text')
			.style('display', 'inline-block')
			.style('margin-left', '5px')
			.style('text-align', 'center')
			.html(range.startunbounded ? ' ' : range.startinclusive ? '&leq;&nbsp;' : '&lt;&nbsp;')

		const x = '<span style="font-family:Times;font-style:italic;">x</span>'
		brush.equation_td
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', '5px')
			.style('text-align', 'center')
			.html(x)

		brush.stop_relation_text = brush.equation_td
			.append('div')
			.attr('class', 'stop_relation_text')
			.style('display', 'inline-block')
			.style('margin-left', '5px')
			.style('text-align', 'center')
			.html(range.stopunbounded ? ' ' : range.stopinclusive ? '&leq;&nbsp;' : '&lt;&nbsp;')

		// select realation for stop value
		brush.stop_select = brush.equation_td
			.append('select')
			.attr('class', 'stop_select')
			.style('display', 'none')
			.style('margin-left', '10px')
			.on('change', () => {
				// make changes based on stop select
				const new_range = JSON.parse(JSON.stringify(brush.range))
				const value = brush.stop_select.property('value')
				if (value == 'stopunbounded') {
					range.stopunbounded = true
					new_range.stop = maxvalue.toFixed(1)
					brush.stop_input.property('disabled', true)
				} else {
					delete range.stopunbounded
					new_range.start = brush.start_input.node().value || minvalue.toFixed(1)
					new_range.stop = brush.stop_input.node().value || maxvalue.toFixed(1)
					brush.stop_input.property('disabled', false)
					range.stopinclusive = value == 'stopinclusive'
				}
				if (brush.start_input.node().value != minvalue.toFixed(1)) {
					new_range.start = brush.start_input.node().value
					delete range.startunbounded
				}
				brush.elem.call(brush.d3brush).call(brush.d3brush.move, [new_range.start, new_range.stop].map(xscale))
			})

		brush.stop_select
			.selectAll('option')
			.data([
				{
					label: '&le;',
					value: 'stopinclusive'
				},
				{
					label: '&lt;',
					value: 'stopexclusive'
				},
				{
					label: '&#8734;',
					value: 'stopunbounded'
				}
			])
			.enter()
			.append('option')
			.attr('value', d => d.value)
			.property('selected', d => range[d.value] || (d.value == 'stopexclusive' && !range.stopinclusive))
			.html(d => d.label)

		brush.stop_text = brush.equation_td
			.append('div')
			.attr('class', 'stop_text')
			.style('display', 'inline-block')
			.style('margin-left', '10px')
			.style('font-weight', 'bold')
			.style('text-align', 'center')
			.html(range.stop)

		brush.stop_input = brush.equation_td
			.append('input')
			.attr('class', 'stop_input')
			.attr('type', 'number')
			.style('display', 'none')
			.style('width', '80px')
			.style('margin-left', '15px')
			.attr('value', range.stop)
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				brush.stop_input.property('disabled', true)
				try {
					if (+brush.stop_input.node().value > maxvalue) throw 'entered value is higher than maximum value'
					update_input()
				} catch (e) {
					window.alert(e)
				}
				brush.stop_input.property('disabled', false)
			})

		makeRangeButtons(brush)

		// note for empty range
		if (orig_range.start === '' && orig_range.stop === '') {
			self.num_obj.range_table
				.append('tr')
				.attr('class', 'note_tr')
				.append('td')
				.attr('colspan', '3')
				.append('div')
				.style('font-size', '.8em')
				.style('margin-left', '20px')
				.style('font-style', 'italic')
				.style('color', '#888')
				.html('Note: Drag the <b>green rectangle</b> at the end of the plot to select new range')
		}

		function update_input() {
			const new_range = JSON.parse(JSON.stringify(brush.range))
			new_range.start = brush.start_input.node().value ? Number(brush.start_input.node().value) : minvalue
			new_range.stop = brush.stop_input.node().value ? Number(brush.stop_input.node().value) : maxvalue
			if (new_range.start != minvalue.toFixed(1)) delete new_range.startunbounded
			if (new_range.stop != maxvalue.toFixed(1)) delete new_range.stopunbounded
			// brush.range = new_range
			brush.elem.call(brush.d3brush).call(brush.d3brush.move, [new_range.start, new_range.stop].map(xscale))
		}
	}

	function makeRangeButtons(brush) {
		const buttons_td = brush.range_tr.append('td')
		const range = brush.range
		const orig_range = brush.orig
		const similarRanges = JSON.stringify(range) == JSON.stringify(brush.orig)

		//'edit' button
		brush.edit_btn = buttons_td
			.append('td')
			.attr('class', 'sja_menuoption edit_btn')
			.style('display', similarRanges || (range.start === '' && range.stop === '') ? 'inline-block' : 'none')
			.style('border-radius', '13px')
			.style('margin', '5px')
			.style('margin-left', '10px')
			// .style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('edit')
			.on('click', async () => {
				brush.start_text.style('display', 'none')
				brush.stop_text.style('display', 'none')
				brush.start_relation_text.style('display', 'none')
				brush.stop_relation_text.style('display', 'none')
				brush.start_input.style('display', 'inline-block')
				brush.stop_input.style('display', 'inline-block')
				brush.start_select.style('display', 'inline-block')
				brush.stop_select.style('display', 'inline-block')
				brush.edit_btn.style('display', 'none')
			})

		//'Apply' button
		brush.apply_btn = buttons_td
			.append('td')
			.attr('class', 'sja_filter_tag_btn apply_btn')
			.style('display', similarRanges || (range.start === '' && range.stop === '') ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('margin', '5px')
			.style('margin-left', '10px')
			// .style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('apply')
			.on('click', async () => {
				self.dom.tip.hide()
				await apply()
			})

		//'Reset' button
		brush.reset_btn = buttons_td
			.append('td')
			.attr('class', 'sja_filter_tag_btn reset_btn')
			.style('display', similarRanges || (range.start === '' && range.stop === '') ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('margin', '5px')
			.style('margin-left', '10px')
			// .style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('reset')
			.on('click', async () => {
				self.dom.tip.hide()
				brush.range = JSON.parse(JSON.stringify(brush.orig))
				brush.init()
			})

		//'Delete' button
		buttons_td
			.append('td')
			.attr('class', 'sja_filter_tag_btn delete_btn')
			.style(
				'display',
				self.tvs.ranges.length == 1 && orig_range.start != '' && orig_range.stop != '' ? 'none' : 'inline-block'
			)
			.style('border-radius', '13px')
			.style('margin', '5px')
			.style('margin-left', '10px')
			// .style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Delete')
			.on('click', async () => {
				const new_tvs = JSON.parse(JSON.stringify(self.tvs))
				new_tvs.ranges.splice(range.index, 1)
				// const deleted_range = self.num_obj.ranges[self.num_obj.ranges.length - 1]
				// callback only if range have non-empty start and end
				if (orig_range.start != '' && orig_range.stop != '') self.opts.callback(new_tvs)
				else {
					self.num_obj.ranges.pop()
					self.num_obj.brushes.pop()
					self.num_obj.num_div.select('.note_tr').remove()
					addBrushes()
					addRangeTable()
				}
			})

		async function apply() {
			try {
				const start = Number(brush.start_input.node().value)
				const stop = Number(brush.stop_input.node().value)
				if (start != null && stop != null && stop != '' && start >= stop) throw 'start must be lower than stop'

				if (brush.start_input.node().value === '') {
					range.startunbounded = true
					delete range.start
				} else {
					delete range.startunbounded
					range.start = start
					range.startinclusive = brush.start_select.property('value') === 'startinclusive'
				}
				if (brush.stop_input.node().value === '') {
					range.stopunbounded = true
					delete range.stop
				} else {
					delete range.stopunbounded
					range.stop = stop
					range.stopinclusive = brush.stop_select.property('value') === 'stopinclusive'
				}
				const new_tvs = JSON.parse(JSON.stringify(self.tvs))
				delete new_tvs.groupset_label
				// merge overlapping ranges
				if (self.num_obj.ranges.length > 1) new_tvs.ranges = mergeOverlapRanges(range)
				else new_tvs.ranges[range.index] = range
				// validte new_tvs
				self.opts.callback(new_tvs)
			} catch (e) {
				window.alert(e)
			}
		}
	}

	function mergeOverlapRanges(new_range) {
		let ranges = JSON.parse(JSON.stringify(self.tvs.ranges))
		let merged_flag = false
		for (const [i, range] of ranges.entries()) {
			// skip unannotated categories and same range edits
			if (!range.value && new_range.index != i) {
				if (new_range.start <= range.start && new_range.stop >= range.stop) {
					// if new range is covering any existing range
					range.start = new_range.start
					range.stop = new_range.stop
					merged_flag = true
				} else if (new_range.start <= range.stop && new_range.stop >= range.stop) {
					// if overlapping only at start of new range
					range.stop = new_range.stop
					merged_flag = true
				} else if (new_range.stop >= range.start && new_range.start <= range.start) {
					// if overlapping only at end of new range
					range.start = new_range.start
					merged_flag = true
				} else if (new_range.start >= range.start && new_range.stop <= range.stop) {
					//new_range is covered by existing range
					merged_flag = true
				} else if (new_range.startunbounded) {
					if (new_range.stop > range.stop) {
						// if new_range is startunbounded and covering existing range
						range.stop = new_range.stop
					}
					delete range.start
					range.startunbounded = true
					merged_flag = true
				} else if (new_range.stopunbounded) {
					if (new_range.start < range.start) {
						// if new_range is stopunbounded and covering existing range
						range.start = new_range.start
					}
					delete range.stop
					range.stopunbounded = true
					merged_flag = true
				}
			}
		}

		if (merged_flag) {
			// if overlapped and existing range merged then remove existing merged range
			if (new_range.index <= ranges.length - 1) ranges.splice(new_range.index, 1)
		} else {
			//if not overlapped then add to ranges[]
			ranges = JSON.parse(JSON.stringify(self.tvs.ranges))
			if (new_range.index) ranges[new_range.index] = new_range
			else ranges.push(new_range)
		}
		return ranges
	}

	async function showCheckList_numeric(tvs, div) {
		if (!tvs.term.values) {
			// no special categories available for this term
			return
		}
		// numerical checkbox for unannotated cats
		const values = await self.opts.vocabApi.getNumericUncomputableCategories(tvs.term, self.filter)
		const unannotated_cats = []
		const lst = values.lst ? values.lst : values
		for (const cat of lst) {
			const key = 'key' in cat ? cat.key : cat.value
			if (!('key' in cat)) cat.key = key
			if (!('value' in cat)) cat.value = key
			if (key in tvs.term.values) {
				cat.label = tvs.term.values[key].label
				unannotated_cats.push(cat)
			}
		}

		const sortedVals = unannotated_cats.sort((a, b) => {
			return b.samplecount - a.samplecount
		})

		// other categories div	(only appear if unannotated categories present)
		const unanno_div = div
			.append('div')
			.attr('class', 'unannotated_div')
			.style('margin-top', '10px')
			.style('font-size', '.9em')
			.style('color', '#888')
			.html('Other Categories')
			.append('div')
			.style('padding', '5px')
			.style('color', '#000')
			.style('border-style', 'solid')
			.style('border-width', '2px')
			.style('border-color', '#eee')

		const values_table = self.makeValueTable(unanno_div, tvs, sortedVals).node()

		// 'Apply' button
		const apply_btn = unanno_div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'none')
			.style('border-radius', '13px')
			// .style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				try {
					const new_tvs = JSON.parse(JSON.stringify(tvs))
					delete new_tvs.groupset_label
					const checked_vals = [...values_table.querySelectorAll('.value_checkbox')]
						.filter(elem => elem.checked)
						.map(elem => elem.value)
					const current_vals = new_tvs.ranges.map(a => 'value' in a && a.value)
					for (const v of sortedVals) {
						const i = checked_vals.indexOf(v.value)
						const j = current_vals.indexOf(v.value)
						if (i === -1 && j !== -1) new_tvs.ranges.splice(j, 1)
						else if (i !== -1 && j === -1) new_tvs.ranges.push({ value: v.value, label: v.label })
					}

					self.dom.tip.hide()
					if (new_tvs.ranges.length == 0) throw 'select at least one range or category'
					//callback only if tvs is changed
					if (JSON.parse(JSON.stringify(tvs) != new_tvs)) self.opts.callback(new_tvs)
				} catch (e) {
					window.alert(e)
				}
			})

		const checkboxes = values_table.querySelectorAll('.value_checkbox')
		// checked values when tip lauch
		const orig_vals = [...checkboxes].filter(elem => elem.checked).map(elem => elem.value)

		for (const [i, checkbox] of checkboxes.entries()) {
			select(checkbox).on('change', () => {
				//changed values after tip launch
				const changed_vals = [...values_table.querySelectorAll('.value_checkbox')]
					.filter(elem => elem.checked)
					.map(elem => elem.value)
				const similarVals = JSON.stringify(orig_vals) === JSON.stringify(changed_vals)
				//show apply button if values changed
				apply_btn.style('display', similarVals ? 'none' : 'inline-block')
			})
		}
	}
}

/*****************************************
 Functions that do not require access 
 to the TVS instance are declared below.

 This will help minimize the unnecessary 
 recreation of functions that are not 
 specific to a TVS instance.
******************************************/

function term_name_gen(d) {
	const name = d.term.name
	return name.length < 26 ? name : '<label title="' + name + '">' + name.substring(0, 24) + '...' + '</label>'
}

function get_pill_label(tvs) {
	if (tvs.ranges.length == 1) {
		const v = tvs.ranges[0]
		if ('value' in v) {
			// category
			if (v.label) return { txt: v.label }
			if (tvs.term.values && tvs.term.values[v.value] && tvs.term.values[v.value].label)
				return { txt: tvs.term.values[v.value].label }
			console.error(`key "${v.value}" not found in values{} of ${tvs.term.name}`)
			return { txt: v.value }
		}
		// numeric range
		return { txt: format_val_text(v) }
	}
	// multiple
	return { txt: tvs.ranges.length + ' intervals' }
}

function format_val_text(range) {
	let range_txt
	const x = '<span style="font-family:Times;font-style:italic;font-size:1em; vertical-align:top">x</span>'
	if (range.startunbounded && range.stopunbounded) {
		const inf = (sign = '') =>
			`<span style='vertical-align: middle; font-size:1.1em; line-height: 0.9em'>${sign}∞</span>`
		const lt = `<span style='vertical-align: top; font-size: 0.9em'>&lt;</span>`
		range_txt = `<span>${inf('﹣')} ${lt} ${x} ${lt} ${inf('﹢')}</span>`
	} else if (range.startunbounded) {
		range_txt = x + ' ' + (range.stopinclusive ? '&le;' : '&lt;') + ' ' + range.stop
	} else if (range.stopunbounded) {
		range_txt = x + ' ' + (range.startinclusive ? '&ge;' : '&gt;') + ' ' + range.start
	} else {
		range_txt =
			range.start +
			' ' +
			(range.startinclusive ? '&le;' : '&lt;') +
			' ' +
			x +
			' ' +
			(range.stopinclusive ? '&le;' : '&lt;') +
			' ' +
			range.stop
	}
	return range_txt
}

function getSelectRemovePos(j, tvs) {
	return j - tvs.ranges.slice(0, j).filter(a => a.start || a.stop).length
}
