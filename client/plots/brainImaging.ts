import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { controlsInit } from './controls'
import { getT0T2defaultQ } from './summaryQ.ts'
import { fillTermWrapper } from '#termsetting'
import { dofetch3 } from '#common/dofetch'
import { Menu, renderTable, sayerror, type TableRow, type TableColumn } from '#dom'
import { debounce } from 'debounce'
import { getCombinedTermFilter } from '#filter'
import { fetchBrainImagingSamples } from './getBrainImagingSampleSet.ts'
import svgLegend from '#dom/svg.legend'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'

type ImgData = { data: any; td: any; dataUrls: any }

class BrainImaging extends PlotBase implements RxComponent {
	static type = 'brainImaging'

	type: string
	components: { controls: any }
	legendLabelMouseup!: any
	imagesData!: { [index: string]: ImgData }
	legendRenderer!: any
	legendItems!: any
	legendValues!: { [index: string]: { color: string; maxLength: number; crossedOut: boolean } }
	config!: any
	settings!: any
	dom!: any

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = BrainImaging.type
		this.components = { controls: {} }
		setInteractivity(this)
	}

	async init(appState) {
		const state = this.getState(appState)
		const holder = this.opts.holder
		if (this.opts.header) {
			const fileNames = state.config.selectedSampleFileNames
			// show individual sample names only for small selections; otherwise show the count
			const samplesLabel =
				fileNames.length < 3 ? fileNames.map(f => f.split('.nii')[0]).join(', ') : `${fileNames.length} samples`
			this.opts.header
				.style('padding-left', '7px')
				.style('color', 'rgb(85, 85, 85)')
				.html(`Brain Imaging: ${state.config.queryKey}/${samplesLabel}`)
		}
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const rightDiv = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerHolder = rightDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '10px')
		const contentHolder = rightDiv.append('div').style('vertical-align', 'top')
		const table = contentHolder.append('table').style('border-collapse', 'collapse')
		const headerTr = table.append('tr')
		const contentTr = table.append('tr').style('background-color', 'black')
		const tdL = contentTr.append('td')
		const tdF = contentTr.append('td')
		const tdT = contentTr.append('td')
		const legendHolder = contentHolder.append('svg').style('width', '100%').on('mouseup', this.legendLabelMouseup)
		const legendMenu = new Menu({ padding: '0px' })

		this.dom = {
			headerHolder,
			contentHolder,
			headerTr,
			tdL,
			tdF,
			tdT,
			legendHolder,
			legendMenu
		}
		this.addSliders(state)

		const configInputsOptions = this.getConfigInputsOptions(state)

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: configInputsOptions
			})
		}
		this.components.controls.on('downloadClick.brainImaging', () => {
			const urls: unknown[] = []
			for (const key in this.imagesData)
				for (const category in this.imagesData[key].dataUrls) {
					const dataUrl = this.imagesData[key].dataUrls[category].url
					urls.push(dataUrl)
				}
			this.downloadImage(urls)
		})
		this.legendRenderer = svgLegend({ holder: this.dom.legendHolder })
	}

	addSliders(state) {
		const settings = state.config.settings.brainImaging
		/* slice index ranges come from the template's voxel counts, read from the NIfTI
		header at server launch */
		const dims = state.RefNIdata?.dimensions
		const maxL = (dims?.l || 193) - 1
		const maxF = (dims?.f || 229) - 1
		const maxT = (dims?.t || 193) - 1

		const tr = this.dom.headerTr
		let td = tr.append('td')
		td.append('label').attr('for', 'saggital').text('Sagittal:')
		this.dom.saggitalSlider = td
			.append('input')
			.attr('id', 'saggital')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', maxL)
			.attr('value', settings.brainImageL)
			.on('change', e => {
				this.editBrainImage('brainImageL', e.target.value)
			})
		this.dom.saggitalInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', maxL)
			.attr('value', settings.brainImageL)
			.on('change', e => {
				this.editBrainImage('brainImageL', e.target.value)
			})
			.style('vertical-align', 'top')

		td = tr.append('td')

		td.append('label').attr('for', 'coronal').text('Coronal:')
		this.dom.coronalSlider = td
			.append('input')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', maxF)
			.attr('value', settings.brainImageF)
			.on('change', e => {
				this.editBrainImage('brainImageF', e.target.value)
			})
		this.dom.coronalInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', maxF)
			.attr('value', settings.brainImageF)
			.on('change', e => {
				this.editBrainImage('brainImageF', e.target.value)
			})
			.style('vertical-align', 'top')

		td = tr.append('td')

		td.append('label').attr('for', 'axial').text('Axial:')
		this.dom.axialSlider = td
			.append('input')
			.attr('id', 'axial')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', maxT)
			.attr('value', settings.brainImageT)
			.on('change', e => {
				this.editBrainImage('brainImageT', e.target.value)
			})
		this.dom.axialInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', maxT)
			.attr('value', settings.brainImageT)
			.on('change', e => {
				this.editBrainImage('brainImageT', e.target.value)
			})
	}

	editBrainImage(key, value) {
		if (!value) return
		const settings = { [key]: Number(value) }

		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { brainImaging: settings } } })
	}

	downloadImage(dataUrls) {
		for (const dataUrl of dataUrls) {
			const downloadImgName = 'brainImaging'
			const a = document.createElement('a')
			document.body.appendChild(a)

			a.addEventListener(
				'click',
				() => {
					// Download the image
					a.download = downloadImgName + '.png'
					a.href = dataUrl
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		}
	}

	getConfigInputsOptions(state) {
		if (state.config.selectedSampleFileNames.length == 1) return []
		const mandatoryConfigInputOptions = [
			{
				label: 'Divide by',
				type: 'term',
				chartType: 'brainImaging',
				configKey: 'divideByTW',
				title: 'Categories to divide by',
				usecase: { target: 'brainImaging', detail: 'term0' },
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete'],
				defaultQ4fillTW: getT0T2defaultQ()
			},
			{
				label: 'Color by',
				type: 'term',
				chartType: 'brainImaging',
				configKey: 'overlayTW',
				title: 'Categories to color the samples',
				usecase: { target: 'brainImaging', detail: 'term2' },
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete'],
				defaultQ4fillTW: getT0T2defaultQ()
			}
		]
		return mandatoryConfigInputOptions
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)

		// global mass filter combined with this plot's local filter (config.filter,
		// set by the plot wrapper's filter UI); restricts which selected samples render
		const termfilter = getCombinedTermFilter(appState, config.filter)

		return {
			config,
			termfilter,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			RefNIdata: appState.termdbConfig.queries.NIdata[config.queryKey]
		}
	}

	async main() {
		this.config = structuredClone(this.state.config) //to modify config on plot_edit
		this.settings = this.state.config.settings.brainImaging

		//settings may be edited by the slider or the input, so we update the sliders and inputs to reflect the current settings
		this.dom.saggitalSlider.property('value', this.settings.brainImageL)
		this.dom.saggitalInput.property('value', this.settings.brainImageL)
		this.dom.coronalSlider.property('value', this.settings.brainImageF)
		this.dom.coronalInput.property('value', this.settings.brainImageF)
		this.dom.axialSlider.property('value', this.settings.brainImageT)
		this.dom.axialInput.property('value', this.settings.brainImageT)

		let data
		try {
			data = await Promise.all([
				this.requestImage('l', this.settings.brainImageL),
				this.requestImage('f', this.settings.brainImageF),
				this.requestImage('t', this.settings.brainImageT)
			])
		} catch (e: any) {
			this.showNoImage(e?.message || e)
			return
		}
		// e.g. none of the requested samples has an imaging file (sample view and
		// matrix may request any sample); show the message instead of crashing.
		// the route sends errors as a plain string, so it is not cached by dofetch3
		const failedIdx = data.findIndex(d => !d || typeof d == 'string' || d.error || !d.brainImage)
		if (failedIdx != -1) {
			const failed = data[failedIdx]
			this.showNoImage((typeof failed == 'string' && failed) || failed?.error || 'no brain imaging data')
			return
		}

		this.imagesData = {
			brainImageL: { dataUrls: {}, td: this.dom.tdL, data: data[0] },
			brainImageF: { dataUrls: {}, td: this.dom.tdF, data: data[1] },
			brainImageT: { dataUrls: {}, td: this.dom.tdT, data: data[2] }
		}

		for (const img of Object.values(this.imagesData)) this.renderImages(img)

		this.renderLegend()
	}

	// shown when image data could not be generated, e.g. the sample has no imaging file
	showNoImage(message: any) {
		for (const td of [this.dom.tdL, this.dom.tdF, this.dom.tdT]) td.selectAll('*').remove()
		this.dom.tdL
			.append('div')
			.style('color', 'white')
			.style('padding', '20px')
			.style('white-space', 'nowrap')
			.text(String(message))
		this.dom.legendHolder.selectAll('*').remove()
	}

	async requestImage(key, value) {
		const body = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			refKey: this.state.config.queryKey,
			[key]: value,
			selectedSampleFileNames: this.state.config.selectedSampleFileNames,
			divideByTW: this.state.config.divideByTW,
			overlayTW: this.state.config.overlayTW,
			legendFilter: this.state.config.legendFilter,
			filter: this.state.termfilter?.filter
		}
		return await dofetch3('brainImaging', { body })
	}

	renderImages({ data, td, dataUrls }: ImgData) {
		this.legendValues = data.legend
		if (data.error) throw data.error
		for (const [termV, result] of Object.entries(data.brainImage)) {
			dataUrls[termV] = result
		}

		td.selectAll('*').remove()
		for (const [termV, result] of Object.entries(dataUrls)) {
			const imgResult = result as { catNum: number; url: string }
			if (this.state.config.divideByTW)
				td.append('div')
					.attr('class', 'pp-chart-title')
					.style('text-align', 'center')
					.text(`${termV} (n=${imgResult.catNum})`)
					.style('font-weight', '600')
					.style('color', 'white')
					.style('font-size', '24px')
					.style('margin-bottom', '5px')
					.style('margin-top', '5px')
					.style('display', 'block')
			td.append('div').append('img').attr('src', imgResult.url)
		}
	}

	renderLegend() {
		// with a single sample the intensity color scale carries no information; skip it
		if (this.state.config.selectedSampleFileNames?.length == 1) {
			this.dom.legendHolder.selectAll('*').remove()
			return
		}
		const legendItems: any[] = []
		for (const [label, v] of Object.entries(this.legendValues)) {
			const scale = scaleLinear([0, v.maxLength], [rgb('white').formatHex(), v.color]).clamp(true)
			legendItems.push({
				text: label == 'default' ? 'Combined Intensity' : label,
				width: 140,
				scale,
				colors: ['white', v.color],
				domain: [0, v.maxLength],
				key: label,
				crossedOut: v.crossedOut
			})
		}
		this.legendItems = legendItems
		const legendRendererData = [
			{
				items: legendItems
			}
		]

		this.legendRenderer(legendRendererData, {
			settings: {
				fontsize: 16,
				iconh: 14,
				iconw: 14,
				dimensions: {
					xOffset: 0
				}
			}
		})
	}
}

export function makeChartBtnMenu(holder, chartsInstance: any) {
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.queries.NIdata) {
		// track each template's div so that once one is chosen, the others can be hidden
		const refDivs: any[] = []
		for (const refKey of Object.keys(chartsInstance.state.termdbConfig.queries.NIdata)) {
			const refDiv = menuDiv.append('div')
			refDivs.push(refDiv)

			const refOption = refDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(refKey)
				.on('click', async () => {
					// a template is chosen: hide the other template options,
					// and show the chosen one as a plain label
					for (const d of refDivs) if (d !== refDiv) d.style('display', 'none')
					refOption.attr('class', '').style('font-weight', 'bold').style('padding', '5px')
					refOption.on('click', null)
					const body = {
						genome: chartsInstance.opts.vocab.genome,
						dslabel: chartsInstance.opts.vocab.dslabel,
						refKey,
						// restrict the sample table by the current cohort filter, if one is set
						filter: chartsInstance.state.filter
					}
					let samples: any[]
					try {
						const result = await fetchBrainImagingSamples(body)
						samples = result.samples || []
					} catch (e: any) {
						sayerror(refDiv, e?.message || String(e))
						return
					}

					const columns = await getTableColumns(chartsInstance, refKey)

					// samples currently shown in the table (narrowed by the search box)
					let shownSamples = samples
					// sample names checked by the user; persists across search box re-renders
					const selectedSamples = new Set<string>()

					/* update selections from the checked row indexes renderTable reports;
					indexes point into the rows array passed to renderTable, i.e. into
					shownSamples, also after sorting. rows hidden by the search keep
					their recorded state, so selections persist across searches */
					const updateSelections = (idxlst: number[]) => {
						const checked = new Set(idxlst.map(i => shownSamples[i]?.sample))
						for (const s of shownSamples) {
							if (!s.sample) continue
							if (checked.has(s.sample)) selectedSamples.add(s.sample)
							else selectedSamples.delete(s.sample)
						}
					}

					// debounce: re-rendering a large table on every keystroke is janky
					const debouncedRenderRows = debounce(() => renderRows(), 200)
					const searchDiv = refDiv.append('div').style('padding', '5px 0px')
					const searchInput = searchDiv
						.append('input')
						.attr('type', 'search')
						.attr('placeholder', 'Search samples')
						.style('width', '200px')
						.on('input', debouncedRenderRows)
					const countLabel = searchDiv.append('span').style('margin-left', '10px').style('opacity', 0.6)
					const tableDiv = refDiv.append('div')

					const applybt = {
						text: 'Apply',
						// unstyled button, found by testid since it carries no distinguishing class
						dataTestId: 'sjpp-brainImaging-apply',
						/* fires on every checkbox change: keeps selectedSamples current, and
						overrides the table's own disabling (which only considers visible rows)
						so Apply stays usable when checked samples are hidden by the search */
						onChange: (idxlst: number[], button: any) => {
							updateSelections(idxlst)
							if (button) button.disabled = !selectedSamples.size
						},
						callback: (indexes: number[]) => {
							updateSelections(indexes)
							if (!selectedSamples.size) return
							chartsInstance.dom.tip.hide()
							const selectedSampleFileNames = [...selectedSamples].map(s => s + '.nii')
							// default slice positions are resolved by getPlotConfig()
							// from the template's dataset-configured parameters
							chartsInstance.app.dispatch({
								type: 'plot_create',
								config: {
									chartType: 'brainImaging',
									queryKey: refKey,
									selectedSampleFileNames
								}
							})
						}
					}

					const renderRows = () => {
						const str = searchInput.property('value').trim().toLowerCase()
						shownSamples = !str
							? samples
							: samples.filter(s => Object.values(s).some(v => v != undefined && String(v).toLowerCase().includes(str)))
						countLabel.text(
							(str ? `${shownSamples.length} of ${samples.length} samples` : `${samples.length} samples`) +
								(selectedSamples.size ? `; ${selectedSamples.size} selected` : '')
						)
						const rows = getTableRows(shownSamples, chartsInstance.state, refKey)
						tableDiv.selectAll('*').remove()
						renderTable({
							rows,
							columns,
							resize: true,
							singleMode: false,
							div: tableDiv,
							maxHeight: '40vh',
							header: { allowSort: true },
							selectedRows: shownSamples.map((s, i) => (selectedSamples.has(s.sample) ? i : -1)).filter(i => i >= 0),
							buttons: [applybt],
							buttonsToLeft: true
						})
					}
					renderRows()
				})
		}
	}
}

export const brainImaging = getCompInit(BrainImaging)
export const componentInit = brainImaging

export async function getPlotConfig(opts, app) {
	/* default slice positions come from the template's dataset-configured
	parameters (NIdata[queryKey].parameters in e.g. DISCOVER.hg38.ts); a ds
	that omits parameters falls back to the volume midpoint (dimensions are
	read from the NIfTI header at server launch), then to default numbers */
	const ref = app.vocabApi?.termdbConfig?.queries?.NIdata?.[opts.queryKey]
	const parameters = ref?.parameters
	const dims = ref?.dimensions
	const settings = {
		brainImaging: {
			brainImageL: parameters?.l ?? (dims ? Math.floor(dims.l / 2) : 98),
			brainImageF: parameters?.f ?? (dims ? Math.floor(dims.f / 2) : 81),
			brainImageT: parameters?.t ?? (dims ? Math.floor(dims.t / 2) : 53)
		}
	}
	const config: any = { chartType: 'brainImaging', settings }
	copyMerge(config, opts)
	/* a tw of a saved session is only raw until it is filled here, same as every other
	chart type. required, since a session is serialized without the derived properties
	of a geneVariant term, see trimGvTermsForSave() */
	if (config.overlayTW) config.overlayTW = await fillTermWrapper(config.overlayTW, app.vocabApi)
	if (config.divideByTW) config.divideByTW = await fillTermWrapper(config.divideByTW, app.vocabApi)
	return config
}

function getTableRows(samples, state, refKey): TableRow[] {
	const rows: TableRow[] = []
	for (const sample of samples) {
		// first cell is sample name
		const row = [{ value: sample.sample }]

		// optional sample columns
		for (const c of state.termdbConfig.queries.NIdata[refKey].sampleColumns || []) {
			row.push({ value: sample[c.termid] })
		}
		rows.push(row)
	}
	return rows
}

async function getTableColumns(self, refKey): Promise<TableColumn[]> {
	// first column is sample and is hardcoded
	const columns: TableColumn[] = [{ label: 'Sample', sortable: true }]

	// add in optional sample columns
	for (const c of self.state.termdbConfig.queries.NIdata[refKey].sampleColumns || []) {
		columns.push({
			label: (await self.app.vocabApi.getterm(c.termid)).name,
			sortable: true
		})
	}

	return columns
}

function setInteractivity(self) {
	self.legendLabelMouseup = event => {
		const targetData = event.target.__data__
		if (!targetData || targetData.key == 'default') return
		const legendMenu = self.dom.legendMenu.clear()
		const legendMenuDiv = legendMenu.d.append('div')
		const legendFilter = self.state.config.legendFilter ? [...self.state.config.legendFilter] : []

		const legendFilterIndex = legendFilter.indexOf(targetData.key)

		if (legendFilterIndex !== -1 || legendFilter.length + 1 !== self.legendItems.length) {
			// only show the Hide option when the cat is not the last shown cat
			legendMenuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(legendFilterIndex == -1 ? 'Hide' : 'Show')
				.on('click', () => {
					legendMenu.hide()
					if (legendFilterIndex == -1) legendFilter.push(targetData.key)
					else legendFilter.splice(legendFilterIndex, 1)

					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: { legendFilter }
					})
				})
		}

		legendMenuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				legendMenu.hide()
				const legendFilter: unknown[] = []
				for (const legendCat of self.legendItems) {
					if (legendCat.key !== targetData.key) legendFilter.push(legendCat.key)
				}
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { legendFilter }
				})
			})

		legendMenuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show all')
			.on('click', () => {
				legendMenu.hide()
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { legendFilter: [] }
				})
			})

		//TODO: support changing color for grouped geneVariant term
		if (self.state.config.overlayTW.term.type != 'geneVariant') {
			let color = self.state.config.overlayTW?.term?.values?.[targetData.key]?.color || 'red'
			color = rgb(color).formatHex() //so that the color is in the correct format to be shown in the input
			legendMenuDiv
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Color:')
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', e => {
					self.changeColor(targetData.key, e.target.value)
				})
		}
		legendMenu.showunder(event.target)
	}

	self.changeColor = async function (key, color) {
		const tw = self.config.overlayTW

		if (!(tw.term.type == 'geneVariant' && tw.q.type == 'values') && tw.term.values[key])
			tw.term.values[key].color = color
		else {
			if (!tw.term.values) tw.term.values = {}
			if (!tw.term.values[key]) tw.term.values[key] = {}
			tw.term.values[key].color = color
		}

		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { overlayTW: tw }
		})
	}
}
