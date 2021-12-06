import { select, event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'
import { renderBoundaryInclusionInput } from './termsetting.numeric.discrete'
import { get_bin_label } from '../../shared/termdb.bins'
import { init_tabs } from '../dom/toggleButtons'
import { keyupEnter } from '../client'
import { make_one_checkbox } from '../dom/checkbox'

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
			renderTypeInputs(self)
			renderButtons(self)
		}
	}
}

function setqDefaults(self) {
	const dd = self.num_obj.density_data
	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id]['cubic-spline']) {
		const defaultCustomBoundary =
			dd.maxvalue != dd.minvalue ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2 : dd.maxvalue
		const default_first_knot = 
			dd.maxvalue != dd.minvalue ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 5 : dd.minvalue

		cache[t.id]['cubic-spline'] = {
			'auto-knots': {
				type: 'auto-knots',
				auto_knots_count: 4,
				auto_knots_lst: []
			},
			'custom-knots': {
				type: 'custom-knots',
				custom_knots_lst: [
					{
						start: +defaultCustomBoundary.toFixed(t.type == 'integer' ? 0 : 2)
					}
				]
			}
		}

		const auto_knots_count = cache[t.id]['cubic-spline']['auto-knots'].auto_knots_count
		const auto_knots_lst = cache[t.id]['cubic-spline']['auto-knots'].auto_knots_lst
		for(let i = 1; i < auto_knots_count + 1 ; i++)
			auto_knots_lst.push({ start: (default_first_knot*i).toFixed(t.type == 'integer' ? 0 : 2) })
	} else if (t.q) {
		/*** is this deprecated? term.q will always be tracked outside of the main term object? ***/
		if (!t.q.type) throw `missing numeric term spline q.type: should be 'spline-auto' or 'spline-custom'`
		cache[t.id]['cubic-spline'][t.q.type] = t.q
	}

	//if (self.q && self.q.type && Object.keys(self.q).length>1) return
	if (self.q && !self.q.mode) self.q.mode = 'cubic-spline'
	if (!self.q || self.q.mode !== 'cubic-spline') self.q = {}
	if (!self.q.type) self.q.type = 'auto-knots'
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id]['cubic-spline'][self.q.type]))
	self.q = Object.assign(cacheCopy, self.q)
	if (self.q.custom_knots_lst) {
		self.q.custom_knots_lst.forEach(knot => {
			if (!('label' in knot)) knot.label = knot.start || ''
		})
	}
	//*** validate self.q ***//
	// console.log(self.q)
}

function renderTypeInputs(self) {
	// toggle switch
	const knots_div = self.dom.knots_div
	const div = self.dom.knots_div.append('div').style('margin', '10px')
	const tabs = [
		{
			active: self.q.type == 'auto-knots' ? true : false,
			label: 'Auto compute knots',
			callback: async div => {
				self.q.type = 'auto-knots'
				self.dom.knots_div = knots_div
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[0].isInitialized) {
					renderAutoSplineInputs(self, div)
					tabs[0].isInitialized = true
				}
			}
		},
		{
			active: self.q.type == 'custom-knots' ? true : false,
			label: 'Specity custom knots',
			callback: async div => {
				self.q.type = 'custom-knots'
				self.dom.knots_div = knots_div
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[1].isInitialized) {
					renderCustomSplineInputs(self, div)
					tabs[1].isInitialized = true
				}
			}
		}
	]
	init_tabs({ holder: div, tabs })
}

/******************* Functions for Auto Spline knots *******************/
function renderAutoSplineInputs(self, div) {
	let knot_count
	const default_knot_count = knot_count = 4
	self.dom.knot_select_div = div.append('div')

	self.dom.knot_select_div.append('div')
		.style('display','inline-block')
		.style('margin-left', '15px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Knots count')

	const knot_ct_select = self.dom.knot_select_div.append('select')
		.style('margin-left', '15px')
		.style('margin-bottom', '7px')
		.on('change', () => {
			knot_caclualte_btn
				.property('disabled', knot_count == knot_ct_select.node().value)
			self.q.auto_knots_count = knot_ct_select.node().value
		})

	for (let i = default_knot_count -1; i < default_knot_count + 5; i++) {
		knot_ct_select
			.append('option')
			.attr('value', i)
			.html(i)
	}

	knot_ct_select.node().value = default_knot_count

	const knot_caclualte_btn = self.dom.knot_select_div.append('button')
		.style('margin', '15px')
		.property('disabled', knot_count == knot_ct_select.node().value)
		.html('Calculate knots')
		.on('click', () => getKnots(self))

}

function getKnots(self){
	//TODO: qnery knots from backend
}

/******************* Functions for Custom Spline knots *******************/
function renderCustomSplineInputs(self, tablediv) {
	self.dom.bins_table = tablediv.append('table')
	const thead = self.dom.bins_table.append('thead').append('tr')
	thead
		.append('th')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Knots')
	thead
		.append('th')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Knot Labels')
	self.dom.customBintbody = self.dom.bins_table.append('tbody')
	const tr = self.dom.customBintbody.append('tr')

	self.dom.customBinBoundaryInput = tr
		.append('td')
		.append('textarea')
		.style('height', '100px')
		.style('width', '100px')
		.text(
			self.q.custom_knots_lst
				.map(d => d.start)
				.join('\n')
		)
		.on('change', handleChange)
		.on('keyup', async () => {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter() && event.key != 8) return
			handleChange.call(this)
		})

	function handleChange() {
		self.dom.customBinLabelTd.selectAll('input').property('value', '')
		const data = processKnotsInputs(self)
		// update self.q.custom_knots_lst and render bin lines only if bin boundry changed
		const q = self.numqByTermIdModeType[self.term.id]['cubic-spline'][self.q.type]
		if (binsChanged(data, q.custom_knots_lst)) {
			q.custom_knots_lst = data
			self.renderBinLines(self, q)
		}
		renderKnotInputDivs(self, q.custom_knots_lst)
		self.q = q
	}

	function binsChanged(data, qlst) {
		if (data.length != qlst.length) return true
		if (Object.keys(data[0]).length !== Object.keys(qlst[0]).length) return true
		for (const [i, bin] of qlst.entries()) {
			for (const k of Object.keys(bin)) {
				if (bin[k] && bin[k] !== data[i][k]) {
					return true
				}
			}
		}
		return false
	}

	self.dom.customBinLabelTd = tr.append('td')
	renderKnotInputDivs(self, self.q.custom_knots_lst)
}

function renderKnotInputDivs(self, data) {
	self.dom.customBinLabelTd.selectAll('div').remove('*')
	const inputDivs = self.dom.customBinLabelTd.selectAll('div').data(data)
	inputDivs.exit().remove()
	inputDivs.each(function(d, i) {
		select(this)
			.select('span')
			.html('Knot ' + (i + 1) + '&nbsp;')
		select(this)
			.select('input')
			.property('value', d.label)
	})
	inputDivs
		.enter()
		.append('div')
		.each(function(d, i) {
			select(this)
				.append('span')
				.style('color', 'rgb(136, 136, 136)')
				.html('Knot ' + (i + 1) + '&nbsp;')
			select(this)
				.append('input')
				.attr('type', 'text')
				.property('value', d.label)
				.on('change', function() {
					self.q.custom_knots_lst[i].label = this.value
				})
		})

	self.dom.customBinLabelInput = self.dom.customBinLabelTd.selectAll('input')
}

function processKnotsInputs(self) {
	const inputDivs = self.dom.customBinLabelTd.node().querySelectorAll('div')
	let prevBin
	const data = self.dom.customBinBoundaryInput
		.property('value')
		.split('\n')
		.filter(d => d != '')
		.map(d => +d)
		.sort((a, b) => a - b)
		.map((d, i) => {
			const bin = {
				start: +d
			}
			if (prevBin) {
				const label = inputDivs[i - 1].querySelector('input').value
				prevBin.label = label ? label : prevBin.start ? prevBin.start : ''
			}
			prevBin = bin
			return bin
		})

	const label = inputDivs[data.length] && inputDivs[data.length].querySelector('input').value
	prevBin.label = label ? label : data[data.length - 1].start

	if (!data[0].label) data[0].label = data[0].start || ''
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

function applyEdits(self){
	// TODO: apply edits to self.q
}
