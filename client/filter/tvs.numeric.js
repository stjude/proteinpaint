import { select } from 'd3-selection'
import { scaleLinear } from 'd3'
import { keyupEnter } from '../src/client'
import { addBrushes, addNewBrush } from './tvs.density'
import { makeDensityPlot } from './densityplot'
import { NumericRangeInput } from '../dom/numericRangeInput'

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
makeRangeButtons() // add buttons for  APPLY / DELETE 
mergeOverlapRanges() // when APPLY is pressed, check if ranges are overlapping, if so, merge them
showCheckList_numeric() // so checklist of uncomputable values
validateNumericTvs() // validate tvs before sending it to callback

*/

export const handler = {
	type: 'numeric',
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

	if (typeof self.opts.vocabApi.getViolinPlotData == 'function') {
		try {
			const data = await self.opts.vocabApi.getViolinPlotData(
				{
					termid: tvs.term.id,
					filter: self.filter,
					svgw: self.num_obj.plot_size.width
				},
				self.opts.getCategoriesArguments
			)
			self.num_obj.density_data = convertViolinData(data)
		} catch (err) {
			console.log(err)
		}
	} else {
		// frontend vocab lacks this method, return no density data so ui will not show the plot
		// if the method is added to front vocab, the method must check if sample data is available for the front vocab;
		// if no sample data then return no density.
		// such is the case for INFO terms used for variant filtering
		self.num_obj.density_data = {}
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
		//if (range.value == undefined) {
		range.index = index
		ranges.push(range)
		//}
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
	const add_range_btn = self.num_obj.num_div
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
			addNewBrush(self, ranges.length ? 'end' : 'center', callback)
		})

	if (!ranges.length) {
		const callback = () => addRangeTable(self)
		addNewBrush(self, 'center', callback)
	}

	self.num_obj.brushes.forEach(brush => brush.init())
	await showCheckList_numeric(self, tvs, div)
}

// convert violin data (vd) to old density data (dd)
export function convertViolinData(vd) {
	const p = vd.plots[0] || { plotValueCount: 0, biggestBin: 0, bins: [] } // assuming only one plot
	const dd = {
		minvalue: vd.min,
		maxvalue: vd.max,
		samplecount: p.plotValueCount,
		densitymax: p.biggestBin,
		density: p.bins.map(i => {
			return [i.x0, i.binValueCount]
		})
	}
	return dd
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

	range.min = 'min' in tvs.term ? tvs.term.min : null
	range.max = 'max' in tvs.term ? tvs.term.max : null

	brush.rangeInput = new NumericRangeInput(brush.equation_td, range, applyRange)

	brush.apply_btn = tr
		.append('td')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
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
			brush.rangeInput.parseRange()
		})

	function applyRange() {
		self.dom.tip.hide()
		self.opts.callback({ term: tvs.term, ranges: [brush.rangeInput.getRange()] })
	}
}

function addRangeTable(self) {
	const num_div = self.num_obj.num_div
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
}

function enterRange(self, tr, brush, i) {
	if (!brush.range_tr) brush.range_tr = select(tr)
	const range_tr = brush.range_tr
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

	brush.rangeInput = new NumericRangeInput(brush.equation_td, brush.range, apply)

	makeRangeButtons(self, brush)
	// note for empty range
	if (i == 0) {
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
			.html('Note: Drag the <b>green rectangle</b> to select a range. Overlapping ranges will be merged')
	}

	async function apply(new_range) {
		try {
			brush.range = new_range
			const minvalue = self.num_obj.density_data.minvalue
			const maxvalue = self.num_obj.density_data.maxvalue

			const start =
				new_range.value != undefined ? new_range.value : new_range.start != undefined ? new_range.start : minvalue
			const stop =
				new_range.value != undefined ? new_range.value : new_range.stop != undefined ? new_range.stop : maxvalue
			brush.elem.call(brush.d3brush).call(brush.d3brush.move, [start, stop].map(xscale))
		} catch (e) {
			window.alert(e)
		}
	}

	function makeRangeButtons(self, brush) {
		const buttons_td = brush.range_tr.append('td')
		const range = brush.range
		const orig_range = brush.orig
		const sameRanges = JSON.stringify(range) == JSON.stringify(brush.orig)

		//'Apply' button
		brush.apply_btn = buttons_td
			.append('td')
			.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
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
				const new_range = brush.rangeInput.parseRange()
				const new_tvs = JSON.parse(JSON.stringify(self.tvs))
				delete new_tvs.groupset_label
				// merge overlapping ranges
				if (self.num_obj.ranges.length > 1) new_tvs.ranges = mergeOverlapRanges(self, new_range)
				else new_tvs.ranges[range.index] = new_range
				try {
					validateNumericTvs(new_tvs)
					self.opts.callback(new_tvs)
				} catch (ex) {
					alert(ex)
				}
			})

		//'Delete' button
		buttons_td
			.append('td')
			.attr('class', 'sja_filter_tag_btn sjpp_delete_btn')
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

	// 'Apply' button
	const callback = indexes => {
		//update term values by ckeckbox values
		try {
			const new_tvs = JSON.parse(JSON.stringify(tvs))
			delete new_tvs.groupset_label
			new_tvs.ranges = [
				...new_tvs.ranges.filter(r => !('value' in r)),
				...indexes.map(i => ({ value: sortedVals[i].value, label: sortedVals[i].label }))
			]
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
	}

	const values_table = self.makeValueTable(unanno_div, tvs, sortedVals, callback).node()
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
