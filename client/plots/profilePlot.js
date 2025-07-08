import { downloadSingleSVG } from '../common/svg.download.js'
import { controlsInit } from './controls.js'
import { fillTermWrapper, fillTwLst } from '#termsetting'
import { select } from 'd3-selection'
import { getSampleFilter } from '../mass/groups.js'
import { Menu } from '#dom/menu'
import { icons as icon_functions } from '#dom/control.icons'
import { getCategoricalTermFilter } from '#shared/filter.js'

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
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
		this.scoreTerms = []
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		const { logged, sites, user } = getProfileLogin(this.app, appState.activeCohort) //later on replace with real login info
		const site = sites?.[0]
		return {
			config,
			termfilter: appState.termfilter,
			dslabel: appState.vocab.dslabel,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab,
			logged, //later change to read login info
			site,
			sites,
			user,
			activeCohort: appState.activeCohort
		}
	}

	//refers to the view where all the filters are shown and not the preselected site
	isAggregate() {
		if (!this.state.logged) return true
		if (this.settings.isAggregate) return true //marked by the user
		if (this.state.sites?.length > 1 || this.state.user == 'admin') return true //multiple sites selected
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const state = this.getState(appState)
		this.isRadarFacility = this.type == 'profileRadarFacility'
		if (this.opts.header) {
			let chartName = config.chartType.match(/[A-Z][a-z]+/g)
			chartName = chartName.join(' ')
			this.opts.header
				.style('text-transform', 'capitalize')
				.text(config.header ? config.header + ` / ${state.user}` : chartName + ` / ${state.user}`)
		}
		const div = this.opts.holder.append('div').style('display', 'inline-block')
		const leftDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const rightDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const controlsDiv = leftDiv.append('div').style('display', 'inline-block').style('font-size', '0.9em')
		const iconsDiv = leftDiv.append('div').style('margin-left', '6px').style('margin-top', '15px')

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
		this.dom.rightDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.rightDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.rightDiv.on('mouseout', event => this.onMouseOut(event))

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
				.attr('data-testid', 'sjpp-profile-table-button')
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

	onMouseOut(event) {
		this.tip.hide()
	}

	async showTable(show) {
		this.settings.showTable = show
		await this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { [this.type]: this.settings } } })
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
			const filter = getCategoricalTermFilter(this.config.filterTWs, this.settings, tw, this.state.termfilter.filter)

			if (filter) filters[tw.term.id] = filter
		}
		this.filteredTermValues = await this.app.vocabApi.filterTermValues({
			terms: this.config.filterTWs,
			filters
		})
		this.regions = this.filteredTermValues[this.config.regionTW.id]
		this.countries = this.filteredTermValues[this.config.countryTW.id]
		this.incomes = this.filteredTermValues[this.config.incomeTW.id]
		this.teachingStates = this.filteredTermValues[this.config.teachingStatusTW.id]
		this.referralStates = this.filteredTermValues[this.config.referralStatusTW.id]
		this.fundingSources = this.filteredTermValues[this.config.fundingSourceTW.id]
		this.hospitalVolumes = this.filteredTermValues[this.config.hospitalVolumeTW.id]
		this.yearsOfImplementation = this.filteredTermValues[this.config.yearOfImplementationTW.id]

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
		this.types = this.filteredTermValues[this.config.typeTW.id]
		this.filter = this.config.filter || this.getFilter()

		const isAggregate = this.isAggregate()
		if (this.type != 'profileForms')
			this.data = await this.app.vocabApi.getProfileScores({
				scoreTerms: this.scoreTerms,
				filter: this.filter,
				isAggregate,
				sites: this.isRadarFacility ? null : this.settings.sites,
				isRadarFacility: this.isRadarFacility,
				userSites: this.state.sites,
				facilityTW: this.config.facilityTW
			})
		else
			this.data = await this.app.vocabApi.getProfileFormScores({
				scoreTerms: this.scoreTerms,
				scScoreTerms: this.scScoreTerms,
				filter: this.filter,
				isAggregate,
				sites: this.isRadarFacility ? null : this.settings.sites,
				userSites: this.state.sites,
				facilityTW: this.config.facilityTW
			})
		this.sites = this.data.sites
		this.sites.sort((a, b) => {
			if (a.label < b.label) return -1
			if (a.label > b.label) return 1
			return 0
		})

		if (!this.settings.site && !this.settings.sites && (this.state.sites?.length == 1 || this.isRadarFacility)) {
			this.settings.site = this.data.sites?.[0]?.value
			this.settings.sites = [this.settings.site] //set sites to the single site
		}

		if (this.settings.sites)
			for (const site of this.settings.sites) {
				const siteOption = this.sites.find(s => s.value == site)
				if (siteOption) siteOption.selected = true //mark selected sites
			}
		const chartType = this.type
		this.dom.controlsDiv.selectAll('*').remove()
		let inputs = []
		if (this.state.sites?.length == 1 && !this.isRadarFacility) {
			const dataInput = {
				label: 'Data',
				type: 'radio',
				chartType,
				settingsKey: 'isAggregate',
				styles: { display: 'inline-block' },
				options: [
					{ label: this.state.site, value: false },
					{ label: 'Aggregate', value: true }
				],
				callback: isAggregate => {
					this.settings.isAggregate = isAggregate
					const id = this.sites.find(s => s.label == this.state.site)?.value
					isAggregate ? this.setSite('') : this.setSite(id)
				}
			}
			inputs.push(dataInput)
		}
		if (isAggregate || this.isRadarFacility) {
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
		if (this.state.logged) {
			if ((isAggregate && (this.state.sites?.length > 1 || this.state.user == 'admin')) || this.isRadarFacility) {
				const sitesInput = {
					label: 'Site',
					type: 'dropdown',
					chartType,
					options: this.sites,
					multiple: true,
					callback: values => {
						this.setSites(values)
					}
				}
				this.isRadarFacility ? inputs.unshift(sitesInput) : inputs.push(sitesInput)
			}
		}

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
			downloadSingleSVG(this.dom.svg, this.getDownloadFilename(), this.dom.holder.node())
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

	setFilterValue(key, value) {
		const config = this.config
		this.settings[key] = value
		if (!this.isRadarFacility) {
			this.settings.site = '' //always clear site when a filter is changed
			this.settings.sites = null //clear sites
		}
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilter() {
		return getCategoricalTermFilter(this.config.filterTWs, this.settings, null, this.state.termfilter.filter)
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
		if (!this.isRadarFacility) {
			this.settings.site = ''
			this.settings.sites = null //clear sites
		}
	}

	setSite(site) {
		this.settings.site = site
		this.settings.sites = null //clear sites
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	setSites(sites) {
		if (sites && sites.length == 1) this.settings.site = sites[0] //if only one site selected, set it as the site
		this.settings.sites = sites?.map(s => Number(s))
		if (this.settings.sites.length > 1) this.settings.site = '' //clear site
		else if (this.settings.sites.length == 1) this.settings.site = this.settings.sites[0] //set site to the single site
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	addFilterLegend() {
		if (!this.settings.site || this.isRadarFacility) {
			const hasFilters = this.config.filterTWs.some(tw => this.settings[tw.term.id])
			const title = hasFilters ? 'Filters' : 'No filter applied'
			this.filterG
				.attr('font-size', '0.9em')
				.append('text')
				.attr('text-anchor', 'left')
				.style('font-weight', 'bold')
				.text(`${title} (n=${this.data.n})`)
				.attr('transform', `translate(0, -5)`)
			for (const tw of this.config.filterTWs) this.addFilterLegendItem(tw.term.name, this.settings[tw.term.id])
		}
		if (this.settings.site && !this.isRadarFacility) {
			const label = this.sites.find(s => s.value == this.settings.site).label
			this.addFilterLegendItem('Facility ID', label)
			const hospital = this.data.hospital
			this.addFilterLegendItem('Facility', hospital)
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

	getPercentage(d) {
		if (!d) return 0
		const score = this.data.term2Score[d.score.term.id]
		return score
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
	if (typeConfig.options.length == 1) {
		createPlot(typeConfig.options[0], chartType, chartsInstance)
		return
	}
	const menuDiv = holder.append('div')
	for (const plotConfig of typeConfig.options) {
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(plotConfig.title)
			.on('click', () => {
				createPlot(plotConfig, chartType, chartsInstance)
				chartsInstance.dom.tip.hide()
			})
	}

	function createPlot(plotConfig, chartType, chartsInstance) {
		let config = structuredClone(plotConfig)
		config.chartType = chartType
		config.header = chartType == 'profileRadarFacility' ? 'Facility Radar Graph' : 'Radar Graph'
		chartsInstance.app.dispatch({
			type: 'plot_create',
			chartType,
			config
		})
	}
}

export async function getProfilePlotConfig(activeCohort, app, opts) {
	const key = activeCohort == FULL_COHORT ? 'full' : 'abbrev'
	const config = app.vocabApi.termdbConfig?.plotConfigByCohort[key]?.[opts.chartType]
	if (!config) throw `No data available for the plot ${opts.chartType} in this dataset`
	const cohortPreffix = activeCohort == FULL_COHORT ? 'F' : 'A'
	config.facilityTW = { id: cohortPreffix + 'facility' } //All the plots want the facility term to show the hospital name if a site is selected
	await fillTermWrapper(config.facilityTW, app.vocabApi)
	await loadFilterTerms(config, activeCohort, app)
	return structuredClone(config)
}

export async function loadFilterTerms(config, activeCohort, app) {
	const cohortPreffix = activeCohort == FULL_COHORT ? 'F' : 'A'
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

	const filterTWs = [
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
	await fillTwLst(filterTWs, app.vocabApi)
	config.filterTWs = filterTWs
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

export function getProfileLogin(app, cohort = FULL_COHORT) {
	const auth = app.vocabApi.getClientAuthResult()
	if (!auth) return { logged: false, sites: [], user: 'public' }
	const auth_info = cohort == FULL_COHORT ? auth.full : auth.abbrev
	const logged = auth_info?.role != 'public'
	if (!auth_info) return { logged: false, sites: [], user: 'public' } //no login info for the cohort, treat it as not logged in, public view for that cohort
	const user = auth_info?.role || 'public'
	const sites = user == 'admin' ? null : auth_info.sites //site only matters if you are not admin
	return { logged, sites, user }
}
