import { downloadSingleSVG } from '../common/svg.download.js'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { filterJoin } from '#filter'
import { controlsInit } from './controls'
export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termfilter: appState.termfilter
		}
	}

	async init(appState) {
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block')
		const holder = this.opts.holder.append('div').style('display', 'inline-block').style('display', 'inline-block')

		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')
		const firstDiv = div.append('div').style('display', 'inline-block')
		const plotDiv = holder.append('div')
		this.dom = {
			controlsDiv,
			holder,
			firstDiv,
			filterDiv: div,
			facilityDiv: div.insert('div').style('display', 'inline-block'),
			plotDiv
		}
		const config = appState.plots.find(p => p.id === this.id)
		const regions = Object.keys(config.regionTW.term.values)
		const countries = Object.keys(config.countryTW.term.values)
		const incomes = Object.keys(config.incomeTW.term.values)
		this.sampleidmap = await this.app.vocabApi.getAllSamplesByName()
		this.regions = regions.map(region => {
			return { label: region, value: region }
		})
		this.countries = countries.map(country => {
			return { label: country, value: country }
		})
		this.incomes = incomes.map(income => {
			return { label: income, value: income }
		})
		const emptyItem = { value: '', label: '' }
		const globalItem = { value: 'Global', label: 'Global' }
		this.regions.unshift(globalItem)
		this.regions.unshift(emptyItem)
		this.countries.unshift(globalItem)
		this.countries.unshift(emptyItem)
		this.incomes.unshift(emptyItem)
		this.sites = []
	}

	async setControls(chartType) {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'Show table',
				type: 'checkbox',
				chartType,
				settingsKey: 'showTable',
				boxLabel: 'Yes'
			},
			{
				label: 'Region',
				type: 'dropdown',
				chartType,
				options: this.regions,
				settingsKey: 'region',
				callback: value => this.setRegion(value)
			},
			{
				label: 'Country',
				type: 'dropdown',
				chartType,
				options: this.countries,
				settingsKey: 'country',
				callback: value => this.setCountry(value)
			},
			{
				label: 'Income group',
				type: 'dropdown',
				chartType,
				options: this.incomes,
				settingsKey: 'income',
				callback: value => this.setIncome(value)
			},
			{
				label: 'Site',
				type: 'dropdown',
				chartType,
				options: this.sites,
				settingsKey: 'site',
				callback: value => this.setSample(value)
			}
		]
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs
			})
		}
		this.components.controls.on(`downloadClick.${chartType}`, () => downloadSingleSVG(this.svg, this.filename))
	}

	setRegion(region) {
		const config = this.config
		this.settings.facility = ''
		this.settings.region = region
		this.settings.income = ''
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setIncome(income) {
		const config = this.config
		this.settings.facility = ''
		this.settings.income = income
		this.settings.region = ''
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setCountry(country) {
		const config = this.config
		this.settings.facility = ''
		this.settings.country = country
		this.settings.region = ''
		this.settings.income = ''

		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setSite(site) {
		this.settings.site = site
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	getFilter() {
		let tvs
		const lst = []
		if (this.settings.region)
			lst.push({
				type: 'tvs',
				tvs: {
					term: this.config.regionTW.term,
					values: [{ key: this.settings.region }]
				}
			})
		if (this.settings.country)
			lst.push({
				type: 'tvs',
				tvs: {
					term: this.config.countryTW.term,
					values: [{ key: this.settings.country }]
				}
			})
		if (this.settings.income)
			lst.push({
				type: 'tvs',
				tvs: {
					term: this.config.incomeTW.term,
					values: [{ key: this.settings.income }]
				}
			})
		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst
		}

		const filter = filterJoin([this.state.termfilter.filter, tvslst])

		return filter
	}

	addLegendFilter(filter, value, index) {
		const text = this.filterG
			.append('text')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
	}

	addLegendItem(category, description, index) {
		const text = this.legendG
			.append('text')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(category)
		text.append('tspan').text(`: ${description}`)
	}
}
