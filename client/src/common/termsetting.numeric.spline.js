import { select, event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'
import { keyupEnter } from '../client'

// self is the termsetting instance
export function getHandler(self) {
	return {
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		},

		get_status_msg() {
			return ''
		},

		async showEditMenu(div) {
			self.num_obj = {}

			self.num_obj.plot_size = {
				width: 500,
				height: 100,
				xpad: 10,
				ypad: 20
			}
			try {
				self.num_obj.density_data = await self.vocabApi.getDensityPlotData(self.term.id, self.num_obj, self.filter)
			} catch (err) {
				console.log(err)
			}

			div.selectAll('*').remove()
			self.dom.num_holder = div
			self.dom.knots_div = div.append('div').style('padding', '5px')
			setqDefaults(self)
			setDensityPlot(self)
			// renderTypeInputs(self)
			renderEditMenu(self)
			renderButtons(self)
		}
	}
}

function setqDefaults(self) {
	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id]['cubic-spline']) {
		cache[t.id]['cubic-spline'] = {
			knots_lst: []
		}
	}

	// create default knots when menu renderes for first time
	const dd = self.num_obj.density_data
	const default_first_knot = dd.maxvalue != dd.minvalue ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 5 : dd.minvalue
	const auto_knots_count = 4
	const knots_lst = cache[t.id]['cubic-spline'].knots_lst
	for (let i = 1; i < auto_knots_count + 1; i++)
		knots_lst.push({ value: (default_first_knot * i).toFixed(t.type == 'integer' ? 0 : 2) })
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id]['cubic-spline']))
	self.q = Object.assign(cacheCopy, self.q)
	delete self.q.type
	//*** validate self.q ***//
}

function renderEditMenu(self) {
	const edit_div = self.dom.knots_div
	renderCustomSplineInputs(self, edit_div)
	renderAutoSplineInputs(self, edit_div)
}

/******************* Functions for Auto Spline knots *******************/
function renderAutoSplineInputs(self, div) {
	let knot_count
	const default_knot_count = (knot_count = 4)
	self.dom.knot_select_div = div.append('div')

	self.dom.knot_select_div
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '15px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Autocompute')

	const knot_ct_select = self.dom.knot_select_div
		.append('select')
		.style('margin-left', '10px')
		.style('margin-bottom', '7px')
		.on('change', () => {
			knot_caclualte_btn.property('disabled', knot_count == knot_ct_select.node().value)
			// TODO: cacluate knots based on dropdown count
			// const auto_knots_count = knot_ct_select.node().value
		})

	for (let i = default_knot_count - 1; i < default_knot_count + 5; i++) {
		knot_ct_select
			.append('option')
			.attr('value', i)
			.html(i)
	}

	knot_ct_select.node().value = default_knot_count

	self.dom.knot_select_div
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '10px')
		.style('color', 'rgb(136, 136, 136)')
		.html('knots')

	const knot_caclualte_btn = self.dom.knot_select_div
		.append('button')
		.style('margin', '15px')
		// .property('disabled', knot_count == knot_ct_select.node().value)
		.html('Compute')
		.on('click', () => getKnots(self))

	self.dom.knot_select_div
		.append('div')
		.style('display', 'inline-block')
		.style('font-size', '.7em')
		.style('padding', '3px 15px')
		.style('padding-left', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Will overwrite existing values.')
}

function getKnots(self) {
	//TODO: qnery knots from backend
}

/******************* Functions for Custom Spline knots *******************/
function renderCustomSplineInputs(self, div) {
	self.dom.custom_knots_div = div.append('div')

	self.dom.custom_knots_div
		.append('div')
		.style('display', 'inline-block')
		.style('vertical-align', 'top')
		.style('padding', '3px 15px')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Knots')

	self.dom.customKnotsInput = self.dom.custom_knots_div
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '3px 15px')
		.style('padding-left', '5px')
		.append('textarea')
		.style('height', '100px')
		.style('width', '100px')
		.text(self.q.knots_lst.map(d => d.value).join('\n'))
		.on('change', handleChange)
		.on('keyup', async () => {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter() && event.key != 8) return
			handleChange.call(this)
		})

	self.dom.custom_knots_div
		.append('div')
		.style('display', 'inline-block')
		.style('vertical-align', 'top')
		.style('font-size', '.7em')
		.style('padding', '3px 15px')
		.style('padding-left', '5px')
		.style('color', 'rgb(136, 136, 136)').html(`Enter knot values, one knot per line.</br> 
			Adjust knot by dragging on the vertical line.</br>
		 	Or autocompute knots from below.`)

	function handleChange() {
		const data = processKnotsInputs(self)
		// update self.q.knots_lst and render knot lines only if knot values changed
		const q = self.numqByTermIdModeType[self.term.id]['cubic-spline'][self.q.type]
		if (knotsChanged(data, q.knots_lst)) {
			q.knots_lst = data
			self.renderBinLines(self, q)
		}
		self.q = q
	}

	function knotsChanged(data, qlst) {
		if (data.length != qlst.length) return true
		if (Object.keys(data[0]).length !== Object.keys(qlst[0]).length) return true
		for (const [i, knot] of qlst.entries()) {
			for (const k of Object.keys(knot)) {
				if (knot[k] && knot[k] !== data[i][k]) {
					return true
				}
			}
		}
		return false
	}
}

function processKnotsInputs(self) {
	const data = self.dom.customKnotsInput
		.property('value')
		.split('\n')
		.filter(d => d != '')
		.map(d => +d)
		.sort((a, b) => a - b)
		.map((d, i) => {
			const knot = {
				value: +d
			}
			return knot
		})
	return data
}

function renderButtons(self) {
	const btndiv = self.dom.knots_div.append('div')
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', () => applyEdits(self))
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Reset')
		.on('click', () => {
			delete self.q
			delete self.numqByTermIdModeType[self.term.id]
			self.handler.showEditMenu(self.dom.num_holder)
		})
}

function applyEdits(self) {
	self.q.mode = 'cubic-spline'
	self.dom.tip.hide()
	self.opts.callback({
		term: self.term,
		q: self.q
	})
}
