import * as rx from './rx.core'
import { select, event } from 'd3-selection'
import { scaleLinear, axisBottom, line as d3line, curveMonotoneX, brushX } from 'd3'
import { dofetch2, Menu } from '../client'
import * as dom from '../dom'
import { appInit } from '../termdb/app'
import * as client from '../client'

class TVS {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.genome = opts.genome
		this.dslabel = opts.dslabel
		this.dom = { holder: opts.holder, controlsTip: opts.controlsTip, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 0 }

		setRenderers(this)
		setInteractivity(this)

		this.categoryData = {}

		this.api = {
			main: async (data = {}) => {
				this.tvs = data.tvs
				this.filter = data.filter
				this.updateUI()

				// when there are filters to be removed, must account for the delayed
				// removal after opacity transition, as btn count will decrease only
				// after the transition and remove() is done
				//
				// !!! TODO: how to pass bus.emit('postRender') delay to rx.component.api.update()
				// this.bus.emit('postRender', null, filters.exit().size() ? this.durations.exit + 100 : 0)
			},
			showMenu: this.showMenu
		}
	}
	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.genome) throw '.genome missing'
		if (!o.dslabel) throw '.dslabel missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}

	async getCategories(term, lst = []) {
		const args = [
			'getcategories=1',
			'genome=' + this.genome,
			'dslabel=' + this.dslabel,
			'tid=' + term.id,
			'filter=' + encodeURIComponent(JSON.stringify(this.filter)),
			...lst
		]

		try {
			const data = await dofetch2('/termdb?' + args.join('&'), {})
			if (data.error) throw data.error
			return data
		} catch (e) {
			window.alert(e.message || e)
		}
	}
	async getNumericCategories(termid) {
		// get number of samples for each category of a numeric term
		const args = [
			'getnumericcategories=1',
			'genome=' + this.genome,
			'dslabel=' + this.dslabel,
			'tid=' + termid,
			'filter=' + encodeURIComponent(JSON.stringify(this.filter))
		]
		// may add filter
		const data = await dofetch2('termdb?' + args.join('&'))
		if (data.error) throw data.error
		return data.lst
	}
}

exports.TVSInit = rx.getInitFxn(TVS)

function setRenderers(self) {
	self.updateUI = function() {
		const terms_div = self.dom.holder
		/*
			Currently, only a single pill per tvs is rendered, so using the 
			array [self.tvs] may seem unnecessary. However, using the
			enter/update/exit pattern helps with coding consistency across components,
			and more clearly indicates whether the whole pill is replaced
			or if only its values are updated.
		*/
		const filters = terms_div.selectAll('.tvs_pill').data([self.tvs], d => d.term.id)
		filters.exit().each(self.exitPill)
		filters.each(self.updatePill)
		filters
			.enter()
			.append('div')
			.attr('class', 'tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function() {
		const one_term_div = select(this).style('font-size', '.9em')

		//term name div
		one_term_div
			.append('div')
			.attr('class', 'term_name_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '6px 0 0 6px')
			.style('padding', '6px 6px 3px 6px')
			.html(self.term_name_gen)
			.style('text-transform', 'uppercase')

		// // negate button
		one_term_div
			.append('div')
			.attr('class', 'negate_btn')
			.style('cursor', 'default')
			.style('display', 'inline-block')
			.style('padding', '6px 6px 3px 6px')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(self.tvs.isnot ? 'NOT' : 'IS')

		self.updatePill.call(this)
	}

	// optional _holder, for example when called by filter.js
	self.showMenu = _holder => {
		const holder = _holder ? _holder : self.dom.tip

		const term = self.tvs.term
		const optsFxn = term.iscategorical
			? self.fillCatMenu
			: term.isfloat || term.isinteger
			? self.fillNumMenu
			: term.iscondition
			? self.fillConditionMenu
			: null

		optsFxn(holder, self.tvs)
	}

	self.fillCatMenu = async function(div, tvs) {
		const data = await self.getCategories(tvs.term)
		const sortedVals = data.lst.sort((a, b) => {
			return b.samplecount - a.samplecount
		})

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			.style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.8em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				// update term values by ckeckbox values
				const checked_vals = [...values_table.querySelectorAll('.value_checkbox')]
					.filter(elem => elem.checked)
					.map(elem => elem.value)
				const new_vals = sortedVals.filter(v => checked_vals.includes(v.key))
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				delete new_tvs.groupset_label
				new_tvs.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		const values_table = self.makeValueTable(div, tvs, sortedVals).node()
	}

	self.fillNumMenu = async function(div, tvs) {
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

		self.num_obj.density_data = await client.dofetch2(
			'/termdb?density=1' +
				'&genome=' +
				self.opts.genome +
				'&dslabel=' +
				self.opts.dslabel +
				'&termid=' +
				tvs.term.id +
				'&width=' +
				self.num_obj.plot_size.width +
				'&height=' +
				self.num_obj.plot_size.height +
				'&xpad=' +
				self.num_obj.plot_size.xpad +
				'&ypad=' +
				self.num_obj.plot_size.ypad +
				'&filter=' +
				encodeURIComponent(JSON.stringify(self.filter))
		)
		if (self.num_obj.density_data.error) throw self.num_obj.density_data.error

		self.makeDensityPlot(self.num_obj.density_data)
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		self.num_obj.xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

		self.num_obj.ranges = ranges
		self.num_obj.brushes = []
		self.addBrushes()
		self.addRangeTable()
		self.num_obj.brushes.forEach(brush => brush.init())
		await self.showCheckList_numeric(tvs, div)
	}

	self.makeDensityPlot = function(data) {
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

	self.addBrushes = function() {
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
			.each(self.applyBrush)
	}

	self.addRangeTable = function() {
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
			.each(self.enterRange)

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
					.on('click', () => {
						//Add new blank range temporary, save after entering values
						const new_range = { start: '', stop: '', index: self.tvs.ranges.length }
						self.num_obj.ranges.push(new_range)
						const brush = { orig: new_range, range: JSON.parse(JSON.stringify(new_range)) }
						brushes.push(brush)
						self.addBrushes()
						self.addRangeTable()
						brush.init()
					})

		add_range_btn.style(
			'display',
			ranges.length && ranges[ranges.length - 1].start == '' && ranges[ranges.length - 1].stop == ''
				? 'none'
				: 'inline-block'
		)
	}

	self.applyBrush = function(brush) {
		if (!brush.elem) brush.elem = select(this)
		const range = brush.range
		const plot_size = self.num_obj.plot_size
		const xscale = self.num_obj.xscale
		const maxvalue = self.num_obj.density_data.maxvalue
		const minvalue = self.num_obj.density_data.minvalue

		brush.d3brush = brushX()
			.extent([[plot_size.xpad, 0], [plot_size.width - plot_size.xpad, plot_size.height]])
			.on('brush', function() {
				const s = event.selection
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
					!similarRanges || (a_range.start == '' || a_range.stop == '') ? 'none' : 'inline-block'
				)
				brush.apply_btn.style('display', similarRanges ? 'none' : 'inline-block')
				brush.reset_btn.style(
					'display',
					similarRanges || (a_range.start == '' || a_range.stop == '') ? 'none' : 'inline-block'
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

	self.enterRange = async function(brush, i) {
		if (!brush.range_tr) brush.range_tr = select(this)
		const range_tr = brush.range_tr
		const range = brush.range
		const orig_range = brush.orig
		const minvalue = self.num_obj.density_data.minvalue
		const maxvalue = self.num_obj.density_data.maxvalue
		const svg = self.num_obj.svg

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
					new_range.startunbounded = true
					new_range.start = minvalue.toFixed(1)
					brush.start_input.property('disabled', true)
				} else {
					delete new_range.startunbounded
					new_range.start = brush.start_input.node().value || minvalue.toFixed(1)
					new_range.stop = brush.stop_input.node().value || maxvalue.toFixed(1)
					brush.start_input.property('disabled', false)
					new_range.startinclusive = value == 'startinclusive'
				}
				if (brush.stop_input.node().value != maxvalue.toFixed(1)) {
					new_range.stop = brush.stop_input.node().value
					delete new_range.stopunbounded
				}
				const i = self.num_obj.brushes.findIndex((b = b == brush))
				self.num_obj.brushes[i] = new_range
				self.applyBrush(brush)
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
				if (value == 'unbounded') {
					delete new_range.stop_inclusive
					new_range.stopunbounded = true
					new_range.stop = maxvalue.toFixed(1)
					brush.stop_input.property('disabled', true)
				} else {
					delete new_range.stopunbounded
					new_range.start = brush.start_input.node().value || minvalue.toFixed(1)
					new_range.stop = brush.stop_input.node().value || maxvalue.toFixed(1)
					brush.stop_input.property('disabled', false)

					if (stop_select.node().selectedIndex == 0) new_range.stopinclusive = true
					else if (stop_select.node().selectedIndex == 1) delete new_range.stopinclusive
				}
				if (start_input.node().value != minvalue.toFixed(1)) {
					new_range.start = start_input.node().value
					delete new_range.startunbounded
				}
				const i = self.num_obj.brushes.findIndex((b = b == brush))
				brush.range = new_range
				self.applyBrush(brush)
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
					if (brush.stop_input.node().value > maxvalue) throw 'entered value is higher than maximum value'
					update_input()
				} catch (e) {
					window.alert(e)
				}
				brush.stop_input.property('disabled', false)
			})

		self.makeRangeButtons(brush)

		// note for empty range
		if (orig_range.start == '' && orig_range.stop == '') {
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
			new_range.start = Number(brush.start_input.node().value)
			new_range.stop = Number(brush.stop_input.node().value)
			if (new_range.start != minvalue.toFixed(1)) delete new_range.startunbounded
			if (new_range.stop != maxvalue.toFixed(1)) delete new_range.stopunbounded
			// brush.range = new_range
			const xscale = self.num_obj.xscale
			brush.elem.call(brush.d3brush).call(brush.d3brush.move, [new_range.start, new_range.stop].map(xscale))
		}
	}

	self.makeRangeButtons = function(brush) {
		const buttons_td = brush.range_tr.append('td')
		const range = brush.range
		const orig_range = brush.orig
		const similarRanges = JSON.stringify(range) == JSON.stringify(brush.orig)

		//'edit' button
		brush.edit_btn = buttons_td
			.append('td')
			.attr('class', 'sja_menuoption edit_btn')
			.style('display', similarRanges || (range.start == '' && range.stop == '') ? 'inline-block' : 'none')
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
			.style('display', similarRanges || (range.start == '' && range.stop == '') ? 'none' : 'inline-block')
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
			.style('display', similarRanges || (range.start == '' && range.stop == '') ? 'none' : 'inline-block')
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
				self.tvs.ranges.length == 1 && (orig_range.start != '' && orig_range.stop != '') ? 'none' : 'inline-block'
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
					self.addBrushes()
					self.addRangeTable()
				}
			})

		async function apply() {
			try {
				const start = Number(brush.start_input.node().value)
				const stop = Number(brush.stop_input.node().value)
				if (start != null && stop != null && stop != '' && start >= stop) throw 'start must be lower than stop'

				if (start == '') {
					range.startunbounded = true
					delete range.start
				} else {
					delete range.startunbounded
					range.start = start
					range.startinclusive = brush.start_select.property('value') === 'startinclusive'
				}
				if (stop == '') {
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
				if (self.num_obj.ranges.length > 1) new_tvs.ranges = self.mergeOverlapRanges(range)
				else new_tvs.ranges[range.index] = range
				self.opts.callback(new_tvs)
			} catch (e) {
				window.alert(e)
			}
		}
	}

	self.mergeOverlapRanges = function(new_range) {
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

	self.showCheckList_numeric = async (tvs, div) => {
		if (!tvs.term.values) {
			// no special categories available for this term
			return
		}
		// numerical checkbox for unannotated cats
		const unannotated_cats = await self.getNumericCategories(tvs.term.id)

		for (const [index, cat] of unannotated_cats.entries()) {
			cat.label = tvs.term.values[cat.value].label
			cat.key = cat.value
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

		// 'Apply' button
		unanno_div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
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

		const values_table = self.makeValueTable(unanno_div, tvs, sortedVals).node()
	}

	self.fillConditionMenu = async function(div, tvs) {
		// grade/subcondtion select
		const bar_by_select = div
			.append('select')
			.attr('class', '.value_select')
			.style('display', 'block')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.on('change', () => {
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				const value = bar_by_select.node().value
				new_tvs.bar_by_grade = value === 'grade'
				new_tvs.bar_by_children = value === 'sub'
				div.selectAll('*').remove()
				self.fillConditionMenu(div, new_tvs)
			})

		bar_by_select
			.append('option')
			.attr('value', 'grade')
			.text('By Grade')
			.property('selected', tvs.bar_by_grade)

		bar_by_select
			.append('option')
			.attr('value', 'sub')
			.text('By Subcondition')
			.property('selected', tvs.bar_by_children)

		// grade type type
		const grade_type_select = div
			.append('select')
			.attr('class', '.grade_select')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', tvs.bar_by_grade ? 'block' : 'none')
			.on('change', () => {
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				const value = grade_type_select.node().value
				new_tvs.bar_by_grade = value !== 'sub'
				new_tvs.bar_by_children = value === 'sub'
				new_tvs.value_by_max_grade = value === 'max'
				new_tvs.value_by_most_recent = value === 'recent'
				new_tvs.value_by_computable_grade = value === 'computable' || value === 'sub'
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		grade_type_select
			.append('option')
			.attr('value', 'max')
			.text('Max grade per patient')
			.property('selected', tvs.value_by_max_grade)

		grade_type_select
			.append('option')
			.attr('value', 'recent')
			.text('Most recent grade per patient')
			.property('selected', tvs.value_by_most_recent)

		grade_type_select
			.append('option')
			.attr('value', 'computable')
			.text('Any grade per patient')
			.property('selected', tvs.value_by_computable_grade)

		// display note if bar by subcondition selected
		div
			.append('span')
			.style('margin', '5px 10px')
			.style('padding', '3px')
			.style('display', tvs.bar_by_children ? 'block' : 'none')
			.style('color', '#888')
			.html('Using any grade per patient')

		const lst = tvs.bar_by_grade ? ['bar_by_grade=1'] : tvs.bar_by_children ? ['bar_by_children=1'] : []
		lst.push(
			tvs.value_by_max_grade
				? 'value_by_max_grade=1'
				: tvs.value_by_most_recent
				? 'value_by_most_recent=1'
				: tvs.value_by_computable_grade
				? 'value_by_computable_grade=1'
				: null
		)

		const data = await self.getCategories(tvs.term, lst)

		// 'Apply' button
		div
			.append('div')
			.style('text-align', 'center')
			.append('div')
			.attr('class', 'apply_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '13px')
			// .style('padding', '7px 15px')
			.style('margin', '5px')
			.style('text-align', 'center')
			.style('font-size', '.9em')
			.style('text-transform', 'uppercase')
			.text('Apply')
			.on('click', () => {
				//update term values by ckeckbox values
				const checked_vals = [...self.values_table.querySelectorAll('.value_checkbox')]
					.filter(elem => elem.checked)
					.map(elem => elem.value)
				const new_vals = data.lst.filter(v => checked_vals.includes(v.key))
				const new_tvs = JSON.parse(JSON.stringify(tvs))
				delete new_tvs.groupset_label
				new_tvs.values = new_vals
				self.dom.tip.hide()
				self.opts.callback(new_tvs)
			})

		self.values_table = self.makeValueTable(div, tvs, data.lst).node()
	}

	self.removeTerm = tvs => {
		// const termfilter = self.termfilter.terms.filter(d => d.term.id != tvs.term.id)
		self.opts.callback(null)
	}

	self.updatePill = async function() {
		const one_term_div = select(this)
		const term = one_term_div.datum()

		// negate button
		one_term_div
			.select('.negate_btn')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(term.isnot ? 'NOT' : 'IS')

		const value_text = self.get_value_text(term)

		const grade_type = term.bar_by_children
			? ''
			: term.value_by_max_grade
			? '[Max Grade]'
			: term.value_by_most_recent
			? '[Most Recent Grade]'
			: term.value_by_computable_grade
			? '[Any Grade]'
			: ''

		const value_btns = one_term_div
			.selectAll('.value_btn')
			.data(value_text ? [{ txt: value_text, grade_type }] : [], d => d.txt + d.grade_type)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('padding', '6px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html(d => d.txt)
			.append('div')
			.attr('class', 'grade_type_btn')
			.style('display', 'inline-block')
			.style('margin', '0 5px')
			.style('font-size', '.6em')
			.style('text-transform', 'uppercase')
			.html(d => d.grade_type)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
	}

	self.get_value_text = function(tvs) {
		// tvs is {term, values/ranges, ... }, a tvs object
		if (tvs.term.iscategorical) {
			if (tvs.values.length == 1) {
				// single
				const v = tvs.values[0]
				if (v.label) return v.label
				if (tvs.term.values && tvs.term.values[v.key] && tvs.term.values[v.key].label)
					return tvs.term.values[v.key].label
				console.error(`key "${v.key}" not found in values{} of ${tvs.term.name}`)
				return v.key
			}
			// multiple
			if (tvs.groupset_label) return tvs.groupset_label
			return tvs.values.length + ' groups'
		}
		if (tvs.term.isfloat || tvs.term.isinteger) {
			if (tvs.ranges.length == 1) {
				const v = tvs.ranges[0]
				if ('value' in v) {
					// category
					if (v.label) return v.label
					if (tvs.term.values && tvs.term.values[v.value] && tvs.term.values[v.value].label)
						return tvs.term.values[v.value].label
					console.error(`key "${v.value}" not found in values{} of ${tvs.term.name}`)
					return v.value
				}
				// numeric range
				return self.numeric_val_text(v)
			}
			// multiple
			return tvs.ranges.length + ' intervals'
		}
		if (tvs.term.iscondition) {
			if (tvs.bar_by_grade || tvs.bar_by_children) {
				if (tvs.values.length == 1) {
					// single
					return tvs.values[0].label
				}
				// multiple
				if (tvs.groupset_label) return tvs.groupset_label
				return tvs.values.length + (tvs.bar_by_grade ? ' Grades' : 'Subconditions')
			}
			if (tvs.grade_and_child) {
				//TODO
				console.error(term)
				return 'todo'
			}
			throw 'unknown tvs setting for a condition term'
		}
		throw 'unknown term type'
	}

	self.exitPill = async function(term) {
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.makeValueTable = function(div, tvs, values) {
		const values_table = div.append('table').style('border-collapse', 'collapse')

		// this row will have group names/number
		const all_checkbox_tr = values_table.append('tr').style('height', '20px')

		const all_checkbox_label = all_checkbox_tr.append('td').style('padding', '2px 5px')

		const all_checkbox = all_checkbox_label
			.append('input')
			.attr('type', 'checkbox')
			.style('position', 'relative')
			.style('vertical-align', 'middle')
			.style('bottom', '3px')
			.on('change', () => {
				values_table.selectAll('.value_checkbox').property('checked', all_checkbox.node().checked)
			})

		all_checkbox_label
			.append('span')
			.style('padding', '2px 5px')
			.style('font-size', '.8em')
			.style('font-weight', 'bold')
			.html('Check/ Uncheck All')

		const value_trs = values_table.selectAll('.value_tr').data(values, d => d.key)

		value_trs
			.exit()
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()

		value_trs
			.enter()
			.append('tr')
			.attr('class', 'value_tr')
			.style('height', '15px')
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
			.each(enter_td)

		function enter_td(d) {
			const value_tr = select(this)

			const value_label = value_tr
				.append('td')
				.style('padding', '2px 5px')
				.append('label')

			value_label
				.append('input')
				.attr('class', 'value_checkbox')
				.attr('type', 'checkbox')
				.attr('value', d.key)
				.style('position', 'relative')
				.style('vertical-align', 'middle')
				.style('bottom', '3px')
				.property('checked', () => {
					if (tvs.term.iscategorical) {
						return tvs.values.find(a => a.key === d.key)
					} else if (tvs.term.isfloat || tvs.term.isinteger) {
						return tvs.ranges.find(a => String(a.value) == d.value.toString())
					} else if (tvs.term.iscondition) {
						return tvs.values.find(a => String(a.key) === String(d.key))
					}
				})

			value_label
				.append('span')
				.style('padding', '2px 5px')
				.style('font-size', '.8em')
				.html(d.label + ' (n=' + d.samplecount + ')')
		}
		return values_table
	}

	self.removeValueBtn = function(d, j) {
		const one_term_div = select(this.parentNode)
		const tvs = one_term_div.datum()
		const select_remove_pos =
			tvs.term.isinteger || tvs.term.isfloat ? j - tvs.ranges.slice(0, j).filter(a => a.start || a.stop).length : j

		select(one_term_div.selectAll('.value_select')._groups[0][select_remove_pos]).remove()
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).remove()
		select(this)
			.style('opacity', 1)
			.transition()
			.duration(self.durations.exit)
			.style('opacity', 0)
			.remove()
	}

	self.makeSelectList = function(data, select, selected_values, btn_value, first_option) {
		if (data.lst) {
			if (first_option == 'delete') {
				select
					.append('option')
					.attr('value', 'delete')
					.html('&times;&nbsp;&nbsp;Delete')
			} else if (first_option == 'add') {
				select
					.append('option')
					.attr('value', 'add')
					.property('disabled', true)
					.html('--- Add New Category ---')
			}

			for (const category of data.lst) {
				select
					.append('option')
					.attr('value', category.key)
					.text(category.label + '\t(n=' + category.samplecount + ')')
			}

			//if more than 1 categories exist, disable other from the dropdown to avoid duplicate selection
			if (btn_value) {
				const options = select.selectAll('option')

				options.nodes().forEach(function(d) {
					if (selected_values.find(v => v.key == d.value) && d.value != btn_value) {
						d.disabled = true
					}
				})

				select.node().value = btn_value
			}
		} else {
			select.append('option').text("ERROR: Can't get the data")
		}
	}

	self.updateSelect = function(select, selected_values, btn_value) {
		const options = select.selectAll('option')

		options.nodes().forEach(function(d) {
			if (
				selected_values.length > 0 &&
				selected_values.find(v => (v.key || v.label) == d.value) &&
				d.value != btn_value
			) {
				d.disabled = true
			} else {
				d.disabled = false
			}
			select.node().value = btn_value
		})
	}

	self.term_name_gen = function(d) {
		let term_name = d.term.name

		// trim long term name with '...' at end and hover to see full term_name
		if ((d.term.isfloat || d.term.isinteger) && d.term.name.length > 25) {
			term_name = '<label title="' + d.term.name + '">' + d.term.name.substring(0, 24) + '...' + '</label>'
		} else if (d.term.iscondition && d.term.name.length > 20) {
			term_name = '<label title="' + d.term.name + '">' + d.term.name.substring(0, 18) + '...' + '</label>'
		}
		return term_name
	}

	self.numeric_val_text = function(range) {
		let range_txt
		const x = '<span style="font-family:Times;font-style:italic;font-size:0.9em;">x</span>'
		if (range.startunbounded) {
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
}

function setInteractivity(self) {
	self.displayTreeMenu = holder => {
		self.dom.tip.clear().showunder(holder || self.dom.holder.node())
		// const one_term_div = self.dom.holder.selectAll('div')
		// const terms = one_term_div.classed('add_term_btn')
		// 	? self.termfilter.terms
		// 	: self.termfilter.terms.filter(t => t.id != term.termId)
		appInit(null, {
			holder: self.dom.tip.d,
			state: {
				genome: self.genome,
				dslabel: self.dslabel,
				termfilter: {
					show_top_ui: false
					// 	terms: terms
				}
			},
			modifiers: {
				//modifier to replace filter by clicking term btn
				//TODO: add tvs as new filter from '+' button
				tvs_select: tvs => {
					self.replaceFilter({ term: tvs })
				}
			},
			app: {
				callbacks: { 'postInit.test': () => {} }
			},
			barchart: {
				bar_click_override: tvslst => {
					self.dom.tip.hide()
					self.opts.callback(tvslst[0])
				}
			}
		})
	}
}
