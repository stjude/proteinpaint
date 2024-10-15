import { getCompInit, multiInit } from '../rx'
import { make_radios } from '#dom'
import { termsettingInit } from '#termsetting'
import { rgb } from 'd3-color'
import { select } from 'd3-selection'
// import { TermTypes } from '#shared/terms.js'

// unique element ID's are needed for  to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups

// instanceNum is incremented for each control menu instance,
// may be optionally used for distinguishing menu instances, such as
// for matrix controls where there are multiple menu buttons
let instanceNum = 1

// controlNum is incremented when calling getElemId(),
// which creates a unique string that can be used to name related radio inputs
// or as a unique element ID to reference with aria-labelledby,
// when the corresponding input is not wrapped by a label element
// or does not have an aria-label attribute (Section 508 requirement)
let controlNum = 1
function getElemId(instanceNum) {
	return `sjpp-control-${controlNum++}-${instanceNum || Math.random().toString().slice(-4)}-${Math.random()
		.toString()
		.slice(-6)}`
}

class TdbConfigUiInit {
	constructor(opts) {
		this.type = 'controlsConfig'
		this.app = opts.app
		this.id = opts.id
		this.instanceNum = instanceNum++
		setRenderers(this)
	}

	async init() {
		try {
			const dispatch = this.app.dispatch
			const table = this.setDom()
			const debug = this.opts.debug
			this.inputs = {} // non-rx notified
			const componentPromises = {} // rx-notified

			for (const key of this.opts.inputs) {
				if (typeof key == 'object') {
					const obj = key // reassign to be less confusing
					if (obj.type in initByInput) {
						this.inputs[obj.settingsKey || obj.configKey] = await initByInput[obj.type](
							Object.assign({}, obj, {
								holder: this.dom.table.append('tr'),
								dispatch,
								id: this.id,
								instanceNum: this.instanceNum,
								debug: this.opts.debug,
								parent: this
							})
						)
					}
				} else if (key in initByInput) {
					this.inputs[key] = await initByInput[key]({
						holder: this.dom.table.append('tr'),
						dispatch,
						id: this.id,
						instanceNum: this.instanceNum,
						debug: this.opts.debug,
						parent: this
					})
				} else {
					throw `unsupported opts.inputs[] entry of '${key}' for controlsInit()`
				}
			}

			this.components = await multiInit(componentPromises)
		} catch (e) {
			throw e
		}
	}

	setDom() {
		this.dom = {
			holder: this.opts.holder
				.style('max-width', '50px')
				.style('height', 0)
				.style('vertical-align', 'top')
				.style('transition', '0.2s ease-in-out')
				//.style('overflow', 'hidden')
				.style('visibility', 'hidden')
				.style('transition', '0.2s')
		}

		this.dom.table = this.dom.holder.append('table').attr('cellpadding', 0).attr('cellspacing', 0)

		return this.dom.table
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config,
			isOpen: this.opts.isOpen()
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = this.opts.isOpen()
		this.render(isOpen)
		for (const name in this.inputs) {
			const o = this.inputs[name]
			o.main(o.usestate ? this.state : plot)
		}
	}

	render(isOpen) {
		this.dom.holder
			.style('visibility', isOpen ? 'visible' : 'hidden')
			.style('max-width', isOpen ? '700px' : '50px')
			.style('height', isOpen ? '' : 0)
			.style('resize', isOpen ? 'both' : 'none')

		this.dom.table
			.selectAll('tr')
			.filter(this.rowIsVisible)
			.selectAll('td')
			.style('border-top', '2px solid #FFECDD')
			.style('padding', '5px 10px')
	}
}

export const configUiInit = getCompInit(TdbConfigUiInit)

function setRenderers(self) {
	self.rowIsVisible = function () {
		return this.style.display != 'none'
	}
}

function setNumberInput(opts) {
	const id = getElemId(opts.instanceNum)
	const self = {
		id,
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.attr('id', id)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title)
				.html(opts.label),
			inputs: {}
		},
		values: {}
	}

	if (!opts.inputs)
		opts.inputs = [
			{
				min: opts.min,
				max: opts.max,
				step: opts.step,
				width: opts.width,
				settingsKey: opts.settingsKey
			}
		]

	// debounce by default
	const debounceTimeout =
		opts.debounceInterval ||
		('debounceInterval' in opts.parent?.app.opts ? opts.parent?.app.opts.debounceInterval : 100)
	for (const input of opts.inputs) {
		let dispatchTimer
		function debouncedDispatch(noDispatch = false) {
			if (dispatchTimer) clearTimeout(dispatchTimer)
			if (!noDispatch) dispatchTimer = setTimeout(dispatchChange, debounceTimeout)
		}

		function dispatchChange() {
			let value = Number(self.dom.inputs[input.settingsKey].property('value'))
			if (input.max && input.max < value) value = input.max
			if (input.min && input.min > value) value = input.min
			if (opts.callback) opts.callback(value)
			else {
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: {
							[opts.chartType]: {
								[input.settingsKey]: opts.processInput ? opts.processInput(value) : value
							}
						}
					}
				})
			}
		}

		const inputTd = opts.holder
			.append('td')
			.style('text-align', opts.align || '')
			.attr('colspan', opts.colspan || '')
		if (!input.settingsKey) {
			inputTd.style('color', '#555').style('cursor', 'default').html(input.label)
		} else {
			self.dom.inputs[input.settingsKey] = inputTd
				.append('input')
				.attr('aria-labelledby', self.id)
				.attr('type', 'number')
				.attr('min', 'min' in input ? input.min : null) // verify that null gives the default html input behavior
				.attr('max', 'max' in input ? input.max : null) // same
				.attr('step', input.step || opts.step || null) //step gives the amount by which user can increment
				.style('width', (input.width || opts.width || 100) + 'px')
				.on('keyup', event => {
					const valueChanged =
						self.values[opts.settingsKey] !== Number(self.dom.inputs[input.settingsKey].property('value'))
					debouncedDispatch(event.key !== 'Enter' && valueChanged)
				})
				.on('change', event => {
					debouncedDispatch(false)
				})
			// the onchange event is too sensitive for a number input, and can cause premature dispatch
			//.on('change', debouncedDispatch)
		}
	}

	const api = {
		main(plot) {
			const display = opts.getDisplayStyle?.(plot) || 'table-row'
			opts.holder.style('display', display)
			for (const settingsKey in self.dom.inputs) {
				const value = plot.settings[opts.chartType][settingsKey]
				self.dom.inputs[settingsKey].property('value', value)
				self.values[settingsKey] = value
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setMathExprInput(opts) {
	const id = getElemId(opts.instanceNum)
	const self = {
		id,
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.attr('id', id)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title)
				.attr('overflow', 'visible')
				.html(opts.label),
			inputTd: opts.holder.append('td')
		}
	}

	const textByNumber = {}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'text')
		.attr('aria-labelledby', self.id)
		.style('width', (opts.width || 100) + 'px')
		.on('change', () => {
			const value = self.dom.input.property('value')
			const number = Number(value)
			if (isNaN(number)) throw `non-numeric value for ${opts.settingsKey}='${value}'`
			textByNumber[number] = value
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						[opts.chartType]: {
							[opts.settingsKey]: number
						}
					}
				}
			})
		})

	const api = {
		main(plot) {
			const value = plot.settings[opts.chartType][opts.settingsKey]
			const number = typeof value == 'number' ? value : Number(value)
			if (typeof value != 'number') textByNumber[number] = value
			self.dom.input.property('value', value in textByNumber ? textByNumber[number] : value)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setTextInput(opts) {
	const id = getElemId(opts.instanceNum)
	const self = {
		id,
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.attr('id', id)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title)
				.html(opts.label),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', opts.placeholder)
		.attr('aria-labelledby', self.id)
		.style('width', (opts.width || 100) + 'px')
		.on('change', () => {
			const value = self.dom.input.property('value')
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						[opts.chartType]: {
							[opts.settingsKey]: opts.processInput ? opts.processInput(value) : value
						}
					}
				}
			})
		})

	const api = {
		main(plot) {
			self.dom.input.property('value', plot.settings[opts.chartType][opts.settingsKey])
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setColorInput(opts) {
	const id = getElemId(opts.instanceNum)
	const self = {
		id,
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.attr('id', id)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title)
				.html(opts.label),
			inputTd: opts.holder
				.append('td')
				.attr('colspan', opts.colspan || '')
				.style('text-align', opts.align || '')
		}
	}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'color')
		.attr('aria-labelledby', self.id)
		.on('change', () => {
			const value = self.dom.input.property('value')
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						[opts.chartType]: {
							[opts.settingsKey]: opts.processInput ? opts.processInput(value) : value
						}
					}
				}
			})
		})

	const api = {
		main(plot) {
			const color = plot.settings[opts.chartType][opts.settingsKey]
			self.dom.input.property('value', rgb(color).formatHex())
			opts.holder.style('display', opts.getDisplayStyle?.(plot) || 'table-row')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setRadioInput(opts) {
	const self = {
		dom: {
			row: opts.holder,
			labelTdb: opts.holder
				.append('td')
				.html(opts.label)
				.attr('aria-label', opts.title)
				.attr('class', 'sja-termdb-config-row-label')
		},
		inputs: {}
	}

	const inputs = opts.inputs
		? opts.inputs
		: [
				{
					settingsKey: opts.settingsKey,
					options: opts.options
				}
		  ]

	const styles = opts.styles
	for (const input of inputs) {
		self.inputs[input.settingsKey] = make_radios({
			inputName: getElemId(opts.instanceNum),
			holder: opts.holder
				.append('td')
				.attr('colspan', opts.colspan || '')
				.style('text-align', opts.align || ''),
			options: input.options,
			getDisplayStyle: () => 'inline-block',
			styles,
			listeners: {
				input(event, d) {
					if (event.key && event.key !== 'Enter') return

					if (opts.callback) {
						opts.callback(d.value)
					} else {
						opts.dispatch({
							type: 'plot_edit',
							id: opts.id,
							config: {
								settings: {
									[opts.chartType]: {
										[input.settingsKey]: d.value
									}
								}
							}
						})
					}
				}
			}
		})
	}

	const api = {
		main(plot) {
			const display = opts.getDisplayStyle?.(plot) || 'table-row'
			self.dom.row.style('display', display)
			if (display == 'none') return
			for (const settingsKey in self.inputs) {
				const radio = self.inputs[settingsKey]
				radio.main(plot.settings[opts.chartType][settingsKey])
				radio.divs.style('display', d =>
					d.getDisplayStyle ? d.getDisplayStyle(plot) : opts.labelDisplay || 'inline-block'
				)
				//radio.labels.style('display', d => opts.labelDisplay || 'span')
				if (opts.setRadioLabel) radio.labels.html(opts.setRadioLabel)
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setDropdownInput(opts) {
	const id = getElemId(opts.instanceNum)
	const self = {
		id,
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder.append('td').attr('id', id).html(opts.label).attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.select = self.dom.inputTd
		.append('select')
		.attr('aria-labelledby', id)
		.property('disabled', opts.disabled)
		.on('change', () => {
			const value = self.dom.select.property('value')
			if (opts.callback) opts.callback(value)
			else
				opts.dispatch({
					type: 'plot_edit',
					id: opts.id,
					config: {
						settings: {
							[opts.chartType]: {
								[opts.settingsKey]: value
							}
						}
					}
				})
		})
	self.dom.select.style('max-width', '300px')
	self.dom.select
		.selectAll('option')
		.data(opts.options)
		.enter()
		.append('option')
		.property('disabled', d => d.disabled)
		.attr('value', d => d.value)
		.attr('selected', d => d.selected)
		.html(d => '&nbsp;' + d.label + '&nbsp;')

	const api = {
		main(plot) {
			opts.holder.style('display', opts.getDisplayStyle?.(plot) || 'table-row')
			self.dom.select.property('value', plot.settings[opts.chartType][opts.settingsKey])
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setCheckboxInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTdb: opts.holder
				.append('td')
				.attr('aria-label', opts.title)
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder
				.append('td')
				.attr('colspan', opts.colspan || '')
				.style('text-align', opts.align || '')
		}
	}

	const label = self.dom.inputTd.append('label')

	self.dom.input = label
		.append('input')
		.attr('type', 'checkbox')
		.on('change', () => {
			const value = self.dom.input.property('checked')
			if (opts.callback) opts.callback(value)
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					settings: {
						[opts.chartType]: {
							[opts.settingsKey]: opts.processInput ? opts.processInput(value) : value
						}
					}
				}
			})
		})

	label.append('span').html('&nbsp;' + opts.boxLabel)

	const api = {
		main(plot) {
			const value = plot.settings[opts.chartType][opts.settingsKey]
			self.dom.input.property('checked', opts.processInput ? opts.processInput(value) : value)
			opts.holder.style('display', opts.getDisplayStyle?.(plot) || 'table-row')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

/*
	Use for array of allowed values
*/
function setMultiCheckbox(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTdb: opts.holder
				.append('td')
				.attr('aria-label', opts.title)
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder
				.append('td')
				.attr('colspan', opts.colspan || '')
				.style('padding', '5px')
				.style('text-align', opts.align || '')
		}
	}

	self.dom.labels = self.dom.inputTd
		.selectAll('label')
		.data(opts.options)
		.enter()
		.append('label')
		.style('margin-right', '8px')
		.each(function (d) {
			const label = select(this)
			self.dom.input = label
				.append('input')
				.attr('type', 'checkbox')
				.attr('value', d => d.value)
				.on('change', () => {
					const checked = []
					const value = self.dom.labels.selectAll('input').each(function (d) {
						if (this.checked) checked.push(d.value)
					})
					opts.dispatch({
						type: 'plot_edit',
						id: opts.id,
						config: {
							settings: {
								[opts.chartType]: {
									[opts.settingsKey]: checked
								}
							}
						}
					})
				})

			label.append('span').html(d.label)
		})

	self.dom.inputs = self.dom.labels.selectAll('input')

	const api = {
		main(plot) {
			const values = plot.settings[opts.chartType][opts.settingsKey]
			self.dom.inputs.property('checked', d => values.includes(d.value))
			self.dom.labels.style('display', d => d.getDisplayStyle?.(plot) || '')
			opts.holder.style('display', opts.getDisplayStyle?.(plot) || 'table-row')
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setCustomInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title)
				.style('vertical-align', 'top'),
			inputTd: opts.holder.append('td')
		}
	}

	self.api = opts.init(self)

	if (opts.debug) self.api.Inner = self
	return Object.freeze(self.api)
}

/*
	this is a generalized control wrapper for termsetting pill,
	intended to eventually replace the more specific term1, overlay, and divide components

	many of the options are mapped to the arguments of termsettingInit(),
	https://docs.google.com/document/d/13bU1azXD6Jl_1w0SCTc8eCEt42YJtrK4kJ3mdSkxMrU/edit#heading=h.oqjmte1ot0h3
*/
async function setTermInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('aria-label', opts.title),
			inputTd: opts.holder.append('td')
		}
	}

	const pill = await termsettingInit({
		menuOptions: opts.menuOptions || '*',
		numericEditMenuVersion: opts.numericEditMenuVersion || ['continuous', 'discrete'],
		vocabApi: opts.vocabApi,
		vocab: opts.state?.vocab,
		activeCohort: opts.state?.activeCohort,
		holder: self.dom.inputTd.append('div'),
		debug: opts.debug,
		usecase: opts.usecase,
		getBodyParams: opts.getBodyParams,
		defaultQ4fillTW: opts.defaultQ4fillTW,
		callback: async tw => {
			// showing "processing data ..."" before pill is set
			if (opts.parent.dom.loadingDiv && opts.parent.dom.svg) {
				opts.parent.dom.loadingDiv.selectAll('*').remove()
				opts.parent.dom.loadingDiv.html('').style('display', '').style('position', 'relative').style('left', '45%')
				opts.parent.dom.loadingDiv.html('Processing data ...')
				opts.parent.dom.svg.style('opacity', 0.1).style('pointer-events', 'none')
			}

			// data is object with only one needed attribute: q, never is null
			if (tw && !tw.q) throw 'data.q{} missing from pill callback'
			if (opts.processInput) await opts.processInput(tw)
			await pill.main(tw ? tw : { term: null, q: null })

			const config = {
				[opts.configKey]: tw
			}

			if (opts.processConfig) opts.processConfig(config) // do the custom config modification inside the processConfig function

			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config
			})
		}
	})

	const api = {
		usestate: true,
		main(plot) {
			const display = opts.getDisplayStyle?.(plot) || 'table-row'
			opts.holder.style('display', display)
			const { config, activeCohort, termfilter } = JSON.parse(JSON.stringify(plot))
			const tw = plot[opts.configKey] || (config && config[opts.configKey]) || {}
			const arg = {
				term: tw.term || null,
				q: tw.q,
				activeCohort,
				filter: termfilter && termfilter.filter
			}
			if ('$id' in tw) arg.$id = tw.$id
			pill.main(arg)
			self.dom.labelTd.datum(tw).html(opts.label)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

export const initByInput = {
	number: setNumberInput,
	math: setMathExprInput,
	text: setTextInput,
	color: setColorInput,
	radio: setRadioInput,
	dropdown: setDropdownInput,
	checkbox: setCheckboxInput,
	multiCheckbox: setMultiCheckbox,
	custom: setCustomInput,
	term: setTermInput
}
