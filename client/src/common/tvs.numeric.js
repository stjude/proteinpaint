import { select, event } from 'd3-selection'
import { scaleLinear } from 'd3'
import * as client from '../client'
import { addBrushes, addNewBrush } from './tvs.density'
import { makeDensityPlot } from './densityplot'

/*
********************** EXPORTED
handler:
	// internal functions as part of handler
	term_name_gen()
	get_pill_label()
		format_val_text()
	getSelectRemovePos()
	fillMenu()
	setTvsDefaults()

********************** INTERNAL
addRangeTableNoDensity() // for terms without desnity table, show brushes but without density_plot on blank svg
addRangeTable() // add table for existing ranges or start with empty_range with brush in center 
enterRange() // add row for each range, for existing readonly and for new or edit, show inputs
makeRangeButtons() // add buttons for EDIT / APPLY / RESET / DELETE 
mergeOverlapRanges() // when APPLY is pressed, check if ranges are overlapping, if so, merge them
showCheckList_numeric() // so checklist of uncomputable values
validateNumericTvs() // validate tvs before sending it to callback

*/

export const handler = {
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

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

async function fillMenu(self, div, tvs) {
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

	if (!self.num_obj.density_data.density || !self.num_obj.density_data.density.length) {
		//if (!tvs.term.range) throw `unable to create an edit menu: missing both density data and term.range`
		addRangeTableNoDensity(self, tvs)
		return
	}

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

	const density_plot_opts = {
		svg: self.num_obj.svg,
		data: self.num_obj.density_data,
		plot_size: self.num_obj.plot_size
	}

	makeDensityPlot(density_plot_opts)
	// add brush_g for tvs brushes
	self.num_obj.brush_g = self.num_obj.svg
		.append('g')
		.attr('transform', `translate(${self.num_obj.plot_size.xpad}, ${self.num_obj.plot_size.ypad})`)
		.attr('class', 'brush_g')

	const maxvalue = self.num_obj.density_data.maxvalue
	const minvalue = self.num_obj.density_data.minvalue

	self.num_obj.xscale = scaleLinear()
		.domain([minvalue, maxvalue])
		.range([self.num_obj.plot_size.xpad, self.num_obj.plot_size.width - self.num_obj.plot_size.xpad])

	self.num_obj.ranges = ranges
	self.num_obj.brushes = []
	addBrushes(self)
	addRangeTable(self)

	if (!ranges.length) {
		const callback = () => addRangeTable(self)
		addNewBrush(self, 'center', callback)
	}
	self.num_obj.brushes.forEach(brush => brush.init())
	await showCheckList_numeric(self, tvs, div)
}

function setTvsDefaults(tvs) {
	if (!tvs.ranges) tvs.ranges = []
}

function addRangeTableNoDensity(self, tvs) {
	const termrange = tvs.term.range || {}
	const range = tvs.ranges && tvs.ranges[0] ? tvs.ranges[0] : termrange
	const num_div = self.num_obj.num_div
	num_div.selectAll('*').remove()
	num_div
		.append('div')
		.style('padding', '5px')
		.style('font-weight', 600)
		.html(tvs.term.name)

	const brush = {}

	const table = num_div.append('table')
	//.style('display', 'inline-block')

	const tr = table.append('tr')

	tr.append('td').html('Range')

	brush.equation_td = tr.append('td')

	const minval = 'min' in tvs.term ? tvs.term.min : null
	const maxval = 'max' in tvs.term ? tvs.term.max : null
	const startval = range && 'start' in range ? range.start : null
	brush.start_input = brush.equation_td
		.append('input')
		.attr('class', 'start_input')
		.attr('type', 'number')
		.attr('value', startval)
		.attr('min', minval)
		.attr('max', maxval)
		.attr('title', 'leave blank for unbounded (-ꝏ)')
		.attr('placeholder', '-ꝏ')
		.style('width', '80px')
		.style('height', '18px')
		.style('margin', '3px 5px')
		//.style('font-size', '20px')
		.style('vertical-align', 'top')
		.on('keyup', () => {
			const textval = brush.start_input.property('value')
			const val = textval === '' ? -Infinity : Number(textval)
			brush.start_input.style(
				'color',
				(minval === null || minval <= val) && (maxval === null || maxval >= val) ? '' : '#f00'
			)
		})

	// select realation for start value
	brush.start_select = brush.equation_td
		.append('select')
		.attr('class', 'start_select')
		//.style('height', '18px')
		.style('margin', '4px 5px')
		.style('vertical-align', 'top')

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
			}
		])
		.enter()
		.append('option')
		.attr('value', d => d.value)
		.property('selected', d => range[d.value] || (d.value == 'startexclusive' && !range.startinclusive))
		.html(d => d.label)

	// 'x' and relation symbols
	/*brush.start_relation_text = brush.equation_td
		.append('div')
		.attr('class', 'start_relation_text')
		.style('display', 'inline-block')
		.style('margin-left', '5px')
		.style('text-align', 'center')
		.html(range.startunbounded ? ' ' : range.startinclusive ? '&leq;&nbsp;' : '&lt;&nbsp;')*/

	const x = '<span style="font-family:Times;font-style:italic;">x</span>'
	brush.equation_td
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '3px 5px')
		.style('text-align', 'center')
		.style('vertical-align', 'top')
		.style('font-size', '18px')
		.html(x)

	/*brush.stop_relation_text = brush.equation_td
		.append('div')
		.attr('class', 'stop_relation_text')
		.style('display', 'inline-block')
		.style('margin-left', '5px')
		.style('text-align', 'center')
		.html(range.stopunbounded ? ' ' : range.stopinclusive ? '&leq;&nbsp;' : '&lt;&nbsp;')*/

	// select realation for stop value
	brush.stop_select = brush.equation_td
		.append('select')
		.attr('class', 'stop_select')
		//.style('height', '18px')
		.style('margin', '4px 5px')
		.style('vertical-align', 'top')

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
			}
		])
		.enter()
		.append('option')
		.attr('value', d => d.value)
		.property('selected', d => range[d.value] || (d.value == 'stopexclusive' && !range.stopinclusive))
		.html(d => d.label)

	const stopval = range && 'stop' in range ? range.stop : null
	brush.stop_input = brush.equation_td
		.append('input')
		.attr('class', 'stop_input')
		.attr('type', 'number')
		.attr('value', stopval)
		.attr('min', minval)
		.attr('max', maxval)
		.attr('title', 'leave blank for unbounded (+ꝏ)')
		.attr('placeholder', '+ꝏ')
		.style('width', '80px')
		.style('height', '18px')
		.style('margin', '3px 5px')
		.style('vertical-align', 'top')
		.on('keyup', () => {
			const textval = brush.stop_input.property('value')
			const val = textval === '' ? Infinity : Number(textval)
			brush.stop_input.style(
				'color',
				(minval === null || minval <= val) && (maxval === null || maxval >= val) ? '' : '#f00'
			)
		})

	brush.apply_btn = tr
		.append('td')
		.attr('class', 'sja_filter_tag_btn apply_btn')
		//.style('display', 'inline-block')
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
			const start = brush.start_input.property('value')
			const stop = brush.stop_input.property('value')
			const range = {
				start,
				startinclusive: brush.start_select.property('value') === 'startinclusive',
				startunbounded: start === '',
				stop,
				stopinclusive: brush.stop_select.property('value') === 'stopinclusive',
				stopunbounded: stop === ''
			}

			let errs = []
			if (minval !== null && (range.startunbounded || minval > range.start)) {
				errs.push('Invalid start value < minimum allowed')
			}
			if (maxval !== null && (range.stopunbounded || maxval < range.stop)) {
				errs.push('Invalid stop value > maximum allowed')
			}

			if (errs.length) {
				alert(errs.join('\n'))
			} else {
				self.opts.callback({ term: tvs.term, ranges: [range] })
			}
		})
}

function addRangeTable(self) {
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
		.each(function(brush, i) {
			enterRange(self, this, brush, i)
		})

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
					const callback = () => addRangeTable(self)
					addNewBrush(self, null, callback)
				})

	add_range_btn.style(
		'display',
		ranges.length && ranges[ranges.length - 1].start === '' && ranges[ranges.length - 1].stop === ''
			? 'none'
			: 'inline-block'
	)
}

function enterRange(self, tr, brush, i) {
	if (!brush.range_tr) brush.range_tr = select(tr)
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

	makeRangeButtons(self, brush)

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

function makeRangeButtons(self, brush) {
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
				addBrushes(self)
				addRangeTable(self)
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
			if (self.num_obj.ranges.length > 1) new_tvs.ranges = mergeOverlapRanges(self, range)
			else new_tvs.ranges[range.index] = range
			try {
				validateNumericTvs(new_tvs)
			} catch (e) {
				window.alert(e)
				return
			}
			self.opts.callback(new_tvs)
		} catch (e) {
			window.alert(e)
		}
	}
}

function mergeOverlapRanges(self, new_range) {
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

async function showCheckList_numeric(self, tvs, div) {
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
				if (JSON.parse(JSON.stringify(tvs) != new_tvs)) {
					try {
						validateNumericTvs(new_tvs)
					} catch (e) {
						window.alert(e)
						return
					}
					self.opts.callback(new_tvs)
				}
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

function validateNumericTvs(tvs) {
	if (!tvs.term) throw 'tvs.term is not defined'
	if (!tvs.ranges) throw `.values[] missing for a term ${tvs.term.name}`
	if (!Array.isArray(tvs.ranges)) throw `.values[] is not an array for a term ${tvs.term.name}`
	if (!tvs.ranges.length) throw `no categories selected for ${tvs.term.name}`
	for (const range of tvs.ranges) {
		if (range.value != undefined) {
			// a special category, not a value from numerical range
			if (!range.label) throw `.label missing for special category for a term ${tvs.term.name}`
		} else {
			// a regular range
			if (range.startunbounded) {
				if (range.stopunbounded) throw `both start & stop are unbounded for a term ${tvs.term.name}`
				if (!Number.isFinite(range.stop)) throw `.stop undefined when start is unbounded for a term ${tvs.term.name}`
			} else if (range.stopunbounded) {
				if (!Number.isFinite(range.start)) throw `.start undefined when stop is unbounded for a term ${tvs.term.name}`
			} else {
				if (!Number.isFinite(range.start))
					throw `.start undefined when start is not unbounded for a term ${tvs.term.name}`
				if (!Number.isFinite(range.stop)) throw `.stop undefined when stop is not unbounded for a term ${tvs.term.name}`
				if (range.start >= range.stop) throw `.start is not lower than stop for a term ${tvs.term.name}`
			}
		}
	}
}
