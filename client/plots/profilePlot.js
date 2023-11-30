import { downloadSingleSVG } from '../common/svg.download.js'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { filterJoin } from '#filter'
import { controlsInit } from './controls'
import { fillTermWrapper } from '#termsetting'

const orderedIncomes = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termfilter: appState.termfilter,
			dslabel: appState.vocab.dslabel
		}
	}

	async init(appState) {
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block').style('font-size', '0.9em')
		const holder = this.opts.holder.append('div').style('display', 'inline-block').style('display', 'inline-block')

		const plotDiv = holder.append('div')
		this.dom = {
			controlsDiv,
			holder,
			plotDiv
		}
		this.sampleidmap = await this.app.vocabApi.getAllSamplesByName()
	}

	getList(tw, data) {
		const samples = Object.values(data.lst)
		const sampleValues = Array.from(new Set(samples.map(sample => sample[tw.$id]?.value)))
		const list = sampleValues.map(value => {
			return { label: value, value }
		})
		list.unshift({ label: '', value: '' })
		return list
	}

	async setControls(chartType, additionalInputs = []) {
		const countriesData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: [this.config.countryTW],
			filter: this.getFilter([this.config.countryTW.id])
		})
		const incomesData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: [this.config.incomeTW],
			filter: this.getFilter([this.config.incomeTW.id])
		})
		const typesData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: [this.config.typeTW],
			filter: this.getFilter([this.config.typeTW.id])
		})

		this.regions = Object.keys(this.config.regionTW.term.values).map(value => {
			return { label: value, value }
		})
		this.regions.unshift({ label: '', value: '' })
		this.countries = this.getList(this.config.countryTW, countriesData)
		this.incomes = this.getList(this.config.incomeTW, incomesData)
		this.incomes.sort((elem1, elem2) => {
			const i1 = orderedIncomes.indexOf(elem1.value)
			const i2 = orderedIncomes.indexOf(elem2.value)
			if (i1 < i2) return -1
			return 1
		})
		this.types = this.getList(this.config.typeTW, typesData)

		if (!this.settings.income) this.settings.income = this.incomes[0].value
		if (!this.settings.region) this.settings.region = this.regions[0].value
		if (!this.settings.country) this.settings.country = this.countries[0].value
		if (!this.settings.facilityType) this.settings.facilityType = this.types[0].value

		const filter = this.config.filter || this.getFilter()
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})

		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
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
				label: 'Facility type',
				type: 'dropdown',
				chartType,
				options: this.types,
				settingsKey: 'facilityType',
				callback: value => this.setFacilityType(value)
			}
		]
		inputs.unshift(...additionalInputs)
		if (this.type == 'profileRadarFacility') {
			this.data2 = await this.app.vocabApi.getAnnotatedSampleData({
				terms: this.twLst
			})
			this.sites = this.data2.lst.map(sample => {
				return { label: sample.sampleName, value: sample.sample }
			})
			if (!this.settings.site) this.settings.site = this.sites[0].value

			this.sampleData = this.data2.lst.find(s => s.sample === this.settings.site)
			inputs.unshift({
				label: 'Site',
				type: 'dropdown',
				chartType,
				options: this.sites,
				settingsKey: 'site',
				callback: value => this.setSite(value)
			})
		}
		if (this.type != 'profileBarchart')
			inputs.push({
				label: 'Show table',
				type: 'checkbox',
				chartType,
				settingsKey: 'showTable',
				boxLabel: 'Yes'
			})
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs
			})
		}
		this.components.controls.on(`downloadClick.${chartType}`, () =>
			downloadSingleSVG(this.svg, this.getDownloadFilename(), this.dom.holder.node())
		)
		this.components.controls.on(`helpClick.${chartType}`, () =>
			window.open(
				'https://docs.google.com/document/d/1hsxqTrfHcDqhCjaYbOldz7kWffR_kM9KDk3Xrxa4glk/edit?usp=sharing',
				'_blank'
			)
		)
		this.filtersCount = 0
	}

	setRegion(region) {
		const config = this.config
		this.settings.region = region
		this.settings.country = ''
		this.settings.income = ''
		this.settings.facilityType = ''
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setIncome(income) {
		const config = this.config
		this.settings.income = income
		this.settings.facilityType = ''
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setCountry(country) {
		const config = this.config
		this.settings.country = country
		this.settings.facilityType = ''
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setFacilityType(type) {
		const config = this.config
		this.settings.facilityType = type
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setSite(site) {
		this.settings.site = site
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilter(excluded = []) {
		const lst = []
		processTW(this.config.regionTW, this.settings.region)
		processTW(this.config.countryTW, this.settings.country)
		processTW(this.config.incomeTW, this.settings.income)
		processTW(this.config.typeTW, this.settings.facilityType)

		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst
		}
		const filter = filterJoin([this.state.termfilter.filter, tvslst])
		return filter

		function processTW(tw, value) {
			if (value && !excluded.includes(tw.id))
				lst.push({
					type: 'tvs',
					tvs: {
						term: tw.term,
						values: [{ key: value }]
					}
				})
		}
	}

	addFilterLegend() {
		this.filterG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text(
				this.settings.region || this.settings.country || this.settings.income || this.settings.facilityType
					? 'Filters'
					: 'No filter applied'
			)
			.attr('transform', `translate(0, -5)`)
		this.addFilterLegendItem('Region', this.settings.region)
		this.addFilterLegendItem('Country', this.settings.country)
		this.addFilterLegendItem('Income', this.settings.income)
		this.addFilterLegendItem('Facility type', this.settings.facilityType)
	}

	addFilterLegendItem(filter, value) {
		if (!value) return
		this.filtersCount++

		const text = this.filterG
			.append('text')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(0, ${this.filtersCount * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
	}

	addLegendItem(category, description, index) {
		const text = this.legendG
			.append('text')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(category)
		text.append('tspan').text(`: ${description}`)
	}

	getDownloadFilename() {
		let filename = `${this.type}${this.settings.component ? this.settings.component : ''}${this.settings.region}${
			this.settings.country
		}${this.settings.income}${this.settings.facilityType}.svg`
		filename = filename.split(' ').join('_')
		return filename
	}

	getPercentage(d) {
		if (!d) return null
		if (this.sampleData) {
			const score = this.sampleData[d.score.$id]?.value
			const maxScore = this.sampleData[d.maxScore.$id]?.value
			const percentage = (score / maxScore) * 100
			return Math.round(percentage)
		} else {
			const maxScore = this.data.lst[0]?.[d.maxScore.$id]?.value //Max score has the same value for all the samples on this module
			let scores = this.data.lst.map(sample => (sample[d.score.$id]?.value / maxScore) * 100)
			scores.sort((s1, s2) => s1 - s2)
			const middle = Math.floor(scores.length / 2)
			const score = scores.length % 2 !== 0 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2
			return Math.round(score)
		}
	}
}

export async function loadFilterTerms(config, app) {
	config.countryTW = { id: 'country' }
	config.regionTW = { id: 'WHO_region' }
	config.incomeTW = { id: 'Income_group' }
	config.typeTW = { id: 'FC_TypeofFacility' }

	await fillTermWrapper(config.countryTW, app.vocabApi)
	await fillTermWrapper(config.regionTW, app.vocabApi)
	await fillTermWrapper(config.incomeTW, app.vocabApi)
	await fillTermWrapper(config.typeTW, app.vocabApi)
}
