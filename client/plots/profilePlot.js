import { downloadSingleSVG } from '../common/svg.download.js'
import { filterJoin } from '#filter'
import { controlsInit } from './controls'
import { fillTwLst } from '#termsetting'
import { select } from 'd3-selection'
import { getSampleFilter } from '../termsetting/handlers/samplelst'

const orderedIncomes = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
		this.downloadCount = 0
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			termfilter: appState.termfilter,
			dslabel: appState.vocab.dslabel,
			vocab: appState.vocab,
			isLoggedIn: config.isLoggedIn,
			site: config.site
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)

		if (this.opts.header) {
			const suffix = config.isLoggedIn ? (config.site ? config.site : 'Admin') : 'Public'
			this.opts.header.text(config.header ? config.header : config.chartType + ` / ${suffix}`)
		}
		const div = this.opts.holder.append('div')
		const holder2 = div.append('div')
		const mainDiv = div.append('div')

		const controlsDiv = mainDiv.insert('div').style('display', 'inline-block').style('font-size', '0.9em')
		const holder = mainDiv.insert('div').style('display', 'inline-block')

		const plotDiv = holder.append('div')
		this.dom = {
			controlsDiv,
			holder,
			plotDiv,
			holder2
		}
		select('.sjpp-output-sandbox-content').on('scroll', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))
		this.sampleidmap = await this.app.vocabApi.getAllSamplesByName()

		if (config.site) {
			if (Object.keys(this.sampleidmap).length == 0) throw 'You must login to view site info' //no sample data returned
			const id = this.sampleidmap[config.site]
			if (!id) throw 'Invalid site'
		}
	}

	getList(tw) {
		const data = this.filtersData.lst.filter(sample => this.samplesPerFilter[tw.id].includes(parseInt(sample.sample)))
		const sampleValues = Array.from(new Set(data.map(sample => sample[tw.$id]?.value)))
		const list = sampleValues.map(value => {
			return { label: value, value }
		})
		list.unshift({ label: '', value: '' })
		if (!(tw.id in this.settings)) this.settings[tw.id] = list[0].value
		return list
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings[this.type]
		if (this.settings.show2Plots) {
			if (!this.plotAdded) await this.addPlot()
		} else {
			if (this.plotAdded) this.dom.holder2.selectAll('*').remove()
			this.plotAdded = false
		}
	}

	async addPlot() {
		this.plotAdded = true
		const appState = this.state
		const plotMod = await import('#plots/plot.app.js')
		const plot = { chartType: this.type }
		if (this.type == 'profileRadar' || this.type == 'profileRadarFacility') plot.plot = this.config.plot
		const opts = { holder: this.dom.holder2, state: { plots: [plot], vocab: appState.vocab } }
		const plotAppApi = await plotMod.appInit(opts)
	}

	async setControls(additionalInputs = []) {
		const filters = {}
		for (const tw of this.config.filterTWs) {
			const filter = this.getFilter([tw.id])
			if (filter) filters[tw.id] = filter
		}
		this.samplesPerFilter = await this.app.vocabApi.getSamplesPerFilter({
			filters
		})

		this.filtersData = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.config.filterTWs,
			termsPerRequest: 10
		})

		this.regions = Object.keys(this.config.regionTW.term.values).map(value => {
			return { label: value, value }
		})
		this.regions.unshift({ label: '', value: '' })
		this.countries = this.getList(this.config.countryTW)
		this.incomes = this.getList(this.config.incomeTW)
		this.teachingStates = this.getList(this.config.teachingStatusTW)
		this.referralStates = this.getList(this.config.referralStatusTW)
		this.fundingSources = this.getList(this.config.fundingSourceTW)
		this.hospitalVolumes = this.getList(this.config.hospitalVolumeTW)
		this.yearsOfImplementation = this.getList(this.config.yearOfImplementationTW)

		this.incomes.sort((elem1, elem2) => {
			const i1 = orderedIncomes.indexOf(elem1.value)
			const i2 = orderedIncomes.indexOf(elem2.value)
			if (i1 < i2) return -1
			return 1
		})
		this.types = this.getList(this.config.typeTW)

		const filter = this.config.filter || this.getFilter()
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter,
			termsPerRequest: 30
		})
		const chartType = this.type
		this.dom.controlsDiv.selectAll('*').remove()

		let inputs = []
		if (this.state.isLoggedIn && this.state.site && chartType != 'profileRadarFacility') {
			const dataInput = {
				label: 'Data',
				type: 'radio',
				chartType,
				settingsKey: 'isAggregate',
				options: [
					{ label: this.state.site, value: false },
					{ label: 'Aggregate', value: true }
				]
			}

			inputs.push(dataInput)
		}
		if (
			!this.state.isLoggedIn ||
			!this.state.site ||
			this.settings.isAggregate ||
			chartType == 'profileRadarFacility'
		) {
			inputs.push(
				...[
					{
						label: 'Region',
						type: 'dropdown',
						chartType,
						options: this.regions,
						settingsKey: this.config.regionTW.id,
						callback: value => this.setRegion(value)
					},
					{
						label: 'Country',
						type: 'dropdown',
						chartType,
						options: this.countries,
						settingsKey: this.config.countryTW.id,
						callback: value => this.setCountry(value)
					},
					{
						label: 'Income group',
						type: 'dropdown',
						chartType,
						options: this.incomes,
						settingsKey: this.config.incomeTW.id,
						callback: value => this.setIncome(value)
					},
					{
						label: 'Facility type',
						type: 'dropdown',
						chartType,
						options: this.types,
						settingsKey: this.config.typeTW.id,
						callback: value => this.setFacilityType(value)
					},
					{
						label: 'Teaching status',
						type: 'dropdown',
						chartType,
						options: this.teachingStates,
						settingsKey: this.config.teachingStatusTW.id,
						callback: value => this.setFilterValue(this.config.teachingStatusTW.id, value)
					},
					{
						label: 'Referral status',
						type: 'dropdown',
						chartType,
						options: this.referralStates,
						settingsKey: this.config.referralStatusTW.id,
						callback: value => this.setFilterValue(this.config.referralStatusTW.id, value)
					},
					{
						label: 'Funding source',
						type: 'dropdown',
						chartType,
						options: this.fundingSources,
						settingsKey: this.config.fundingSourceTW.id,
						callback: value => this.setFilterValue(this.config.fundingSourceTW.id, value)
					},
					{
						label: 'Hospital volume',
						type: 'dropdown',
						chartType,
						options: this.hospitalVolumes,
						settingsKey: this.config.hospitalVolumeTW.id,
						callback: value => this.setFilterValue(this.config.hospitalVolumeTW.id, value)
					},
					{
						label: 'Year of implementation',
						type: 'dropdown',
						chartType,
						options: this.yearsOfImplementation,
						settingsKey: this.config.yearOfImplementationTW.id,
						callback: value => this.setFilterValue(this.config.yearOfImplementationTW.id, value)
					}
				]
			)
		}
		if (chartType != 'profileRadarFacility')
			inputs.push({
				label: 'Add plot',
				type: 'checkbox',
				chartType,
				settingsKey: 'show2Plots',
				boxLabel: 'Yes'
			})
		inputs.unshift(...additionalInputs)
		await this.loadSampleData(chartType, inputs)

		if (this.type == 'profilePolar')
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

	async loadSampleData(chartType, inputs) {
		if (chartType != 'profileRadarFacility') {
			if (this.state.isLoggedIn) {
				let result
				if (this.state.site && !this.settings.isAggregate) {
					const id = this.sampleidmap[this.state.site]
					this.settings.site = id
					this.sites = [{ label: this.state.site, value: id }]
				} //Admin
				else if (!this.state.site) {
					this.sites = this.data.lst.map(s => {
						return { label: this.data.refs.bySampleId[s.sample].label, value: s.sample }
					})
					this.sites.unshift({ label: '', value: '' })
					inputs.push({
						label: 'Site',
						type: 'dropdown',
						chartType,
						options: this.sites,
						settingsKey: 'site',
						callback: value => this.setSite(value)
					})
				}
				if (this.settings.site) this.sampleData = this.data.lst[this.settings.site]
				else this.sampleData = null
			}
		} else {
			let result
			if (this.state.isLoggedIn) {
				let result

				if (this.state.site) {
					const id = this.sampleidmap[this.state.site]
					this.settings.site = id
					this.sites = [{ label: this.state.site, value: id }]
					result = await this.app.vocabApi.getAnnotatedSampleData({
						terms: this.twLst,
						termsPerRequest: 30,
						filter: getSampleFilter(parseInt(id))
					})
					this.sampleData = result.lst[0]
				} //Admin
				else {
					result = await this.app.vocabApi.getAnnotatedSampleData({
						terms: this.twLst,
						termsPerRequest: 30
					})
					this.sites = result.lst.map(s => {
						return { label: result.refs.bySampleId[s.sample].label, value: s.sample }
					})
					if (!this.settings.site) this.settings.site = result.lst[0].sample
					this.sampleData = result.lst[this.settings.site]
				}
				inputs.unshift({
					label: 'Site',
					type: 'dropdown',
					chartType,
					options: this.sites,
					settingsKey: 'site',
					callback: value => this.setSite(value)
				})
			}
		}
	}

	setFilterValue(key, value) {
		const config = this.config
		this.settings[key] = value
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	setRegion(region) {
		const config = this.config
		this.settings[config.regionTW.id] = region
		this.clearFiltersExcept([config.regionTW.id])
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	clearFiltersExcept(ids) {
		for (const tw of this.config.filterTWs) if (!ids.includes(tw.id)) this.settings[tw.id] = ''
		this.settings.site = ''
	}

	setIncome(income) {
		const config = this.config
		this.settings.income = income
		this.clearFiltersExcept([config.regionTW.id, config.incomeTW.id])

		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setCountry(country) {
		const config = this.config
		this.settings.country = country
		this.clearFiltersExcept([config.regionTW.id, config.countryTW.id])
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setFacilityType(type) {
		const config = this.config
		this.settings.facilityType = type
		this.clearFiltersExcept([config.regionTW.id, config.countryTW.id, config.incomeTW.id, config.typeTW.id])

		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setSite(site) {
		this.settings.site = site
		this.sampleData = null
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilter(excluded = []) {
		const lst = []
		for (const tw of this.config.filterTWs) this.processTW(tw, this.settings[tw.id], excluded, lst)

		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst
		}
		const filter = filterJoin([this.state.termfilter.filter, tvslst])
		return filter
	}

	processTW(tw, value, excluded, lst) {
		if (value && !excluded.includes(tw.$id))
			lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: value }]
				}
			})
	}

	addFilterLegend() {
		if (!this.settings.site || this.config.chartType == 'profileRadarFacility') {
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
		if (this.settings.site && this.config.chartType != 'profileRadarFacility') {
			const label = this.sites.find(s => s.value == this.settings.site).label
			this.addFilterLegendItem('Facility', label)
		}
	}

	addFilterLegendItem(filter, value) {
		if (!value) return
		this.filtersCount++

		const text = this.filterG
			.append('text')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(0, ${this.filtersCount * 22})`)
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
		this.downloadCount++
		let filename = `${this.type}${this.component ? this.component : ''}${this.settings.region}${this.settings.country}${
			this.settings.income
		}${this.settings.facilityType}${this.downloadCount}.svg`
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
	const twlst = []
	config.countryTW = { id: 'country' }
	config.regionTW = { id: 'WHO_region' }
	config.incomeTW = { id: 'Income_group' }
	config.typeTW = { id: 'FC_TypeofFacility' }
	config.teachingStatusTW = { id: 'FC_TeachingFacility' }
	config.referralStatusTW = { id: 'FC_ReferralFacility' }
	config.fundingSourceTW = { id: 'FC_FundingSrc' }
	//config.annualDiagnosisNumber = {id: 'PO_TotalDxAll'}
	config.hospitalVolumeTW = { id: 'PO_HospitalVolume' }
	config.yearOfImplementationTW = { id: 'Year_implementation' }

	twlst.push(
		...[
			config.countryTW,
			config.regionTW,
			config.incomeTW,
			config.typeTW,
			config.teachingStatusTW,
			config.referralStatusTW,
			config.fundingSourceTW,
			config.hospitalVolumeTW,
			config.yearOfImplementationTW
		]
	)
	await fillTwLst(twlst, app.vocabApi)
	config.filterTWs = twlst
}

export function getDefaultProfilePlotSettings() {
	return {
		show2Plots: false,
		isAggregate: false
	}
}
