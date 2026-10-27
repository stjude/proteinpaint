import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { getCombinedTermFilter } from '#filter'
import { fillTermWrapper, termsettingInit } from '#termsetting'
import { SunburstChart } from './SunburstChart'
import { allowedSampleTypes } from './sunburst.data'

/*
Sunburst of nested sample counts, one dictionary term per ring (categorical, or numeric binned),
inside out. The dataset sets the default rings (termdb.sunburst.twLst); the Rings box left of the
chart switches, edits, adds and removes them (from each term pill's menu). Counts follow the
global and plot filters.

The chart itself, its wedge selection and the sample group made from it are in SunburstChart.ts, which
the About tab also uses.

In a dataset with a sample hierarchy, the rings are patient terms and the terms of one sample type (no
value maps between sibling types such as primary and PDX samples): once a ring is of a sample type, the
pickers offer only terms of its line of descent. The server returns the counted unit (e.g. patients,
primary samples), which the chart's wording follows.
*/

class Sunburst extends PlotBase implements RxComponent {
	static type = 'sunburst'
	type: string
	chart!: SunburstChart
	twLst: any[] = []
	/** the rings the Rings box shows, to rebuild its pills only when they change */
	ringsShown = ''
	/** the Rings box pills and their main() argument without the filter, which follows the state */
	ringPills: { pill: any; arg: any }[] = []

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = Sunburst.type
		if (this.opts.header)
			this.opts.header.style('padding-left', '7px').style('color', 'rgb(85, 85, 85)').html('Sunburst')
	}

	getState(appState: any) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config,
			// global mass filter combined with this plot's local filter
			termfilter: getCombinedTermFilter(appState, config.filter),
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			sunburst: appState.termdbConfig?.sunburst || {}
		}
	}

	async init() {
		// the plot holder inherits nowrap from the sandbox; the cards need their text to wrap
		const holder = this.opts.holder
			.append('div')
			.attr('data-testid', 'sjpp-sunburst-holder')
			.style('white-space', 'normal')
			.style('padding', '10px')
		this.chart = new SunburstChart({ holder, app: this.app })
		// a ring pill is only the term: termsetting's info button (its holder's 4th child) is hidden
		this.chart.dom.rings.box
			.append('style')
			.text('.sjpp-sunburst-ringpill > div:nth-child(4) { display: none !important; }')
	}

	async main() {
		const config = this.state.config
		this.twLst = config.twLst || []
		await this.renderRings()
		await this.chart.update(
			{
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				twLst: this.twLst,
				termfilter: this.state.termfilter,
				groupFilter: config.filter,
				colors: this.state.sunburst.colors
			},
			'Add a ring in the Rings box to draw the sunburst.'
		)
	}

	/************ rings box ************/

	/** one line per ring: its number and a term pill, whose menu switches, edits or removes the
	 *  term; then + Add ring. Rebuilt only when the rings change; otherwise the pills get the current
	 *  filter, which their term pickers use */
	async renderRings() {
		const twLst = this.twLst
		const filter = this.state.termfilter?.filter
		const sig = JSON.stringify(twLst.map(tw => [tw.$id, tw.q]))
		if (sig == this.ringsShown) {
			await Promise.all(this.ringPills.map(({ pill, arg }) => pill.main({ ...arg, filter })))
			return
		}
		this.ringsShown = sig
		this.ringPills = []
		this.chart.dom.rings.body.selectAll('*').remove()
		const disable_terms = twLst.map(tw => tw.term)
		const sampleTypes = this.app.vocabApi.termdbConfig?.sampleTypes
		const edit = (lst: any[]) => this.app.dispatch({ type: 'plot_edit', id: this.id, config: { twLst: lst } })
		for (const [i, tw] of twLst.entries()) {
			const pillDiv = this.chart
				.ringLine(i)
				.append('div')
				.attr('class', 'sjpp-sunburst-ringpill')
				.style('min-width', '0')
				.style('overflow', 'hidden')
				.style('white-space', 'nowrap')
				.style('font-size', '.9em')
				.style('text-overflow', 'ellipsis')
				.attr('title', tw.term.name)
			const others = twLst.filter((_, j) => j != i)
			const p = await this.ringPill(
				pillDiv,
				newTw => {
					const lst = twLst.slice()
					if (newTw?.term) lst[i] = newTw
					else lst.splice(i, 1)
					edit(lst)
				},
				allowedSampleTypes(others, sampleTypes)
			)
			this.ringPills.push({ pill: p, arg: { term: tw.term, q: tw.q, $id: tw.$id, disable_terms } })
		}
		const addDiv = this.chart
			.ringRow(twLst.length)
			.style('margin-top', '6px')
			.append('div')
			.style('margin-left', '21px')
		const add = await this.ringPill(
			addDiv,
			newTw => {
				if (newTw?.term) edit([...twLst, newTw])
			},
			allowedSampleTypes(twLst, sampleTypes),
			'+ Add ring'
		)
		this.ringPills.push({ pill: add, arg: { term: null, q: null, disable_terms } })
		await Promise.all(this.ringPills.map(({ pill, arg }) => pill.main({ ...arg, filter })))
		this.chart.markShownRings()
	}

	/** a ring term pill; `sampleTypes` limits the terms it offers (see allowedSampleTypes) */
	async ringPill(holder: any, callback: (tw: any) => void, sampleTypes?: number[], placeholder?: string) {
		return await termsettingInit({
			holder,
			vocabApi: this.app.vocabApi,
			usecase: { target: 'sunburst', ...(sampleTypes ? { sampleTypes } : {}) },
			// the full term name; a name too long for the box is clipped, with the name as its tooltip
			abbrCutoff: 1000,
			menuOptions: '*',
			numericEditMenuVersion: ['discrete'],
			defaultQ4fillTW: { numeric: { mode: 'discrete' } },
			...(placeholder ? { placeholder } : {}),
			debug: this.app.opts.debug,
			callback
		})
	}

	destroy() {
		this.chart?.destroy()
	}
}

/** the plot config, with the dataset's default rings unless `opts` gives its own; also used by the
 *  About tab for the same rings */
export async function getPlotConfig(opts: any, app: any) {
	const config: any = {
		chartType: 'sunburst',
		settings: {}
	}
	copyMerge(config, opts)
	// default rings from the dataset; a saved session or another chart may give its own
	if (!config.twLst) config.twLst = structuredClone(app.vocabApi.termdbConfig?.sunburst?.twLst || [])
	config.twLst = await Promise.all(
		config.twLst.map((tw: any) => fillTermWrapper(tw, app.vocabApi, { numeric: { mode: 'discrete' } } as any))
	)
	return config
}

export const sunburstInit = getCompInit(Sunburst)
// this alias will allow abstracted dynamic imports
export const componentInit = sunburstInit
