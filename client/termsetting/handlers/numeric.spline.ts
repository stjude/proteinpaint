import { setDensityPlot } from './density'
import { keyupEnter } from '#src/client'
import { getPillNameDefault } from '../utils.ts'
import { convertViolinData } from '#filter/tvs.numeric'
import type { NumericQ } from '#types'
import { violinRenderer } from '#dom'
/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	showEditMenu(div): content/inputs to show for editing cubic spline knots
	- sequence of function calls:
		setqDefaults() // set self.q from self.numqByTermIdModeType or if not prsent create default self.q
		setDensityPlot() // create density plot and set knot lines
		renderEditMenu() // render knot edit menu
		renderButtons() // apply and reset buttons

********************** INTERNAL
setqDefaults()
renderEditMenu()
	renderCustomSplineInputs() // knots list as textarea input, displaying auto knots can be edited and apply
		updateCustomSplineInputs() // apply custom knots if changed from density plot to textarea
		processKnotsInputs() // apply custom knots to self.q.knots
	renderAutoSplineInputs() // dropdown for knots count to get auto knots
		getKnots() // get autoknots for given knots count. e.g. 1st knot at 5 percentile, 
		           // last at 95 and devide inbetween at equal percentile
	renderButtons()
	applyEdits() // when apply button clicked
*/

export function getHandler(self) {
	return {
		getPillName(d: any) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			return { text: 'cubic spline' }
		},

		async showEditMenu(div: any) {
			self.num_obj = {}

			self.num_obj.plot_size = {
				width: 500,
				height: 100,
				xpad: 10,
				ypad: 20
			}
			div.selectAll('*').remove()
			div
				.append('div')
				.style('padding', '10px')
				.style('text-align', 'center')
				.html('Getting distribution data ...<br/>')
			try {
				const d = await self.vocabApi.getViolinPlotData(
					{
						tw: { term: self.term, q: self.q },
						svgw: self.num_obj.plot_size.width
					},
					self.opts.getBodyParams?.()
				)
				self.num_obj.density_data = convertViolinData(d)
			} catch (err) {
				console.log(err)
			}
			div.selectAll('*').remove()
			self.dom.density_div = div.append('div')
			self.vr = new violinRenderer(
				self.dom.density_div,
				self.num_obj.density_data,
				self.num_obj.plot_size.width,
				self.num_obj.plot_size.height
			)
			self.num_obj.svg = self.vr.svg
			self.dom.num_holder = div
			self.dom.knots_div = div.append('div').style('padding', '5px')
			await setqDefaults(self)
			setDensityPlot(self)
			// renderTypeInputs(self)
			renderEditMenu(self)
			renderButtons(self)
		}
	}
}

async function setqDefaults(self) {
	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id]['spline']) {
		cache[t.id]['spline'] = {
			mode: 'spline',
			knots: []
		}
	}

	// const knots = cache[t.id]['spline'].knots
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id]['spline']))
	self.q = Object.assign(cacheCopy, self.q)
	// create default knots when menu renderes for first time
	if (!self.q.knots.length) {
		const default_knots_count = 4
		await getKnots(self, default_knots_count)
		self.numqByTermIdModeType[self.term.id]['spline'].knots = self.q.knots
	}
	//*** validate self.q ***//
}

function renderEditMenu(self) {
	const edit_div = self.dom.knots_div
	renderCustomSplineInputs(self, edit_div)
	renderAutoSplineInputs(self, edit_div)
}

/******************* Functions for Custom Spline knots *******************/
function renderCustomSplineInputs(self, div: any) {
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
		.text(self.q.knots.map((d: any) => d.value).join('\n'))
		.on('change', handleChange)
		.on('keyup', async function (this: any, event: any) {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter(event) && event.key != 8) return
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
		// update self.q.knots and render knot lines only if knot values changed
		const q = self.q
		if (knotsChanged(data, q.knots)) {
			q.knots = data
			self.renderBinLines(self, q as NumericQ)
		}
		self.q = q
	}

	function knotsChanged(data: any, qlst: any) {
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

// apply custom knots if changed from density plot to textarea
function updateCustomSplineInputs(self) {
	self.dom.customKnotsInput.property('value', self.q.knots.map((d: any) => d.value).join('\n'))
}

// apply custom knots to self.q.knots
function processKnotsInputs(self) {
	const data = self.dom.customKnotsInput
		.property('value')
		.split('\n')
		.filter((d: any) => d != '')
		.map((d: any) => +d)
		.sort((a: any, b: any) => a - b)
		.map((d: any) => {
			const knot = {
				value: +d
			}
			return knot
		})
	return data
}

/******************* Functions for Auto Spline knots *******************/
function renderAutoSplineInputs(self, div: any) {
	const knot_count = 4
	const default_knot_count = knot_count
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

	for (let i = default_knot_count - 1; i < default_knot_count + 5; i++) {
		knot_ct_select.append('option').attr('value', i).html(i)
	}

	const knots_count = self.q.knots && self.q.knots.length ? self.q.knots.length : default_knot_count
	knot_ct_select.node().value = knots_count

	self.dom.knot_select_div
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '10px')
		.style('color', 'rgb(136, 136, 136)')
		.html('knots')

	self.dom.knot_select_div
		.append('button')
		.style('margin', '15px')
		// .property('disabled', knot_count == knot_ct_select.node().value)
		.html('Compute')
		.on('click', async () => {
			const desired_knots_ct = Number.parseInt(knot_ct_select.node().value)
			let requested_knots_ct = Number.parseInt(knot_ct_select.node().value)
			// request knots util desired_knots are available
			while (self.q.knots.length != desired_knots_ct) {
				await getKnots(self, requested_knots_ct)
				requested_knots_ct = requested_knots_ct + 1
			}
			updateCustomSplineInputs(self)
			setDensityPlot(self)
		})

	self.dom.knot_select_div
		.append('div')
		.style('display', 'inline-block')
		.style('font-size', '.7em')
		.style('padding', '3px 15px')
		.style('padding-left', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Will overwrite existing values.')
}

async function getKnots(self, knot_count: any) {
	// qnery knots from backend
	// knots are calcualted by node backend, 1st knot at 5 percentile,
	// last knot at 95, and inbetween knots at equidistance
	const middle_knot_count = knot_count - 2
	const t = self.term
	const knots: any = (self.q.knots = [])
	const percentile_lst = [5]
	const second_knot_perc: any = (90 / (middle_knot_count + 1)).toFixed(0)
	for (let i = 1; i < middle_knot_count + 1; i++) {
		percentile_lst.push(i * second_knot_perc)
	}
	percentile_lst.push(95)
	const values: any = await getPercentile2Value(self, percentile_lst)
	for (const val of values) {
		knots.push({ value: val.toFixed(t.type == 'integer' ? 0 : 2) })
	}
}

async function getPercentile2Value(self, percentile_lst: any) {
	const data = await self.vocabApi.getPercentile(self.term, percentile_lst, self.vocabApi.state?.termfilter)
	if (data.error || !data.values.length || !data.values.every(v => Number.isFinite(v)))
		throw 'cannot get median value: ' + (data.error || 'no data')
	const perc_values = [...new Set(data.values)]
	return perc_values
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
			// delete self.q
			self.q = {}
			delete self.numqByTermIdModeType[self.term.id]
			self.handler = getHandler(self)
			self.handler.showEditMenu(self.dom.num_holder)
		})
}

function applyEdits(self) {
	self.q.mode = 'spline'
	self.dom.tip.hide()
	self.api.runCallback()
}
