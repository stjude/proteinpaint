import * as rx from '../rx.core'
import { select as d3select, event as d3event } from 'd3-selection'
import * as client from '../client'
import { display as termui_display, numeric_bin_edit } from '../mds.termdb.termsetting.ui'

const panel_bg_color = '#fdfaf4'
const panel_border_color = '#D3D3D3'
let i = 0 // track controls "instances" for assigning unambiguous unique input names

class TdbPlotControls {
	constructor(app, opts) {
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.api.id = this.id
		this.app = app
		this.index = i++ // used for assigning unique input names, across different plots
		this.isVisible = false

		const topbar = opts.holder.append('div')
		const config_div = opts.holder.append('div')
		const table = config_div
			.append('table')
			.attr('cellpadding', 0)
			.attr('cellspacing', 0)
		this.dom = {
			holder: opts.holder.style('vertical-align', 'top').style('transition', '0.5s'),
			topbar,
			burger_div: topbar.append('div'),
			button_bar: topbar.append('div'),
			config_div,
			table
		}

		this.components = {
			burger: setBurgerBtn(app, { holder: this.dom.burger_div }, this),
			svg: setSvgBtn(app, { holder: this.dom.button_bar.append('div') }, this),
			term_info: setTermInfoBtn(app, { holder: this.dom.button_bar.append('div') }, this),
			config: setConfigDiv(app, { holder: this.dom.config_div }, this),
			//barsAs: setBarsAsOpts(app, {holder: table.append('tr'), label: "Bars as"}, this),
			overlay: setOverlayOpts(app, { holder: table.append('tr') }, this),
			//view: setViewOpts(app),
			orientation: setOrientationOpts(app, { holder: table.append('tr') }, this),
			scale: setScaleOpts(app, { holder: table.append('tr') }, this)
			/*bin: setBinOpts(app, "term", "Primary Bins"),
			divideBy: setDivideByOpts(app)
			*/
		}

		//this.plot.bus.on("postRender.controls", controls.listeners.plot.postRender)
		//this.bus = new rx.Bus("controls", ["postRender"], app.opts.callbacks, this.api)
	}

	main(action = {}) {
		this.dom.button_bar
			.style('display', this.isVisible ? 'inline-block' : 'block')
			.style('float', this.isVisible ? 'right' : 'none')

		const plot = this.app.state({ type: 'plot', id: this.id })
		for (const name in this.components) {
			this.components[name].main(action, plot)
		}

		this.dom.holder.style('background', this.isVisible ? panel_bg_color : '')
		//this.bus.emit("postRender", plot)
	}
}

export const controlsInit = rx.getInitFxn(TdbPlotControls)

export function init(opts) {
	const controls = {
		components: {}, // filled-in below
		plot: opts.plot,
		dispatch: opts.plot.main,
		main(plot) {
			if (plot) controls.plot = plot
			for (const name in controls.components) {
				controls.components[name].main(plot)
			}
			controls.dom.holder.style('background', controls.isVisible ? panel_bg_color : '')
			controls.bus.emit('postRender', plot)
		},
		dom: {
			holder: opts.holder.style('vertical-align', 'top').style('transition', '0.5s'),

			topbar: opts.holder.append('div')
		},
		index: i++, // used for assigning unique input names, across different plots
		isVisible: 'isVisible' in opts ? opts.isVisible : false,
		listeners: {
			plot: {
				postRender(plot) {
					const abspos =
						plot.settings.currViews.includes('barchart') &&
						(!plot.components.barchart.visibleCharts ||
							plot.components.barchart.visibleCharts.length > 1 ||
							plot.components.barchart.visibleCharts[0].settings.svgw > window.innerWidth - 500)

					controls.dom.holder.style('position', abspos ? 'absolute' : '')
				}
			}
		}
	}

	controls.components = {
		burger: setBurgerBtn(controls),
		svg: setSvgBtn(controls),
		term_info: setTermInfoBtn(controls),
		config: setConfigDiv(controls),
		barsAs: setBarsAsOpts(controls, 'Bars as'),
		overlay: setOverlayOpts(controls),
		view: setViewOpts(controls),
		orientation: setOrientationOpts(controls),
		scale: setScaleOpts(controls),
		bin: setBinOpts(controls, 'term', 'Primary Bins'),
		divideBy: setDivideByOpts(controls)
	}

	plot.bus.on('postRender.controls', controls.listeners.plot.postRender)
	controls.bus = client.get_event_bus(
		['postRender'],
		opts.plot.obj.callbacks.controls ? opts.plot.obj.callbacks.controls : {}
	)
	return controls
}

function setBurgerBtn(app, opts, controls) {
	const btn = opts.holder
		.style('margin', '10px')
		.style('margin-left', '20px')
		.style('font-family', 'verdana')
		.style('font-size', '28px')
		.style('cursor', 'pointer')
		.style('transition', '0.5s')
		.html('&#8801;')
		.on('click', () => {
			controls.isVisible = !controls.isVisible
			controls.main()
		})

	return {
		main() {
			btn.style('display', controls.isVisible ? 'inline-block' : 'block')
		},
		dom: {
			btn
		}
	}
}

function setSvgBtn(app, opts, controls) {
	const svg_btn = opts.holder
		.style('margin', '10px')
		.style('margin-top', '15px')
		.style('margin-left', '24px')
		.style('font-family', 'verdana')
		.style('font-size', '18px')
		.style('cursor', 'pointer')
		.html('&#10515;')
		.on('click', () => {
			return
			for (const name in plot.components) {
				if (typeof plot.components[name].download == 'function') {
					plot.components[name].download()
				}
			}
		})

	return {
		main(action, plot) {
			svg_btn.style('display', controls.isVisible ? 'inline-block' : 'block')

			//show tip info for download button based on visible plot/table
			const currviews = plot.settings.currViews
			const plots = ['barchart', 'boxplot', 'scatter']
			if (plots.some(view => currviews.includes(view))) {
				svg_btn.attr('title', 'Download plot image')
			} else if (currviews.includes('table')) {
				svg_btn.attr('title', 'Download table data')
			}
		},
		dom: {
			svg_btn
		}
	}
}

function setTermInfoBtn(app, opts, controls) {
	const info_btn = opts.holder
		// TO-DO: put the conditional display back in using app.state()
		.style('display', 'block') //controls.plot.term && controls.plot.term.term.hashtmldetail ? "block" : "none")
		.style('margin', '10px')
		.style('font-family', 'verdana')
		.style('font-size', '18px')
		.style('font-weight', 'bold')
		.style('cursor', 'pointer')
		.attr('title', 'Grade Details')
		.html('&#9432;')
		.on('click', async () => {
			let info_div

			if (!table_flag) {
				//query server for term_info
				const args = [
					'genome=' +
						controls.plot.obj.genome.name +
						'&dslabel=' +
						controls.plot.obj.mds.label +
						'&getterminfo=1&tid=' +
						controls.plot.term.term.id
				]
				let data
				try {
					data = await client.dofetch2('/termdb?' + args.join('&'))
					if (data.error) throw data.error
				} catch (e) {
					window.alert(e.message || e)
				}

				//create term_info table
				info_div = controls.plot.dom.viz
					.append('div')
					.attr('class', 'term_info_div')
					.style('width', '80vh')
					.style('padding-bottom', '20px')
					.style('display', 'block')
					.append('table')
					.style('white-space', 'normal')
					.append('tbody')

				make_table(info_div, data)
			} else {
				info_div = controls.plot.dom.viz.selectAll('.term_info_div')
			}

			//display term_info under the plot
			info_div.style('display', info_div.style('display') == 'block' ? 'none' : 'block')
		})

	let table_flag = false

	// populate table for term_info when info button clicked
	function make_table(info_div, data) {
		table_flag = true //set flag to true

		for (let s of data.terminfo.src) {
			const source_td = info_div
				.append('tr')
				.append('td')
				.style('padding', '5px 0')

			source_td
				.append('div')
				.style('font-weight', 'bold')
				.text('Source')

			source_td
				.append('div')
				.style('margin-left', '20px')
				.text(s.pub)

			source_td
				.append('div')
				.style('margin-left', '20px')
				.html(s.title + ':&nbsp;<i>' + s.section + '</i>')
		}

		const grade_td = info_div
			.append('tr')
			.append('td')
			.style('padding', '5px 0')
			.append('div')
			.style('font-weight', 'bold')
			.text('Grading Rubric')
			.append('ol')
			.style('margin', '0px')

		for (let grade of data.terminfo.rubric) {
			grade_td
				.append('li')
				.style('font-weight', 'normal')
				.text(grade)
		}
	}

	return {
		main(action, plot) {
			if (plot.term && plot.term.term.hashtmldetail) {
				info_btn
					.style('display', controls.isVisible ? 'inline-block' : 'block')
					.style('margin-top', controls.isVisible ? '15px' : '20px')
					.style('margin-right', controls.isVisible ? '15px' : '10px')
					.style('margin-left', controls.isVisible ? '15px' : '24px')
			}
		},
		dom: {
			info_btn
		}
	}
}

function setConfigDiv(app, opts, controls) {
	const config_div = opts.holder
		.style('max-width', '50px')
		.style('height', 0)
		.style('vertical-align', 'top')
		.style('transition', '0.2s ease-in-out')
		.style('overflow', 'hidden')
		.style('visibility', 'hidden')
		.style('transition', '0.2s')

	const table = config_div
		.append('table')
		.attr('cellpadding', 0)
		.attr('cellspacing', 0)

	function rowIsVisible() {
		return d3select(this).style('display') != 'none'
	}

	return {
		main() {
			config_div
				.style('visibility', controls.isVisible ? 'visible' : 'hidden')
				.style('max-width', controls.isVisible ? '660px' : '50px')
				.style('height', controls.isVisible ? '' : 0)

			table
				.selectAll('tr')
				.filter(rowIsVisible)
				.selectAll('td')
				.style('border-top', '2px solid #FFECDD')
				.style('padding', '5px 10px')
		},
		dom: {
			config_div,
			table
		}
	}
}

//
function initRadioInputs(opts) {
	const divs = opts.holder
		.selectAll('div')
		.style('display', 'block')
		.data(opts.options, d => d.value)

	divs.exit().each(function(d) {
		d3select(this)
			.on('input', null)
			.on('click', null)
			.remove()
	})

	const labels = divs
		.enter()
		.append('div')
		.style('display', 'block')
		.style('padding', '5px')
		.append('label')

	const inputs = labels
		.append('input')
		.attr('type', 'radio')
		.attr('name', opts.name)
		.attr('value', d => d.value)
		.property('checked', opts.isCheckedFxn)
		.style('vertical-align', 'top')
		.on('input', opts.listeners.input)

	labels
		.append('span')
		.style('vertical-align', 'top')
		.html(d => '&nbsp;' + d.label)

	function isChecked(d) {
		return d.value == radio.currValue
	}

	const radio = {
		main(currValue) {
			radio.currValue = currValue
			inputs.property('checked', isChecked)
		},
		dom: {
			divs: opts.holder.selectAll('div'),
			labels: opts.holder.selectAll('label').select('span'),
			inputs: labels.selectAll('input')
		}
	}

	return radio
}

function setOrientationOpts(app, opts, controls) {
	const tr = opts.holder
	tr.append('td')
		.html('Orientation')
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')
	const radio = initRadioInputs({
		name: 'pp-termdb-condition-unit-' + controls.index,
		holder: td,
		options: [{ label: 'Vertical', value: 'vertical' }, { label: 'Horizontal', value: 'horizontal' }],
		listeners: {
			input(d) {
				app.dispatch({
					type: 'plot_edit',
					id: controls.id,
					config: {
						settings: {
							bar: {
								orientation: d.value
							}
						}
					}
				})
			}
		}
	})

	return {
		main(action, plot) {
			tr.style('display', plot.settings.currViews.includes('barchart') ? 'table-row' : 'none')
			radio.main(plot.settings.bar.orientation)
		},
		radio
	}
}

function setScaleOpts(app, opts, controls) {
	const tr = opts.holder
	tr.append('td')
		.html('Scale')
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')
	const radio = initRadioInputs({
		name: 'pp-termdb-scale-unit-' + controls.index,
		holder: td,
		options: [
			{ label: 'Absolute', value: 'abs' },
			{ label: 'Log', value: 'log' },
			{ label: 'Proportion', value: 'pct' }
		],
		listeners: {
			input(d) {
				app.dispatch({
					type: 'plot_edit',
					id: controls.id,
					config: {
						settings: {
							bar: {
								unit: d.value
							}
						}
					}
				})
			}
		}
	})

	return {
		main(action, plot) {
			tr.style('display', plot.settings.currViews.includes('barchart') ? 'table-row' : 'none')
			radio.main(plot.settings.bar.unit)
			radio.dom.divs.style('display', d => {
				if (d.value == 'log') {
					return plot.term2 ? 'none' : 'inline-block'
				} else if (d.value == 'pct') {
					return plot.term2 ? 'inline-block' : 'none'
				} else {
					return 'inline-block'
				}
			})
		},
		radio
	}
}

function setOverlayOpts(app, opts, controls) {
	const obj = app.state()
	const plot = app.state({ type: 'plot', id: controls.id })
	const tr = opts.holder
	tr.append('td')
		.html('Overlay with')
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')
	const radio = initRadioInputs({
		name: 'pp-termdb-overlay-' + controls.index,
		holder: td,
		options: [
			{ label: 'None', value: 'none' },
			{ label: 'Subconditions', value: 'bar_by_children' },
			{ label: 'Grade', value: 'bar_by_grade' },
			{ label: '', value: 'tree' },
			{ label: 'Genotype', value: 'genotype' }
		],
		listeners: {
			input(d) {
				d3event.stopPropagation()
				if (d.value == 'none') {
					controls.dispatch({
						term2: undefined,
						settings: {
							currViews: ['barchart'],
							bar: { overlay: d.value }
						}
					})
				} else if (d.value == 'tree') {
					controls.dispatch({
						term2: { term: termuiObj.termsetting.term },
						settings: { bar: { overlay: d.value } }
					})
				} else if (d.value == 'genotype') {
					// to-do
					console.log('genotype overlay to be handled from term tree portal', d, d3event.target)
				} else if (d.value == 'bar_by_children') {
					if (plot.term.q.bar_by_children) {
						console.log('bar_by_children term1 should not allow subcondition overlay')
						return
					}
					const q = { bar_by_grade: 1 }
					controls.dispatch({
						term2: {
							term: plot.term.term,
							q: {
								bar_by_children: 1
							}
						},
						settings: { bar: { overlay: d.value } }
					})
				} else if (d.value == 'bar_by_grade') {
					if (plot.term.q.bar_by_grade) {
						console.log('bar_by_grade term1 should not allow grade overlay')
						return
					}
					controls.dispatch({
						term2: {
							term: plot.term.term,
							q: {
								bar_by_grade: 1
							}
						},
						settings: { bar: { overlay: d.value } }
					})
				} else {
					console.log('unhandled click event', d, d3event.target)
				}
			},
			click(d) {
				d3event.stopPropagation()
				if (d.value != 'tree' || d.value != plot.settings.bar.overlay) return
				const obj = app.state()
				const plot = app.state({ type: 'plot', id: controls.id })

				obj.showtree4selectterm([plot.term.id, plot.term2 ? plot.term2.term.id : null], tr.node(), term2 => {
					console.log(term2)
					obj.tip.hide()
					controls.dispatch({ term2: { term: term2 } })
				})
			}
		}
	})

	//add blue-pill for term2
	const treeInput = radio.dom.inputs
		.filter(d => {
			return d.value == 'tree'
		})
		.style('margin-top', '2px')
	const pill_div = d3select(treeInput.node().parentNode.parentNode)
		.append('div')
		.style('display', 'inline-block')

	const termuiObj = {
		mainlabel: 'Another term',
		holder: pill_div,
		genome: obj.genome,
		mds: obj.mds,
		tip: obj.tip,
		currterm: plot.term.term,
		termsetting: {
			term: plot.term2 ? plot.term2.term : undefined,
			q: plot.term2 ? plot.term2.q : undefined
		},
		callback: term2 => {
			plot.term2 = term2 ? { term: term2 } : null
			if (term2 && term2.q) plot.term2.q = term2.q
			if (!term2) {
				plot.settings.bar.overlay = 'none'
				controls.dispatch({ settings: { bar: { overlay: 'none' } } })
			} else {
				treeInput.property('checked', true)
				controls.dispatch({ settings: { bar: { overlay: 'tree' } } })
			}
		},
		isCoordinated: true
	}

	plot.termuiObjOverlay = termuiObj
	termui_display(termuiObj)

	return {
		main(action, plot) {
			// hide all options when opened from genome browser view
			tr.style('display', obj.modifier_ssid_barchart ? 'none' : 'table-row')

			// do not show genotype overlay option when opened from stand-alone page
			if (!plot.settings.bar.overlay) {
				plot.settings.bar.overlay = obj.modifier_ssid_barchart
					? 'genotype'
					: plot.term2 && plot.term2.term.id != plot.term.term.id
					? 'tree'
					: 'none'
			}

			radio.main(plot.settings.bar.overlay)

			radio.dom.labels.html(d => {
				const term1 = plot.term.term
				if (!term1.iscondition) return '&nbsp;' + d.label
				if (d.value == 'bar_by_children') return '&nbsp;' + term1.id + ' subconditions'
				if (d.value == 'bar_by_grade') return '&nbsp;' + term1.id + ' grades'
				return '&nbsp;' + d.label
			})

			radio.dom.divs.style('display', d => {
				const term1 = plot.term.term
				if (d.value == 'bar_by_children') {
					return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_grade ? 'block' : 'none'
				} else if (d.value == 'bar_by_grade') {
					return term1.iscondition && !term1.isleaf && term1.q && term1.q.bar_by_children ? 'block' : 'none'
				} else {
					const block = 'block' //term1.q.iscondition || (plot.term2 && plot.term2.term.iscondition) ? 'block' : 'inline-block'
					return d.value != 'genotype' || obj.modifier_ssid_barchart ? block : 'none'
				}
			})

			if (plot.term2 && plot.term2.term.id != plot.term.id && plot.term2 != termuiObj.termsetting.term) {
				termuiObj.termsetting.term = plot.term2.term
				termuiObj.update_ui()
			}
		},
		radio,
		termuiObj
	}
}

function setViewOpts(controls) {
	const tr = controls.dom.table.append('tr')
	tr.append('td')
		.html('Display mode')
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')
	const radio = initRadioInputs({
		name: 'pp-termdb-display-mode-' + controls.index, // elemName
		holder: td,
		options: [
			// options
			{ label: 'Barchart', value: 'barchart' },
			{ label: 'Table', value: 'table' },
			{ label: 'Boxplot', value: 'boxplot' },
			{ label: 'Scatter', value: 'scatter' }
		],
		listeners: {
			input(d) {
				controls.dispatch({
					settings: { currViews: [d.value] }
				})
			}
		}
	})

	return {
		main(plot) {
			tr.style('display', plot.term2 ? 'table-row' : 'none')
			const currValue = plot.settings.currViews.includes('table')
				? 'table'
				: plot.settings.currViews.includes('boxplot')
				? 'boxplot'
				: plot.settings.currViews.includes('scatter')
				? 'scatter'
				: 'barchart'

			radio.main(currValue)
			radio.dom.divs.style('display', d =>
				d.value == 'barchart'
					? 'inline-block'
					: d.value == 'table' && plot.term2
					? 'inline-block'
					: d.value == 'boxplot' && plot.term2 && plot.term2.term.isfloat
					? 'inline-block'
					: d.value == 'scatter' && plot.term.term.isfloat && plot.term2 && plot.term2.term.isfloat
					? 'inline-block'
					: 'none'
			)
		},
		radio
	}
}

function setDivideByOpts(controls) {
	const tr = controls.dom.table.append('tr')
	tr.append('td')
		.html('Divide by')
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')
	const radio = initRadioInputs({
		name: 'pp-termdb-divide-by-' + controls.index,
		holder: td,
		options: [{ label: 'None', value: 'none' }, { label: '', value: 'tree' }, { label: 'Genotype', value: 'genotype' }],
		listeners: {
			input(d) {
				d3event.stopPropagation()
				plot.settings.bar.divideBy = d.value
				if (d.value == 'none') {
					controls.dispatch({ term0: undefined })
				} else if (d.value == 'tree') {
					controls.dispatch({ term0: { term: termuiObj.termsetting.term } })
				} else if (d.value == 'genotype') {
					// to-do
				}
			}
		}
	})

	//add blue-pill for term0
	const pill_div = d3select(
		radio.dom.divs
			.filter(d => {
				return d.value == 'tree'
			})
			.node()
	)
		.append('div')
		.style('display', 'inline-block')

	const plot = controls.plot
	const termuiObj = {
		holder: pill_div,
		genome: plot.obj.genome,
		mds: plot.obj.mds,
		tip: plot.obj.tip,
		currterm: plot.term,
		termsetting: {
			term: plot.term0,
			q: plot.term0 ? plot.term0.q : undefined
		},
		currterm: plot.term,
		callback: term0 => {
			controls.dispatch({
				term0: term0 ? { term: term0 } : undefined,
				settings: {
					bar: {
						divideBy: term0 ? 'tree' : 'none'
					}
				}
			})
		},
		isCoordinated: true
	}

	plot.termuiObjDivide = termuiObj
	termui_display(termuiObj)

	return {
		main(plot) {
			// hide all options when opened from genome browser view
			tr.style(
				'display',
				plot.obj.modifier_ssid_barchart ||
					(!plot.settings.currViews.includes('barchart') && !plot.settings.currViews.includes('scatter'))
					? 'none'
					: 'table-row'
			)
			// do not show genotype divideBy option when opened from stand-alone page
			if (!plot.settings.bar.divideBy) {
				plot.settings.bar.divideBy = plot.obj.modifier_ssid_barchart ? 'genotype' : plot.term0 ? 'tree' : 'none'
			}
			radio.main(plot.settings.bar.divideBy)

			radio.dom.divs.style('display', d => {
				if (d.value == 'max_grade_perperson' || d.value == 'most_recent_grade') {
					return plot.term.term.iscondition || (plot.term0 && plot.term0.term.iscondition) ? 'block' : 'none'
				} else {
					const block = 'block'
					return d.value != 'genotype' || plot.obj.modifier_ssid_barchart ? block : 'none'
				}
			})

			if (plot.term0 && plot.term0.term != termuiObj.termsetting.term) {
				termuiObj.termsetting.term = plot.term0.term
				termuiObj.update_ui()
			}
		}
	}
}

function setBarsAsOpts(app, opts, controls) {
	const tr = opts.holder
	tr.append('td')
		.html(opts.label)
		.attr('class', 'sja-termdb-config-row-label')
	const td = tr.append('td')

	const plot = app.state({ type: 'plot', id: controls.id })
	console.log(plot, controls.id)
	if (!plot.term.q) plot.term.q = {}

	const termuiObj = {
		holder: td.append('div'),
		genome: plot.obj.genome,
		mds: plot.obj.mds,
		tip: plot.obj.tip,
		currterm: plot.term,
		termsetting: plot.term, //{term: plot.term.term, q: plot.term.q},
		is_term1: true,
		callback: term => {
			plot.term.q = term.q
			controls.dispatch({ term: plot.term })
		},
		isCoordinated: true
	}

	if (!plot.term.q) plot.term.q = {}
	termuiObj.termsetting.term.q = plot.term.q
	termui_display(termuiObj)

	return {
		main(plot) {
			tr.style('display', plot.term && plot.term.term.iscondition ? 'table-row' : 'none')
			if (!plot.term.q) plot.term.q = {}
			termuiObj.termsetting.term.q = plot.term.q
			termuiObj.update_ui()
		}
	}
}

function setBinOpts(controls, termNum, label) {
	const plot = controls.plot
	const tr = controls.dom.table.append('tr')
	tr.append('td')
		.html(label)
		.attr('class', 'sja-termdb-config-row-label')
	const bin_edit_td = tr.append('td')

	bin_edit_td
		.append('div')
		.attr('class', 'sja_edit_btn')
		.style('margin-left', '0px')
		.html('EDIT')
		.on('click', () => {
			// click to show ui and customize binning
			numeric_bin_edit(plot.tip, plot.term.term, plot.term.q, true, q => {
				plot.term.q = q
				controls.dispatch({ term: plot.term })
			})
		})

	//TODO: remove following code if not used
	return {
		main(plot) {
			tr.style(
				'display',
				plot[termNum] && (plot[termNum].term.isfloat || plot[termNum].term.isinteger) ? 'table-row' : 'none'
			)
		}
	}
}
