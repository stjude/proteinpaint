import { event as d3event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'
import { renderBoundaryInclusionInput, renderBoundaryInputDivs } from './termsetting.numeric.discrete'
import { get_bin_label } from '../../shared/termdb.bins'
import { init_tabs } from '../dom/toggleButtons'
import { keyupEnter } from '../client'
import { make_one_checkbox } from '../dom/checkbox'

// self is the termsetting instance
export function getHandler(self) {
	return {
		get_term_name(d) {
			if (!self.opts.abbrCutoff) return d.name
			return d.name.length <= self.opts.abbrCutoff + 2
				? d.name
				: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
		},

		get_status_msg() {
			return ''
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
			renderTypeInputs(self)
		}
	}
}

function setqDefaults(self) {
	const dd = self.num_obj.density_data
	const cache = self.numqByTermIdModeType
	const t = self.term
	if (!cache[t.id]) cache[t.id] = {}
	if (!cache[t.id].spline) {
		const defaultCustomBoundary =
			dd.maxvalue != dd.minvalue ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2 : dd.maxvalue

		cache[t.id].spline = {
			spline_auto: { lst: [] },
			spline_custom:
				self.q && self.q.type == 'spline_custom'
					? self.q
					: {
							type: 'spline_custom',
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
		if (!cache[t.id].spline.spline_auto.type) {
			cache[t.id].spline.spline_auto.type = 'spline_auto'
		}
	} else if (t.q) {
		/*** is this deprecated? term.q will always be tracked outside of the main term object? ***/
		if (!t.q.type) throw `missing numeric term spline q.type: should be 'spline-auto' or 'spline-custom'`
		cache[t.id].discrete[t.q.type] = t.q
	}

	//if (self.q && self.q.type && Object.keys(self.q).length>1) return
	if (self.q && !self.q.mode) self.q.mode = 'spline'
	if (!self.q || self.q.mode !== 'spline') self.q = {}
	if (!self.q.type) self.q.type = 'spline_auto'
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id].spline[self.q.type]))
	self.q = Object.assign(cacheCopy, self.q)
	const bin_size = 'bin_size' in self.q && self.q.bin_size.toString()
	if (!self.q.rounding && typeof bin_size == 'string' && bin_size.includes('.') && !bin_size.endsWith('.')) {
		const binDecimals = bin_size.split('.')[1].length
		self.q.rounding = '.' + binDecimals + 'f'
	}
	if (self.q.lst) {
		self.q.lst.forEach(bin => {
			if (!('label' in bin)) bin.label = get_bin_label(bin, self.q)
		})
	}
	//*** validate self.q ***//
	// console.log(self.q)
}

function renderTypeInputs(self) {
	// toggle switch
	const div = self.dom.bins_div.append('div').style('margin', '10px')
	const tabs = [
		{
			active: self.q.type == 'spline_auto' ? true : false,
			label: 'Auto compute knots',
			callback: async div => {
				self.q.type = 'spline_auto'
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[0].isInitialized) {
					// renderFixedBinsInputs(self, div)
					tabs[0].isInitialized = true
				}
			}
		},
		{
			active: self.q.type == 'spline_custom' ? true : false,
			label: 'Specity custom knots',
			callback: async div => {
				self.q.type = 'spline_custom'
				setqDefaults(self)
				setDensityPlot(self)
				if (!tabs[1].isInitialized) {
					// renderCustomBinInputs(self, div)
					tabs[1].isInitialized = true
				}
			}
		}
	]
	init_tabs({ holder: div, tabs })
}
