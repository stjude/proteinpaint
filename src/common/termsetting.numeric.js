import * as rx from '../common/rx.core'
import * as client from '../client'
import { appInit } from '../termdb/app'
import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, brushX, drag as d3drag, transform } from 'd3'

/*
Arguments
self: a termsetting instance
*/

exports.setNumericMethods = function setNumericMethods(self) {
	self.term_name_gen = function(d) {
		return d.name.length <= 25 ? d.name : '<label title="' + d.name + '">' + d.name.substring(0, 24) + '...' + '</label>'
	}

	self.get_status_msg = () => ''

	self.showMenu = () => {
		self.dom.tip.clear().showunder(self.dom.holder.node())
		self.showNumOpts(self.dom.tip.d)
	}

	self.showNumOpts = async function(div) {
		self.num_obj = {}

		if (self.q && Object.keys(self.q).length !== 0) {
			//if bincoinfig initiated by user/by default
			self.num_obj.custom_bins_q = JSON.parse(JSON.stringify(self.q))
		} else if (self.term.bins) {
			//if binconfig not defined yet or deleted by user, set it as numeric_bin.bins
			const bins = self.opts.use_bins_less && self.term.bins.less ? self.term.bins.less : self.term.bins.default
			self.num_obj.custom_bins_q = JSON.parse(JSON.stringify(bins))
		}
		if (!self.num_obj.custom_bins_q.type) self.num_obj.custom_bins_q.type = 'regular'

		// (termporary) set default_bins_q as self.bins.default
		self.num_obj.default_bins_q =
			self.opts.use_bins_less && self.term.bins.less ? self.term.bins.less : self.term.bins.default

		if (!self.num_obj.default_bins_q.type) self.num_obj.default_bins_q.type = 'regular'

		self.num_obj.plot_size = {
			width: 500,
			height: 100,
			xpad: 10,
			ypad: 20
		}
		try {
			let density_q =
				'/termdb?density=1' +
				'&genome=' +
				self.opts.genome +
				'&dslabel=' +
				self.opts.dslabel +
				'&termid=' +
				self.term.id +
				'&width=' +
				self.num_obj.plot_size.width +
				'&height=' +
				self.num_obj.plot_size.height +
				'&xpad=' +
				self.num_obj.plot_size.xpad +
				'&ypad=' +
				self.num_obj.plot_size.ypad

			if (typeof self.filter != 'undefined') {
				density_q = density_q + '&filter=' + encodeURIComponent(JSON.stringify(self.filter))
			}
			self.num_obj.density_data = await client.dofetch2(density_q)
			if (self.num_obj.density_data.error) throw self.num_obj.density_data.error
			else if (self.num_obj.density_data.maxvalue == self.num_obj.density_data.minvalue) {
				self.num_obj.no_density_data = true
				self.num_obj.ranges = []
				if (self.num_obj.custom_bins_q.first_bin) {
					self.num_obj.ranges.push(self.num_obj.custom_bins_q.first_bin)
					self.num_obj.ranges[0].bin = 'first'
				}
				if (self.num_obj.custom_bins_q.last_bin) {
					self.num_obj.ranges.push(self.num_obj.custom_bins_q.last_bin)
					self.num_obj.ranges[1].bin = 'last'
				}
				self.num_obj.brushes = []
				const brushes = self.num_obj.brushes

				for (const [i, r] of self.num_obj.ranges.entries()) {
					const _b = brushes.find(b => b.orig === r)
					let brush
					if (!_b) {
						brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
						brushes.push(brush)
					} else {
						brush = _b
					}

					const custom_bins_q = self.num_obj.custom_bins_q
					const maxvalue = self.num_obj.density_data.maxvalue
					const minvalue = self.num_obj.density_data.minvalue

					const custom_bins = custom_bins_q.lst || []

					if (custom_bins.length == 0) {
						const mean_value = (maxvalue + minvalue) / 2
						const first_bin = {
							startunbounded: true,
							stop: Math.round(mean_value),
							stopinclusive: true,
							name: 'First bin'
						}
						const last_bin = {
							start: Math.round(mean_value),
							stopunbounded: true,
							startinclusive: false,
							name: 'Last bin'
						}
						custom_bins.push(first_bin)
						custom_bins.push(last_bin)
						self.num_obj.custom_bins_q.lst = custom_bins
					}
				}
			} else {
				// svg for range plot
				self.num_obj.svg = div.append('svg')

				self.makeDensityPlot()

				const maxvalue = self.num_obj.density_data.maxvalue
				const minvalue = self.num_obj.density_data.minvalue

				self.num_obj.xscale = scaleLinear()
					.domain([minvalue, maxvalue])
					.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

				self.num_obj.ranges = []
				if (self.num_obj.custom_bins_q.first_bin) {
					self.num_obj.ranges.push(self.num_obj.custom_bins_q.first_bin)
					self.num_obj.ranges[0].bin = 'first'
				}
				if (self.num_obj.custom_bins_q.last_bin) {
					self.num_obj.ranges.push(self.num_obj.custom_bins_q.last_bin)
					self.num_obj.ranges[1].bin = 'last'
				}
				self.num_obj.brushes = []
				self.addBrushes()
				self.addBinSizeLines()
				self.addCustomBinLines()
			}
		} catch (err) {
			console.log(err)
		}

		//div for 'fix_bins' and 'custom_bins'
		const rand_id = Math.floor(Math.random() * 1000 + 1)
		const bins_div = div.append('div').style('padding', '5px')

		const fixed_radio_div = bins_div.append('div').style('padding', '10px')
		const fixed_bins_div = bins_div.append('div')
		const custom_radio_div = bins_div.append('div').style('padding', '10px')
		const custom_bins_div = bins_div.append('div').style('display', 'none')
		// reset row with 'reset to default' button if any changes detected
		self.num_obj.edit_btns_div = bins_div.append('div')
		self.makeRangeButtons()

		const fixed_radio_btn = fixed_radio_div
			.append('input')
			.attr('type', 'radio')
			.attr('id', 'fixed_num_bins' + rand_id)
			.attr('name', 'bins_type')
			.attr('value', 'fix')
			.property('checked', 'true')
			.on('change', () => {
				radio_change_update()
			})

		fixed_radio_div
			.append('label')
			.attr('for', 'fixed_num_bins' + rand_id)
			.style('padding-left', '10px')
			.html('Use regular-sized bins')

		custom_radio_div
			.append('input')
			.attr('type', 'radio')
			.attr('id', 'custom_num_bins' + rand_id)
			.attr('name', 'bins_type')
			.attr('value', 'custom')
			.on('change', () => {
				radio_change_update()
			})

		custom_radio_div
			.append('label')
			.attr('for', 'custom_num_bins' + rand_id)
			.style('padding-left', '10px')
			.html('Use custom bin set')

		// fixed bins table with inputs
		self.num_obj.fixed_bins_table = fixed_bins_div
			.append('table')
			.style('border-spacing', '7px')
			.style('margin', '5px')
			.style('margin-left', '20px')
			.style('padding-left', '5px')
			.style('border-collapse', 'separate')
			.style('border-left', '1px solid #eee')

		self.addFixedBinsTable()
		if (!self.num_obj.no_density_data)
			self.num_obj.brushes.forEach(brush => {
				if (brush.range.stop > self.num_obj.density_data.minvalue) brush.init()
			})

		// custom bins table with inputs
		self.num_obj.custom_bins_table = custom_bins_div
			.append('table')
			.style('border-spacing', '7px')
			.style('margin', '5px')
			.style('margin-left', '20px')
			.style('padding-left', '5px')
			.style('border-collapse', 'separate')
			.style('border-left', '1px solid #eee')

		self.addCustomBinsTable()

		const radio_change_update = function() {
			if (fixed_radio_btn.node().checked) {
				fixed_bins_div.style('display', 'block')
				custom_bins_div.style('display', 'none')
				if (!self.num_obj.no_density_data) {
					self.num_obj.svg.selectAll('.brush_g').style('display', 'block')
					self.num_obj.svg.selectAll('.binsize_g').style('display', 'block')
					self.num_obj.svg.selectAll('.custombins_g').style('display', 'none')
				}
			} else {
				fixed_bins_div.style('display', 'none')
				custom_bins_div.style('display', 'block')
				if (!self.num_obj.no_density_data) {
					self.num_obj.svg.selectAll('.brush_g').style('display', 'none')
					self.num_obj.svg.selectAll('.binsize_g').style('display', 'none')
					self.num_obj.svg.selectAll('.custombins_g').style('display', 'block')
				}
			}
		}
	}

	self.makeDensityPlot = function() {
		const svg = self.num_obj.svg
		const data = self.num_obj.density_data

		const width = 500,
			height = 100,
			xpad = 10,
			ypad = 20,
			xaxis_height = 20

		svg.attr('width', width + xpad * 2).attr('height', height + ypad * 2 + xaxis_height)

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
			.text(self.term.unit)

		self.num_obj.brush_g = svg
			.append('g')
			.attr('class', 'brush_g')
			.attr('transform', `translate(${xpad}, ${ypad})`)

		self.num_obj.binsize_g = svg
			.append('g')
			.attr('class', 'binsize_g')
			.attr('transform', `translate(${xpad}, ${ypad})`)

		self.num_obj.custombins_g = svg
			.append('g')
			.attr('class', 'custombins_g')
			.attr('transform', `translate(${xpad}, ${ypad})`)
			.style('display', 'none')
	}

	/******************* Functions for Numerical Fixed size bins *******************/

	self.addBrushes = function() {
		const brushes = self.num_obj.brushes

		for (const [i, r] of self.num_obj.ranges.entries()) {
			const _b = brushes.find(b => b.orig === r)
			let brush
			if (!_b) {
				brush = { orig: r, range: JSON.parse(JSON.stringify(r)) }
				brushes.push(brush)
			} else {
				brush = _b
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
			.each(self.applyBrush)
	}

	self.applyBrush = function(brush) {
		if (!brush.elem) brush.elem = select(this)
		const range = brush.range
		const plot_size = self.num_obj.plot_size
		const xpad = plot_size.xpad
		const ypad = plot_size.ypad
		const xscale = self.num_obj.xscale
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue
		let brush_drag_start, cursor_style

		brush.d3brush = brushX()
			.extent([[plot_size.xpad, 0], [plot_size.width - plot_size.xpad, plot_size.height]])
			.on('start', function() {
				cursor_style = event.sourceEvent && event.sourceEvent.target && select(event.sourceEvent.target).attr('cursor')
				if (self.num_obj.custom_bins_q.type == 'regular') {
					brush.elem.selectAll('.selection').attr('pointer-events', 'none')
					if (cursor_style == 'default') return
				}

				// brush_drag_start = event.selection[1]
				brush.elem
					.selectAll('.selection')
					.attr('cursor', 'default')
					.attr('pointer-events', '')
				if (brush.orig.bin == 'first') brush.elem.selectAll('.handle--w').attr('pointer-events', 'none')
				else if (brush.orig.bin == 'last') brush.elem.selectAll('.handle--e').attr('pointer-events', 'none')
			})
			.on('brush', function() {
				if (self.num_obj.custom_bins_q.type == 'regular') {
					brush.elem.selectAll('.selection').attr('pointer-events', 'none')
					if (cursor_style == 'default') return
				} else {
					brush.elem.selectAll('.selection').attr('pointer-events', '')
				}

				const s = event.selection
				//update temp_ranges
				range.start = Number(xscale.invert(s[0]).toFixed(1))
				range.stop = Number(xscale.invert(s[1]).toFixed(1))
				const a_range = JSON.parse(JSON.stringify(brush.orig))
				if (range.startunbounded) a_range.start = Number(minvalue.toFixed(1))
				if (range.stopunbounded) a_range.stop = Number(maxvalue.toFixed(1))
				const similarRanges = JSON.stringify(range) == JSON.stringify(a_range)

				// update inputs from brush move
				// select(brush.start_input._groups[0][0]).style('color', a_range.start == range.start ? '#000' : '#23cba7')
				// brush.start_input._groups[0][0].value = range.start == minvalue.toFixed(1) ? '' : range.start

				if (brush.orig.bin == 'first') {
					select(brush.input._groups[0][0]).style('color', a_range.stop == range.stop ? '#000' : '#23cba7')
					brush.input._groups[0][0].value = range.stop
				} else if (brush.orig.bin == 'last') {
					select(brush.input._groups[0][0]).style('color', a_range.start == range.start ? '#000' : '#23cba7')
					brush.input._groups[0][0].value = range.start
				}

				// brush.start_select
				// 	.style('display', similarRanges ? 'none' : 'inline-block')
				// 	.property('selectedIndex', range.start == minvalue.toFixed(1) ? 2 : range.startinclusive ? 0 : 1)
				// brush.stop_select
				// 	.style('display', similarRanges ? 'none' : 'inline-block')
				// 	.property('selectedIndex', range.stop == maxvalue.toFixed(1) ? 2 : range.stopinclusive ? 0 : 1)

				// //update 'apply' and 'reset' buttons based on brush change
				self.num_obj.reset_btn.style('display', similarRanges && !self.bins_customized() ? 'none' : 'inline-block')

				// // hide start and stop text and relation symbols if brush moved
				// brush.start_text.style('display', !similarRanges ? 'none' : 'inline-block')
				// brush.stop_text.style('display', !similarRanges ? 'none' : 'inline-block')
				// brush.start_relation_text.style('display', !similarRanges ? 'none' : 'inline-block')
				// brush.stop_relation_text.style('display', !similarRanges ? 'none' : 'inline-block')

				// make brush green if changed
				brush.elem.selectAll('.selection').style('fill', !similarRanges ? '#23cba7' : '#777777')
				//move lines_g with brush move
				// self.num_obj.binsize_g.attr('transform', `translate(${s[1] + xpad - brush_drag_start + brush_drag_stop}, ${ypad})`)
				self.num_obj.binsize_g.attr('transform', `translate(${s[1] - xscale(a_range.stop) + xpad}, ${ypad})`)
			})
			.on('end', function() {
				//diable pointer-event for multiple brushes
				brush.elem.selectAll('.overlay').style('pointer-events', 'none')
			})

		const brush_start = range.startunbounded ? minvalue : range.start
		const brush_stop = range.stopunbounded ? maxvalue : range.stop
		brush.init = () => brush.elem.call(brush.d3brush).call(brush.d3brush.move, [brush_start, brush_stop].map(xscale))

		if (range.startunbounded) delete range.start
		if (range.stopunbounded) delete range.stop
		brush.elem
			.selectAll('.selection')
			.style(
				'fill',
				(brush.orig.start == '' && brush.orig.stop == '') || JSON.stringify(range) != JSON.stringify(brush.orig)
					? '#23cba7'
					: '#777777'
			)
	}

	self.addBinSizeLines = function() {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		const bin_size = self.bins_customized() ? custom_bins_q.bin_size : default_bins_q.bin_size
		const plot_size = self.num_obj.plot_size
		const xscale = self.num_obj.xscale
		const end_bins = self.num_obj.ranges
		const first_bin = self.num_obj.brushes[0].range
		const first_bin_orig = JSON.parse(JSON.stringify(self.num_obj.brushes[0].orig))
		const last_bin = self.num_obj.brushes[1] ? self.num_obj.brushes[1].range : undefined
		const line_x = []
		const binLinesStop = last_bin ? last_bin.start : maxvalue

		for (let i = first_bin.stop; i <= binLinesStop; i = i + bin_size) {
			line_x.push(i)
		}

		self.num_obj.binsize_g.selectAll('line').remove()

		self.num_obj.binsize_g
			.selectAll('line')
			.data(line_x)
			.enter()
			.append('line')
			.style('stroke', '#cc0000')
			.style('stroke-width', 1)
			.attr('x1', d => xscale(d))
			.attr('y1', 0)
			.attr('x2', d => xscale(d))
			.attr('y2', plot_size.height)
	}

	self.addFixedBinsTable = function() {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const fixed_bins_table = self.num_obj.fixed_bins_table

		//Bin Size edit row
		fixed_bins_table.bin_size_tr = fixed_bins_table.append('tr')

		//Bin bountry edit row
		fixed_bins_table.bin_bountry_tr = fixed_bins_table.append('tr')

		//First Bin edit row
		fixed_bins_table.first_bin_tr = fixed_bins_table.append('tr')

		//Last Bin edit row
		fixed_bins_table.last_bin_tr = fixed_bins_table.append('tr')

		self.bins_size_edit()
		self.bins_boundries_edit()
		self.first_bin_edit()
		self.last_bin_edit()
	}

	// function to edit bin_size options
	self.bins_size_edit = function() {
		self.num_obj.fixed_bins_table.bin_size_tr.selectAll('*').remove()

		self.num_obj.fixed_bins_table.bin_size_tr
			.append('td')
			.style('margin', '5px')
			.html('Bin Size')

		const bin_size_td = self.num_obj.fixed_bins_table.bin_size_tr.append('td')
		const note_td = self.num_obj.fixed_bins_table.bin_size_tr.append('td')
		const custom_bins_q = self.num_obj.custom_bins_q
		const edit_btns_div = self.num_obj.edit_btns_div

		const bin_size_input = bin_size_td
			.append('input')
			.attr('type', 'number')
			.attr('value', custom_bins_q.bin_size)
			.style('color', '#cc0000')
			.style('margin-left', '15px')
			.style('width', '100px')
			.on('keyup', () => {
				if (!client.keyupEnter()) return
				bin_size_input.property('disabled', true)
				apply()
				bin_size_input
					.property('disabled', false)
					.node()
					.focus()
			})

		note_td
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '1px')
			.style('color', '#858585')
			.style('display', self.num_obj.no_density_data ? 'none' : 'block')
			.text('Red lines indicate bins automatically generated based on this value.')

		function apply() {
			const first_bin_range = self.num_obj.brushes[0].range
			const first_bin_orig = self.num_obj.brushes[0].orig
			const minvalue = self.num_obj.density_data.minvalue
			const similarRanges = JSON.stringify(first_bin_range) == JSON.stringify(first_bin_orig)
			if (first_bin_range.start == minvalue.toFixed(1)) delete first_bin_range.start
			if (bin_size_input.node().value) custom_bins_q.bin_size = parseFloat(bin_size_input.node().value)
			edit_btns_div.style('display', !similarRanges || self.bins_customized() ? 'table-row' : 'none')
			self.num_obj.reset_btn.style('display', similarRanges && !self.bins_customized() ? 'none' : 'inline-block')
			self.addBinSizeLines()
		}
	}

	self.bins_boundries_edit = function() {
		self.num_obj.fixed_bins_table.bin_bountry_tr.selectAll('*').remove()
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const edit_btns_div = self.num_obj.edit_btns_div

		self.num_obj.fixed_bins_table.bin_bountry_tr
			.append('td')
			.style('margin', '5px')
			.html('Boundries')

		const bin_boundry_td = self.num_obj.fixed_bins_table.bin_bountry_tr.append('td')

		// select between start/stop inclusive
		const include_select = bin_boundry_td
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				apply()
			})

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		include_select
			.append('option')
			.attr('value', 'stopinclusive')
			.html('start &lt; ' + x + ' &le; end')
		include_select
			.append('option')
			.attr('value', 'startinclusive')
			.html('start &le; ' + x + ' &lt; end')

		include_select.node().selectedIndex = custom_bins_q.startinclusive ? 1 : 0

		//TODO: fix apply function for boundry edit
		function apply() {
			const first_bin_range = self.num_obj.brushes[0].range
			const first_bin_orig = self.num_obj.brushes[0].orig
			const minvalue = self.num_obj.density_data.minvalue
			if (first_bin_range.start == minvalue.toFixed(1)) delete first_bin_range.start
			const similarRanges = JSON.stringify(first_bin_range) == JSON.stringify(first_bin_orig)
			custom_bins_q.stopinclusive = include_select.node().value == 'stopinclusive'
			if (!custom_bins_q.stopinclusive) custom_bins_q.startinclusive = include_select.node().value == 'startinclusive'
			edit_btns_div.style('display', !similarRanges || self.bins_customized() ? 'table-row' : 'none')

			self.addBinSizeLines()
		}
	}

	self.first_bin_edit = function() {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const xscale = self.num_obj.xscale
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue
		const plot_size = self.num_obj.plot_size
		const xpad = plot_size.xpad
		const ypad = plot_size.ypad
		const bin = custom_bins_q.first_bin
		const brush = self.num_obj.brushes[0]

		self.num_obj.fixed_bins_table.first_bin_tr.selectAll('*').remove()

		self.num_obj.fixed_bins_table.first_bin_tr
			.append('td')
			.style('margin', '5px')
			.html('First Bin Stop')

		const first_bin_td = self.num_obj.fixed_bins_table.first_bin_tr.append('td')
		const note_td = self.num_obj.fixed_bins_table.first_bin_tr.append('td')

		brush.input = first_bin_td
			.append('input')
			.attr('type', 'number')
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				brush.input.property('disabled', true)
				try {
					self.update_first_bin(brush)
				} catch (e) {
					window.alert(e)
				}
				brush.input.property('disabled', false)
			})

		if (isFinite(bin.stop)) {
			brush.input.attr('value', parseFloat(bin.stop))
		}

		note_td
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '1px')
			.style('color', '#858585')
			.style('display', self.num_obj.no_density_data ? 'none' : 'block')
			.html('<b>Left</b>-side gray box indicates the first bin. <br> Drag to change its size.')
	}

	self.update_first_bin = function(brush) {
		const new_range = JSON.parse(JSON.stringify(brush.range))
		const plot_size = self.num_obj.plot_size
		new_range.stop = parseFloat(brush.input.node().value)
		self.num_obj.brushes[0].range = new_range
		brush.elem
			.call(brush.d3brush)
			.call(brush.d3brush.move, [self.num_obj.density_data.minvalue, new_range.stop].map(self.num_obj.xscale))
		self.num_obj.binsize_g.attr('transform', `translate(${plot_size.xpad}, ${plot_size.ypad})`)
		self.addBinSizeLines()
	}

	self.last_bin_edit = function() {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const xscale = self.num_obj.xscale
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue
		const plot_size = self.num_obj.plot_size
		const xpad = plot_size.xpad
		const ypad = plot_size.ypad
		const bin = custom_bins_q.last_bin || { stopunbounded: true, stop: maxvalue, bin: 'last' }
		const brush = self.num_obj.brushes[1] || { orig: bin, range: JSON.parse(JSON.stringify(bin)) }

		self.num_obj.fixed_bins_table.last_bin_tr.selectAll('*').remove()

		self.num_obj.fixed_bins_table.last_bin_tr
			.append('td')
			.style('margin', '5px')
			.html('Last Bin Start')

		const last_bin_td = self.num_obj.fixed_bins_table.last_bin_tr.append('td').style('padding-left', '15px')

		const last_bin_select_div = last_bin_td.append('div')

		const last_bin_edit_div = last_bin_td.append('div').style('display', 'none')

		const note_td = self.num_obj.fixed_bins_table.last_bin_tr.append('td').style('display', 'none')

		note_td
			.append('div')
			.style('font-size', '.6em')
			.style('margin-left', '1px')
			.style('padding-top', '30px')
			.style('color', '#858585')
			.style('display', self.num_obj.no_density_data ? 'none' : 'block')
			.html('<b>Right</b>-side gray box indicates the last bin. <br> Drag to change its size.')

		brush.input = last_bin_edit_div
			.append('input')
			.attr('type', 'number')
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('keyup', async () => {
				if (!client.keyupEnter()) return
				brush.input.property('disabled', true)
				try {
					if (brush.input.node().value < minvalue) throw 'entered value is lower than minimum value'
					self.update_last_bin(brush)
				} catch (e) {
					window.alert(e)
				}
				brush.input.property('disabled', false)
			})

		// if last bin is not defined, it will be auto, can be edited from dropdown
		// const last_bin_select = last_bin_select_div
		// 	.append('select')
		// 	.style('margin-left', '15px')
		// 	.style('margin-bottom', '7px')
		// 	.on('change', () => {
		// 		self.apply_last_bin_change(last_bin_edit_div, last_bin_select)
		// 		if (last_bin_select.node().value == 'auto') {
		// 			self.opts.callback({
		// 				term: self.term,
		// 				q: self.q
		// 			})
		// 		}
		// 	})

		const auto_radio_btn = last_bin_select_div
			.append('input')
			.attr('type', 'radio')
			.attr('id', 'auto_last_bin')
			.attr('name', 'last_bin_opt')
			.attr('value', 'auto')
			.property('checked', 'true')
			.on('change', () => {
				self.apply_last_bin_change(last_bin_edit_div, auto_radio_btn)
				if (auto_radio_btn.node().checked == true) {
					self.opts.callback({
						term: self.term,
						q: self.q
					})
				}
			})

		last_bin_select_div
			.append('label')
			.attr('for', 'auto_last_bin')
			.style('padding-left', '10px')
			.style('padding-right', '10px')
			.html('Auto<br>')

		const custom_radio_btn = last_bin_select_div
			.append('input')
			.attr('type', 'radio')
			.attr('id', 'custom_last_bin')
			.attr('name', 'last_bin_opt')
			.attr('value', 'custom_last')
			.style('margin-top', '10px')
			.on('change', () => {
				self.apply_last_bin_change(last_bin_edit_div, auto_radio_btn)
			})

		last_bin_select_div
			.append('label')
			.attr('for', 'custom_last_bin')
			.style('padding-left', '10px')
			.html('Custom Bin')

		if (
			!custom_bins_q.last_bin ||
			(Object.keys(custom_bins_q.last_bin).length === 0 && custom_bins_q.last_bin.constructor === Object)
		) {
			auto_radio_btn.node().checked = true
		} else if (JSON.stringify(custom_bins_q.last_bin) != JSON.stringify(default_bins_q.last_bin)) {
			custom_radio_btn.node().checked = true
		}

		self.apply_last_bin_change(last_bin_edit_div, auto_radio_btn)

		if (
			!default_bins_q.last_bin ||
			(Object.keys(default_bins_q.last_bin).length === 0 && default_bins_q.last_bin.constructor === Object)
		) {
			last_bin_select_div.style('display', 'block')
		} else {
			last_bin_edit_div.style('display', 'block')
		}
	}

	self.update_last_bin = function(brush) {
		const new_range = JSON.parse(JSON.stringify(brush.range))
		const plot_size = self.num_obj.plot_size
		new_range.start = parseFloat(brush.input.node().value)
		if (!self.num_obj.brushes[1]) {
			self.num_obj.brushes[1] = brush
			self.addBrushes()
		}
		self.num_obj.brushes[1].range = new_range
		brush.elem
			.call(brush.d3brush)
			.call(brush.d3brush.move, [new_range.start, self.num_obj.density_data.maxvalue].map(self.num_obj.xscale))
		self.num_obj.binsize_g.attr('transform', `translate(${plot_size.xpad}, ${plot_size.ypad})`)
		self.addBinSizeLines()
	}

	self.makeRangeButtons = function() {
		// let custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue
		let similarRanges = false
		for (const brush of self.num_obj.brushes) {
			similarRanges = JSON.stringify(brush.range) == JSON.stringify(brush.orig)
		}

		const buttons_div = self.num_obj.edit_btns_div
		//'Apply' button
		self.num_obj.apply_btn = buttons_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn apply_btn')
			// .style('display', similarRanges || !self.bins_customized() ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('margin-left', '10px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('apply')
			.on('click', async () => {
				self.dom.tip.hide()
				await apply()
			})

		//'Reset' button
		self.num_obj.reset_btn = buttons_div
			.append('div')
			.attr('class', 'sja_filter_tag_btn reset_btn')
			.style('display', similarRanges || !self.bins_customized() ? 'none' : 'inline-block')
			.style('border-radius', '13px')
			.style('margin-left', '10px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('reset')
			.on('click', async () => {
				for (const brush of self.num_obj.brushes) {
					brush.range = JSON.parse(JSON.stringify(brush.orig))
					if (brush.range.stop > minvalue) brush.init()
				}
				self.q = JSON.parse(JSON.stringify(self.num_obj.default_bins_q))
				self.num_obj.custom_bins_q = JSON.parse(JSON.stringify(self.num_obj.default_bins_q))
				self.num_obj.brushes[0].range.stop = default_bins_q.first_bin.stop
				if (self.num_obj.brushes[1] && default_bins_q.last_bin)
					self.num_obj.brushes[1].range.start = default_bins_q.last_bin.start
				else delete self.num_obj.brushes[1]
				self.bins_size_edit()
				self.addBinSizeLines()
				self.bins_boundries_edit()
				self.first_bin_edit()
				if (self.num_obj.brushes[0].range.stop > minvalue) self.update_first_bin(self.num_obj.brushes[0])
				self.last_bin_edit()
				if (!self.num_obj.default_bins_q.last_bin && self.num_obj.brushes.length > 1) self.num_obj.brushes.pop()
				if (self.num_obj.brushes[1]) self.update_last_bin(self.num_obj.brushes[1])
				self.num_obj.reset_btn.style('display', 'none')
			})

		async function apply() {
			try {
				const custom_bins_q = JSON.parse(JSON.stringify(self.num_obj.custom_bins_q))
				custom_bins_q.first_bin = JSON.parse(JSON.stringify(self.num_obj.brushes[0].range))
				// if (custom_bins_q.first_bin.start == minvalue.toFixed(1)) delete custom_bins_q.first_bin.start
				if (self.num_obj.brushes.length > 1) {
					custom_bins_q.last_bin =
						self.num_obj.brushes.length > 1 ? JSON.parse(JSON.stringify(self.num_obj.brushes[1].range)) : undefined
				} else {
					delete custom_bins_q.last_bin
				}
				self.q = JSON.parse(JSON.stringify(custom_bins_q))
				self.opts.callback({
					term: self.term,
					q: self.q
				})
			} catch (e) {
				window.alert(e)
			}
		}
	}

	self.apply_last_bin_change = function(last_bin_edit_div, auto_radio_btn) {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const note_td = select(self.num_obj.fixed_bins_table.last_bin_tr.node().querySelectorAll('td')[2])
		if (auto_radio_btn.node().checked == false) {
			//if custom_bin is set, replace default_last_bin with custom_last_bin
			if (!custom_bins_q.last_bin) {
				custom_bins_q.last_bin = {}
			}
			const last_bin = JSON.parse(JSON.stringify(custom_bins_q.last_bin))
			if (last_bin) self.q.last_bin = last_bin
			else delete self.q.last_bin
			last_bin_edit_div.style('display', 'block')
			note_td.style('display', 'block')
		} else if (auto_radio_btn.node().checked == true) {
			//if default_last_bin is empty, delete last_bin
			const last_bin = default_bins_q.last_bin
			if (last_bin) self.q.last_bin = last_bin
			else delete self.q.last_bin
			last_bin_edit_div.style('display', 'none')
			note_td.style('display', 'none')
		}
	}

	self.bins_customized = function() {
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		if (custom_bins_q && default_bins_q) {
			if (
				custom_bins_q.bin_size == default_bins_q.bin_size &&
				custom_bins_q.stopinclusive == default_bins_q.stopinclusive &&
				JSON.stringify(custom_bins_q.first_bin) == JSON.stringify(default_bins_q.first_bin)
			) {
				if (
					default_bins_q.last_bin &&
					JSON.stringify(custom_bins_q.last_bin) == JSON.stringify(default_bins_q.last_bin)
				)
					return false
				else if (!custom_bins_q.last_bin && !default_bins_q.last_bin) return false
				else return true
			} else {
				return true
			}
		}
	}

	/******************* Functions for Numerical Custom bins *******************/

	self.addCustomBinLines = function() {
		const plot_size = self.num_obj.plot_size
		const custom_bins_q = self.num_obj.custom_bins_q
		const default_bins_q = self.num_obj.default_bins_q
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		const custom_bins = custom_bins_q.lst || []
		const xscale = self.num_obj.xscale
		const line_x = []
		// const binLinesStop = last_bin ? last_bin.start : maxvalue

		if (custom_bins.length == 0) {
			const mean_value = (maxvalue + minvalue) / 2
			const first_bin = { startunbounded: true, stop: Math.round(mean_value), stopinclusive: true, name: 'First bin' }
			const last_bin = { start: Math.round(mean_value), stopunbounded: true, startinclusive: false, name: 'Last bin' }
			custom_bins.push(first_bin)
			custom_bins.push(last_bin)
			self.num_obj.custom_bins_q.lst = custom_bins
		}

		for (let i = 0; i < custom_bins.length - 1; i++) {
			line_x.push(custom_bins[i].stop)
		}

		self.num_obj.custombins_g.selectAll('line').remove()

		const drag = d3drag()
			.on('start', dragstarted)
			.on('drag', dragged)
			.on('end', dragended)

		const lines = self.num_obj.custombins_g
			.selectAll('line')
			.data(line_x)
			.enter()
			.append('line')
			.attr('class', 'custom_line')
			.style('stroke', '#cc0000')
			.style('stroke-width', 1)
			.attr('x1', d => xscale(d))
			.attr('y1', 0)
			.attr('x2', d => xscale(d))
			.attr('y2', plot_size.height)
			.call(drag)
			.on('mouseover', (d, i) => {
				select(self.num_obj.custombins_g.node().querySelectorAll('line')[i]).style('stroke-width', 3)
			})
			.on('mouseout', (d, i) => {
				select(self.num_obj.custombins_g.node().querySelectorAll('line')[i]).style('stroke-width', 1)
			})

		function dragstarted() {
			select(this).style('cursor', 'pointer')
		}

		function dragged() {
			const x = event.x

			const line = select(this)
			line
				.attr('x1', x)
				.attr('y1', 0)
				.attr('x2', x)
				.attr('y2', plot_size.height)
		}

		function dragended(d, i) {
			select(this).style('cursor', 'default')
			custom_bins[i].stop = xscale(event.x)
		}
	}

	self.addCustomBinsTable = function() {
		const custom_bins_table = self.num_obj.custom_bins_table
		const custom_bins = self.num_obj.custom_bins_q.lst
		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		//Bin Size edit row
		custom_bins_table.note_tr = custom_bins_table.append('tr')

		custom_bins_table.note_tr
			.append('td')
			.attr('colspan', 3)
			.style('font-size', '.6em')
			.style('margin-left', '1px')
			.style('color', '#858585')
			.html(
				'<b>Work In Progress</b></br>Click on the graph to add bin boundaries; move a boundary line to adjust bin sizes.'
			)

		for (let i = 0; i < custom_bins.length; i++) {
			const bin_tr = custom_bins_table.append('tr')
			const bin_start = custom_bins[i].start ? custom_bins[i].start + ' < ' : ''
			const bin_stop = custom_bins[i].stop ? ' < ' + custom_bins[i].stop : ''

			bin_tr.append('td').text(i + 1 + '.')

			const bin_detail_td = bin_tr.append('td')

			const equation_div = bin_detail_td.append('div').html(bin_start + x + bin_stop)

			const bin_name_div = bin_detail_td.append('div')

			bin_name_div
				.append('div')
				.style('display', 'inline-block')
				.style('font-size', '.9em')
				.style('margin-left', '1px')
				.style('width', '100px')
				.style('color', '#858585')
				.html('Bin Name')

			bin_name_div
				.append('input')
				.attr('size', 12)
				.style('margin', '2px 5px')
				.style('display', 'inline-block')
				.style('font-size', '.8em')
				.style('width', '80px')
				.attr('value', custom_bins[i].name)

			if (i != custom_bins.length - 1) {
				const breakpoint_div = bin_detail_td.append('div')

				breakpoint_div
					.append('div')
					.style('display', 'inline-block')
					.style('font-size', '.9em')
					.style('margin-left', '1px')
					.style('width', '100px')
					.style('color', '#858585')
					.html('Break Point')

				breakpoint_div
					.append('input')
					.attr('size', 12)
					.style('margin', '2px 5px')
					.style('display', 'inline-block')
					.style('font-size', '.8em')
					.style('width', '80px')
					.attr('value', custom_bins[i].stop)
			}

			const delete_btn_td = bin_tr.append('td')

			delete_btn_td
				.append('div')
				.attr('class', 'delete_btn sja_filter_tag_btn')
				.style('display', custom_bins.length > 2 ? 'inline-block' : 'none')
				.style('border-radius', '13px')
				.style('margin', '5px')
				.style('text-align', 'center')
				.style('font-size', '.8em')
				.style('text-transform', 'uppercase')
				.text('Delete')
		}
	}
}
