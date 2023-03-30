import { Menu } from '#dom/menu'
import { select, selectAll } from 'd3-selection'

/*
	This creates a menu of control options. 
	The type of rendered input or control elements 
	are based off the opts.options settings below, 
	with initial values copied from opts.conf.
	
	Arguments
	opts = {
		elem: DOM_node_to_use_for_positioning_the_menu,

		conf: {The object on which the options.settings.key/values 
			are derived from and applied to},

		options: [{
			label:"The heading to use for this section of the control menu",
			settings:[{
				key: "The name of the option key to use for getting 
					the default value and applying the changed value",
				label: "The label to use next to the control/input element",
				example: a_js_literal_value_example,
				description: "Will be used as control/input
					element title that explains the control option on-hover" 
			},]
		},{
			// see tp.hm2.options for an example of generating opts.options	
		}],

		changeHandler: ()=>{
			// the function to call after applying changes to opts.conf
		}
	}
	
	Returns a d3-wrapped menu div with
	- a show() function to show the menu
	- a reveal() function that syncs all input values with the conf[key] value  
*/
export default function(opts) {
	const elems = {}
	let menu

	const setInput = {
		radio(elem, s) {
			const radios = elem
				.style('padding', '1px')
				.append('div')
				.selectAll('input')
				.data(s.options)
				.enter()
				.append('span')

			const inputs = radios
				.append('input')
				.attr('type', 'radio') // typeof s.example)
				.attr('name', s.name)
				.attr('id', d => d.id)
				//.style('width',7*s.example.length+'px')
				.style('text-align', 'center')
				.property('value', d => d.value)
				.attr('checked', d => d.value == getNestedVal(s))
				.on('change', radioHandler)

			const labels = radios
				.append('label')
				.attr('for', d => d.id)
				.html(d => '&nbsp;' + d.label + '&nbsp;')

			function isCheckedFilter(d) {
				return select(this).property('checked')
			}

			return {
				getval() {
					return inputs.filter(isCheckedFilter).property('value')
				},
				setval(value) {
					const val = arguments.length ? value : getNestedVal(s)
					inputs.property('checked', d => {
						return d.value == val
					})
				}
			}
		},
		range(elem, s) {
			const input = elem
				.style('padding', '1px')
				.append('input')
				.attr('type', 'range')
				.attr('id', s.id)
				.datum(s)
				.attr('min', s.min)
				.attr('max', s.max)
				.attr('value', s.example)
				.on('change', inputHandler)
				.on('input', () => {
					label.text(input.property('value'))
				})

			const label = elem
				.append('label')
				.attr('for', s.id)
				.style('font-size', s.fontSize ? s.fontSize : '14px')
				.style('vertical-align', 'top')
				.text(s.example)

			return {
				getval() {
					return input.property('value')
				},
				setval(value) {
					const val = arguments.length ? value : getNestedVal(s)
					input.property('value', val)
					label.text(val)
				}
			}
		},
		string(elem, s) {
			const input = elem
				.style('padding', '1px')
				.append('input')
				.datum(s)
				.attr('type', 'text') // typeof s.example)
				.style('width', Math.max(50, 7 * s.example.length) + 'px')
				.style('text-align', 'center')
				.property('value', getNestedVal(s))
				.on('change', inputHandler)

			return {
				getval() {
					return input.property('value')
				},
				setval(value) {
					if (!arguments.length) {
						input.property('value', getNestedVal(s))
					} else {
						setNestedVal(s, value)
						input.property('value', value)
					}
				}
			}
		},
		boolean(elem, s) {
			const input = elem
				.style('padding', '1px')
				.append('input')
				.datum(s)
				.attr('type', 'checkbox') // typeof s.example)
				.style('width', '12px')
				.property('checked', getNestedVal(s))
				.on('change', checkBoxHandler)

			return {
				getval() {
					return input.property('checked')
				},
				setval(value) {
					if (!arguments.length) input.property('checked', getNestedVal(s))
					else {
						setNestedVal(s, value)
						input.property('checked', value)
					}
				}
			}
		},
		number(elem, s) {
			const input = elem
				.style('padding', '1px')
				.append('input')
				.datum(s)
				.attr('type', 'number')
				.attr('min', 'min' in s ? s.min : 0)
				.attr('max', s.max)
				.style('width', 4 * '${s.example}'.length + 'px')
				.style('text-align', 'center')
				.property('value', getNestedVal(s))
				.on('change', inputHandler)

			if (s.step) {
				input.attr('step', s.step)
			}

			return {
				getval() {
					return +input.property('value')
				},
				setval(value) {
					if (!arguments.length) {
						input.property('value', 1 * getNestedVal(s))
					} else {
						setNestedVal(s, 1 * value)
						input.property('value', 1 * value)
					}
				}
			}
		},
		csv(elem, s) {
			const input = elem
				.style('padding', '1px')
				.append('input')
				.datum(s)
				.attr('type', 'text') // typeof s.example)
				.style('width', 7 * s.example.length + 'px')
				.style('text-align', 'center')
				.property('value', getNestedVal(s).join(','))
				.on('change', csvHandler)

			return {
				getval() {
					const v = input.property('value')
					const vals = v ? v.split(',') : []
					return vals.map(d => (isNumeric(d) ? +d : d))
				},
				setval(value) {
					if (!arguments.length) {
						input.property('value', getNestedVal(s).join(','))
					} else {
						setNestedVal(s, value)
						input.property('value', value.join(','))
					}
				}
			}
		},

		button(elem, s) {},

		select(elem, s) {
			const currVal = getNestedVal(s)
			const selectElem = elem
				.style('padding', '1px')
				.append('select')
				.on(
					'change',
					s.refreshAllOnChange
						? () => {
								setNestedVal(s, selectElem.node().value)
								for (var key in elems) {
									elems[key].setval()
								}
						  }
						: inputHandler
				)

			function getOptions() {
				const options = Array.isArray(s.options)
					? s.options
					: s.options.startsWith('[') && s.options.endsWith(']') && s.options.slice(1, -1) in opts.conf
					? opts.conf[s.options.slice(1, -1)]
					: []
				return s.optionsFilter ? options.filter(s.optionsFilter) : options
			}

			selectElem
				.selectAll('option')
				.data(getOptions())
				.enter()
				.append('option')
				.attr('value', d => (typeof d == 'object' ? d.value : d))
				.property('selected', d => {
					const val = typeof d == 'object' ? d.value : d
					return val == currVal ? true : false
				})
				.html(d => (typeof d == 'object' ? d.label : d))

			return {
				getval() {
					return selectElem.node().value
				},
				setval(value) {
					const o = selectElem.selectAll('option').data(getOptions())

					o.exit().remove()
					o.enter()
						.append('option')
						.attr('value', d => (typeof d == 'object' ? d.value : d))
						.property('selected', d => {
							const val = typeof d == 'object' ? d.value : d
							return val == currVal ? true : false
						})
						.html(d => (typeof d == 'object' ? d.label : d))

					if (!arguments.length) {
						setNestedVal(s, selectElem.node().value)
					} else {
						setNestedVal(s, value)
					}
				}
			}
		},

		// a multiselect dropdown built with checkboxes
		checkdown(elem, s) {
			elem.style('position', 'relative')
			const selectGoBtn = elem
				.append('button')
				.style('position', 'absolute')
				.style('right', '15px')
				.html('Submit')
				.on('click', opts.changeHandler)
			const selectDiv = elem
				.append('div')
				.style('max-height', '60px')
				.style('overflow-y', 'scroll')
				.style('padding', '5px')
				.style('border', '1px solid #ececec')
				.on('click', getval)
			let elems

			function getOptions() {
				const options = Array.isArray(s.options)
					? s.options
					: s.options.startsWith('[') && s.options.endsWith(']') && s.options.slice(1, -1) in opts.conf
					? opts.conf[s.options.slice(1, -1)]
					: []

				const o = s.optionsFilter ? options.filter(s.optionsFilter) : options
				const selected = opts.conf[s.key]
				o.sort((a, b) => {
					const i = selected.includes(a)
					const j = selected.includes(b)
					return i == j ? 0 : i ? -1 : 1
				})
				return o
			}

			function render() {
				elems = []
				const selected = getNestedVal(s)
				selectDiv.selectAll('div').remove()

				selectDiv
					.selectAll('div')
					.data(getOptions())
					.enter()
					.append('div')
					.style('margin', '2px')
					.each(function(d, i) {
						const parentDiv = select(this)
						const parentOption = parentDiv.append('div')
						const id = s.idPrefix + '-' + i
						const value = 'valKey' in s ? d[s.valKey] : d

						elems.push(
							parentOption
								.append('input')
								.datum(s)
								.attr('id', id)
								.attr('type', 'checkbox') // typeof s.example)
								.style('width', '12px')
								.property('checked', selected.includes(value) === s.selectedIfChecked)
								.attr('value', value)
								.node()
						)

						parentOption
							.append('label')
							.attr('for', id)
							.style('font-weight', 'bold')
							.html('&nbsp;' + value)

						/*if (d.lst) {
							const childrenDiv = parentDiv.append('div')
							d.lst.map((c,j)=>{
								const childOption = childrenDiv.append('div').style('margin-left','20px')
								const subId=id+'-'+j
								const value=d.name+';;'+c.name
								elems.push(
									childOption.append('input')
										.datum(s)
										.attr('id',subId)
										.attr('type','checkbox') // typeof s.example)
										.style('width','12px')
										.property('checked',selected.includes(value)===s.selectedIfChecked)
										.attr('value',value)
										//.on('change',multiSelectHandler)
										.node()
								)
								
								childOption.append('label')
										.attr('for',subId)
										.html('&nbsp'+c.name)
							})
						}*/
					})
			}

			if (s.styles) {
				for (var key in s.styles) {
					selectDiv.style(key, s.styles[key])
				}
			}

			function getval() {
				const selected = []
				const d = getNestedVal(s)
				elems.map(elem => {
					if (elem.checked === s.selectedIfChecked) selected.push(elem.value)
				})
				setNestedVal(s, selected)
				return selected
			}

			return {
				getval: getval,
				setval: render
			}
		},

		multiselect(elem, s) {
			const selectElem = elem
				.style('padding', '1px')
				.append('select')
				.on('click', multiSelectHandler)
			const space5 = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'

			selectElem
				.selectAll('option')
				.data(opts.conf[s.options])
				.enter()
				.append('option')
				//.style('margin','2px')
				.each(function(d, i) {
					const option = select(this)
						.property('value', d.name)
						.html(d.name)

					if (!d.lst) return
					d.lst.map((c, j) => {
						selectElem
							.append('option')
							.property('value', d.name + ';;' + c.name)
							.html(space5 + ' ' + c.name)
					})
				})

			return {
				getval() {},
				setval(value) {
					//selectDiv.selectAll('div').remove()

					opts.conf[s.key].map(p => {
						//selectDiv.append()
					})
				}
			}
		}
	}

	function inputHandler(type) {
		const s = event.target.__data__
		if (!s) return
		const val = isNumeric(event.target.value) ? +event.target.value : event.target.value
		setNestedVal(s, val)
		opts.changeHandler()
	}

	function csvHandler() {
		const s = event.target.__data__
		if (!s) return
		const val = event.target.value.split(',').map(d => (isNumeric(d) ? +d : d))
		setNestedVal(s, val)
		opts.changeHandler()
	}

	function checkBoxHandler() {
		const s = event.target.__data__
		if (!s) return
		setNestedVal(s, event.target.checked)
		opts.changeHandler()
	}

	function radioHandler() {
		const d = event.target.__data__
		if (!d) return
		setNestedVal(d, d.value)
		opts.changeHandler()
	}

	function getNestedVal(d) {
		return [opts.conf].concat(d.key.split('.')).reduce((o, a) => {
			return a.startsWith('[') && a.endsWith(']') && o && o[a.slice(1, -1)] ? o[o[a.slice(1, -1)]] : o[a]
		})
	}

	function setNestedVal(d, value) {
		if (!d.key.includes('.')) {
			opts.conf[d.key] = value
		} else {
			const nestedKeys = d.key.split('.')
			const finalKey = nestedKeys.pop()
			let currObj = opts.conf
			nestedKeys.forEach(d => {
				currObj = d.startsWith('[') && d.endsWith(']') ? currObj[currObj[d.slice(1, -1)]] : currObj[d]
			})
			currObj[finalKey] = value
		}
	}

	function render() {
		const options = opts.options ? opts.options.filter(d => !d.env || d.env.includes(opts.env)) : []

		if (opts.container) {
			opts.container.style('z-index', 1001)
			menu = opts.container.append('div')

			menu
				.selectAll('div')
				.data(options)
				.enter()
				.append('div')
				.each(function(d) {
					select(this)
						.selectAll('div')
						.data(d.settings)
						.enter()
						.append('div')
						.each(function(s) {
							const div = select(this).datum(s)
							const controlType = s.type ? s.type : typeof s.example
							elems[s.key] = setInput[controlType](div, s)
						})
				})

			if (opts.styles) {
				for (var key in opts.styles) {
					menu.style(key, opts.styles[key])
				}
			}
		} else {
			if (!menu) menu = new Menu({ padding: 0, offsetX: -20, openedBy: opts.elem })
			if (!opts.elem) opts.elem = document.querySelector('#pp-hm-btn-advanced')
			menu.showunder(opts.elem)

			menu.d
				.style('border', '1px solid #aaa')
				.style('display', opts.container ? '' : 'none')
				.style('position', 'absolute')
				.style('z-index', 1001)
				.selectAll('div')
				.data(options)
				.enter()
				.append('div')
				.style('padding', '5px')
				.each(function(d) {
					const div = select(this)
					div
						.append('h5')
						.html(d.label)
						.style('padding', '2px')
						.style('margin', '2px')

					div
						.append('table')
						.selectAll('tr')
						.data(
							d.settings.filter(s => {
								return (!s.env || s.env.includes(opts.env)) && (!s.hideTest || !s.hideTest(opts.conf))
							})
						)
						.enter()
						.append('tr')
						.each(function(s) {
							const tr = select(this)
								.datum(s)
								.attr('title', s.description)
								.style('font-size', '12px')
							tr.append('td')
								.style('padding', '1px')
								.html(s.label)
							const td = tr.append('td').style('padding', '1px')
							const controlType = s.type ? s.type : typeof s.example
							elems[s.key] = setInput[controlType](td, s)
						})
				})

			if (opts.styles) {
				for (var key in opts.styles) {
					menu.d.style(key, opts.styles[key])
				}
			}
		}

		// menu already has show() function attached
		// by either menuunderdom or menushow;
		// this syncs all input values with conf before showing the menu
		if (menu)
			menu.sync = () => {
				if (!opts.elem) opts.elem = document.querySelector('#pp-hm-btn-advanced')
				menu.showunder(opts.elem)

				for (var key in elems) elems[key].setval()
				//menu.toggle()
			}

		menu.getVals = () => {
			const s = {}
			for (var key in elems) {
				s[key] = elems[key].getval()
			}
			return s
		}

		menu.reset = function(conf) {
			if (menu) menu.d.selectAll('div').remove()
			opts.conf = conf
			render()
		}
	}

	render()
	return menu
}

function isNumeric(d) {
	return !isNaN(parseFloat(d)) && isFinite(d) && d !== ''
}
