import { keyupEnter } from '#src/client'
import { format } from 'd3-format'
import type { DensityData } from './density'
import { setDensityPlot } from './density'
import { get_bin_label, get_bin_range_equation } from '#shared/termdb.bins.js'
import { make_radios, Tabs, violinRenderer } from '#dom'
import { getPillNameDefault } from '../utils.ts'
import { convertViolinData } from '#filter/tvs.numeric'
import type { PillData, NumericBin, NumericQ } from '#types'

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
**** Functions for regular-sized bins ****
	renderRegularSizedBinsInputs()
		renderBinSizeInput() // render Bin Size Input
		renderFirstBinInput() // render First Bin Input
		renderLastBinInputs() // render Last Bin Inputs
**** Functions for Custom size bins ****
	renderCustomBinInputs() // render Custom Bin Inputs
		handleChange() // update self.q if custom inputs changed
		binsChanged() // check if bins changed from input or return
		processCustomBinInputs() // create or update self.q from custom bins inputs
*/

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (!self.q) throw `Missing .q{} [numeric.discrete getPillStatus()]`
			const text = self.q?.name || self.q?.reuseId
			if (text) return { text }
			if (self.q.type == 'regular-bin') return { text: 'bin size=' + self.q.bin_size }
			return { text: self.q.lst!.length + ' bins' }
		},

		async showEditMenu(div: any) {
			showBinsMenu(self, div)
		}
	}
}

async function showBinsMenu(self, div: any) {
	self.num_obj = {}

	self.num_obj.plot_size = {
		width: 500,
		height: 100,
		xpad: 10,
		ypad: 20
	}
	div.selectAll('*').remove()
	div.append('div').style('padding', '10px').style('text-align', 'center').html('Getting distribution data ...<br/>')
	try {
		const d = await self.vocabApi.getViolinPlotData(
			{
				tw: { term: self.term, q: { mode: 'continuous' } },
				filter: self.filter,
				filter0: self.vocabApi.state?.termfilter?.filter0, // this is in sync with mass. do not use the one from vocabApi.opts which is initial state and is out of sync with changes
				svgw: self.num_obj.plot_size.width,
				strokeWidth: 0.2
			},
			self.opts.getBodyParams?.()
		)
		self.num_obj.density_data = convertViolinData(d)
	} catch (err) {
		console.log(err)
	}

	div.selectAll('*').remove()
	if (self.term.type == 'survival') {
		// survival terms have a different discrete UI than numeric terms
		self.dom.discreteSur_div = div.append('div').style('padding', '4px')
		renderSurvivalDiscreteButton(self)
		return
	}
	self.dom.num_holder = div
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
	renderTypeInputs(self)
	renderButtons(self)
}

function applyEdits(self) {
	if (self.q.type == 'regular-bin') {
		if (!self.q.first_bin) {
			self.q.first_bin = {
				stop: Number(self.dom.first_stop_input.property('value'))
			}
		}
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

		if (Number.isFinite(self.q.last_bin?.start)) {
			// has valid last_bin.start, it's using fixed last bin
		} else {
			// no valid value, delete the optional attribute to indicate last bin is automatic
			delete self.q.last_bin
		}
		self.numqByTermIdModeType[self.term.id].discrete['regular-bin'] = JSON.parse(JSON.stringify(self.q))
	} else if (self.term.type !== 'survival') {
		// do not need to processCustomBinInputs for survival terms
		if (self.dom.bins_table.selectAll('input').node().value) {
			self.q.lst = processCustomBinInputs(self)
			self.numqByTermIdModeType[self.term.id].discrete['custom-bin'] = JSON.parse(JSON.stringify(self.q))
		}
	}
	self.q.mode = 'discrete'
	self.dom.tip.hide()
	self.api.runCallback()
}

function processCustomBinInputs(self) {
	const startinclusive = self.dom.boundaryInput.property('value') == 'startinclusive'
	const stopinclusive = self.dom.boundaryInput.property('value') == 'stopinclusive'
	const inputs = self.dom.bins_table.node().querySelectorAll('input')

	const inputData = self.dom.customBinBoundaryInput
		.property('value')
		.split('\n')
		.filter((d: any) => d != '' && !isNaN(d))

	// Fix for when user enters in the same number more than once.
	// UI will ignore duplicate entries completely.
	const trackBins = new Set(inputData)
	if (!trackBins.size) return

	const sortedBins = Array.from(trackBins)
		.map((d: any) => +d)
		.sort((a, b) => a - b)

	const data: NumericBin[] = [
		// first bin: StartUnbounded type
		{
			startunbounded: true,
			stop: sortedBins[0],
			startinclusive: false,
			stopinclusive,
			label: inputs[0].value
		}
	]
	// first bin
	if (!data[0].label) data[0].label = get_bin_label(data[0], self.q, self.term.valueConversion)
	if (!data[0].range) data[0].range = get_bin_range_equation(data[0], self.q)

	for (const [i, d] of sortedBins.entries()) {
		let bin
		const label = inputs[i + 1]?.value || ''
		if (i !== trackBins.size - 1) {
			// intermediate bin: FullyBounded type
			bin = {
				start: +d,
				startinclusive,
				stopinclusive,
				stop: sortedBins[i + 1],
				label,
				range: ''
			}
		} else {
			// last bin: StopUnbounded type
			bin = {
				start: +d,
				startinclusive,
				stopinclusive: false,
				stopunbounded: true,
				label,
				range: ''
			}
		}

		if (bin.label === '' || bin.label === undefined) bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
		if (bin.range === '' || bin.range === undefined) bin.range = get_bin_range_equation(bin, self.q)
		data.push(bin)
	}
	return data
}

function setqDefaults(self) {
	const dd = self.num_obj.density_data as DensityData

	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}

	if (!cache[t.id].discrete) {
		// when cache{}.discrete{} is missing, initiate it

		const defaultCustomBoundary =
			/* when no sample is annotated by this term,
			minvalue and maxvalue are both null
			setting defaultCustomBoundary to arbitrary "0" will allow existing UI to work
			but remains to be evaluated if is really okay to use 0
			*/
			!Number.isFinite(dd.minvalue) || !Number.isFinite(dd.maxvalue)
				? 0
				: // minvalue and maxvalue is valid number
				dd.maxvalue != dd.minvalue
				? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2
				: dd.maxvalue

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

	if (!self.q.type) {
		// supply default q.type when missing. important not to always hardcode to "regular-bin". e.g. in gdc, agedx default binning is custom but not regular; for such term defaulting to regular will confuse termsetting ui
		self.q.type = self.term.bins?.default?.type || 'regular-bin'
	}

	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id].discrete[self.q.type]))
	self.q = Object.assign(cacheCopy, self.q)
	const bin_size = 'bin_size' in self.q && self.q.bin_size!.toString()
	if (!self.q.rounding && typeof bin_size == 'string' && bin_size.includes('.') && !bin_size.endsWith('.')) {
		const binDecimals = bin_size.split('.')[1].length
		self.q.rounding = '.' + binDecimals + 'f'
	}
	if (self.q.lst) {
		self.q.lst.forEach(bin => {
			if (!('label' in bin)) bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
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
		.on('change', function () {
			const c =
				self.q.mode == 'binary'
					? self.numqByTermIdModeType[self.term.id].binary
					: self.numqByTermIdModeType[self.term.id].discrete[self.q.type!]
			c.lst = self.q.lst
			if (c.type == 'regular-bin') {
				setBinsInclusion(c)
			} else {
				c.lst.forEach(bin => {
					setBinsInclusion(bin)
					bin.label = get_bin_label(bin, self.q, self.term.valueConversion)
					bin.range = get_bin_range_equation(bin, self.q)
				})
				renderBoundaryInputDivs(self, c.lst)
			}

			function setBinsInclusion(par) {
				par.startinclusive = self.dom.boundaryInput.node().selectedIndex == 1
				par.stopinclusive = self.dom.boundaryInput.node().selectedIndex == 0
			}
		})

	type htmlData = { value: string; html: string }

	self.dom.boundaryInput
		.selectAll('option')
		.data([
			{ value: 'stopinclusive', html: 'start &lt; ' + x + ' &le; end' },
			{ value: 'startinclusive', html: 'start &le; ' + x + ' &lt; end' }
		])
		.enter()
		.append('option')
		.property('value', (d: htmlData) => d.value)
		.property('selected', (d: htmlData) => {
			if (self.q.type == 'regular-bin') return self.q[d.value] == true
			else return self.q.lst![0][d.value] == true
		})
		.html((d: htmlData) => d.html)
}

function renderTypeInputs(self) {
	const div = self.dom.bins_div.append('div').style('margin', '10px')

	if (self.term.bins.default.type == 'custom-bin') {
		/*
		this term's default bin is custom bin! it's without a regular binning config
		cannot render regular/custom bin switchtab, as regular ui will break without that part of data
		only render custom bin ui, and do not allow switching from custom to regular bin size
		*/
		self.q.type = 'custom-bin'
		setqDefaults(self)
		setDensityPlot(self)
		renderCustomBinInputs(self, div)
		return
	}

	if (self.term.bins.default.type != 'regular-bin')
		throw 'self.bins.default.type is neither regular-bin or custom-bin, cannot render ui'

	// toggle switch between regular and custom
	const tabs: any = [
		{
			active: self.q.type == 'regular-bin',
			label: 'Same bin size',
			callback: async (event, tab) => {
				self.q.type = 'regular-bin'
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[0].isInitialized) {
					renderRegularSizedBinsInputs(self, tab.contentHolder)
					tabs[0].isInitialized = true
				}
			}
		},
		{
			active: self.q.type == 'custom-bin',
			label: 'Varying bin sizes',
			callback: async (event, tab) => {
				self.q.type = 'custom-bin'
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[1].isInitialized) {
					renderCustomBinInputs(self, tab.contentHolder)
					tabs[1].isInitialized = true
				}
			}
		}
	]
	new Tabs({ holder: div, tabs }).main()
}

/******************* Functions for Numerical Fixed size bins *******************/
function mayShowValueconversionMsg(self, tablediv: any) {
	if (!self.term.valueConversion) return
	tablediv
		.append('div')
		.style('margin-bottom', '5px')
		.style('opacity', 0.6)
		.text(`Note: using values by the unit of ${self.term.valueConversion.fromUnit}.`)
}
function renderRegularSizedBinsInputs(self, tablediv: any) {
	mayShowValueconversionMsg(self, tablediv)
	self.dom.bins_table = tablediv.append('table')
	renderBinSizeInput(self, self.dom.bins_table.append('tr'))
	renderFirstBinInput(self, self.dom.bins_table.append('tr'))
	renderLastBinInputs(self, self.dom.bins_table.append('tr'))
}

function renderBinSizeInput(self, tr: any) {
	tr.append('td').style('margin', '5px').style('opacity', 0.5).text('Bin Size')

	const dd = self.num_obj.density_data as DensityData
	const origBinSize = self.q.bin_size

	self.dom.bin_size_input = tr
		.append('td')
		.append('input')
		.attr('type', 'number')
		.attr('value', 'rounding' in self.q ? format(self.q.rounding!)(self.q.bin_size!) : self.q.bin_size)
		.style('margin-left', '15px')
		.style('width', '100px')
		.style('color', () => (self.q.bin_size! > Math.abs(dd.maxvalue - dd.minvalue) ? 'red' : ''))
		.on('change', event => {
			const newValue = Number(event.target.value)
			// must validate input value
			if (newValue <= 0) {
				window.alert('Please enter non-negative bin size.')
				// must reset value in <input>, otherwise the wrong value will be recorded in self.q upon clicking Submit
				event.target.value = origBinSize
				return
			}
			if ((dd.maxvalue - dd.minvalue) / newValue > 100) {
				// avoid rendering too many svg lines and lock up browser
				window.alert('Bin size too small. Try setting a bigger value.')
				event.target.value = origBinSize
				return
			}
			self.q.bin_size = newValue
			self.dom.bin_size_input.style(
				'color',
				self.q.bin_size > dd.maxvalue - dd.minvalue ? 'red' : newValue != origBinSize ? 'green' : ''
			)
			setDensityPlot(self)
		})
}

function renderFirstBinInput(self, tr: any) {
	if (!self.q.first_bin) throw 'missing q.first_bin'

	tr.append('td').style('margin', '5px').style('opacity', 0.5).text('First Bin Stop')

	const dd = self.num_obj.density_data as DensityData
	const origValue = self.q.first_bin.stop

	self.dom.first_stop_input = tr
		.append('td')
		.append('input')
		.attr('type', 'number')
		.property('value', origValue)
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('change', event => {
			const newValue = Number(event.target.value)
			if (newValue < dd.minvalue || newValue > dd.maxvalue) {
				window.alert('First bin stop value out of bound.')
				event.target.value = origValue
				return
			}

			// first_bin should have already been set; adding the check just to skip the tsc error...
			if (self.q.first_bin) self.q.first_bin.stop = newValue
			self.renderBinLines(self, self.q as NumericQ)
		})

	tr.append('td')
		.append('div')
		.style('font-size', '.6em')
		.style('opacity', 0.5)
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.text('Indicated by left-most red line. Drag to change.')
}

function renderLastBinInputs(self, tr: any) {
	// tell if last bin is automatic (not fixed)
	const isAuto = !self.q.last_bin || !Number.isFinite(self.q.last_bin.start)

	tr.append('td')
		.style('padding-top', '4px')
		.style('opacity', 0.5)
		.style('vertical-align', 'top')
		.text('Last Bin Start')

	const dd = self.num_obj.density_data as DensityData

	const td1 = tr.append('td').style('padding-left', '15px').style('vertical-align', 'top')
	const radio_div = td1.append('div')

	make_radios({
		holder: radio_div,
		options: [
			{ label: 'Automatic', value: 'auto', checked: isAuto },
			{ label: 'Fixed', value: 'fixed', checked: !isAuto }
		],
		callback: v => {
			if (v == 'auto') {
				delete self.q.last_bin
				// if just deleting last_bin.start and keeps q.last_bin{}, density plot may set last_bin.bin='last' and will break bin validation
				edit_div.style('display', 'none')
				self.renderBinLines(self, self.q as NumericQ)
				setDensityPlot(self)
				return
			}
			// v is "fixed", to assign a number to self.q.last_bin.start
			edit_div.style('display', 'inline-block')
			if (!self.q.last_bin) self.q.last_bin = {}

			if (self.dom.last_start_input.property('value') == '') {
				// blank input, fill max
				self.dom.last_start_input.property('value', dd.maxvalue)
			}
			setLastBinStart()
			setDensityPlot(self)
		}
	})

	const edit_div = tr
		.append('td')
		.append('div')
		.style('display', isAuto ? 'none' : 'inline-block')

	self.dom.last_start_input = edit_div
		.append('input')
		.attr('type', 'number')
		.property('value', self.q.last_bin ? self.q.last_bin.start : '')
		.style('width', '100px')
		.on('change', setLastBinStart)

	edit_div
		.append('div')
		.style('font-size', '.6em')
		.style('opacity', 0.5)
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.text('Indicated by right-most red line. Drag to change.')

	function setLastBinStart() {
		// only get value from <input>
		const inputValue = Number(self.dom.last_start_input.property('value'))

		// TODO first_bin should be required
		if (self.q.first_bin && inputValue <= self.q.first_bin.stop) {
			window.alert('Last bin start cannot be smaller than first bin stop.')
			self.dom.last_start_input.property('value', dd.maxvalue)
			return
		}
		if (inputValue > dd.maxvalue) {
			window.alert('Last bin start value out of bound.')
			self.dom.last_start_input.property('value', dd.maxvalue)
			return
		}
		if (!self.q.last_bin) self.q.last_bin = {} // this should be fine since it's optional
		self.q.last_bin.start = inputValue
		self.renderBinLines(self, self.q as NumericQ)
	}
}

/******************* Functions for Numerical Custom size bins *******************/
function renderCustomBinInputs(self, tablediv: any) {
	mayShowValueconversionMsg(self, tablediv)
	self.dom.bins_table = tablediv.append('div').style('display', 'flex').style('width', '100%')

	// boundaryDiv for entering bin boundaries
	// rangeAndLabelDiv for rendering ranges and labels
	const boundaryDiv = self.dom.bins_table.append('div').style('margin-right', '20px')
	self.dom.rangeAndLabelDiv = self.dom.bins_table.append('div')

	boundaryDiv.append('div').style('margin-bottom', '5px').style('color', 'rgb(136, 136, 136)').text('Bin boundaries')

	self.dom.customBinBoundaryInput = boundaryDiv
		.append('textarea')
		.style('width', '100px')
		.style('height', '70px')
		.text(
			self.q
				.lst!.slice(1)
				.map(d => d.start)
				.join('\n')
		)
		.on('change', handleChange)
		.on('keyup', async function (this: any, event: any) {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter(event) && event.key != 8) return
			if (!self.dom.bins_table.selectAll('input').node().value) return
			// Fix for if user hits enter with no values. Reverts to default cutoff.
			handleChange.call(this)
		})

	// help note
	boundaryDiv
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.html('Enter numeric values </br>seperated by ENTER')

	function handleChange() {
		const inputs = self.dom.bins_table.selectAll('input')
		inputs.property('value', '')
		const data = processCustomBinInputs(self)
		if (data == undefined) {
			// alert('Enter custom bin value(s)')
			return
		}
		// update self.q.lst and render bin lines only if bin boundry changed
		const q = self.numqByTermIdModeType[self.term.id].discrete[self.q.type!]
		if (self.q.hiddenValues!) q.hiddenValues = self.q.hiddenValues!
		if (binsChanged(data, q.lst)) {
			q.lst = data
			self.renderBinLines!(self, q)
		}
		renderBoundaryInputDivs(self, q.lst)
		self.q.lst = q.lst //store the new ranges in self.q, the mode is initialized when selecting the tab
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

	renderBoundaryInputDivs(self, self.q.lst)

	// add help message for custom bin labels
}

export function renderBoundaryInputDivs(self, data: any) {
	const holder = self.dom.rangeAndLabelDiv
	holder.selectAll('*').remove()

	const grid = holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto')
		.style('column-gap', '20px')
		.style('align-items', 'center')

	grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Range')

	grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Bin label')

	for (const [i, d] of data.entries()) {
		grid.append('div').attr('name', 'range').html(d.range)

		grid
			.append('div')
			.append('input')
			.attr('type', 'text')
			.style('margin', '2px 0px')
			.property('value', d.label)
			.on('change', function (this: any) {
				data[i].label = this.value
			})
	}

	self.dom.customBinRanges = self.dom.bins_table.selectAll('div[name="range"]').data(data)
	self.dom.customBinLabelInput = self.dom.bins_table.selectAll('input').data(data)
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
			// delete self.q
			self.q = {}
			delete self.numqByTermIdModeType[self.term.id]
			showBinsMenu(self, self.dom.num_holder)
		})
}

function renderSurvivalDiscreteButton(self) {
	const noteDiv = self.dom.discreteSur_div.append('div')

	noteDiv.append('div').style('font-size', '.8em').style('margin', '5px').html(`
			Display survival outcomes as exit codes <br>
		`)
	const btndiv = self.dom.discreteSur_div.append('div')
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', () => applyEdits(self))
}
