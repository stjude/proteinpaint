import { setDensityPlot } from './density'
import { renderBoundaryInclusionInput, renderBoundaryInputDivs } from './numeric.discrete'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import { make_one_checkbox, violinRenderer } from '#dom'
import { getPillNameDefault } from '../termsetting'
import { convertViolinData } from '#filter/tvs.numeric'
import type { PillData, NumericBin } from '#types'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	getPillName() // Print term name in the pill
	getPillStatus() // Returns righthalf pill text as 'binary'
	showEditMenu(div) // binary edit menu
		setqDefaults(self)
		setDensityPlot(self)
		renderBoundaryInclusionInput(self) // 'start < x <= end' OR 'start <= x < end'
		renderCuttoffInput(self) // render edit UI for cutoff values and bin labels
			handleChange() // call when cutoff value is changed
			updateUI(cutoff) // update density plot and inputs based on new value 
			handleCheckbox() // checkbox for percentile
		renderBoundaryInputDivs(self, self.q.lst) // bin labels
********************** INTERNAL
	processCustomBinInputs()
*/

export function getHandler(self) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			return {
				text:
					self.usecase?.target == 'regression' ? self.data.q.lst.find(x => x.label != self.data.refGrp).label : 'binary'
			}
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
			const d = await self.vocabApi.getViolinPlotData(
				{
					tw: { term: self.term, q: self.q },
					filter: self.filter,
					filter0: self.vocabApi.state?.termfilter?.filter0, // this is in sync with mass. do not use the one from vocabApi.opts which is initial state and is out of sync with changes
					svgw: self.num_obj.plot_size.width / window.devicePixelRatio
				},
				self.opts.getBodyParams?.()
			)
			self.num_obj.density_data = convertViolinData(d)
			self.dom.num_holder = div
			div.selectAll('*').remove()
			self.dom.density_div = div.append('div')
			self.vr = new violinRenderer(
				self.dom.density_div,
				self.num_obj.density_data,
				self.num_obj.plot_size.width,
				self.num_obj.plot_size.height
			)
			self.num_obj.svg = self.vr.svg
			self.dom.bins_div = div.append('div').style('padding', '4px')

			setqDefaults(self)
			setDensityPlot(self)
			renderBoundaryInclusionInput(self)

			// cutoff input
			self.dom.cutoff_div = self.dom.bins_div.append('div').style('margin', '10px')
			renderCuttoffInput(self)

			self.dom.bins_table = self.dom.bins_div
				.append('div')
				.style('display', 'flex')
				.style('color', 'rgb(136, 136, 136)')
				.style('margin', '10px')
				.style('width', '100%')

			self.dom.rangeAndLabelDiv = self.dom.bins_table.append('div')

			renderBoundaryInputDivs(self, self.q.lst)

			const btndiv = div.append('div').style('padding', '3px 10px')

			btndiv
				.append('button')
				.style('margin', '5px')
				.html('Apply')
				.on('click', async () => {
					delete self.q.startinclusive
					delete self.q.stopinclusive
					delete self.q.bin_size
					delete self.q.first_bin
					delete self.q.last_bin
					self.q.lst = processCustomBinInputs(self)
					self.numqByTermIdModeType[self.term.id].binary = JSON.parse(JSON.stringify(self.q))
					self.q.mode = 'binary'
					self.api.runCallback()
				})

			btndiv
				.append('button')
				.style('margin', '5px')
				.html('Reset')
				.on('click', () => {
					// delete self.q and create new with default
					// TODO: rightnow reset will devide bins at max-min/2 as per logic at line 134
					// if it must be reset at median, the logic must be changned
					// delete self.q
					self.q = {}
					delete self.numqByTermIdModeType[self.term.id]
					getHandler(self).showEditMenu(self.dom.num_holder)
				})
		}
	}
}

function setqDefaults(self) {
	const dd = self.num_obj.density_data!
	const boundry_value = self.q && self.q.lst && self.q.lst.length ? self.q.lst[0].stop : undefined
	const cache = self.numqByTermIdModeType
	if (!self.term) throw `Missing .term{} [numeric.binary, setqDefaults()]`
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id].binary) {
		// automatically derive a cutoff to generate binary bins
		const cutoff =
			boundry_value !== undefined
				? Number(boundry_value)
				: dd.maxvalue != dd.minvalue
				? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2
				: dd.maxvalue

		cache[t.id].binary = {
			mode: 'binary',
			type: 'custom-bin',
			modeBinaryCutoffType: 'normal', // default value
			modeBinaryCutoffPercentile: 50, // default value
			lst: [
				{
					startunbounded: true,
					stopinclusive: true,
					stop: cutoff.toFixed(self.term.type == 'integer' ? 0 : 2)
				},
				{
					stopunbounded: true,
					start: cutoff.toFixed(self.term.type == 'integer' ? 0 : 2)
				}
			]
		}
	}

	if (!self.q || self.q.mode !== 'binary') self.q = {}
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id].binary))
	self.q = Object.assign(cacheCopy, self.q)
	if (self.q.lst) {
		self.q.lst.forEach(bin => {
			if (!('label' in bin)) bin.label = get_bin_label(bin, self.q)
			if (!('range' in bin)) bin.range = get_bin_range_equation(bin, self.q)
		})
	}
	//*** validate self.q ***//
}

async function renderCuttoffInput(self) {
	// binary mode unqiue UI
	self.dom.cutoff_div.append('span').style('margin-right', '5px').style('opacity', 0.5).text('Boundary value')

	/* known bug:
	when percentile checkbox is checked,
	after entering new percentile value to <input>,
	must press Enter to apply;
	click Apply without Enter may not apply the change
	*/
	self.dom.customBinBoundaryInput = self.dom.cutoff_div
		.append('input')
		.style('width', '100px')
		.attr('type', 'number')
		.style('margin-right', '10px')
		.attr('value', self.q.modeBinaryCutoffType == 'normal' ? self.q.lst![0].stop : self.q.modeBinaryCutoffPercentile)
		.on('change', handleChange)

	self.dom.customBinBoundaryPercentileCheckbox = make_one_checkbox({
		holder: self.dom.cutoff_div,
		labeltext: 'Use percentile',
		checked: self.q.modeBinaryCutoffType == 'percentile',
		divstyle: { display: 'inline-block' },
		callback: handleCheckbox
	})

	async function handleChange(this: any) {
		const value: number = +this.value
		if (self.q.modeBinaryCutoffType == 'normal') {
			updateUI(value)
		} else if (self.q.modeBinaryCutoffType == 'percentile') {
			// using percentile, value is a percentile number
			if (value < 1 || value > 99) {
				window.alert('Invalid percentile value: enter integer between 1 and 99')
				return
			}
			self.q.modeBinaryCutoffPercentile = value
			await setPercentile()
		} else {
			throw 'invalid modeBinaryCutoffType value'
		}
	}

	function updateUI(cutoff: number) {
		// cutoff is the actual data value, not percentile
		self.q.lst![0].stop = cutoff
		self.q.lst![1].start = cutoff
		self.q.lst!.forEach(bin => {
			bin.label = get_bin_label(bin, self.q)
			bin.range = get_bin_range_equation(bin, self.q)
		})
		if (!self.num_obj) throw `Missing density data [numeric.binary updateUI()]`
		setDensityPlot(self)
		renderBoundaryInputDivs(self, self.q.lst)
	}

	async function handleCheckbox() {
		self.q.modeBinaryCutoffType = self.q.modeBinaryCutoffType == 'percentile' ? 'normal' : 'percentile'
		if (self.q.modeBinaryCutoffType == 'normal') {
			const v = self.q.lst![0].stop as number
			self.dom.customBinBoundaryInput.property('value', v)
			updateUI(v)
		} else if (self.q.modeBinaryCutoffType == 'percentile') {
			// switched to percentile
			self.dom.customBinBoundaryInput.property('value', self.q.modeBinaryCutoffPercentile)
			await setPercentile()
		} else {
			throw 'invalid modeBinaryCutoffType value'
		}
	}
	async function setPercentile() {
		const data = await self.opts.vocabApi.getPercentile(
			self.term,
			[self.q.modeBinaryCutoffPercentile!],
			self.vocabApi.state?.termfilter
		)
		updateUI(data.values[0])
	}
}

function processCustomBinInputs(self) {
	const startinclusive = self.dom.boundaryInput.property('value') == 'startinclusive'
	const stopinclusive = self.dom.boundaryInput.property('value') == 'stopinclusive'
	const inputDivs = self.dom.bins_table.node().querySelectorAll('input')
	//let prevBin
	const val = self.q.lst![0].stop // should not get value from dom.customBinBoundaryInput as value can be percentile
	if (!val && val !== 0) throw 'val is undefined'

	const bins: NumericBin[] = [
		{
			startunbounded: true,
			stop: Number(val),
			startinclusive: false,
			stopinclusive
		},
		{
			start: Number(val),
			startinclusive,
			stopinclusive: false,
			stopunbounded: true
		}
	]

	for (const [i, bin] of bins.entries()) {
		// may use user assigned labels if not empty string
		const label = inputDivs[i].value
		bin.label = label ? label : get_bin_label(bin, self.q)
	}

	return bins
}
