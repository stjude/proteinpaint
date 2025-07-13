import { getId } from './nav'
import { getCompInit } from '../rx'
import type { Elem, Div, H2 } from '../types/d3'
import type { SelectCohortEntry } from '#types'
import type { MassAppApi } from './types/mass'
import { renderTable } from '#dom'
import type { TableRow } from '#dom'
import { select } from 'd3-selection'

/* 
"about" tab will display following contents inside this.subheader:
- if ds uses subcohorts:
	- <h2> for selectCohort.title
	- description
	- radio button options
- custom html via massNav.about.html (todo images and cartoon)
- active items to launch demo plots
- server info
*/

const cohortTableActiveColor = 'yellow'

// this type is fully defined in MassNav def in dataset.ts but not in a form that can extract "about" config to share. thus need to repeat here to avoid tsc err
type AboutObj = {
	html: string
	activeItems?: { items: any }
}

type MassAboutOpts = {
	/** Optional. Set in the dataset file under .massNav.tabs.about. Otherwise null. */
	aboutOverrides: AboutObj | null
	/** Required. Provided from nav component */
	app: MassAppApi
	/** Required. Provided from nav component */
	instanceNum: number
	/** Optional. Set in the dataset file under .termdb.selectCohort. Otherwise null. */
	selectCohort: SelectCohortEntry | null
	/** Required. .dom.subheader.about in nav component, assigned to this.subheader */
	subheader: Elem
}

type MassAboutDom = {
	/** Fine print dom shown between the cohort specific content and the server info */
	cohortAsterisk?: Div
	/** Displays description */
	cohortDescription: Div
	/** Div for cohort radio buttons */
	cohortOpts?: Div
	/** Text above radio cohort options */
	cohortPrompt?: Div
	/**  */
	cohortTable?: Div
	/** Title above the cohort introduction/content */
	cohortTitle?: H2
}
//TODO: Make a validate opts fn
export class MassAbout {
	aboutOverrides: AboutObj | null
	app: MassAppApi
	dom: MassAboutDom
	instanceNum: number
	selectCohort: SelectCohortEntry | null
	subheader: Elem // where all contents are rendered
	type: string
	opts: MassAboutOpts
	state: any

	constructor(opts: MassAboutOpts) {
		this.opts = opts
		this.type = 'about'
		this.app = opts.app
		this.subheader = opts.subheader
		this.instanceNum = opts.instanceNum
		this.aboutOverrides = opts.aboutOverrides
		this.selectCohort = opts.selectCohort
		this.dom = {
			cohortDescription: this.subheader
				.append('div')
				.attr('data-testid', 'sjpp-about-cohort-desc')
				.style('margin-left', '10px')
		}

		if (opts?.selectCohort?.title) {
			this.dom.cohortTitle = opts.subheader.append('h2').style('margin-left', '10px').text(opts.selectCohort.title)
		}

		if (opts.selectCohort?.prompt) {
			this.dom.cohortPrompt = this.subheader
				.append('div')
				.style('margin-left', '10px')
				.style('padding-top', '30px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.style('font-size', '1.2em')
				.text(opts.selectCohort.prompt)
		}

		if (opts.selectCohort) {
			this.dom.cohortOpts = this.subheader.append('div').style('margin-bottom', '30px').style('margin-left', '10px')
		}
	}

	/* render all contents into this.subheader
	do it through init() means that contents are rendered just once on launching mass ui and won't be rerendered or updated
	since there's no reason to update about tab contents while user is interacting with mass ui
	*/
	init(appState) {
		/** If selectCohort available, options in the about html will not show */
		this.initCohort(appState)
		this.initCustomHtml()
		this.initActiveItems()
		//Always show the release version and server launch date at the bottom
		this.showServerInfo()
	}

	async main() {
		// do not render unless the cohort tab is active
		if (this.state.nav.activeTab !== 0) return
		await this.renderCohortsTable()
		if (this.opts.selectCohort) {
			if (this.opts.selectCohort.description) {
				this.dom.cohortDescription.html(this.opts.selectCohort.description)
			} else if (this.opts.selectCohort.descriptionByCohort) {
				this.dom.cohortDescription.html(
					this.opts.selectCohort.descriptionByCohort[
						this.state.termdbConfig.selectCohort.values[this.state.activeCohort].keys.join(',')
					]
				)
			}
		}
	}

	initCohort = appState => {
		if (this.selectCohort == null) return
		//Move to validate opts fn
		if (!this.selectCohort.values) return

		const instanceNum = this.instanceNum
		const activeCohort = appState.activeCohort
		const app = this.app

		//TODO: replace with make_radios
		this.dom
			.cohortOpts!.append('table')
			.selectAll('tr')
			.data(this.selectCohort.values)
			.enter()
			.append('tr')
			.each(function (d, i, nodes) {
				const tr = select(nodes[i])
				const td0 = tr.append('td')
				const radioName = 'sja-termdb-cohort-' + instanceNum
				const radioId = radioName + '-' + i
				td0
					.append('input')
					.style('scale', '1.2')
					.attr('type', 'radio')
					.attr('name', radioName)
					.attr('id', radioId)
					.attr('value', i)
					.property('checked', i === activeCohort)
					.style('margin-right', '5px')
					.style('margin-left', '0px')
					.on('click', async event => {
						const state = app.getState()
						const clearOnChange = state.termdbConfig.selectCohort.clearOnChange
						if (clearOnChange) {
							const subactions: any[] = []
							const toBeCleared: string[] = []
							const plots = state.plots
							const filter = state.termfilter.filter.lst.find(f => f.tag == 'filterUiRoot')?.lst
							const groups = state.groups

							if (clearOnChange.plots && plots?.length) toBeCleared.push('plots')
							for (const plot of plots) {
								subactions.push({
									type: 'plot_delete',
									id: plot.id
								})
							}
							if (clearOnChange.filter && filter?.length) toBeCleared.push('filters')
							subactions.push({
								type: 'filter_replace',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									tag: 'filterUiRoot',
									lst: []
								}
							})
							if (clearOnChange.groups && groups?.length) {
								toBeCleared.push('groups')
								for (const group of groups) {
									subactions.push({
										type: 'delete_group',
										name: group.name
									})
								}
								for (const term of state.customTerms) {
									subactions.push({
										type: 'delete_customTerm',
										name: term.name
									})
								}
							}
							subactions.push({ type: 'cohort_set', activeCohort: i })
							if (toBeCleared.length) {
								const confirm = window.confirm(
									`Changing the cohort will clear all ${joinByComma(
										toBeCleared
									)}. To proceed, click "OK". To save the session, click "Cancel" and then click the "Session" button at the top of the page.`
								)
								if (!confirm) {
									event.preventDefault()
									return
								}
							}
							app.dispatch({
								type: 'app_refresh',
								subactions
							})
						} else app.dispatch({ type: 'cohort_set', activeCohort: i })
					})

				td0
					.append('label')
					.style('font-size', '1.4em')
					.attr('for', radioId)
					.attr('colspan', 2)
					.style('cursor', 'pointer')
					.html((d: any) => d.label)

				tr.selectAll('td')
					.style('max-width', '600px')
					.style('padding-bottom', '10px')
					.style('padding-right', '20px')
					.style('vertical-align', 'top')
			})

		this.dom.cohortTable = this.subheader.append('div').style('margin-left', '12px')

		if (this.selectCohort.asterisk) {
			this.dom.cohortAsterisk = this.subheader
				.append('div')
				.style('margin', '10px')
				.style('font-size', '.8em')
				.text(this.selectCohort.asterisk)
		}
	}

	renderCohortsTable = async () => {
		if (!this.dom.cohortTable) return
		this.dom.cohortTable.selectAll('*').remove()
		const columns = [{ label: 'Feature' }]
		const rows: TableRow[] = []
		const result = await this.app.vocabApi.getCohortsData()
		if ('error' in result) throw result.error
		if (this.selectCohort?.values) {
			// selectCohort.values[] contains ordered set of cohorts
			// ensure cohorts in cohorts table follow this order
			const values = this.selectCohort.values
			result.cohorts.sort((a, b) => {
				const aIndex = values.findIndex(v => v.keys.toString() == a.cohort)
				const bIndex = values.findIndex(v => v.keys.toString() == b.cohort)
				if (aIndex < bIndex) return -1
				if (aIndex > bIndex) return 1
				return 0
			})
		}
		if (!result.cfeatures.length) return
		for (const feature of result.features) rows.push([{ value: feature.name }])
		for (const cohort of result.cohorts) {
			if (cohort.subcohorts?.length) continue
			columns.push({ label: cohort.name })
			for (const [i, feature] of result.features.entries()) {
				const cf = result.cfeatures.find(cf => cf.idfeature === feature.idfeature && cf.cohort === cohort.cohort)
				if (cf) rows[i].push({ value: cf.value })
			}
		}

		renderTable({
			rows,
			columns,
			div: this.dom.cohortTable,
			showLines: false,
			maxHeight: '60vh',
			header: { style: { 'font-size': '1.2em', 'font-weight': 'bold' } }
		})

		this.dom.cohortTable.select('table').style('border-collapse', 'collapse')
		this.dom.cohortTable.selectAll(`tbody > tr > td`).style('background-color', 'transparent').style('padding', '6px')
		const state = this.app.getState()
		const selectCohort = state.termdbConfig.selectCohort
		const activeCohort = state.activeCohort
		const keys = selectCohort.values[activeCohort].keys
		let selector = `tbody > tr > td:nth-child(${activeCohort + 2})`
		const combined = keys.length > 1
		if (combined) {
			selector = ''
			for (const key of keys) {
				const i = result.cohorts.map(c => c.cohort).indexOf(key)
				if (selector !== '') selector += ','
				selector += `tbody > tr > td:nth-child(${i + 2})`
			}
		}
		const activeColumns = this.dom.cohortTable.selectAll(selector)
		const color = state.termdbConfig.massNav?.activeColor || cohortTableActiveColor
		activeColumns.style('background-color', color)
	}

	initCustomHtml = () => {
		if (this.selectCohort != null) return
		if (!this.aboutOverrides?.html) return
		this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-custom-about-content')
			.style('padding', '10px')
			.html(this.aboutOverrides.html)
	}

	initActiveItems = () => {
		if (!this.aboutOverrides?.activeItems) return

		// todo: customize general holder by activeItems.holderStyle{}
		const div = this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-custom-about-activeItems')
			.style('padding', '0px 0px 20px 20px')

		for (const item of this.aboutOverrides.activeItems.items) {
			// todo: by item.type, item.divStyle{}
			div
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '5px')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', 'sjpp-custom-active-item-btn')
				.html(item.title)
				.on('click', async () => {
					/* First, set the active tab to toggle to the plots tab and wait for the tab to be set,
					otherwise the plotDiv is hidden when rendering and
					may cause issues. A known issue is that getMaxLabelWidth getBBox on a hidden div returns width=0
					this affects the legend rendering in plots like the scatter resulting in overlapping texts
					*/
					await this.app.dispatch({
						type: 'tab_set',
						activeTab: 1
					})
					// after switching tab so plot div is shown, dispatch to create the plot
					this.app.dispatch({
						type: 'plot_create',
						id: getId(),
						config: structuredClone(item.plot)
					})
				})
		}
	}

	showServerInfo = () => {
		const state = this.app.getState()
		const about = state.termdbConfig.massNav?.tabs?.about
		if (!about && !this.app.opts.pkgver && !this.app.opts.launchDate) return
		const dataRelease = about?.dataRelease
		const additionalInfo = about?.additionalInfo
		const div = this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-about-server-info')
			.style('margin', '10px')
			.style('font-size', '.8em')

		const htmlArr: string[] = []
		if (dataRelease) {
			htmlArr.push(`Data Release: <a href=${dataRelease.link} target=_blank>${dataRelease.version}</a>`)
		}
		if (this.app.opts.pkgver) {
			htmlArr.push(
				`Software Release: <a href=https://github.com/stjude/proteinpaint/pkgs/container/ppfull target=_blank>${this.app.opts.pkgver}</a>`
			)
		}
		if (this.app.opts.launchDate) {
			htmlArr.push(`Server Launched: ${this.app.opts.launchDate}`)
		}
		if (additionalInfo) {
			htmlArr.push(additionalInfo)
		}
		div.append('div').html(htmlArr.join('; '))
	}
}

export const aboutInit = getCompInit(MassAbout)

function joinByComma(arr) {
	if (!arr.length) return ''
	else if (arr.length == 1) return arr[0]
	else if (arr.length == 2) return arr.join(' and ')
	else return `${arr.slice(0, -1).join(', ')}, and ${arr.slice(-1)}`
}
