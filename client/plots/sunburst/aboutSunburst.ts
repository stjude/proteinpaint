import { SunburstChart } from './SunburstChart'
import { getPlotConfig } from './sunburst'
import { LINK, TEXT_DARK } from './SunburstRenderer'

/*
The sunburst on the About tab (massNav.tabs.about.showSunburst), of the dataset's default rings
(termdb.sunburst.twLst). It zooms, selects, launches the plots of a selection (in the plots tab) and makes
groups like the sunburst plot, but its Rings box only names the rings: they are edited in the full chart,
which a link below them launches, since the About tab has no plot config to keep them in. The counts follow
the global filter.
*/

export class AboutSunburst {
	app: any
	chart: SunburstChart
	/** launches the sunburst plot */
	onOpen: () => void
	twLst?: any[]
	/** the default rings once loaded and listed in the Rings box; kept so that an update made while they
	 *  load waits for them instead of loading and listing them again */
	ringsLoaded?: Promise<any[]>
	/** the filter of the shown counts, to re-fetch only when it changes */
	filterShown?: string

	constructor(holder: any, app: any, onOpen: () => void) {
		this.app = app
		this.onOpen = onOpen
		const div = holder.append('div').attr('data-testid', 'sjpp-about-sunburst').style('white-space', 'normal')
		this.chart = new SunburstChart({
			holder: div,
			app,
			// the Rings box and the stats close to the chart, 12px from it on both sides
			gap: 6,
			// a plot of the selection is shown in the plots tab, as the About tab's launch items are
			beforeLaunch: () => app.dispatch({ type: 'tab_set', activeTab: 1 })
		})
	}

	/** draw the counts of the app state's filter, unless they are shown already */
	async update(appState: any) {
		const termfilter = appState.termfilter
		const sig = JSON.stringify(termfilter)
		if (sig == this.filterShown) return
		this.filterShown = sig
		this.ringsLoaded ??= getPlotConfig({}, this.app).then(config => {
			this.twLst = config.twLst
			this.renderRings()
			return config.twLst
		})
		let twLst: any[]
		try {
			twLst = await this.ringsLoaded
		} catch (e: any) {
			// try again on the next update, even with the same filter
			this.ringsLoaded = undefined
			this.filterShown = undefined
			this.chart.dom.errdiv.style('display', '').text(e?.message || String(e))
			return
		}
		const drawn = await this.chart.update({
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			twLst,
			termfilter,
			colors: appState.termdbConfig?.sunburst?.colors
		})
		// a failed request is retried on the next update, unless a newer update has recorded its own filter
		if (drawn === false && this.filterShown == sig) this.filterShown = undefined
	}

	/** one line per ring with its term name, then the link to the full chart */
	renderRings() {
		for (const [i, tw] of this.twLst!.entries()) {
			this.chart
				.ringLine(i)
				.append('div')
				.style('font-size', '.9em')
				.style('color', TEXT_DARK)
				.style('overflow', 'hidden')
				.style('white-space', 'nowrap')
				.style('text-overflow', 'ellipsis')
				.attr('title', tw.term.name)
				.text(tw.term.name)
		}
		this.chart.dom.rings.body
			.append('div')
			.attr('data-testid', 'sjpp-about-sunburst-open')
			.attr('role', 'button')
			.style('margin-top', '10px')
			.style('font-size', '.85em')
			.style('color', LINK)
			.style('cursor', 'pointer')
			.text('Edit rings in the full chart ›')
			.attr('tabindex', 0)
			.on('click', this.onOpen)
			.on('keydown', (event: KeyboardEvent) => {
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault()
					this.onOpen()
				}
			})
		this.chart.markShownRings()
	}
}
