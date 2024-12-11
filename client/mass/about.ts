import { getId } from './nav'
import { getCompInit } from '../rx'
import type { Elem, Div, H2 } from '../types/d3'
import type { SelectCohortEntry } from '#types'
import type { MassAppApi } from './types/mass'
import { renderTable } from '#dom'
import type { TableRow } from '#dom'
import { select } from 'd3-selection'
import { getProfileLogin } from '../plots/profilePlot.js'

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
	/** Displays either the description or descriptionBy content */
	cohortDescription?: Div
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

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.subheader = opts.subheader
		this.instanceNum = opts.instanceNum
		this.aboutOverrides = opts.aboutOverrides
		this.selectCohort = opts.selectCohort
		this.dom = {}

		if (opts?.selectCohort?.title) {
			this.dom.cohortTitle = opts.subheader.append('h2').style('margin-left', '10px').text(opts.selectCohort.title)
		}

		if (opts.selectCohort?.description || opts.selectCohort?.descriptionByUser) {
			//temporary logic to get the profile description until the login is implemented
			const [logged, site, user] = getProfileLogin()
			//If there is a user and a descriptionByUser, use the user description otherwise use the default description
			const description =
				user && opts.selectCohort.descriptionByUser
					? opts.selectCohort.descriptionByUser[user]
					: opts.selectCohort.description
			if (description)
				this.dom.cohortDescription = this.subheader
					.append('div')
					.attr('data-testid', 'sjpp-about-cohort-desc')
					.style('margin-left', '10px')
					.html(description)
			else new Error('Missing cohort description')
		}

		if (opts.selectCohort?.prompt) {
			this.dom.cohortPrompt = this.subheader
				.append('div')
				.style('margin-left', '10px')
				.style('padding-top', '30px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
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
		await this.renderCohortsTable()
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
					.attr('type', 'radio')
					.attr('name', radioName)
					.attr('id', radioId)
					.attr('value', i)
					.property('checked', i === activeCohort)
					.style('margin-right', '5px')
					.style('margin-left', '0px')
					.on('click', async () => {
						const state = app.getState()
						const clearOnChange = state.termdbConfig.selectCohort.clearOnChange
						if (clearOnChange) {
							const subactions: any[] = []

							if (clearOnChange.plots)
								for (const plot of state.plots) {
									subactions.push({
										type: 'plot_delete',
										id: plot.id
									})
								}
							if (clearOnChange.filter)
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
							subactions.push({ type: 'cohort_set', activeCohort: i })
							app.dispatch({
								type: 'app_refresh',
								subactions
							})
						} else app.dispatch({ type: 'cohort_set', activeCohort: i })
					})

				td0
					.append('label')
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
				.style('margin-left', '10px')
				.style('padding-top', '20px')
				.style('padding-bottom', '20px')
				.style('font-size', 'small')
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
		if (!result.cfeatures.length) return
		for (const feature of result.features) rows.push([{ value: feature.name }])
		for (const cohort of result.cohorts) {
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
			headerThStyle: { 'font-size': '1.1em', 'font-weight': 'bold' }
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
		const color = selectCohort.activeCohortColor || 'yellow'
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
				.html(item.title)
				.on('click', () => {
					this.app.dispatch({
						type: 'plot_create',
						id: getId(),
						config: structuredClone(item.plot)
					})
				})
		}
	}

	showServerInfo = () => {
		if (!this.app.opts.pkgver && !this.app.opts.launchDate) return
		const div = this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-about-server-info')
			.style('margin-left', '10px')
			.style('padding-bottom', '5px')
			.style('font-size', '.8em')

		if (this.app.opts.pkgver) {
			div
				.append('div')
				.attr('data-testid', 'sjpp-about-release')
				.style('display', 'inline-block')
				.text('Release version: ')
				.append('a')
				.property('href', 'https://github.com/stjude/proteinpaint/pkgs/container/ppfull')
				.property('target', `${this.app.opts.pkgver}`)
				.text(`${this.app.opts.pkgver}`)
		}

		if (this.app.opts.launchDate) {
			div
				.append('div')
				.attr('data-testid', 'sjpp-about-server')
				.style('display', 'inline-block')
				.text(`${this.app.opts.pkgver ? ', ' : ''}server launched: ${this.app.opts.launchDate}`)
		}
	}
}

export const aboutInit = getCompInit(MassAbout)
