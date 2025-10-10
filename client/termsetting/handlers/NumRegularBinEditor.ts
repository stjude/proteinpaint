import { format } from 'd3-format'
//import { setDensityPlot } from './density'
import { make_radios } from '#dom'
import initBinConfig from '#shared/termdb.initbinconfig.js'
import type { NumRegularBin } from '#tw'
import type { NumDiscrete } from './NumDiscrete.ts'
import type { TermSetting } from '../TermSetting.ts'
import type { RegularNumericBinConfig } from '#types'

export class NumRegularBinEditor {
	tw: NumRegularBin
	q: RegularNumericBinConfig
	editHandler: NumDiscrete
	termsetting: TermSetting
	opts: any
	dom: {
		[elemName: string]: any
	} = {}

	constructor(editHandler) {
		this.editHandler = editHandler
		this.opts = editHandler.opts
		this.tw = editHandler.tw
		this.q = this.getQ()
		this.termsetting = editHandler.termsetting
	}

	main() {
		//this.tw = structuredClone(this.editHandler.tw)
	}

	render(div) {
		if (this.dom.binsTable) {
			if (this.editHandler.dom.binsDiv?.node().contains(this.dom.binsTable.node())) return
			else delete this.dom.binsTable //.remove()
		}
		const binsTable = div.append('table')
		this.dom.binsTable = binsTable
		this.renderBinSizeInput(binsTable.append('tr'))
		this.renderFirstBinInput(binsTable.append('tr'))
		this.renderLastBinInputs(binsTable.append('tr'))
	}

	getQ(): RegularNumericBinConfig {
		if (this.tw.q.type == 'regular-bin') return JSON.parse(JSON.stringify(this.tw.q))
		const self = this.termsetting
		const t = this.tw.term
		const defaultQ = (self.opts.use_bins_less && t.bins?.less) || t.bins?.default
		if (defaultQ) return structuredClone(defaultQ)
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
				//setDensityPlot(handler)
			})
	}

	renderFirstBinInput(tr: any) {
		const handler = this.editHandler.handler
		const tw = this.tw
		if (!tw.q.first_bin) throw 'missing q.first_bin'

		tr.append('td').style('margin', '5px').style('opacity', 0.5).text('First Bin Stop')

		const { min, max } = handler.density_data
		const origValue = tw.q.first_bin.stop

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
				tw.q.first_bin.stop = newValue
				handler.density.renderBinLines(tw.q)
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

		make_radios({
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
					handler.density.renderBinLines(q)
					//setDensityPlot(self)
					return
				}
				// v is "fixed", to assign a number to self.q.last_bin.start
				edit_div.style('display', 'inline-block')
				if (this.dom.last_start_input.property('value') == '') {
					// blank input, fill max
					this.dom.last_start_input.property('value', this.tw.q.last_bin?.start || handler.density_data.max)
				}
				this.setLastBinStart()
				//setDensityPlot(self)
			}
		})

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
		const inputValue = Number(this.dom.last_start_input.property('value'))

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
		if (!q.last_bin)
			q.last_bin = {
				start: inputValue,
				stopunbounded: true,
				stopinclusive: false
			}
		this.editHandler.handler.density.renderBinLines(this.q)
	}

	getEditedQ(startinclusive, stopinclusive): RegularNumericBinConfig {
		const bin_size = this.dom.bin_size_input.property('value')
		const config = {
			type: 'regular-bin',
			startinclusive,
			stopinclusive,
			bin_size: Number(bin_size),
			first_bin: {
				startunbounded: true,
				stop: Number(this.dom.first_stop_input.property('value'))
			},
			rounding: bin_size.includes('.') && !bin_size.endsWith('.') ? `.${bin_size.split('.')[1].length}f` : '.0f'
		} satisfies RegularNumericBinConfig

		for (const name of Object.keys(this.dom)) {
			this.dom[name].remove()
			delete this.dom[name]
		}

		return config
	}
}
