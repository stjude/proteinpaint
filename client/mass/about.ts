import { getId } from './nav'
import { type AppApi, getCompInit } from '#rx'
import type { Elem, Div, H2 } from '../types/d3'
import type { SelectCohortEntry } from '#types'
import { renderTable, type TableRow, Menu } from '#dom'
import { importPlot } from '#plots/importPlot.js'
import { select } from 'd3-selection'

/* 
"about" tab will display following contents inside this.subheader:
- if ds uses subcohorts:
	- <h2> for selectCohort.title
	- description
	- radio button options
- custom html via massNav.about.html (todo images and cartoon)
- sunburst of the dataset's default rings, if massNav.about.showSunburst; in the custom html element
  that showSunburst.holderSelector selects, if given
- active items to launch demo plots; in the custom html element that activeItems.holderSelector selects, if given
- server info
*/

const cohortTableActiveColor = 'yellow'

// this type is fully defined in MassNav def in dataset.ts but not in a form that can extract "about" config to share. thus need to repeat here to avoid tsc err
type AboutObj = {
	html: string
	activeItems?: {
		layout?: 'buttons' | 'cards'
		holderSelector?: string
		title?: string
		description?: string
		items: any
	}
	disclaimer?: any
	/** when true, render the world map from termdbConfig.geomap directly on the landing tab */
	showGeomap?: boolean
	/** render the sunburst of termdbConfig.sunburst.twLst on the landing tab; an object gives it a heading and
	 *  a holderSelector */
	showSunburst?: boolean | { holderSelector?: string; title?: string; description?: string }
}

type MassAboutOpts = {
	/** Optional. Set in the dataset file under .massNav.tabs.about. Otherwise null. */
	aboutOverrides: AboutObj | null
	/** Required. Provided from nav component */
	app: AppApi
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
	static type = 'about'

	aboutOverrides: AboutObj | null
	app: AppApi
	dom: MassAboutDom
	instanceNum: number
	selectCohort: SelectCohortEntry | null
	subheader: Elem // where all contents are rendered
	type: string
	opts: MassAboutOpts
	state: any
	/** reused menu for openChartMenu() so repeated card clicks don't accumulate menu divs in the DOM */
	chartMenu?: Menu
	/** the sunburst on this tab, once its module is loaded (initSunburst) */
	sunburst?: Promise<any>

	constructor(opts: MassAboutOpts) {
		this.opts = opts
		this.type = MassAbout.type
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
			this.dom.cohortTitle = opts.subheader
				.append('h2')
				.attr('data-testid', 'sjpp-about-cohort-title')
				.style('margin-left', '10px')
				.text(opts.selectCohort.title)
		}

		if (opts.selectCohort?.prompt) {
			this.dom.cohortPrompt = this.subheader
				.append('div')
				.attr('data-testid', 'sjpp-about-cohort-prompt')
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
		this.initGeomap(appState)
		this.initSunburst(appState)
		this.initActiveItems()
		this.initDisclaimer()
		//Always show the release version and server launch date at the bottom
		this.showServerInfo()
	}

	async main() {
		// do not render unless the cohort tab is active
		if (this.state.nav.activeTab !== 0) return
		await this.renderCohortsTable()
		// the sunburst counts follow the global filter
		if (this.sunburst) await (await this.sunburst)?.update(this.state)
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
			.attr('data-testid', 'sjpp-about-cohort-options-table')
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

		this.dom.cohortTable = this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-about-cohort-table')
			.style('margin-left', '12px')

		if (this.selectCohort.asterisk) {
			this.dom.cohortAsterisk = this.subheader
				.append('div')
				.attr('data-testid', 'sjpp-about-cohort-asterisk')
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

	// render the world map (from termdbConfig.geomap) directly on the landing tab when the dataset opts in.
	// the renderer (and its ~170KB world.json basemap) is dynamically imported so it never loads for
	// datasets that don't enable the map.
	initGeomap = async appState => {
		if (!this.aboutOverrides?.showGeomap) return
		const geomap = appState.termdbConfig?.geomap
		if (!geomap?.sites?.length) return
		const holder = this.subheader.append('div').attr('data-testid', 'sjpp-about-geomap').style('padding', '10px')
		const { renderGeomap } = await import('#plots/geomap/render.ts')
		renderGeomap(holder, geomap)
	}

	// render the sunburst of the dataset's default rings when the dataset opts in. like the geomap,
	// its module is dynamically imported so it only loads for datasets that show it; main() draws it
	initSunburst = appState => {
		if (!this.aboutOverrides?.showSunburst) return
		if (!appState.termdbConfig?.sunburst?.twLst?.length) return
		const s = this.aboutOverrides.showSunburst
		const placed = typeof s == 'object' ? this.getSectionHolder(s.holderSelector, 'showSunburst') : undefined
		const section = (placed || this.subheader.append('div')).style('padding', '10px')
		if (typeof s == 'object') this.sectionHeading(section, s.title, s.description)
		// the chart is as wide as its columns, centered, with some space before the next section
		const holder = section
			.append('div')
			.style('display', 'flex')
			.style('justify-content', 'center')
			.style('margin-bottom', '32px')
		const onOpen = () => this.launchActiveItem({ plot: { chartType: 'sunburst' } }, holder.node())
		this.sunburst = import('#plots/sunburst/aboutSunburst.ts')
			.then(_ => new _.AboutSunburst(holder, this.app, onOpen))
			.catch(e => {
				holder
					.append('div')
					.attr('class', 'sja_errorbar')
					.text(e?.message || String(e))
				console.error(e)
			})
	}

	destroy() {
		void this.sunburst?.then(sunburst => sunburst?.chart.destroy())
	}

	// the element of the custom html that a section's holderSelector (a css selector from the dataset)
	// selects; undefined without one, or when it selects nothing, and then the section follows the content above
	getSectionHolder = (selector: string | undefined, section: string) => {
		if (!selector) return
		let el
		try {
			el = this.subheader.select(selector)
		} catch (_) {
			// not a valid selector
		}
		if (el && !el.empty()) return el
		console.error(`about tab: ${section}.holderSelector '${selector}' selects no element of the html; shown at the end`)
	}

	// a section's centered heading and text, from the dataset; nothing if neither is given
	sectionHeading = (holder, title?: string, description?: string) => {
		if (!title && !description) return
		const div = holder.append('div').style('text-align', 'center').style('margin', '24px 0 12px 0')
		if (title)
			div
				.append('div')
				.attr('data-testid', 'sjpp-about-section-title')
				.style('font-size', '1.4em')
				.style('font-weight', '600')
				.style('color', '#243b53')
				.html(title)
		if (description)
			div
				.append('div')
				.style('margin-top', '6px')
				.style('font-size', '.95em')
				.style('color', '#4b5563')
				.html(description)
	}

	initActiveItems = () => {
		if (!this.aboutOverrides?.activeItems) return
		const placed = this.getSectionHolder(this.aboutOverrides.activeItems.holderSelector, 'activeItems')
		const holder = placed || this.subheader
		const { title, description } = this.aboutOverrides.activeItems
		this.sectionHeading(holder, title, description)
		if (this.aboutOverrides.activeItems.layout == 'cards') {
			this.initActiveItemCards(holder)
			return
		}

		// todo: customize general holder by activeItems.holderStyle{}
		const div = holder
			.append('div')
			.attr('data-testid', 'sjpp-custom-about-activeItems')
			// placed by the custom html, the buttons are not indented
			.style('padding', placed ? '0px 0px 10px 0px' : '0px 0px 10px 20px')

		for (const item of this.aboutOverrides.activeItems.items) {
			// todo: by item.type, item.divStyle{}
			const btn = div
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '5px')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', 'sjpp-custom-active-item-btn')
				.html(item.title)
			this.makeActivatable(btn, () => this.launchActiveItem(item, btn.node()))
		}
	}

	// render activeItems as large square tiles (homepage style) that lift on hover
	initActiveItemCards = parent => {
		const items = this.aboutOverrides!.activeItems!.items
		const holder = parent
			.append('div')
			.attr('data-testid', 'sjpp-custom-about-activeItems')
			.style('display', 'flex')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'center')
			.style('gap', '24px')
			.style('padding', '20px 20px 30px 20px')

		for (const item of items) {
			const card = holder
				.append('div')
				.attr('class', 'sjpp-about-card')
				.attr('data-testid', 'sjpp-custom-active-item-card')
			if (item.icon) card.append('div').attr('class', 'sjpp-about-card-icon').html(item.icon)
			card.append('div').attr('class', 'sjpp-about-card-title').html(item.title)
			// always render the subtitle div (even when empty) so its reserved height keeps every card the same size
			card
				.append('div')
				.attr('class', 'sjpp-about-card-subtitle')
				.text(item.subtitle || '')
			this.makeActivatable(card, () => this.launchActiveItem(item, card.node()))
		}
	}

	// make a non-native clickable element (a styled <div>) operable like a button:
	makeActivatable = (sel, onActivate) => {
		sel
			.attr('role', 'button')
			.attr('tabindex', 0)
			.on('click', () => onActivate())
			.on('keydown', (event: KeyboardEvent) => {
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault()
					onActivate()
				}
			})
	}

	// launch behavior shared by button and card layouts
	launchActiveItem = async (item, anchorEl) => {
		// an item grouping several launch items opens them as a menu under the item
		if (item.menu) {
			this.openItemMenu(item.menu, anchorEl)
			return
		}
		// some charts (e.g. proteinView) require user input before a plot can be created;
		// open their chart-specific menu instead of directly creating a plot
		if (item.openChartMenu) {
			await this.openChartMenu(item.openChartMenu, anchorEl)
			return
		}
		if (!item.plot) {
			console.error('about activeItem has neither .plot nor .openChartMenu', item)
			return
		}
		/* First, set the active tab to toggle to the plots tab and wait for the tab to be set,
		otherwise the plotDiv is hidden when rendering and may cause issues. */
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
	}

	// menu of launch items in labelled groups, anchored to the tile. An entry with its own
	// chart menu (e.g. a gene search) replaces this menu's content in place; other entries
	// hide the menu and launch their plot.
	openItemMenu = (groups, anchorEl) => {
		const menu = this.chartMenu || (this.chartMenu = new Menu({ padding: '0px' }))
		menu.clear()
		const holder = menu.d.append('div').style('padding', '6px 0').style('min-width', '260px')
		for (const group of groups) {
			if (group.label) {
				holder
					.append('div')
					.style('padding', '6px 14px 2px')
					.style('font-size', '0.75em')
					.style('font-weight', 'bold')
					.style('letter-spacing', '0.05em')
					.style('text-transform', 'uppercase')
					.style('color', '#777')
					.text(group.label)
			}
			for (const entry of group.items || []) {
				const row = holder.append('div').attr('class', 'sja_menuoption').style('padding', '6px 14px')
				row.append('div').style('font-weight', '600').html(entry.title)
				if (entry.subtitle) row.append('div').style('font-size', '0.8em').style('color', '#666').text(entry.subtitle)
				this.makeActivatable(row, async () => {
					if (!entry.openChartMenu && !entry.menu) menu.hide()
					await this.launchActiveItem(entry, anchorEl)
				})
			}
		}
		menu.showunder(anchorEl)
	}

	// open a chart-specific launch menu (e.g. gene search for proteinView) anchored to the tile.
	// the chart module is dynamically imported so its code only loads when the tile is clicked.
	openChartMenu = async (chartType, anchorEl) => {
		// reuse a single menu instance; Menu.hide() only hides (doesn't remove) the div
		const menu = this.chartMenu || (this.chartMenu = new Menu({ padding: '0px' }))
		menu.clear()
		// wrap dispatch so that creating a plot from the menu also switches to the plots tab
		const shimApp = {
			opts: this.app.opts,
			dispatch: async action => {
				if (action.type == 'plot_create') await this.app.dispatch({ type: 'tab_set', activeTab: 1 })
				return this.app.dispatch(action)
			}
		}
		const chartsInstanceShim = { app: shimApp, dom: { tip: menu } }
		const _ = await importPlot(chartType)
		if (typeof _.makeChartBtnMenu != 'function')
			throw `about activeItem openChartMenu: chart '${chartType}' has no makeChartBtnMenu`
		_.makeChartBtnMenu(menu.d.append('div'), chartsInstanceShim, chartType)
		menu.showunder(anchorEl)
	}

	initDisclaimer = () => {
		const d = this.aboutOverrides?.disclaimer
		if (!d) return
		// customize styling from d{}
		const div = this.subheader
			.append('div')
			.attr('data-testid', 'sjpp-custom-about-disclaimer')
			.style('margin', '10px 0 20px 10px')
			.style('opacity', 0.7)
			.style('padding', '10px')
			.style('background-color', '#f8f9fa')
			.style('border-left', '4px solid #6c757d')
			.style('font-size', '0.8em')
		div.append('div').style('margin-bottom', '8px').style('font-weight', 'bold').text('DISCLAIMER')
		div.append('div').text(d.text)
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
