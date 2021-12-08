import { select, event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'
import { init_tabs } from '../dom/toggleButtons'
import { keyupEnter } from '../client'

// self is the termsetting instance
export function getHandler(self) {``
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
				auto_knots_lst: []
			},
			'custom-knots': {
				type: 'custom-knots',
				custom_knots_lst: [
					{
						value: +defaultCustomBoundary.toFixed(t.type == 'integer' ? 0 : 2)
					}
				]
			}
		}

		const auto_knots_count = 4
		const auto_knots_lst = cache[t.id]['cubic-spline']['auto-knots'].auto_knots_lst
		for(let i = 1; i < auto_knots_count + 1 ; i++)
			auto_knots_lst.push({ value: (default_first_knot*i).toFixed(t.type == 'integer' ? 0 : 2) })
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
			label: 'Number of knots',
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
			label: 'Custom knots list',
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
		.html('Number of knots')

	const knot_ct_select = self.dom.knot_select_div.append('select')
		.style('margin-left', '15px')
		.style('margin-bottom', '7px')
		.on('change', () => {
			knot_caclualte_btn
				.property('disabled', knot_count == knot_ct_select.node().value)
			// TODO: cacluate knots based on dropdown count
			// const auto_knots_count = knot_ct_select.node().value
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
function renderCustomSplineInputs(self, div) {
	self.dom.custom_knots_div = div.append('div')
	
	self.dom.custom_knots_div
		.append('div')
		.style('padding', '3px 15px')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Knots')

	self.dom.customKnotsInput = self.dom.custom_knots_div
		.append('div')
		.style('padding', '3px 15px')
		.append('textarea')
		.style('height', '100px')
		.style('width', '100px')
		.text(
			self.q.custom_knots_lst
				.map(d => d.value)
				.join('\n')
		)
		.on('change', handleChange)
		.on('keyup', async () => {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter() && event.key != 8) return
			handleChange.call(this)
		})

	self.dom.custom_knots_div.append('div')
		.style('font-size', '.8em')
		.style('padding', '3px 15px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Note: Press \'Enter\' key after adding each knot.')	

	function handleChange() {
		const data = processKnotsInputs(self)
		// update self.q.custom_knots_lst and render knot lines only if knot values changed
		const q = self.numqByTermIdModeType[self.term.id]['cubic-spline'][self.q.type]
		if (knotsChanged(data, q.custom_knots_lst)) {
			q.custom_knots_lst = data
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
