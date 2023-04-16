import { getCompInit, multiInit } from '../rx'
import { overlayInit } from './controls.overlay'
import { term1uiInit } from './controls.term1'
import { divideInit } from './controls.divide'
import { initRadioInputs } from '../dom/radio2'
import { termsettingInit } from '../termsetting/termsetting'
import { rgb } from 'd3-color'

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

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
					} else if (obj.type in initByComponent) {
						componentPromises[obj.type] = await initByComponent[obj.type]({
							app: this.app,
							holder: this.dom.table.append('tr'),
							id: this.id,
							usecase: obj.usecase,
							defaultQ4fillTW: obj.defaultQ4fillTW,
							numericEditMenuVersion: obj.numericEditMenuVersion,
							debug: this.opts.debug
						})
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
				} else if (key in initByComponent) {
					componentPromises[key] = await initByComponent[key]({
						app: this.app,
						holder: this.dom.table.append('tr'),
						id: this.id,
						debug: this.opts.debug
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
				.style('overflow', 'hidden')
				.style('visibility', 'hidden')
				.style('transition', '0.2s')
		}

		this.dom.table = this.dom.holder
			.append('table')
			.attr('cellpadding', 0)
			.attr('cellspacing', 0)

		return this.dom.table
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config
		}
	}

	main() {
		const plot = this.state.config
		const isOpen = plot.settings.controls.isOpen
		this.render(isOpen)
		for (const name in this.inputs) {
			const o = this.inputs[name]
			o.main(o.usestate ? this.state : plot)
		}
	}

	render(isOpen) {
		this.dom.holder
			.style('visibility', isOpen ? 'visible' : 'hidden')
			.style('max-width', isOpen ? '660px' : '50px')
			.style('height', isOpen ? '' : 0)

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
	self.rowIsVisible = function() {
		return this.style.display != 'none'
	}
}

function setNumberInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('title', opts.title),
			inputs: {}
		}
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
	const debounceTimeout = 'debounceInterval' in opts.parent?.app.opts ? opts.parent?.app.opts.debounceInterval : 100
	for (const input of opts.inputs) {
		let dispatchTimer
		function debouncedDispatch() {
			if (dispatchTimer) clearTimeout(dispatchTimer)
			dispatchTimer = setTimeout(dispatchChange, debounceTimeout)
		}

		function dispatchChange() {
			const value = Number(self.dom.inputs[input.settingsKey].property('value'))
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

		const inputTd = opts.holder
			.append('td')
			.attr('colspan', opts.colspan || '')
			.style('text-align', opts.align || '')
		if (!input.settingsKey) {
			inputTd
				.style('text-align', 'center')
				.style('color', '#999')
				.style('cursor', 'default')
				.html(input.label)
		} else {
			self.dom.inputs[input.settingsKey] = inputTd
				.append('input')
				.attr('type', 'number')
				.attr('min', 'min' in input ? input.min : null) // verify that null gives the default html input behavior
				.attr('max', 'max' in input ? input.max : null) // same
				.attr('step', input.step || opts.step || null) //step gives the amount by which user can increment
				.style('width', (input.width || opts.width || 100) + 'px')
				.on('change', debouncedDispatch)
		}
	}

	const api = {
		main(plot) {
			for (const settingsKey in self.dom.inputs) {
				self.dom.inputs[settingsKey].property('value', plot.settings[opts.chartType][settingsKey])
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setMathExprInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('title', opts.title),
			inputTd: opts.holder.append('td')
		}
	}

	const textByNumber = {}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'text')
		.style('width', (opts.width || 100) + 'px')
		.on('change', () => {
			const value = self.dom.input.property('value')
			const number = Number(eval(value))
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
			const number = typeof value == 'number' ? value : Number(eval(value))
			if (typeof value != 'number') textByNumber[number] = value
			self.dom.input.property('value', value in textByNumber ? textByNumber[number] : value)
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setTextInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label')
				.attr('title', opts.title),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'text')
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
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row').attr('title', opts.title),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.input = self.dom.inputTd
		.append('input')
		.attr('type', 'color')
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

	for (const input of inputs) {
		self.inputs[input.settingsKey] = initRadioInputs({
			name: `pp-control-${input.settingsKey}-${opts.instanceNum}`,
			holder: opts.holder
				.append('td')
				.attr('colspan', opts.colspan || '')
				.style('text-align', opts.align || ''),
			options: input.options,
			getDisplayStyle: () => 'block',
			listeners: {
				input(event, d) {
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
		})
	}

	const api = {
		main(plot) {
			self.dom.row.style('table-row')
			for (const settingsKey in self.inputs) {
				const radio = self.inputs[settingsKey]
				radio.main(plot.settings[opts.chartType][settingsKey])
				radio.dom.divs.style('display', d =>
					d.getDisplayStyle ? d.getDisplayStyle(plot) : opts.labelDisplay || 'inline-block'
				)
				//radio.dom.labels.style('display', d => opts.labelDisplay || 'span')
			}
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setDropdownInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row'),
			labelTd: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	self.dom.select = self.dom.inputTd.append('select').on('change', () => {
		opts.dispatch({
			type: 'plot_edit',
			id: opts.id,
			config: {
				settings: {
					[opts.chartType]: {
						[opts.settingsKey]: self.dom.select.property('value')
					}
				}
			}
		})
	})

	self.dom.select
		.selectAll('option')
		.data(opts.options)
		.enter()
		.append('option')
		.attr('value', d => d.value)
		.attr('selected', d => d.selected)
		.html(d => '&nbsp;' + d.label + '&nbsp;')

	const api = {
		main(plot) {
			self.dom.select.property('value', plot.settings[opts.chartType][opts.settingsKey])
		}
	}

	if (opts.debug) api.Inner = self
	return Object.freeze(api)
}

function setCheckboxInput(opts) {
	const self = {
		dom: {
			row: opts.holder.style('display', 'table-row').attr('title', opts.title),
			labelTdb: opts.holder
				.append('td')
				.html(opts.label)
				.attr('class', 'sja-termdb-config-row-label'),
			inputTd: opts.holder.append('td')
		}
	}

	const label = self.dom.inputTd.append('label')

	self.dom.input = label
		.append('input')
		.attr('type', 'checkbox')
		.on('change', () => {
			const value = self.dom.input.property('checked')
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
				.attr('title', opts.title),
			inputTd: opts.holder.append('td')
		}
	}

	const pill = await termsettingInit({
		menuOptions: opts.menuOptions || '*',
		numericEditMenuVersion: opts.numericEditMenuVersion,
		vocabApi: opts.vocabApi,
		vocab: opts.state?.vocab,
		activeCohort: opts.state?.activeCohort,
		holder: self.dom.inputTd.append('div'),
		debug: opts.debug,
		usecase: opts.usecase,
		callback: tw => {
			// data is object with only one needed attribute: q, never is null
			if (tw && !tw.q) throw 'data.q{} missing from pill callback'
			if (opts.processInput) opts.processInput(tw)
			pill.main(tw ? tw : { term: null, q: null })
			opts.dispatch({
				type: 'plot_edit',
				id: opts.id,
				config: {
					[opts.configKey]: tw
				}
			})
		}
	})

	const api = {
		usestate: true,
		main(plot) {
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
	term: setTermInput
}

const initByComponent = {
	term1: term1uiInit,
	overlay: overlayInit,
	divideBy: divideInit
}
