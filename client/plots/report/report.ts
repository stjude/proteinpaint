import { getCompInit, copyMerge } from '../../rx/index.js'
import { fillTermWrapper } from '#termsetting'
import { ReportView } from './view/reportView'
import { RxComponentInner } from '../../types/rx.d'
import { controlsInit } from '../controls.js'
import { importPlot } from '#plots/importPlot.js'

export class Report extends RxComponentInner {
	config: any
	view!: ReportView
	components: any
	settings: any
	opts: any
	state!: any
	readonly type: string
	id!: string
	filterTWs: any[] = []
	selectFilters: any

	constructor() {
		super()
		this.type = 'report'
	}

	async init(appState) {
		this.config = appState.plots.find(p => p.id === this.id)
		this.view = new ReportView(this)

		this.components = { plots: {} }
		const state = this.getState(appState)
		for (const section of state.config.sections) {
			const div = this.view.dom.plotsDiv.append('div')

			const headerIcon = div.append('span').style('margin-right', '10px').style('cursor', 'pointer').text('▼') //icon to toggle the plots

			div
				.append('div')
				.style('display', 'inline-block')
				.style('font-size', '1.2em')
				.style('margin', '10px 0px')
				.style('font-weight', 'bold')
				.text(section.name) //header
			const sectionDiv = div
				.append('div')
				.style('margin', '10px')
				.style('display', 'flex')
				.style('flex-direction', 'row')
				.style('flex-wrap', 'wrap')
				.style('width', '100vw')
			headerIcon.on('click', () => {
				const display = sectionDiv.style('display')
				headerIcon.text(display === 'none' ? '▼' : '▲') //toggle the icon
				//toggle the display of the plot
				sectionDiv.style('display', display === 'none' ? 'flex' : 'none')
			})

			for (const plot of section.plots) {
				if (this.components.plots[plot.id]) continue
				await this.setPlot(plot, sectionDiv)
			}
		}
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			plots: appState.plots.filter(p => p.parentId === this.id), //this property is needed to indicate that child plots need to be added to the appState plots
			termfilter: appState.termfilter,
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig
		}
	}

	async main() {
		this.config = structuredClone(this.state.config)
		this.settings = this.config.settings.report
		this.selectFilters.fillFilters()
	}

	async setPlot(plot, sectionDiv) {
		const plotDiv = sectionDiv.append('div').style('display', 'inline-block').style('margin', '10px')
		const headerDiv = plotDiv.append('div')
		const headerIcon = headerDiv.append('span').style('margin', '10px').style('cursor', 'pointer').text('▼') //icon to toggle the plots

		const header = headerDiv
			.append('div')
			.style('display', 'inline-block')
			.style('font-size', '1.1em')
			.style('margin-top', '10px')
		headerIcon.on('click', () => {
			const display = holder.style('display')
			headerIcon.text(display === 'none' ? '▼' : '▲') //toggle the icon
			//toggle the display of the plot
			holder.style('display', display === 'none' ? 'block' : 'none')
		})
		const holder = plotDiv.append('div')
		const opts = structuredClone(plot)
		opts.header = header
		opts.holder = holder
		opts.app = this.app
		opts.parentId = this.id
		//opts.controls = this.view.dom.controlsHolder
		const { componentInit } = await importPlot(opts.chartType)
		this.components.plots[opts.id] = await componentInit(opts)
	}

	async setControls() {
		this.view.dom.controlsHolder.selectAll('*').remove()
		const inputs = this.view.getControlInputs()
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.view.dom.controlsHolder,
				inputs
			})
		}
	}

	async downloadReport() {
		const JSPDF = await import('jspdf')
		const { jsPDF } = JSPDF
		/*
		When imported, the svg2pdf.js module modifies or extends the jsPDF library (which we already imported).
		The code inside svg2pdf.js adds a new method (.svg()) to the jsPDF object prototype, making that functionality available on all jsPDF instances.
		Therefore, a simple import 'svg2pdf.js' without curly braces is all that is needed to apply its functionality. 
		*/
		await import('svg2pdf.js') // This import extends jsPDF with SVG functionality
		const doc = new jsPDF('p', 'pt', 'a4') // p for portrait, l for landscape, points, A4 size
		const pageWidth = doc.internal.pageSize.getWidth() - 10
		const pageHeight = doc.internal.pageSize.getHeight() - 10
		const ratio = 72 / 96 //convert pixels to pt

		let y = 40
		const x = 20
		doc.setFontSize(12)
		doc.text(this.config.sections[0].name, x, y)
		doc.setFontSize(10)
		for (const section of this.config.sections) {
			for (const plotConfig of section.plots) {
				const plot = this.components.plots[plotConfig.id]
				console.log(plot)
				if (plot?.getName2Svg) {
					const name2svg = plot.getName2Svg()
					const entries: any[] = Object.entries(name2svg)

					for (const [name, svgObj] of entries) {
						const svg = svgObj.node()
						const rect = svg.getBoundingClientRect()
						svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
						const width = Math.min(pageWidth, rect.width * ratio) - 20
						const height = Math.min(pageHeight, rect.height * ratio) - 20
						if (y + height > pageHeight - 20) {
							doc.addPage()
							y = 40
						}
						if (y == 40) {
							//new page, add section
							doc.setFontSize(12)
							doc.text(section.name, x, 40)
							doc.setFontSize(10)
							y += 30
						}
						doc.text(name, x, y)
						y += 20
						await doc.svg(svg, { x, y, width, height })
						y = y + height + 30
					}
				}
			}
		}
		if (y == 40) doc.deletePage(doc.internal.getNumberOfPages()) //delete last page if nothing added
		doc.save('report.pdf')
	}
}

export async function getPlotConfig(opts, app) {
	//if (!opts.colorTW) throw 'sampleScatter getPlotConfig: opts.colorTW{} missing'
	//if (!opts.name && !(opts.term && opts.term2)) throw 'sampleScatter getPlotConfig: missing coordinates input'

	const authFilter = app.vocabApi?.termdbConfig?.authFilter
	const settings = getDefaultReportSettings()
	if (authFilter?.lst?.length) {
		//The authFilter contains a single tvs with the list of sites the user has access to.
		//As they are preselected here I fill the settings with the sites to show them as selected in the site filter
		const siteTvs = authFilter.lst[0].tvs
		const sites = siteTvs?.values?.map(v => v.key)
		settings[siteTvs.term.id] = sites //set the site filter to the current site
	}
	const plot: any = {
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			report: settings,
			startColor: {}, //dict to store the start color of the gradient for each chart when using continuous color
			stopColor: {} //dict to store the stop color of the gradient for each chart when using continuous color
		}
	}

	try {
		const config = app.vocabApi?.termdbConfig?.plotConfigByCohort?.default?.report
		// the filter should always start with the authFilter, avoids issues with previous filters from previous sessions with different user access
		opts.filter = authFilter
		copyMerge(plot, config, opts)
		if (plot.filterTWs) for (const tw of plot.filterTWs) await fillTermWrapper(tw, app.vocabApi)

		return plot
	} catch (e) {
		console.log(e)
		throw `${e} [sampleScatter getPlotConfig()]`
	}
}

export const reportInit = getCompInit(Report)
// this alias will allow abstracted dynamic imports
export const componentInit = reportInit

export function getDefaultReportSettings() {
	return {}
}
