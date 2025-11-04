import { controlsInit } from '../controls.js'
import { fillTermWrapper, fillTwLst } from '#termsetting'
import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { icons as icon_functions } from '#dom/control.icons'
import { getCategoricalTermFilter, getCombinedTermFilter } from '#filter'
import { DownloadMenu } from '#dom/downloadMenu'
import { importPlot } from '#plots/importPlot.js'
import { PlotBase } from '../PlotBase.ts'
import { type RxComponent } from '#rx'
/*

The profilePlot is the base class for all the profile plots. It handles the common functionality such as setting controls, fetching data, and initializing the plot elements.
All the profile plots have the same filters:
- Region
- Country
- Income group
- Facility type
- Teaching status
- Referral status
- Funding source
- Hospital volume
- Year of implementation
- Sites

The profileRadarFacility adds at the top of these filters the facility select as here we compare a single facility with the average scores of all the facilities aggregated
*/

//order for income groups and hospital volumes
const orderedIncomes = ['Low income', 'Lower middle income', 'Upper middle income', 'High income']
const orderedVolumes = [
	'Small (1-25 annual newly diagnoses)',
	'Medium (26-80 annual newly diagnoses)',
	'Large (81-120 annual newly diagnoses)',
	'Very large (>120 annual newly diagnoses)'
]

//Cohort types
export const ABBREV_COHORT = 0
export const FULL_COHORT = 1

export abstract class profilePlot extends PlotBase implements RxComponent {
	readonly type: string
	downloadCount: number
	tip: Menu
	scoreTerms: any[]
	scScoreTerms: any[]
	isRadarFacility: boolean
	components: any
	settings: any
	isComparison: any
	config: any
	filter: any
	legendG: any
	filteredTermValues: any
	data: any
	sites!: any[]
	sampleData: any
	filterG: any
	filtersCount: any

	constructor(opts, type) {
		super(opts)
		this.type = type
		this.downloadCount = 0
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
		this.scoreTerms = []
		this.scScoreTerms = []
		this.isRadarFacility = false
		this.components = { plots: {} }
	}

	//extracts the relevant state from the appState: config, termfilter, vocab, login info
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
			activeCohort: appState.activeCohort,
			//Find plots where I am a parent. Here the child is a second plot for comparison
			plots: appState.plots.filter(p => p.parentId === this.id) //this property is needed to indicate that child plots need to be added to the appState plots
		}
	}

	//refers to the view where all the filters are shown and not the preselected site
	isAggregate() {
		if (!this.state.logged) return true
		if (this.settings.isAggregate) return true //marked by the user
		if (this.state.sites?.length > 1 || this.state.user == 'admin' || this.isRadarFacility) return true //multiple sites selected
		return false
	}

	//initializes the plot elements
	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const state = this.getState(appState)
		if (this.opts.header) {
			let chartName = config.chartType.match(/[A-Z][a-z]+/g)
			chartName = chartName.join(' ')
			chartName = config.headerTitle ? config.headerTitle + ` / ${state.user}` : chartName + ` / ${state.user}`
			this.opts.header.style('text-transform', 'capitalize').text(chartName)
		}
		const div = this.opts.holder.append('div').style('display', 'inline-block')
		const leftDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const rightDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		const controlsDiv = leftDiv.append('div').style('display', 'inline-block').style('font-size', '0.9em')
		const iconsDiv = leftDiv.append('div').style('margin-top', '10px').style('padding-left', '12px')

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

		const restartDiv = iconsDiv.append('div').style('padding-bottom', '8px')
		icon_functions['restart'](restartDiv, {
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
		if (!config.parentId) {
			const iconDiv = iconsDiv.append('div').style('fill', '#aaa').style('padding', '2px')

			icon_functions['add'](iconDiv, {
				title: 'Open another plot for comparison',
				handler: () => {
					const show = !this.isComparison
					const icon = iconDiv.select('svg')
					icon.style('fill', show ? 'orange' : 'black')
					if (this.isComparison) {
						const id = this.state.plots.find(p => p.parentId === this.id)?.id
						this.app.dispatch({
							type: 'plot_delete',
							id,
							parentId: this.id
						})
						return
					}
					this.legendG.selectAll('*').remove()
					const config = structuredClone(this.config)
					config.parentId = this.id
					this.app.dispatch({
						type: 'plot_create',
						config
					})
				}
			})
		}
	}

	abstract onMouseOver(event)

	//tooltip handler to hide the tooltip when mouse leaves the plot area
	onMouseOut(_event) {
		this.tip.hide()
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings[this.type]
		this.dom.plotDiv.selectAll('*').remove()

		this.isComparison = this.config.parentId || this.state.plots.length > 0
		//Render second plot for comparison that is a duplicate of this one, that will be rendered to the right of this plot
		//Child plots need to be rendered by the father plot, a similar approach is used in the report
		for (const config of this.state.plots) {
			const plot = structuredClone(config)
			if (this.components.plots[plot.id]) continue
			const holder = this.opts.holder.append('div').style('display', 'inline-block').style('padding', '5px')
			plot.holder = holder.append('div')
			plot.app = this.app
			const { componentInit } = await importPlot(plot.chartType)
			this.components.plots[plot.id] = await componentInit(plot)
		}
		//delete child plot if comparison disabled and plot deleted
		for (const plotId in this.components.plots) {
			if (!this.state.plots.find(p => p.id === plotId)) {
				this.components.plots[plotId].destroy()
				delete this.components.plots[plotId]
			}
		}
	}

	async setControls(additionalInputs: any[] = []) {
		try {
			const isRadarFacility = this.isRadarFacility
			const filters = {}
			for (const tw of this.config.filterTWs) {
				filters[tw.term.id] = getCategoricalTermFilter(this.config.filterTWs, this.settings, tw)
			}

			this.filteredTermValues = await this.app.vocabApi.filterTermValues({
				terms: this.config.filterTWs,
				filter: this.state.termfilter.filter,
				filters,
				facilityTW: this.config.facilityTW,
				// safe to pass because the backend code will still compare terms[] with the the dataset's hiddenTermIds,
				// it only affects what will be included in the aggregation and does not disable user access authentication
				filterByUserSites: this.settings.filterByUserSites,
				showAll: true
			})
			const regions = this.filteredTermValues[this.config.regionTW.id]
			const countries = this.filteredTermValues[this.config.countryTW.id]
			const incomes = this.filteredTermValues[this.config.incomeTW.id]
			const teachingStates = this.filteredTermValues[this.config.teachingStatusTW.id]
			const referralStates = this.filteredTermValues[this.config.referralStatusTW.id]
			const fundingSources = this.filteredTermValues[this.config.fundingSourceTW.id]
			const hospitalVolumes = this.filteredTermValues[this.config.hospitalVolumeTW.id]
			const yearsOfImplementation = this.filteredTermValues[this.config.yearOfImplementationTW.id]
			incomes.sort((elem1, elem2) => {
				const i1 = orderedIncomes.indexOf(elem1.value)
				const i2 = orderedIncomes.indexOf(elem2.value)
				if (i1 < i2) return -1
				return 1
			})
			hospitalVolumes.sort((elem1, elem2) => {
				const i1 = orderedVolumes.indexOf(elem1.value)
				const i2 = orderedVolumes.indexOf(elem2.value)
				if (i1 < i2) return -1
				return 1
			})
			const types = this.filteredTermValues[this.config.typeTW.id]
			const isAggregate = this.isAggregate()

			if (!this.settings[this.config.facilityTW?.term?.id] && this.state.sites?.length == 1 && !isAggregate) {
				this.settings[this.config.facilityTW?.term?.id] = [this.state.sites[0]]
			}

			this.filter = this.config.filter || this.getFilter()

			if (this.type != 'profileForms')
				this.data = await this.app.vocabApi.getProfileScores({
					scoreTerms: this.scoreTerms,
					filter: this.filter,
					facilityTW: this.config.facilityTW,
					filterByUserSites: this.settings.filterByUserSites
				})
			else
				this.data = await this.app.vocabApi.getProfileFormScores({
					scoreTerms: this.scoreTerms,
					scScoreTerms: this.scScoreTerms,
					filter: this.filter,
					facilityTW: this.config.facilityTW,
					filterByUserSites: this.settings.filterByUserSites
				})
			if ('error' in this.data) throw this.data.error
			this.sites = this.filteredTermValues[this.config.facilityTW.id]?.filter(s => !s.disabled && s.value)

			if (this.settings[this.config.facilityTW?.term?.id])
				for (const site of this.settings[this.config.facilityTW?.term?.id]) {
					const siteOption = this.sites.find(s => s.value == site)
					if (siteOption) siteOption.selected = true //mark selected sites
				}
			const chartType = this.type
			this.dom.controlsDiv.selectAll('*').remove()
			const inputs: any[] = []
			const userSitesFilterInput = {
				label: 'Use accessible sites only',
				boxLabel: '',
				type: 'checkbox',
				chartType,
				settingsKey: 'filterByUserSites'
			}
			if (this.state.sites?.length == 1 && !isRadarFacility) {
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
						const id = this.sites.find(s => s.value == this.state.site)?.value
						const value = isAggregate ? [] : [id]
						this.setFilterValue(this.config.facilityTW.term.id, value)
					}
				}
				inputs.push(dataInput)
			}
			if (isAggregate || isRadarFacility) {
				inputs.push(
					...[
						{
							label: 'Region',
							type: 'dropdown',
							chartType,
							settingsKey: this.config.regionTW.term.id,
							options: regions,
							callback: value => this.setFilterValue(this.config.regionTW.term.id, value)
						},
						{
							label: 'Country',
							type: 'dropdown',
							chartType,
							settingsKey: this.config.countryTW.term.id,
							options: countries,
							callback: value => this.setFilterValue(this.config.countryTW.term.id, value)
						},
						{
							label: 'Income group',
							type: 'dropdown',
							chartType,
							settingsKey: this.config.incomeTW.term.id,
							options: incomes,
							callback: value => this.setFilterValue(this.config.incomeTW.term.id, value)
						},
						{
							label: 'Facility type',
							type: 'dropdown',
							chartType,
							settingsKey: this.config.typeTW.term.id,
							options: types,
							callback: value => this.setFilterValue(this.config.typeTW.term.id, value)
						},
						{
							label: this.config.teachingStatusTW.term.name,
							type: 'dropdown',
							chartType,
							settingsKey: this.config.teachingStatusTW.term.id,
							options: teachingStates,
							callback: value => this.setFilterValue(this.config.teachingStatusTW.term.id, value)
						},
						{
							label: this.config.referralStatusTW.term.name,
							type: 'dropdown',
							chartType,
							settingsKey: this.config.referralStatusTW.term.id,
							options: referralStates,
							callback: value => this.setFilterValue(this.config.referralStatusTW.term.id, value)
						},
						{
							label: this.config.fundingSourceTW.term.name,
							type: 'dropdown',
							chartType,
							settingsKey: this.config.fundingSourceTW.term.id,
							options: fundingSources,
							callback: value => this.setFilterValue(this.config.fundingSourceTW.term.id, value)
						},
						{
							label: this.config.hospitalVolumeTW.term.name,
							type: 'dropdown',
							chartType,
							settingsKey: this.config.hospitalVolumeTW.term.id,
							options: hospitalVolumes,
							callback: value => this.setFilterValue(this.config.hospitalVolumeTW.term.id, value)
						},
						{
							label: this.config.yearOfImplementationTW.term.name,
							type: 'dropdown',
							chartType,
							settingsKey: this.config.yearOfImplementationTW.term.id,
							options: yearsOfImplementation,
							callback: value => this.setFilterValue(this.config.yearOfImplementationTW.term.id, value)
						}
					]
				)
			}
			if (this.state.logged) {
				if (isAggregate && (this.state.sites?.length > 1 || this.state.user == 'admin')) {
					const sitesInput = {
						label: 'Sites',
						type: 'dropdown',
						chartType,
						options: this.sites,
						multiple: true,
						callback: values => this.setFilterValue(this.config.facilityTW.term.id, values)
					}
					inputs.push(sitesInput)
					if (this.state.user != 'admin') inputs.unshift(userSitesFilterInput) //add filter by user sites only for non-admin users
				}
				if (isRadarFacility) {
					const settings = { ...this.settings }
					settings[this.config.facilityTW.term.id] = null //clear facility filter to get all the sites allowed
					const filter = this.getFilterWithSettings(settings)
					//another request is needed to get the sample selected and populate the facility sites
					this.sampleData = await this.app.vocabApi.getProfileScores({
						scoreTerms: this.scoreTerms,
						filter, //filter excluding facility term
						facilitySite: this.settings.facilitySite || null, //need to pass null not undefined, so the parameter is always passed to the server
						facilityTW: this.config.facilityTW
					})
					const facilitySites = this.sampleData.sites
					const facilitySite = this.settings.facilitySite
						? facilitySites.find(s => s.value == this.settings.facilitySite)
						: facilitySites[0]
					if (!facilitySite)
						//probably a session recovery
						throw new Error(`Access to ${this.settings.facilitySite} facility not allowed`)
					facilitySite.selected = true //mark selected facility site

					inputs.unshift({
						label: 'Facility site',
						type: 'dropdown',
						chartType,
						options: facilitySites,
						callback: value => {
							this.setFacilitySite(value)
						}
					})
				}
			}

			inputs.unshift(...additionalInputs)
			this.components.controls = await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs,
				title: 'Filters'
			})
			this.components.controls.on(`downloadClick.${chartType}`, event => this.download(event))
			this.components.controls.on(`helpClick.${chartType}`, () => {
				const activeCohort = this.state.activeCohort
				let link
				if (activeCohort == ABBREV_COHORT) {
					if (chartType == 'profileBarchart')
						link =
							'https://global.stjude.org/content/dam/global/en-us/documents/no-index/bar-graph-abbr-profiledash.pdf'
					else if (chartType == 'profilePolar')
						link =
							'https://global.stjude.org/content/dam/global/en-us/documents/no-index/polar-graph-abbr-profiledash.pdf'
					else if (chartType.startsWith('profileRadar'))
						link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/radar-abbr-profiledash.pdf'
				} else if (activeCohort == FULL_COHORT) {
					if (chartType == 'profileBarchart')
						link =
							'https://global.stjude.org/content/dam/global/en-us/documents/no-index/bar-graph-full-profiledash.pdf'
					else if (chartType == 'profilePolar')
						link =
							'https://global.stjude.org/content/dam/global/en-us/documents/no-index/polar-graph-full-profiledash.pdf'
					else if (chartType.startsWith('profileRadar'))
						link = 'https://global.stjude.org/content/dam/global/en-us/documents/no-index/radar-full-profiledash.pdf'
				}
				if (link) window.open(link)
			})
			this.filtersCount = 0
		} catch (e) {
			console.log(e)
			throw e
		}
	}

	setFilterValue(key, value) {
		const config = this.config
		this.settings[key] = value
		config.filter = this.getFilter()
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	getFilterWithSettings(settings) {
		let filter = getCategoricalTermFilter(this.config.filterTWs, settings, null)
		filter = getCombinedTermFilter(this.state, filter)
		return filter.filter
	}

	getFilter() {
		let filter = getCategoricalTermFilter(this.config.filterTWs, this.settings, null)
		filter = getCombinedTermFilter(this.state, filter)
		return filter.filter
	}

	clearFiltersExcept(ids) {
		for (const tw of this.config.filterTWs) if (!ids.includes(tw.term.id)) this.settings[tw.term.id] = ''
	}

	setFacilitySite(site) {
		this.settings.facilitySite = site
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	addFilterLegend() {
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

	addFilterLegendItem(filter, value) {
		if (!value || value?.length === 0) return
		this.filtersCount++
		const isArray = Array.isArray(value)
		let text = isArray ? value.join(', ') : value
		if (text.length > 40) {
			text = text.slice(0, 40) + '...'
		}
		const itemG = this.filterG.append('g').attr('font-size', '0.95em')
		const textElem = itemG
			.append('text')
			.attr('transform', `translate(0, ${this.filtersCount * 22})`)
			.attr('text-anchor', 'left')
		textElem.append('tspan').attr('font-weight', 'bold').text(`${filter}: `)
		textElem.append('tspan').text(text)
	}

	addEndUserImpressionNote(uiG) {
		uiG.attr('font-size', '0.9em')
		const textElem = uiG.append('text').attr('transform', `translate(0, 115)`)
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
		const textElem = uiG.append('text').attr('transform', `translate(0, 115)`)
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
		let filename = `${this.type}${this.downloadCount}`
		filename = filename.split(' ').join('_')
		return filename
	}

	getPercentage(d) {
		if (!d) return 0
		const score = this.data.term2Score[d.score.term.id]
		return score
	}

	async download(event) {
		const chartImages = this.getChartImages()
		const menu = new DownloadMenu(chartImages, this.getDownloadFilename())
		menu.show(event.clientX, event.clientY)
	}

	getChartImages() {
		const plots: any[] = Object.values(this.components.plots)
		const note = '© 2025 St. Jude Children’s Research Hospital'
		let name = plots.length > 0 ? 'Original' : ''
		name += ` ${note}`
		const charts = [{ name, svg: this.dom.svg }]
		let i = 1
		for (const plot of plots) {
			//Adding comparison plots
			const chartImages = plot.getChartImages()

			for (const chartImage of chartImages) {
				const svg = chartImage.svg
				const name =
					chartImages.length > 1
						? `Comparison ${i}. ${chartImage.name} ${note}`
						: `Comparison ${chartImage.name} ${note}`
				charts.push({ name, svg })
			}
			i++
		}
		return charts
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
		const config = structuredClone(plotConfig)
		config.chartType = chartType
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
	config.facilityTW = { id: cohortPreffix + 'UNIT' } //All the plots want the facility term to show the hospital name if a site is selected
	config.hidePlotFilter = true
	await fillTermWrapper(config.facilityTW, app.vocabApi)
	await loadFilterTerms(config, activeCohort, app)
	return structuredClone(config)
}

export async function loadFilterTerms(config, activeCohort, app) {
	//These are the profile filters for each plot. Hardcoded here
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
		config.facilityTW,
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
		filterByUserSites: false //if true, the aggregation will be limited to the user sites only
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
