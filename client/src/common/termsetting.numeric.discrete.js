import { keyupEnter } from '../client'
import { select, event } from 'd3-selection'
import { format } from 'd3-format'
import { setDensityPlot } from './termsetting.density'
import { get_bin_label, get_bin_range_equation } from '../../shared/termdb.bins'
import { init_tabs } from '../dom/toggleButtons'
import { make_radios } from '../dom/radiobutton'
import { getPillNameDefault } from './termsetting'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	getPillName()
	getPillStatus()

	showEditMenu(div): regular/custom bin config menu
	- sequence of function calls:
		setqDefaults() // set self.q from self.numqByTermIdModeType or if not prsent create default self.q
		setDensityPlot() // create density plot and set bin lines
		renderBoundaryInclusionInput() // start <= x < end OR start < x <= end
		renderTypeInputs() // 'same bin size' and 'Varying bin sizes' tabs with edit UI
		renderButtons() // 'apply' and 'reset' buttons

renderBoundaryInputDivs() //custom bin name inputs

********************** INTERNAL
	applyEdits() // when apply button clicked
**** Functions for Numerical Fixed size bins ****
	renderFixedBinsInputs() // render Fixed Bins Inputs
		renderBinSizeInput() // render BinSize Input
		renderFirstBinInput() // render First Bin Input
		renderLastBinInputs() // render Last Bin Inputs
**** Functions for Numerical Custom size bins ****
	renderCustomBinInputs() // render Custom Bin Inputs
		handleChange() // update self.q if custom inputs changed
		binsChanged() // check if bins changed from input or return
		processCustomBinInputs() // create or update self.q from custom bins inputs
*/

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName(d) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (self.q.type == 'regular-bin') return { text: 'bin size=' + self.q.bin_size }
			return { text: self.q.lst.length + ' bins' }
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
			self.dom.bins_div = div.append('div').style('padding', '5px')
			setqDefaults(self)
			setDensityPlot(self)
			renderBoundaryInclusionInput(self)
			renderTypeInputs(self)
			renderButtons(self)
		}
	}
}

function applyEdits(self) {
	if (self.q.type == 'regular-bin') {
		self.q.first_bin.startunbounded = true
		self.q.first_bin.stop = +self.dom.first_stop_input.property('value')
		self.q.startinclusive = self.dom.boundaryInput.property('value') == 'startinclusive'
		self.q.stopinclusive = self.dom.boundaryInput.property('value') == 'stopinclusive'
		const bin_size = self.dom.bin_size_input.property('value')
		self.q.bin_size = Number(bin_size)
		if (bin_size.includes('.') && !bin_size.endsWith('.')) {
			self.q.rounding = '.' + bin_size.split('.')[1].length + 'f'
		} else {
			self.q.rounding = '.0f'
		}
		// don't forward scaling factor from continuous termsetting
		if (self.q.scale) delete self.q.scale
		if (self.dom.last_radio_auto.property('checked')) {
			delete self.q.last_bin
		} else {
			if (!self.q.last_bin) self.q.last_bin = {}
			self.q.last_bin.start = +self.dom.last_start_input.property('value')
			self.q.last_bin.stopunbounded = true
		}
		self.numqByTermIdModeType[self.term.id].discrete['regular-bin'] = JSON.parse(JSON.stringify(self.q))
	} else {
		self.q.lst = processCustomBinInputs(self)
		self.numqByTermIdModeType[self.term.id].discrete['custom-bin'] = JSON.parse(JSON.stringify(self.q))
	}
	self.q.mode = 'discrete'
	self.dom.tip.hide()
	self.runCallback()
}

function processCustomBinInputs(self) {
	const startinclusive = self.dom.boundaryInput.property('value') == 'startinclusive'
	const stopinclusive = self.dom.boundaryInput.property('value') == 'stopinclusive'
	const inputDivs = self.dom.customBinLabelDiv.node().querySelectorAll('div')
	let prevBin
	const inputData = self.dom.customBinBoundaryInput
		.property('value')
		.split('\n')
		.filter(d => d != '' && !isNaN(d))

	const trackBins = new Set()
	inputData.filter(d => !trackBins.has(d)).forEach(d => trackBins.add(d))
	const data = Array.from(trackBins)
		.map(d => +d)
		.sort((a, b) => a - b)
		.map((d, i) => {
			const bin = {
				start: +d,
				startinclusive,
				stopinclusive
			}
			if (prevBin) {
				delete prevBin.stopunbounded
				prevBin.stop = bin.start
				const label = inputDivs[i].querySelector('input').value
				prevBin.label = label ? label : get_bin_label(prevBin, self.q)
				prevBin.range = get_bin_range_equation(prevBin, self.q)
			}
			prevBin = bin
			return bin
		})

	prevBin.stopunbounded = true
	const label = inputDivs[data.length] && inputDivs[data.length].querySelector('input').value
	prevBin.label = label ? label : get_bin_label(prevBin, self.q)
	prevBin.range = get_bin_range_equation(prevBin, self.q)

	data.unshift({
		startunbounded: true,
		stop: data[0].start,
		startinclusive,
		stopinclusive,
		label: inputDivs[0].querySelector('input').value
	})
	if (!data[0].label) data[0].label = get_bin_label(data[0], self.q)
	if (!data[0].range) data[0].range = get_bin_range_equation(data[0], self.q)
	return data
}

function setqDefaults(self) {
	const dd = self.num_obj.density_data
	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id].discrete) {
		const defaultCustomBoundary =
			dd.maxvalue != dd.minvalue ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2 : dd.maxvalue

		cache[t.id].discrete = {
			'regular-bin':
				self.q && self.q.type == 'regular-bin'
					? JSON.parse(JSON.stringify(self.q))
					: self.opts.use_bins_less && t.bins.less
					? JSON.parse(JSON.stringify(t.bins.less))
					: JSON.parse(JSON.stringify(t.bins.default)),
			'custom-bin':
				self.q && self.q.type == 'custom-bin'
					? self.q
					: {
							type: 'custom-bin',
							mode: 'discrete',
							lst: [
								{
									startunbounded: true,
									startinclusive: true,
									stopinclusive: false,
									stop: +defaultCustomBoundary.toFixed(t.type == 'integer' ? 0 : 2)
								},
								{
									stopunbounded: true,
									startinclusive: true,
									stopinclusive: false,
									start: +defaultCustomBoundary.toFixed(t.type == 'integer' ? 0 : 2)
								}
							]
					  }
		}
		if (!cache[t.id].discrete['regular-bin'].type) {
			cache[t.id].discrete['regular-bin'].type = 'regular-bin'
		}
	}

	//if (self.q && self.q.type && Object.keys(self.q).length>1) return
	if (self.q && !self.q.mode) self.q.mode = 'discrete'
	if (!self.q || self.q.mode !== 'discrete') self.q = {}
	if (!self.q.type) self.q.type = 'regular-bin'
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id].discrete[self.q.type]))
	self.q = Object.assign(cacheCopy, self.q)
	const bin_size = 'bin_size' in self.q && self.q.bin_size.toString()
	if (!self.q.rounding && typeof bin_size == 'string' && bin_size.includes('.') && !bin_size.endsWith('.')) {
		const binDecimals = bin_size.split('.')[1].length
		self.q.rounding = '.' + binDecimals + 'f'
	}
	if (self.q.lst) {
		self.q.lst.forEach((bin, i) => {
			if (!('label' in bin)) bin.label = get_bin_label(bin, self.q)
			if (!('range' in bin)) bin.range = get_bin_range_equation(bin, self.q)
		})
	}
	//*** validate self.q ***//
}

export function renderBoundaryInclusionInput(self) {
	self.dom.boundaryInclusionDiv = self.dom.bins_div.append('div').style('margin-left', '5px')

	self.dom.boundaryInclusionDiv
		.append('span')
		.style('padding', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Boundary Inclusion')

	const x = '<span style="font-family:Times;font-style:italic">x</span>'

	self.dom.boundaryInput = self.dom.boundaryInclusionDiv
		.append('select')
		.style('margin-left', '10px')
		.on('change', function() {
			const c =
				self.q.mode == 'binary'
					? self.numqByTermIdModeType[self.term.id].binary
					: self.numqByTermIdModeType[self.term.id].discrete[self.q.type]
			if (c.type == 'regular-bin') {
				setBinsInclusion(c)
			} else {
				c.lst.forEach((bin, i) => {
					setBinsInclusion(bin)
					bin.label = get_bin_label(bin, self.q)
					bin.range = get_bin_range_equation(bin, self.q)
				})
				renderBoundaryInputDivs(self, c.lst)
			}

			function setBinsInclusion(par) {
				par.startinclusive = self.dom.boundaryInput.node().selectedIndex == 1
				par.stopinclusive = self.dom.boundaryInput.node().selectedIndex == 0
			}
		})

	self.dom.boundaryInput
		.selectAll('option')
		.data([
			{ value: 'stopinclusive', html: 'start &lt; ' + x + ' &le; end' },
			{ value: 'startinclusive', html: 'start &le; ' + x + ' &lt; end' }
		])
		.enter()
		.append('option')
		.property('value', d => d.value)
		.property('selected', d => {
			if (self.q.type == 'regular-bin') return self.q[d.value] == true
			else return self.q.lst[0][d.value] == true
		})
		.html(d => d.html)
}

function renderTypeInputs(self) {
	// toggle switch
	const bins_div = self.dom.bins_div
	const div = self.dom.bins_div.append('div').style('margin', '10px')
	const tabs = [
		{
			active: self.q.type == 'regular-bin' ? true : false,
			label: 'Same bin size',
			callback: async div => {
				self.q.type = 'regular-bin'
				self.dom.bins_div = bins_div
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[0].isInitialized) {
					renderFixedBinsInputs(self, div)
					tabs[0].isInitialized = true
				}
			}
		},
		{
			active: self.q.type == 'custom-bin' ? true : false,
			label: 'Varying bin sizes',
			callback: async div => {
				self.q.type = 'custom-bin'
				self.dom.bins_div = bins_div
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[1].isInitialized) {
					renderCustomBinInputs(self, div)
					tabs[1].isInitialized = true
				}
			}
		}
	]
	init_tabs({ holder: div, tabs })
}

/******************* Functions for Numerical Fixed size bins *******************/
function renderFixedBinsInputs(self, tablediv) {
	self.dom.bins_table = tablediv.append('table')
	renderBinSizeInput(self, self.dom.bins_table.append('tr'))
	renderFirstBinInput(self, self.dom.bins_table.append('tr'))
	renderLastBinInputs(self, self.dom.bins_table.append('tr'))
}

function renderBinSizeInput(self, tr) {
	tr.append('td')
		.style('margin', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Bin Size')

	const dd = self.num_obj.density_data
	const origBinSize = self.q.bin_size

	self.dom.bin_size_input = tr
		.append('td')
		.append('input')
		.attr('type', 'number')
		.attr('value', 'rounding' in self.q ? format(self.q.rounding)(self.q.bin_size) : self.q.bin_size)
		.style('margin-left', '15px')
		.style('width', '100px')
		.style('color', d => (self.q.bin_size > Math.abs(dd.maxvalue - dd.minvalue) ? 'red' : ''))
		.on('change', handleChange)
		.on('keyup', function() {
			if (!keyupEnter()) return
			handleChange.call(this)
		})

	function handleChange() {
		self.q.bin_size = +this.value
		select(this).style(
			'color',
			self.q.bin_size > Math.abs(dd.maxvalue - dd.minvalue) ? 'red' : +this.value != origBinSize ? 'green' : ''
		)
		setDensityPlot(self)
	}

	tr.append('td')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.text('Green text indicates an edited value, red indicates size larger than the current term value range')
}

function renderFirstBinInput(self, tr) {
	//const brush = self.num_obj.brushes[0]
	if (!self.q.first_bin) self.q.first_bin = {}
	tr.append('td')
		.style('margin', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('First Bin Stop')

	self.dom.first_stop_input = tr
		.append('td')
		.append('input')
		.attr('type', 'number')
		.property('value', 'stop' in self.q.first_bin ? self.q.first_bin.stop : '')
		.style('width', '100px')
		.style('margin-left', '15px')
		.style('color', self.q.first_bin && self.q.first_bin.stop < self.num_obj.density_data.minvalue ? 'red' : '')
		.on('change', handleChange)
		.on('keyup', function() {
			if (!keyupEnter()) return
			handleChange.call(this)
		})

	tr.append('td')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.html('<b>Left most</b>red line indicates the first bin stop. <br> Drag that line to edit this value.')

	function handleChange() {
		self.q.first_bin.stop = +self.dom.first_stop_input.property('value')
		self.dom.first_stop_input.restyle()
		self.renderBinLines(self, self.q)
	}

	const origFirstStop = self.q.first_bin.stop
	self.dom.first_stop_input.restyle = () => {
		self.dom.first_stop_input.style(
			'color',
			self.q.first_bin.stop < self.num_obj.density_data.minvalue
				? 'red'
				: self.q.first_bin.stop != origFirstStop
				? 'green'
				: ''
		)
	}
}

function renderLastBinInputs(self, tr) {
	const isAuto = !self.q.last_bin || Object.keys(self.q.last_bin).length === 0

	tr.append('td')
		.style('margin', '5px')
		.style('color', 'rgb(136, 136, 136)')
		.html('Last Bin Start')

	const td1 = tr
		.append('td')
		.style('padding-left', '15px')
		.style('vertical-align', 'top')
	const radio_div = td1.append('div')

	const { divs, labels, inputs } = make_radios({
		holder: radio_div,
		options: [
			{ label: 'Automatic', value: 'auto', checked: isAuto },
			{ label: 'Fixed', value: 'fixed', checked: !isAuto }
		],
		callback: v => {
			if (v == 'auto') {
				delete self.q.last_bin.start
				edit_div.style('display', 'none')
			} else if (v == 'fixed') {
				if (!self.q.last_bin) self.q.last_bin = {}
				if (!('start' in self.q.last_bin)) {
					// default to setting the last bin start to max value,
					// so that it will be dragged to the left by default
					self.q.last_bin.start = self.num_obj.density_data.maxvalue
				}
				self.dom.last_start_input.property('value', self.q.last_bin.start)
				const value = +self.dom.last_start_input.property('value')
				self.q.last_bin.start = value
				edit_div.style('display', 'inline-block')
			}
			handleChange()
			setDensityPlot(self)
		},
		styles: {
			padding: '0 10px'
		}
	})

	self.dom.last_radio_auto = select(inputs.nodes()[0])

	const edit_div = tr
		.append('td')
		.append('div')
		.style('display', isAuto ? 'none' : 'inline-block')

	self.dom.last_start_input = edit_div
		.append('input')
		.attr('type', 'number')
		.property('value', self.q.last_bin ? self.q.last_bin.start : '')
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('change', handleChange)
		.on('keyup', function() {
			if (!keyupEnter()) return
			handleChange.call(this)
		})

	// note div
	tr.append('td')
		.style('display', 'none')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('padding-top', '30px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.html('<b>Right</b>most red line indicates the last bin start. <br> Drag that line to edit this value.')

	function handleChange() {
		self.q.last_bin.start = +self.dom.last_start_input.property('value')
		self.dom.last_start_input.restyle()
		self.renderBinLines(self, self.q)
		if (self.dom.last_radio_auto.property('checked')) {
			delete self.q.last_bin.start
			edit_div.style('display', 'none')
		}
	}

	const origLastStart = self.q.last_bin ? self.q.last_bin.start : null
	self.dom.last_start_input.restyle = () => {
		self.dom.last_start_input.style(
			'color',
			self.q.last_bin.start > self.num_obj.density_data.maxvalue
				? 'red'
				: self.q.last_bin.start != origLastStart
				? 'green'
				: ''
		)
	}
}

/******************* Functions for Numerical Custom size bins *******************/
function renderCustomBinInputs(self, tablediv) {
	self.dom.bins_table = tablediv.append('table')
	const thead = self.dom.bins_table.append('thead').append('tr')
	thead
		.append('th')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Bin Boundaries')
	thead
		.append('th')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Range')
	thead
		.append('th')
		.style('font-weight', 'normal')
		.style('color', 'rgb(136, 136, 136)')
		.html('Bin Label')
	self.dom.customBintbody = self.dom.bins_table.append('tbody')
	const tr = self.dom.customBintbody.append('tr')

	const binBoundaryTd = tr.append('td')

	self.dom.customBinBoundaryInput = binBoundaryTd
		.append('textarea')
		.style('height', '100px')
		.style('width', '100px')
		.text(
			self.q.lst
				.slice(1)
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

	// help note
	binBoundaryTd
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.html('Enter numeric values </br>seperated by ENTER')

	function handleChange() {
		self.dom.customBinLabelDiv.selectAll('input').property('value', '')
		const data = processCustomBinInputs(self)
		// update self.q.lst and render bin lines only if bin boundry changed
		const q = self.numqByTermIdModeType[self.term.id].discrete[self.q.type]
		if (self.q.hiddenValues) q.hiddenValues = self.q.hiddenValues
		if (binsChanged(data, q.lst)) {
			q.lst = data
			self.renderBinLines(self, q)
		}
		renderBoundaryInputDivs(self, q.lst)
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

	self.dom.customBinRangeTd = tr.append('td').style('vertical-align', 'top')
	const customBinLabelTd = tr.append('td').style('vertical-align', 'top')
	self.dom.customBinLabelDiv = customBinLabelTd.append('div')
	renderBoundaryInputDivs(self, self.q.lst)

	// add help message for custom bin labels
	customBinLabelTd
		.append('span')
		.style('font-size', '.6em')
		.style('margin', '3px')
		.style('color', '#858585')
		.html('Enter optional label for each range')
}

export function renderBoundaryInputDivs(self, data) {
	// TODO: follwing code can be improved by using flex rather than table and td
	// bin range equations, read-only
	// get bin range equation using get_bin_range_equation()
	const rangeDivs = self.dom.customBinRangeTd.selectAll('div').data(data)

	rangeDivs.exit().remove()
	rangeDivs.each(function(d, i) {
		select(this).html(d.range)
	})

	rangeDivs
		.enter()
		.append('div')
		.style('margin', '9px')
		.each(function(d, i) {
			select(this)
				.style('color', 'rgb(136, 136, 136)')
				.html(d.range)
		})

	self.dom.customBinRanges = self.dom.customBinRangeTd.selectAll('div')

	// bin label inputs, start with label, use can edit labels and apply changes
	const inputDivs = self.dom.customBinLabelDiv.selectAll('div').data(data)
	inputDivs.exit().remove()
	inputDivs.each(function(d, i) {
		select(this)
			.select('input')
			.property('value', d.label)
	})
	inputDivs
		.enter()
		.append('div')
		.each(function(d, i) {
			select(this)
				.append('input')
				.style('margin', '2px')
				.attr('type', 'text')
				.property('value', d.label)
				.on('change', function() {
					self.q.lst[i].label = this.value
				})
		})

	self.dom.customBinLabelInput = self.dom.customBinLabelDiv.selectAll('input')
}

function renderButtons(self) {
	const btndiv = self.dom.bins_div.append('div')
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
