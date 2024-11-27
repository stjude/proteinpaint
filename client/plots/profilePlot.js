import { downloadSingleSVG } from '../common/svg.download.js'
import { filterJoin } from '#filter'
import { controlsInit } from './controls'
import { fillTwLst } from '#termsetting'
import { select } from 'd3-selection'
import { getSampleFilter } from '../mass/groups.js'
import { Menu } from '#dom/menu'
import { icons as icon_functions } from '#dom/control.icons'

const orderedIncomes = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
const orderedVolumes = [
	'Small (1-25 annual newly diagnoses)',
	'Medium (26-80 annual newly diagnoses)',
	'Large (81-120 annual newly diagnoses)',
	'Very large (>120 annual newly diagnoses)'
]

export const ABBREV_COHORT = 0
export const FULL_COHORT = 1
export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
		this.downloadCount = 0
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		const [logged, site, user] = getProfileLogin() //later on replace with real login info
		return {
			config,
			termfilter: appState.termfilter,
			dslabel: appState.vocab.dslabel,
			vocab: appState.vocab,
			logged, //later change to read login info
			site,
			activeCohort: appState.activeCohort
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const state = this.getState(appState)
		if (this.opts.header) {
			const suffix = state.logged ? (state.site ? state.site : 'Admin') : 'Public'
			this.opts.header.text(config.header ? config.header + ` / ${suffix}` : config.chartType + ` / ${suffix}`)
		}
		const div = this.opts.holder.append('div').style('display', 'inline-block')
		const leftDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const rightDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const controlsDiv = leftDiv.append('div').style('display', 'inline-block').style('font-size', '0.9em')
		const iconsDiv = leftDiv.append('div').style('margin-left', '16px').style('margin-top', '8px')

		const holder = rightDiv.insert('div').style('display', 'inline-block')

		const plotDiv = holder.append('div')
		this.dom = {
			controlsDiv,
			holder,
			iconsDiv,
			rightDiv,
			plotDiv
		}
		select('.sjpp-output-sandbox-content').on('scroll', event => {
			if (this.onMouseOut) this.onMouseOut(event)
		})
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))
		this.sampleidmap = await this.app.vocabApi.getSamplesByName()

		if (state.site) {
			if (Object.keys(this.sampleidmap).length == 0) throw 'You must login to view site info' //no sample data returned
			const id = this.sampleidmap[state.site]?.id
			if (!id) throw 'Invalid site'
		}

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
		document.addEventListener('scroll', () => this?.tip?.hide())
		icon_functions['pdf'](iconsDiv.append('div').style('padding', '0px 5px 15px 5px'), {
			title: 'Prints page, select Save as PDF in the options to download as a pdf',
			handler: () => {
				window.print()
			}
		})
		//later on show table for the profileForms
		if (this.type != 'profileBarchart' && this.type != 'profileForms') {
			const tableIconDiv = iconsDiv.append('div').style('padding-bottom', '15px')
			this.dom.tableBt = tableIconDiv
				.append('button')
				.style('border', 'none')
				.style('background-color', 'rgb(207, 226, 243)')
			icon_functions['table'](this.dom.tableBt, { title: 'Show table with data' })
			this.dom.tableBt.on('click', () => {
				const show = !this.settings.showTable
				this.dom.tableBt.style('background-color', show ? 'rgb(207, 226, 243)' : 'transparent')
				this.showTable(show)
			})
		}
		icon_functions['restart'](iconsDiv.append('div').style('padding', '0px 5px 15px 5px'), {
			title: 'Clear filters',
			handler: async () => {
				this.clearFiltersExcept([])
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { filter: this.getFilter(), settings: { [this.type]: this.settings } }
				})
			}
		})
		icon_functions['add'](iconsDiv.append('div').style('padding', '3px'), {
			title: 'Open a new plot',
			handler: async () => {
				let config = structuredClone(this.config)
				config.insertBeforeId = this.id
				this.app.dispatch({
					type: 'plot_create',
					config
				})
			}
		})
	}

	async showTable(show) {
		this.settings.showTable = show
		await this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { [this.type]: this.settings } } })
	}

	getList(tw) {
		let values = Object.values(tw.term.values)
		values.sort((v1, v2) => v1.label.localeCompare(v2.label))
		const twSamples = this.samplesPerFilter[tw.term.id]
		const data = []
		for (const sample of twSamples) {
			data.push(this.filtersData.samples[sample])
		}
		//select samples with data for that term
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
		if (this.dom.tableBt)
			this.dom.tableBt.style('background-color', this.settings.showTable ? 'rgb(207, 226, 243)' : 'transparent')
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

		this.regions = this.getList(this.config.regionTW)
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
		if (this.state.logged && this.state.site && chartType != 'profileRadarFacility') {
			const dataInput = {
				label: 'Data',
				type: 'radio',
				chartType,
				settingsKey: 'isAggregate',
				styles: { display: 'inline-block' },
				options: [
					{ label: this.state.site, value: false },
					{ label: 'Aggregate', value: true }
				]
			}

			inputs.push(dataInput)
		}
		if (!this.state.logged || !this.state.site || this.settings.isAggregate || chartType == 'profileRadarFacility') {
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

		inputs.unshift(...additionalInputs)

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs,
				title: 'Filters'
			})
		}
		this.components.controls.on(`downloadClick.${chartType}`, () =>
			downloadSingleSVG(this.svg, this.getDownloadFilename(), this.dom.holder.node())
		)
		this.components.controls.on(`helpClick.${chartType}`, () => {
			const activeCohort = this.state.activeCohort
			let link
			if (activeCohort == ABBREV_COHORT) {
				if (chartType == 'profileBarchart')
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/bar-graph-abbr-profiledash.pdf'
				else if (chartType == 'profilePolar')
					link =
						'https://global.stjude.org/content/dam/global/en-us/documents/no-index/polar-graph-abbr-profiledash.pdf'
				else if (chartType.startsWith('profileRadar'))
					link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/radar-abbr-profiledash.pdf'
			} else if (activeCohort == FULL_COHORT) {
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
			if (this.state.logged) {
				if (this.state.site && !this.settings.isAggregate) {
					this.settings.site = this.sampleidmap[this.state.site]?.id
					this.sites = [{ label: this.state.site, value: this.settings.site }]
				} //Admin
				else if (!this.state.site) {
					this.sites = this.data.lst.map(s => {
						return { label: this.data.refs.bySampleId[s.sample].label, value: s.sample }
					})
					this.sites.sort((a, b) => {
						if (a.label < b.label) return -1
						if (a.label > b.label) return 1
						return 0
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

				this.sampleData = await this.getSampleData()
			}
		} else {
			if (this.state.logged) {
				let result

				if (this.state.site && !this.settings.isAggregate) {
					this.settings.site = this.sampleidmap[this.state.site].id
					this.sites = [{ label: this.state.site, value: this.settings.site }]

					this.sampleData = await this.getSampleData()
				} //Admin
				else {
					result = await this.app.vocabApi.getAnnotatedSampleData({
						terms: this.twLst,
						termsPerRequest: 30
					})
					this.sites = result.lst.map(s => {
						return { label: result.refs.bySampleId[s.sample].label, value: s.sample }
					})
					this.sites.sort((a, b) => {
						if (a.label < b.label) return -1
						if (a.label > b.label) return 1
						return 0
					})
					if (!this.settings.site) this.settings.site = this.sites[0].value
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

	async getSampleData() {
		if (this.settings.site) {
			//sample selected or provided from login
			let sampleData = this.data.samples[this.settings.site]
			if (sampleData) return sampleData
			//may have been filtered out
			const data = await this.app.vocabApi.getAnnotatedSampleData({
				terms: this.twLst,
				filter: getSampleFilter(parseInt(this.settings.site)),
				termsPerRequest: 30
			})
			if (data.lst.length == 0)
				throw 'No data available for the selected site. Please change the cohort and close this message'
			return data.samples[this.settings.site]
		}
		return null
	}

	setFilterValue(key, value) {
		const config = this.config
		this.settings[key] = value
		if (this.type != 'profileRadarFacility') this.settings.site = '' //always clear site when a filter is changed
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
			const title = hasFilters ? 'Filters' : 'No filter applied'
			this.filterG
				.attr('font-size', '0.9em')
				.append('text')
				.attr('text-anchor', 'left')
				.style('font-weight', 'bold')
				.text(`${title} (n=${this.data.lst.length})`)
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

		const itemG = this.filterG.append('g').attr('font-size', '0.95em')
		const text = itemG
			.append('text')
			.attr('transform', `translate(0, ${this.filtersCount * 22})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-size', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
	}

	addEndUserImpressionNote(uiG) {
		uiG.attr('font-size', '0.9em')
		let textElem = uiG.append('text').attr('transform', `translate(0, 115)`)
		textElem.append('tspan').attr('font-weight', 'bold').text('End-user Impression: ')
		textElem.append('tspan').text('It is provided by the local liaison who completed the assessment ')
		uiG
			.append('text')
			.attr('transform', `translate(0, 140)`)
			.text('in consultation with the PHO medical director or directly by the PHO medical director.')
		uiG
			.append('text')
			.attr('transform', `translate(0, 165)`)
			.text('The end-user was asked to rate the current status of the domains and subdomains included.')
	}

	addPOCNote(uiG) {
		uiG.attr('font-size', '0.9em')
		let textElem = uiG.append('text').attr('transform', `translate(0, 115)`)
		textElem.append('tspan').attr('font-weight', 'bold').text('Point of Care (POC) Staff: ')
		textElem.append('tspan').text('All members of the assessment team, ')
		uiG
			.append('text')
			.attr('transform', `translate(0, 140)`)
			.text('excluding the Site Coordinator. POC staff provide subjective information based ')
		uiG
			.append('text')
			.attr('transform', `translate(0, 165)`)
			.text('on their experience and perception about service delivery at the PHO facility.')
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

export function makeChartBtnMenu(holder, chartsInstance, chartType) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const state = chartsInstance.state
	const key = state.activeCohort == FULL_COHORT ? 'full' : 'abbrev'
	const typeConfig = state.termdbConfig?.plotConfigByCohort[key][chartType]
	const menuDiv = holder.append('div')
	for (const plotConfig of typeConfig.plots) {
		let config = structuredClone(plotConfig)
		config.chartType = chartType
		config.header = chartType == 'profileRadarFacility' ? 'Facility Radar Graph' : 'Radar Graph'
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(plotConfig.title)
			.on('click', () => {
				chartsInstance.app.dispatch({
					type: 'plot_create',
					chartType,
					config
				})
				chartsInstance.dom.tip.hide()
			})
	}
}

export function getProfilePlotConfig(activeCohort, app, opts) {
	const key = activeCohort == FULL_COHORT ? 'full' : 'abbrev'
	const config = app.vocabApi.termdbConfig?.plotConfigByCohort[key]?.[opts.chartType]
	if (!config) throw `No data available for the plot ${opts.chartType} in this dataset`
	return structuredClone(config)
}

export async function loadFilterTerms(config, activeCohort, app) {
	const cohortPreffix = activeCohort == FULL_COHORT ? 'F' : 'A'
	const twlst = []
	config.countryTW = { id: cohortPreffix + 'country' }
	config.regionTW = { id: cohortPreffix + 'WHO_region' }
	config.incomeTW = { id: cohortPreffix + 'Income_group' }
	config.typeTW = { id: cohortPreffix + 'FC_TypeofFacility' }
	config.teachingStatusTW = { id: cohortPreffix + 'FC_TeachingFacility' }
	config.referralStatusTW = { id: cohortPreffix + 'FC_ReferralFacility' }
	config.fundingSourceTW = { id: cohortPreffix + 'FC_FundingSrc' }
	//config.annualDiagnosisNumber = {id: 'PO_TotalDxAll'}
	config.hospitalVolumeTW = { id: cohortPreffix + 'PO_HospitalVolume' }
	config.yearOfImplementationTW = { id: cohortPreffix + 'Year_implementation' }

	twlst.push(
		config.countryTW,
		config.regionTW,
		config.incomeTW,
		config.typeTW,
		config.teachingStatusTW,
		config.referralStatusTW,
		config.fundingSourceTW,
		config.hospitalVolumeTW,
		config.yearOfImplementationTW
	)
	await fillTwLst(twlst, app.vocabApi)
	config.filterTWs = twlst
}

export function clearLocalFilters(plot) {
	plot.settings = getDefaultProfilePlotSettings()
}

export function getDefaultProfilePlotSettings() {
	return {
		isAggregate: false,
		showTable: true
	}
}

export function getProfileLogin() {
	const queryString = window.location.search
	const urlParams = new URLSearchParams(queryString)
	const logged = urlParams.get('logged')
	const site = urlParams.get('site')
	const user = logged && site ? 'site' : logged ? 'admin' : 'public'
	return [logged, site, user]
}
