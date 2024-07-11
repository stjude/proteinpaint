import { downloadSingleSVG } from '../common/svg.download.js'
import { filterJoin } from '#filter'
import { controlsInit } from './controls'
import { fillTwLst } from '#termsetting'
import { select } from 'd3-selection'
import { getSampleFilter } from '../mass/groups.js'
import { Menu } from '#dom/menu'

const orderedIncomes = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
const orderedVolumes = [
	'Small (1-25 annual newly diagnoses)',
	'Medium (26-80 annual newly diagnoses)',
	'Large (81-120 annual newly diagnoses)',
	'Very large (>120 annual newly diagnoses)'
]

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

		const controlsDiv = mainDiv.insert('div').style('display', 'inline-block').style('font-size', '0.8em')
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
		this.sampleidmap = await this.app.vocabApi.getSamplesByName()

		if (config.site) {
			if (Object.keys(this.sampleidmap).length == 0) throw 'You must login to view site info' //no sample data returned
			const id = this.sampleidmap[config.site]?.id
			if (!id) throw 'Invalid site'
		}

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
		document.addEventListener('scroll', event => this?.tip?.hide())
	}

	getList(tw) {
		const values = Object.values(tw.term.values)
		const data = this.filtersData.lst.filter(sample =>
			this.samplesPerFilter[tw.term.id].includes(parseInt(sample.sample))
		)
		const sampleValues = Array.from(new Set(data.map(sample => sample[tw.$id]?.value)))

		for (const value of values) {
			value.value = value.label
			value.disabled = !sampleValues.includes(value.label)
		}
		values.unshift({ label: '', value: '' })
		if (!(tw.term.id in this.settings)) this.settings[tw.term.id] = values[0].label
		return values
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
			const filter = this.getFilter(tw)
			if (filter) filters[tw.term.id] = filter
		}

		//Dictionary with samples applying all the filters but not the one from the current term id
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
		this.hospitalVolumes.sort((elem1, elem2) => {
			const i1 = orderedVolumes.indexOf(elem1.value)
			const i2 = orderedVolumes.indexOf(elem2.value)
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
						settingsKey: this.config.regionTW.term.id,
						callback: value => this.setRegion(value)
					},
					{
						label: 'Country',
						type: 'dropdown',
						chartType,
						options: this.countries,
						settingsKey: this.config.countryTW.term.id,
						callback: value => this.setFilterValue(this.config.countryTW.term.id, value)
					},
					{
						label: 'Income group',
						type: 'dropdown',
						chartType,
						options: this.incomes,
						settingsKey: this.config.incomeTW.term.id,
						callback: value => this.setFilterValue(this.config.incomeTW.term.id, value)
					},
					{
						label: 'Facility type',
						type: 'dropdown',
						chartType,
						options: this.types,
						settingsKey: this.config.typeTW.term.id,
						callback: value => this.setFilterValue(this.config.typeTW.term.id, value)
					},
					{
						label: this.config.teachingStatusTW.term.name,
						type: 'dropdown',
						chartType,
						options: this.teachingStates,
						settingsKey: this.config.teachingStatusTW.term.id,
						callback: value => this.setFilterValue(this.config.teachingStatusTW.term.id, value)
					},
					{
						label: this.config.referralStatusTW.term.name,
						type: 'dropdown',
						chartType,
						options: this.referralStates,
						settingsKey: this.config.referralStatusTW.term.id,
						callback: value => this.setFilterValue(this.config.referralStatusTW.term.id, value)
					},
					{
						label: this.config.fundingSourceTW.term.name,
						type: 'dropdown',
						chartType,
						options: this.fundingSources,
						settingsKey: this.config.fundingSourceTW.term.id,
						callback: value => this.setFilterValue(this.config.fundingSourceTW.term.id, value)
					},
					{
						label: this.config.hospitalVolumeTW.term.name,
						type: 'dropdown',
						chartType,
						options: this.hospitalVolumes,
						settingsKey: this.config.hospitalVolumeTW.term.id,
						callback: value => this.setFilterValue(this.config.hospitalVolumeTW.term.id, value)
					},
					{
						label: this.config.yearOfImplementationTW.term.name,
						type: 'dropdown',
						chartType,
						options: this.yearsOfImplementation,
						settingsKey: this.config.yearOfImplementationTW.term.id,
						callback: value => this.setFilterValue(this.config.yearOfImplementationTW.term.id, value)
					}
				]
			)
		}
		await this.loadSampleData(chartType, inputs)

		if (chartType != 'profileRadarFacility')
			inputs.push({
				label: 'Open a plot for comparison using different filters',
				type: 'checkbox',
				chartType,
				settingsKey: 'show2Plots',
				boxLabel: 'Yes'
			})
		inputs.unshift(...additionalInputs)

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
		this.components.controls.on(`helpClick.${chartType}`, () => {
			let link
			if (this.state.dslabel == 'ProfileAbbrev') {
				if (chartType == 'profileBarchart')
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/bar-graph-abbr-profiledash.pdf'
				else if (chartType == 'profilePolar')
					link =
						'https://global.stjude.org/content/dam/global/en-us/documents/no-index/polar-graph-abbr-profiledash.pdf'
				else if (chartType.startsWith('profileRadar'))
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/radar-abbr-profiledash.pdf'
			} else if (this.state.dslabel == 'ProfileFull') {
				if (chartType == 'profileBarchart')
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/bar-graph-full-profiledash.pdf'
				else if (chartType == 'profilePolar')
					link =
						'https://global.stjude.org/content/dam/global/en-us/documents/no-index/polar-graph-full-profiledash.pdf'
				else if (chartType.startsWith('profileRadar'))
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/radar-full-profiledash.pdf'
			}
			if (link) window.open(link)
		})
		this.filtersCount = 0
	}

	async loadSampleData(chartType, inputs) {
		if (chartType != 'profileRadarFacility') {
			if (this.state.isLoggedIn) {
				if (this.state.site && !this.settings.isAggregate) {
					const id = this.sampleidmap[this.state.site].id
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
				if (this.settings.site) this.sampleData = this.data.samples[Number(this.settings.site)]
				else this.sampleData = null
			}
		} else {
			if (this.state.isLoggedIn) {
				let result

				if (this.state.site) {
					const id = this.sampleidmap[this.state.site].id
					this.settings.site = id
					this.sites = [{ label: this.state.site, value: id }]
					result = await this.app.vocabApi.getAnnotatedSampleData({
						terms: this.twLst,
						termsPerRequest: 30,
						filter: getSampleFilter(parseInt(id))
					})
					this.sampleData = result.samples[Number(this.settings.site)]
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
					this.sampleData = result.samples[Number(this.settings.site)]
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
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	setRegion(region) {
		const config = this.config
		this.settings[config.regionTW.term.id] = region
		this.clearFiltersExcept([config.regionTW.term.id])
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	clearFiltersExcept(ids) {
		for (const tw of this.config.filterTWs) if (!ids.includes(tw.term.id)) this.settings[tw.term.id] = ''
		if (this.config.chartType != 'profileRadarFacility') this.settings.site = ''
	}

	setSite(site) {
		this.settings.site = site
		this.sampleData = null
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilter(tw = null) {
		const excluded = []
		if (tw) excluded.push(tw.$id)
		const lst = []
		for (const tw of this.config.filterTWs) this.processTW(tw, this.settings[tw.term.id], excluded, lst)

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
			const hasFilters = this.config.filterTWs.some(tw => this.settings[tw.term.id])
			this.filterG
				.attr('font-size', '0.9em')
				.append('text')
				.attr('text-anchor', 'left')
				.style('font-weight', 'bold')
				.text(hasFilters ? 'Filters' : 'No filter applied')
				.attr('transform', `translate(0, -5)`)
			for (const tw of this.config.filterTWs) this.addFilterLegendItem(tw.term.name, this.settings[tw.term.id])
		}
		if (this.settings.site && this.config.chartType != 'profileRadarFacility') {
			const label = this.sites.find(s => s.value == this.settings.site).label
			this.addFilterLegendItem('Facility', label)
		}
	}

	addFilterLegendItem(filter, value) {
		if (!value) return
		this.filtersCount++

		const itemG = this.filterG.append('g').attr('font-size', '0.8em')
		const text = itemG
			.append('text')
			.attr('transform', `translate(0, ${this.filtersCount * 22})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-size', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
	}

	addEndUserImpressionNote(uiG) {
		uiG.attr('font-size', '0.8em')
		let textElem = uiG.append('text').attr('transform', `translate(0, 115)`)
		textElem.append('tspan').attr('font-weight', 'bold').text('End-user Impression: ')
		textElem.append('tspan').text('It is provided by the local liaison who completed the assessment in consultation')
		uiG
			.append('text')
			.attr('transform', `translate(0, 140)`)
			.text('with the PHO medical director or directly by the PHO medical director.')
		uiG
			.append('text')
			.attr('transform', `translate(0, 165)`)
			.text('The end-user was asked to rate the current status of the domains and subdomains included for this module.')
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
		let filename = `${this.type}${this.downloadCount}.svg`
		filename = filename.split(' ').join('_')
		return filename
	}

	getPercentage(d, isAggregate = null) {
		if (!d) return null
		if (isAggregate == null)
			//not specified when called
			//if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
			isAggregate = this.settings.isAggregate || this.sampleData == null //if defined in the settings a site is provided and the user can decide what to see, otherwise it is admin view and if the site was set sampleData is not null
		if (isAggregate) {
			const maxScore = d.maxScore.term ? this.data.lst[0]?.[d.maxScore.$id]?.value : d.maxScore
			let scores = this.data.lst.map(sample => (sample[d.score.$id]?.value / maxScore) * 100)
			scores.sort((s1, s2) => s1 - s2)
			const middle = Math.floor(scores.length / 2)
			const score = scores.length % 2 !== 0 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2
			return Math.round(score)
		} else {
			const score = this.sampleData[d.score.$id]?.value
			const maxScore = d.maxScore.term ? this.sampleData[d.maxScore.$id]?.value : d.maxScore //if maxScore is not a term, it is a number
			const percentage = (score / maxScore) * 100
			return Math.round(percentage)
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
