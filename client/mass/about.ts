import { getCompInit } from '../rx'
import { Elem } from '../types/d3'
import { MassAppApi } from './types/mass'
import { renderTable, TableRow } from '#dom'
import { select } from 'd3-selection'
import { getProfileLogin } from '../plots/profilePlot.js'

type AboutObj = {
	html: string
}

type MassAboutOpts = {
	aboutOverrides: AboutObj | null
	app: MassAppApi
	instanceNum: number
	selectCohort: any
	subheader: Elem
}

export class MassAbout {
	aboutOverrides: AboutObj | null
	app: MassAppApi
	dom: any
	instanceNum: number
	selectCohort: any
	subheader: Elem
	type: string

	constructor(opts: MassAboutOpts) {
		this.type = 'about'
		this.app = opts.app
		this.subheader = opts.subheader
		this.instanceNum = opts.instanceNum
		this.aboutOverrides = opts.aboutOverrides
		this.selectCohort = opts.selectCohort
		this.dom = {}

		if (opts.selectCohort?.title) {
			this.dom.cohortTitle = opts.subheader.append('h2').style('margin-left', '10px').text(opts.selectCohort.title)
		}

		if (opts.selectCohort?.description || opts.selectCohort?.descriptionByUser) {
			//temporary logic to get the description until the login is implemented
			const loginInfo = getProfileLogin()
			if (loginInfo[2]) {
				const description = opts.selectCohort.descriptionByUser?.[loginInfo[2]] || opts.selectCohort.description
				this.dom.cohortDescription = this.subheader.append('div').style('margin-left', '10px').html(description)
			}
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

	init(appState) {
		/** If selectCohort available, options in the about html will not show */
		this.initCohort(appState)
		this.initCustomHtml()
		//Always show the release version and server launch date at the bottom
		this.showServerInfo()
	}

	async main() {
		await this.renderCohortsTable()
	}

	initCohort = appState => {
		if (this.selectCohort == null) return

		const instanceNum = this.instanceNum
		const activeCohort = appState.activeCohort
		const app = this.app

		//TODO: replace with make_radios
		this.dom.cohortOpts
			.append('table')
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
						const clearOnChange = state.clearOnChange
						if (clearOnChange) {
							const subactions: { [index: string]: string | number | any }[] = [{ type: 'cohort_set', activeCohort: i }]
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
							if (clearOnChange.plots)
								for (const plot of state.plots) {
									subactions.push({
										type: 'plot_delete',
										id: plot.id
									})
								}

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

		this.dom.cohortInputs = this.dom.cohortOpts.selectAll('input')
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
			maxHeight: '60vh'
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
		activeColumns.style('background-color', 'yellow')
	}

	initCustomHtml = () => {
		if (this.selectCohort != null) return
		if (!this.aboutOverrides) return
		this.subheader.append('div').style('padding', '10px').html(this.aboutOverrides.html)
	}

	showServerInfo = () => {
		if (!this.app.opts.pkgver && !this.app.opts.launchDate) return
		const div = this.subheader
			.append('div')
			.style('margin-left', '10px')
			.style('padding-bottom', '5px')
			.style('font-size', '.8em')

		if (this.app.opts.pkgver) {
			div
				.append('div')
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
				.style('display', 'inline-block')
				.text(`${this.app.opts.pkgver ? ', ' : ''}server launched: ${this.app.opts.launchDate}`)
		}
	}
}

export const aboutInit = getCompInit(MassAbout)
