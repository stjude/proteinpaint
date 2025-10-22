import { format } from 'd3-format'
//import { setDensityPlot } from './density'
import { make_radios } from '#dom'
import initBinConfig from '#shared/termdb.initbinconfig.js'
import type { NumRegularBin } from '#tw'
import type { NumDiscreteEditor } from './NumDiscreteEditor.ts'
import type { BoundaryOpts, BoundaryValue, DraggedLineData } from './NumericDensity.ts'
import type { TermSetting } from '../TermSetting.ts'
import type { RegularNumericBinConfig } from '#types'

export class NumRegularBinEditor {
	tw: NumRegularBin
	q: RegularNumericBinConfig
	editHandler: NumDiscreteEditor
	termsetting: TermSetting
	opts: any
	dom: {
		[elemName: string]: any
	} = {}

	constructor(editHandler) {
		this.editHandler = editHandler
		this.opts = editHandler.opts
		this.tw = editHandler.tw
		this.termsetting = editHandler.termsetting
		this.q = this.getDefaultQ()
	}

	getPillStatus() {
		return { text: 'bin size=' + this.tw.q.bin_size }
	}

	render(div) {
		this.editHandler.handler.density.setBinLines(this.getBoundaryOpts())
		if (this.dom.binsTable) {
			if (this.editHandler.dom.binsDiv?.node().contains(this.dom.binsTable.node())) return
			else {
				this.dom.binsTable.remove()
				delete this.dom.binsTable
			}
		}
		const binsTable = div.append('table')
		this.dom.binsTable = binsTable
		this.renderBinSizeInput(binsTable.append('tr'))
		this.renderFirstBinInput(binsTable.append('tr'))
		this.renderLastBinInputs(binsTable.append('tr'))
	}

	getDefaultQ(): RegularNumericBinConfig {
		if (this.tw.q.type == 'regular-bin') return JSON.parse(JSON.stringify(this.tw.q))
		const t = this.tw.term
		const defaultQ = (this.termsetting.opts.use_bins_less && t.bins?.less) || t.bins?.default
		if (defaultQ) return JSON.parse(JSON.stringify(defaultQ))
		const binConfig = initBinConfig(this.editHandler.handler.density_data)
		return typeof binConfig == 'string' ? JSON.parse(binConfig) : binConfig
	}

	renderBinSizeInput(tr: any) {
		const handler = this.editHandler.handler
		tr.append('td').style('margin', '5px').style('opacity', 0.5).text('Bin Size')

		const { min, max } = handler.density_data
		const q = this.q
		const origBinSize = q.bin_size

		this.dom.bin_size_input = tr
			.append('td')
			.append('input')
			.attr('type', 'number')
			.attr('value', 'rounding' in q ? format(q.rounding || '.0f')(q.bin_size) : q.bin_size)
			.style('margin-left', '15px')
			.style('width', '100px')
			.style('color', () => (q.bin_size > Math.abs(max - min) ? 'red' : ''))
			.on('change', event => {
				const newValue = Number(event.target.value)
				// must validate input value
				if (newValue <= 0) {
					window.alert('Please enter non-negative bin size.')
					// must reset value in <input>, otherwise the wrong value will be recorded in self.q upon clicking Submit
					event.target.value = origBinSize
					return
				}
				if ((max - min) / newValue > 100) {
					// avoid rendering too many svg lines and lock up browser
					window.alert('Bin size too small. Try setting a bigger value.')
					event.target.value = origBinSize
					return
				}
				q.bin_size = newValue
				this.dom.bin_size_input.style('color', q.bin_size > max - min ? 'red' : newValue != origBinSize ? 'green' : '')
				handler.density.setBinLines(this.getBoundaryOpts())
			})
	}

	renderFirstBinInput(tr: any) {
		const handler = this.editHandler.handler
		const q = this.q
		if (!q.first_bin) throw 'missing q.first_bin'

		tr.append('td').style('margin', '5px').style('opacity', 0.5).text('First Bin Stop')

		const { min, max } = handler.density_data
		const origValue = q.first_bin.stop

		this.dom.first_stop_input = tr
			.append('td')
			.append('input')
			.attr('type', 'number')
			.property('value', origValue)
			.style('width', '100px')
			.style('margin-left', '15px')
			.on('change', event => {
				const newValue = Number(event.target.value)
				if (newValue < min || newValue > max) {
					window.alert('First bin stop value out of bound.')
					event.target.value = origValue
					return
				}

				// first_bin should have already been set; adding the check just to skip the tsc error...
				this.q.first_bin.stop = newValue
				handler.density.setBinLines(this.getBoundaryOpts())
			})

		tr.append('td')
			.append('div')
			.style('font-size', '.6em')
			.style('opacity', 0.5)
			.style('display', handler.density.no_density_data ? 'none' : 'block')
			.text('Indicated by left-most red line. Drag to change.')
	}

	renderLastBinInputs(tr) {
		const handler = this.editHandler.handler
		const q = this.q
		// tell if last bin is automatic (not fixed)
		const isAuto = !q.last_bin || !Number.isFinite(q.last_bin.start)

		tr.append('td')
			.style('padding-top', '4px')
			.style('opacity', 0.5)
			.style('vertical-align', 'top')
			.text('Last Bin Start')

		const td1 = tr.append('td').style('padding-left', '15px').style('vertical-align', 'top')
		const radio_div = td1.append('div')

		const radios = make_radios({
			holder: radio_div,
			options: [
				{ label: 'Automatic', value: 'auto', checked: isAuto },
				{ label: 'Fixed', value: 'fixed', checked: !isAuto }
			],
			callback: v => {
				if (v == 'auto') {
					delete q.last_bin
					// if just deleting last_bin.start and keeps q.last_bin{}, density plot may set last_bin.bin='last' and will break bin validation
					edit_div.style('display', 'none')
					handler.density.setBinLines(this.getBoundaryOpts())
					return
				}
				// v is "fixed", to assign a number to self.q.last_bin.start
				edit_div.style('display', 'inline-block')
				if (this.dom.last_start_input.property('value') == '') {
					// blank input, fill max
					this.dom.last_start_input.property('value', this.tw.q.last_bin?.start || handler.density_data.max)
				}
				this.setLastBinStart()
			}
		})

		this.dom.fixed_radio = radios.inputs.filter((_, i) => i === 1)

		const edit_div = tr
			.append('td')
			.append('div')
			.style('display', isAuto ? 'none' : 'inline-block')

		this.dom.last_start_input = edit_div
			.append('input')
			.attr('type', 'number')
			.property('value', q.last_bin?.start || '')
			.style('width', '100px')
			.on('change', () => this.setLastBinStart())

		edit_div
			.append('div')
			.style('font-size', '.6em')
			.style('opacity', 0.5)
			.style('display', handler.density.no_density_data ? 'none' : 'block')
			.text('Indicated by right-most red line. Drag to change.')
	}

	setLastBinStart() {
		const q = this.q
		const { max } = this.editHandler.handler.density_data
		// only get value from <input>
		const strInput = this.dom.last_start_input.property('value')
		if (strInput === '') return
		const inputValue = Number(strInput)

		// TODO first_bin should be required
		if (q.first_bin && inputValue <= q.first_bin.stop) {
			window.alert('Last bin start cannot be smaller than first bin stop.')
			this.dom.last_start_input.property('value', max)
			return
		}
		if (inputValue > max) {
			window.alert('Last bin start value out of bound.')
			this.dom.last_start_input.property('value', max)
			return
		}
		if (q.last_bin) q.last_bin.start = inputValue
		else
			q.last_bin = {
				start: inputValue,
				stopunbounded: true,
				stopinclusive: false
			}

		this.editHandler.handler.density.setBinLines(this.getBoundaryOpts())
	}

	getBoundaryOpts(): BoundaryOpts {
		const { min, max } = this.editHandler.handler.density_data
		const binLinesStop = this.q.last_bin?.start ?? max + Math.abs(this.q.first_bin.stop) - Math.min(min, 0)
		const boundaryValues: BoundaryValue[] = []
		for (let i = this.q.first_bin.stop; i <= binLinesStop; i = i + this.q.bin_size) {
			if (this.q.last_bin?.start === i) break
			if (i > binLinesStop) boundaryValues[boundaryValues.length - 1].isLastVisibleLine = true
			const isDraggable = i === this.q.first_bin.stop || i === this.q.bin_size - 1
			// non-draggable lines should move with the first bin boundary line
			boundaryValues.push({ x: i, isDraggable, movesWithLineIndex: !isDraggable ? 0 : -1 })
		}
		if (this.q.last_bin) {
			boundaryValues.push({
				x: this.q.last_bin.start,
				isDraggable: true,
				isLastVisibleLine: true,
				movesWithLineIndex: -1
			})
		}

		return {
			values: boundaryValues,
			callback: (d: DraggedLineData, value) => {
				//d.scaledX = Math.round(xscale(value))
				if (d.index === 0) {
					this.dom.first_stop_input.property('value', value)
					this.q.first_bin.stop = value as number
				} else {
					this.editHandler.handler.dom.last_start_input.property('value', value)
					//if (!this.q.last_bin) this.q.last_bin = {}
					if (this.q.last_bin) this.q.last_bin.start = value
					//middleLines.style('display', (c: any) => (d.draggedX && c.scaledX >= d.draggedX ? 'none' : ''))
				}
			}
		}
	}

	getEditedQ(destroyDom = true): RegularNumericBinConfig {
		const bin_size = this.dom.bin_size_input.property('value')
		const config: RegularNumericBinConfig = {
			mode: 'discrete',
			type: 'regular-bin',
			startinclusive: this.editHandler.boundaryInclusion == 'startinclusive',
			stopinclusive: this.editHandler.boundaryInclusion == 'stopinclusive',
			bin_size: Number(bin_size),
			first_bin: {
				startunbounded: true,
				stop: Number(this.dom.first_stop_input.property('value'))
			},
			rounding: bin_size.includes('.') && !bin_size.endsWith('.') ? `.${bin_size.split('.')[1].length}f` : '.0f'
		}

		if (this.dom.fixed_radio.property('checked')) {
			config.last_bin = {
				start: Number(this.dom.last_start_input.property('value')),
				stopunbounded: true
			}
		}

		if (destroyDom) {
			for (const name of Object.keys(this.dom)) {
				this.dom[name].remove()
				delete this.dom[name]
			}
		}

		return config
	}

	undoEdits() {
		this.q = this.getDefaultQ()
		this.dom.binsTable.selectAll('*').remove()
		this.renderBinSizeInput(this.dom.binsTable.append('tr'))
		this.renderFirstBinInput(this.dom.binsTable.append('tr'))
		this.renderLastBinInputs(this.dom.binsTable.append('tr'))
		this.editHandler.handler.density.setBinLines(this.getBoundaryOpts())
	}
}
