import { getCompInit, copyMerge, type RxComponent } from '#rx'
import type { BasePlotConfig, MassAppApi, MassState } from '#mass/types/mass'
import type { GRIN2Dom, GRIN2Opts } from './GRIN2Types'
import { dofetch3 } from '#common/dofetch'
import { getNormalRoot } from '#filter'
import { Menu, renderTable, table2col, make_one_checkbox, sayerror } from '#dom'
import { dtsnvindel, mclass, dtcnv, dtfusionrna, dtsv, proteinChangingMutations } from '#shared/common.js'
import { get$id } from '#termsetting'
import { PlotBase } from '#plots/PlotBase.ts'
import { plotManhattan, createLollipopFromGene } from '#plots/manhattan/manhattan.ts'

class GRIN2 extends PlotBase implements RxComponent {
	readonly type = 'grin2'
	dom: GRIN2Dom

	// Colors
	readonly borderColor = '#eee'
	readonly backgroundColor = '#f8f8f8'
	readonly optionsTextColor = '#666'
	readonly btnBackgroundColor = '#f0f0f0'
	readonly btnBorderColor = '#ccc'
	readonly btnTextColor = '#333'
	readonly btnHoverBackgroundColor = '#e0e0e0'

	// Typography
	readonly optionsTextFontSize: number = 12
	readonly btnFontSize: number = 12
	readonly headerFontSize: number = 14
	readonly headerFontWeight: number = 600
	readonly tableFontSize: number = 11

	// Spacing & Layout
	readonly btnPadding = '8px 16px'
	readonly btnSmallPadding = '2px 8px' // for Select All/Clear All
	readonly btnBorderRadius = '3px'
	readonly btnMargin = '10px'
	readonly tableCellPadding = '8px'
	readonly controlsMargin = '5px'
	readonly controlsPadding = '10px'

	// Input fields
	readonly inputWidth = '80px'
	readonly inputPadding = '2px 4px'
	readonly inputBorderColor = '#ddd'
	readonly inputBorderRadius = '2px'

	// Containers
	readonly checkboxContainerMaxHeight = '150px'
	readonly checkboxContainerBackground = '#fafafa'
	readonly checkboxContainerBorder = '1px solid #ddd'
	readonly checkboxContainerPadding = '4px'
	readonly checkboxContainerBorderRadius = '3px'

	// Interactive states
	readonly disabledOpacity = '0.6'
	readonly enabledOpacity = '1'

	// Gaps and offsets
	readonly controlGap = '8px'
	readonly checkboxMarginBottom = '2px'
	readonly headerMargin = '0 10px 0 0'
	readonly sectionMargin = '20px 0'

	constructor(opts: any, api) {
		super(opts, api)
		this.opts = opts
		opts.holder.classed('sjpp-grin2-main', true)
		this.dom = {
			controls: opts.holder.append('div'), // controls ui on top
			div: opts.holder.append('div').style('margin', '20px'), // result ui on bottom
			tip: new Menu({ padding: '' }),
			geneTip: new Menu({ padding: '' }),
			snvindelCheckbox: null,
			cnvCheckbox: null,
			fusionCheckbox: null,
			svCheckbox: null,
			runButton: null,
			consequenceCheckboxes: {},
			snvindelSelectAllBtn: null,
			snvindelClearAllBtn: null,
			snvindelDefaultBtn: null
		}
		if (opts.header) this.dom.header = opts.header.text('GRIN2')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}
	private addSnvindelRow = (table: any) => {
		const [left, right] = table.addRow()

		// Options table
		const t2 = table2col({ holder: right })

		// Top numeric options
		this.dom.snvindel_minTotalDepth = this.addOptionRowToTable(
			t2,
			'Min Total Depth',
			this.state.config.settings?.snvindelOptions?.minTotalDepth ?? 10, // default. Getting from state and defaulting to 10 if not available
			0, // min
			1e6, // max
			1 // step
		)
		this.dom.snvindel_minAltAlleleCount = this.addOptionRowToTable(
			t2,
			'Min Alt Allele Count',
			this.state.config.settings?.snvindelOptions?.minAltAlleleCount ?? 2, // default. Getting from state and defaulting to 2 if not available
			0,
			1e6,
			1
		)

		// if 5/3 flanking size will be needed in future, can create a helper this.addFlankingOption() to dedup

		// TODO: Enable once talk to collaborators about supporting these options
		// // 5' flanking size
		// this.dom.snvindel_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )
		// // 3' flanking size
		// this.dom.snvindel_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// Consequences section header + checkbox grid
		{
			const [labelCell, containerCell] = t2.addRow()
			labelCell
				.text('Consequences')
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('font-weight', '600')
				.style('padding-top', '8px')

			// Build the consequence checkboxes in the right cell
			this.createConsequenceCheckboxes(containerCell)
		}

		// ----- Left-side SNV/INDEL checkbox -----
		const isChecked = this.state.config.settings.dtUsage[dtsnvindel].checked
		t2.table.style('display', isChecked ? '' : 'none')
		this.dom.snvindelCheckbox = make_one_checkbox({
			holder: left,
			labeltext: 'SNV/INDEL (Mutation)',
			checked: isChecked,
			testid: 'grin2-checkbox-snvindel',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	// Add CNV row
	private addCnvRow = (table: any) => {
		const [left, right] = table.addRow()

		// CNV options table
		const t2 = table2col({ holder: right })

		// We need this extra useSaved because of having a ds specific value set. Only use saved CNV settings if we know they came from a completed run
		// TODO: Long term we will need to do this for snvindel once we support ds specific values there also
		const useSaved = this.state.config.settings.runAnalysis === true
		const savedCnv = useSaved ? this.state.config.settings.cnvOptions : undefined

		// Loss Threshold
		this.dom.cnv_lossThreshold = this.addOptionRowToTable(
			t2,
			'Loss Threshold',
			savedCnv?.lossThreshold ?? this.app.vocabApi.termdbConfig.queries.cnv?.cnvLossCutoff ?? -0.4, // default. We first check if we have saved state, then we check the ds specific value, if that is undefined we fall back to the hardcoded default value
			-5, // min
			0, // max
			0.05 // step
		)

		// Gain Threshold
		this.dom.cnv_gainThreshold = this.addOptionRowToTable(
			t2,
			'Gain Threshold',
			savedCnv?.gainThreshold ?? this.app.vocabApi.termdbConfig.queries.cnv?.cnvGainCutoff ?? 0.4, // default. We first check if we have saved state, then we check the ds specific value, if that is undefined we fall back to the hardcoded default value
			0, // min
			5, // max
			0.05 // step
		)

		// Max Segment Length (0 = no cap)
		this.dom.cnv_maxSegLength = this.addOptionRowToTable(
			t2,
			'Max Segment Length',
			savedCnv?.maxSegLength ?? this.app.vocabApi.termdbConfig.queries.cnv?.cnvMaxLength ?? 2e6, // default 2Mb. We first check if we have saved state, then we check the ds specific value, if that is undefined we fall back to the hardcoded default value
			0, // min
			1e9, // max
			1000 // step
		)

		// // 5' flanking size
		// this.dom.cnv_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.cnv_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// ----- Left-side CNV checkbox -----
		const dtUsage = this.state.config.settings.dtUsage
		const isChecked =
			useSaved && dtUsage[dtcnv]?.checked !== undefined
				? dtUsage[dtcnv].checked
				: !!this.app.vocabApi.termdbConfig.queries.cnv

		t2.table.style('display', isChecked ? '' : 'none')

		this.dom.cnvCheckbox = make_one_checkbox({
			holder: left,
			labeltext: 'CNV (Copy Number Variation)',
			checked: isChecked,
			testid: 'grin2-checkbox-cnv',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	// Add Fusion row
	private addFusionRow = (table: any) => {
		const [left, right] = table.addRow()

		// Fusion options table
		const t2 = table2col({ holder: right })

		// // 5' flanking size
		// this.dom.fusion_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.fusion_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		const isChecked = this.state.config.settings.dtUsage[dtfusionrna].checked
		t2.table.style('display', isChecked ? '' : 'none')

		this.dom.fusionCheckbox = make_one_checkbox({
			holder: left,
			labeltext: 'Fusion (RNA Fusion Events)',
			checked: isChecked,
			testid: 'grin2-checkbox-fusion',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	// Add SV row
	private addSvRow = (table: any) => {
		const [left, right] = table.addRow()

		// SV options table
		const t2 = table2col({ holder: right })

		// // 5' flanking size
		// this.dom.sv_five_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"5' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		// // 3' flanking size
		// this.dom.sv_three_prime_flank_size = this.addOptionRowToTable(
		// 	t2,
		// 	"3' Flanking Size",
		// 	500, // default
		// 	0, // min
		// 	1e9, // max
		// 	500 // step
		// )

		const isChecked = this.state.config.settings.dtUsage[dtsv].checked
		t2.table.style('display', isChecked ? '' : 'none')

		this.dom.svCheckbox = make_one_checkbox({
			holder: left,
			labeltext: 'SV (Structural Variants)',
			checked: isChecked,
			testid: 'grin2-checkbox-sv',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	// Enable the run button only if at least one data type is checked
	private updateRunButtonState(dtu?: Record<number, { checked: boolean; label: string }>) {
		const dtUsage = dtu || (this.state.config.settings.dtUsage as Record<number, { checked: boolean; label: string }>)
		const anyChecked = Object.values(dtUsage).some(info => info.checked)
		this.dom.runButton.property('disabled', !anyChecked)
	}

	private createConfigTable() {
		const table = table2col({ holder: this.dom.controls, disableScroll: true })
		const queries = this.app.vocabApi.termdbConfig.queries
		if (queries.snvindel) {
			this.addSnvindelRow(table)
		}

		if (queries.cnv) {
			this.addCnvRow(table)
		}
		if (queries.svfusion?.dtLst?.includes(dtfusionrna)) {
			this.addFusionRow(table)
		}
		if (queries.svfusion?.dtLst?.includes(dtsv)) {
			this.addSvRow(table)
		}

		// Run Button
		this.dom.runButton = this.dom.controls
			.append('button')
			.attr('data-testid', 'grin2-run-button')
			.style('margin-left', '100px')
			.text('Run GRIN2')
			.on('click', () => this.runAnalysis())

		if (this.state.config.settings.runAnalysis) {
			this.runAnalysis()
		} else {
			// Set initial button state
			this.updateRunButtonState()
		}
	}

	// Helper method to add option rows to table2col instances
	private addOptionRowToTable(
		table: any,
		label: string,
		defaultValue: number,
		min?: number,
		max?: number,
		step?: number
	) {
		const [labelCell, inputCell] = table.addRow()
		labelCell.text(label).style('font-size', `${this.optionsTextFontSize}px`)

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.style('width', this.inputWidth)
			.style('padding', this.inputPadding)
			.style('border', `1px solid ${this.inputBorderColor}`)
			.style('border-radius', this.inputBorderRadius)
			.style('font-size', `${this.optionsTextFontSize}px`)

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)
		if (step !== null && step !== undefined) input.attr('step', step)

		return input
	}

	private createConsequenceCheckboxes(container: any) {
		const snvIndelClasses = Object.entries(mclass).filter(
			([key, cls]: [string, any]) => cls.dt === dtsnvindel && key !== 'Blank' && key !== 'WT'
		)

		const saved = this.state.config.settings.snvindelOptions?.consequences as string[] | undefined
		const useSaved = this.state.config.settings.runAnalysis === true && !!saved && saved.length > 0

		// Canonical default set = protein-changing + StartLost + StopLost
		const canonicalDefault = new Set<string>([...proteinChangingMutations, 'StartLost', 'StopLost'])

		// What we use for initial rendering:
		const initialChecked = useSaved ? new Set<string>(saved!) : canonicalDefault

		// --- Controls row ---
		const controlDiv = container
			.append('div')
			.style('margin-bottom', '6px')
			.style('display', 'flex')
			.style('gap', this.controlGap)

		this.dom.snvindelSelectAllBtn = controlDiv
			.append('button')
			.style('font-size', `${this.tableFontSize}px`)
			.text('Select All')

		this.dom.snvindelClearAllBtn = controlDiv
			.append('button')
			.style('font-size', `${this.tableFontSize}px`)
			.text('Clear All')

		this.dom.snvindelDefaultBtn = controlDiv
			.append('button')
			.style('font-size', `${this.tableFontSize}px`)
			.text('Default')

		// --- Checkbox list ---
		const checkboxContainer = container
			.append('div')
			.style('max-height', this.checkboxContainerMaxHeight)
			.style('overflow-y', 'auto')
			.style('border', this.checkboxContainerBorder)

		this.dom.consequenceCheckboxes = {}

		snvIndelClasses.forEach(([classKey, classInfo]: [string, any]) => {
			const checkboxDiv = checkboxContainer.append('div').style('margin-bottom', this.checkboxMarginBottom)

			const checkbox = make_one_checkbox({
				holder: checkboxDiv,
				labeltext: classInfo.label,
				checked: initialChecked.has(classKey),
				divstyle: { 'font-size': `${this.tableFontSize}px` },
				callback: () => {}
			})

			checkboxDiv.select('label').attr('title', classInfo.desc)
			this.dom.consequenceCheckboxes[classKey] = checkbox
		})

		// Select All
		this.dom.snvindelSelectAllBtn.on('click', () => {
			Object.values(this.dom.consequenceCheckboxes).forEach(cb => cb.property('checked', true))
		})

		// Clear All
		this.dom.snvindelClearAllBtn.on('click', () => {
			Object.values(this.dom.consequenceCheckboxes).forEach(cb => cb.property('checked', false))
		})

		// Default: always reset to canonical (protein-changing + StartLost + StopLost)
		this.dom.snvindelDefaultBtn.on('click', () => {
			Object.entries(this.dom.consequenceCheckboxes).forEach(([classKey, checkbox]) => {
				checkbox.property('checked', canonicalDefault.has(classKey))
			})
		})
	}

	private getConfigValues(dtUsage: Record<number, { checked: boolean; label: string }>): any {
		const requestConfig: any = {}
		const usage = dtUsage || this.state.config.settings.dtUsage

		if (usage[dtsnvindel]?.checked) {
			requestConfig.snvindelOptions = {
				minTotalDepth: parseFloat(this.dom.snvindel_minTotalDepth.property('value')),
				minAltAlleleCount: parseFloat(this.dom.snvindel_minAltAlleleCount.property('value')),
				consequences: this.getSelectedConsequences()
			}
		}

		if (usage[dtcnv]?.checked) {
			requestConfig.cnvOptions = {
				lossThreshold: parseFloat(this.dom.cnv_lossThreshold.property('value')),
				gainThreshold: parseFloat(this.dom.cnv_gainThreshold.property('value')),
				maxSegLength: parseFloat(this.dom.cnv_maxSegLength.property('value'))
			}
		}

		if (usage[dtfusionrna]?.checked) {
			requestConfig.fusionOptions = {}
		}

		if (usage[dtsv]?.checked) {
			requestConfig.svOptions = {}
		}

		return requestConfig
	}

	private getDtUsageFromCheckboxes(): Record<number, { checked: boolean; label: string }> {
		const dtUsage = structuredClone(this.state.config.settings.dtUsage)

		if (dtUsage[dtsnvindel]) {
			dtUsage[dtsnvindel].checked = this.dom.snvindelCheckbox.property('checked')
		}
		if (dtUsage[dtcnv]) {
			dtUsage[dtcnv].checked = this.dom.cnvCheckbox.property('checked')
		}
		if (dtUsage[dtfusionrna]) {
			dtUsage[dtfusionrna].checked = this.dom.fusionCheckbox.property('checked')
		}
		if (dtUsage[dtsv]) {
			dtUsage[dtsv].checked = this.dom.svCheckbox.property('checked')
		}

		return dtUsage
	}

	private getSelectedConsequences(): string[] {
		const consequences: string[] = []

		Object.entries(this.dom.consequenceCheckboxes).forEach(([classKey, checkbox]) => {
			if (checkbox.property('checked')) {
				consequences.push(classKey)
			}
		})

		return consequences
	}

	private updateRunButtonFromCheckboxes() {
		const dtUsage = this.getDtUsageFromCheckboxes()
		this.updateRunButtonState(dtUsage)
	}
	private async runAnalysis() {
		try {
			// Get checkbox states
			const dtUsage = this.getDtUsageFromCheckboxes()

			this.dom.runButton.property('disabled', true).text('Running GRIN2...')

			// Clear previous results
			this.dom.div.selectAll('*').remove()

			// Get configuration and make request using the dtUsage we just read
			const configValues = this.getConfigValues(dtUsage)
			const requestData = {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				filter: getNormalRoot(this.app.vocabApi.state.termfilter.filter),
				width: this.state.config.settings.manhattan?.plotWidth,
				height: this.state.config.settings.manhattan?.plotHeight,
				pngDotRadius: this.state.config.settings.manhattan?.pngDotRadius,
				devicePixelRatio: window.devicePixelRatio,
				maxGenesToShow: this.state.config.settings?.manhattan?.maxGenesToShow,
				lesionTypeColors: this.state.config.settings?.manhattan?.lesionTypeColors,
				qValueThreshold: this.state.config.settings?.manhattan?.qValueThreshold,
				...configValues
			}

			const response = await dofetch3('/grin2', {
				body: requestData
			})

			if (response.status === 'error') throw `GRIN2 analysis failed: ${response.error}`

			this.renderResults(response)

			// After the analysis completes successfully, dispatch with the updated config to save state
			const updatedConfig = {
				...this.state.config,
				settings: {
					...this.state.config.settings,
					...configValues,
					dtUsage: dtUsage,
					runAnalysis: true
				}
			}

			this.app.dispatch({
				type: 'plot_edit',
				id: this.id,
				config: updatedConfig
			})
		} catch (error) {
			sayerror(this.dom.div, `Error running GRIN2: ${error instanceof Error ? error.message : error}`)
		} finally {
			this.dom.runButton.property('disabled', false).text('Run GRIN2')
		}
	}

	async init() {}

	async main() {
		// Initialize the table with the different data types and options
		const config = structuredClone(this.state.config)
		if (config.childType != this.type && config.chartType != this.type) return

		if (!this.dom.runButton) {
			this.createConfigTable()
		}
	}

	private renderResults(result: any) {
		// Display Manhattan plot
		if (result.pngImg) {
			const plotData = result
			const plotDiv = this.dom.div
			const manhattanSettings = this.state.config.settings.manhattan
			plotManhattan(plotDiv, plotData, manhattanSettings, this.app)
		}

		// Display top genes table
		if (result.topGeneTable) {
			const tableContainer = this.dom.div.append('div').style('margin', this.sectionMargin)

			// Create header with title and Matrix button
			const headerDiv = tableContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', this.btnMargin)

			headerDiv
				.append('h3')
				.style('margin', this.headerMargin)
				.style('font-size', `${this.headerFontSize}px`)
				.text(`Top Genes (showing ${result.showingTop?.toLocaleString()} of ${result.totalGenes?.toLocaleString()})`)

			// Add Matrix button
			const matrixBtn = headerDiv
				.append('button')
				.text('Matrix (0 genes selected)')
				.property('disabled', true)
				.on('click', () => {
					matrixBtn.property('disabled', true)
					this.createMatrixFromGenes(selectedGenes)
				})

			// Add the lollipop button
			const lollipopBtn = headerDiv
				.append('button')
				.text('Lollipop')
				.property('disabled', true)
				.on('click', () => {
					if (lastTouchedGene) {
						lollipopBtn.property('disabled', true)
						createLollipopFromGene(lastTouchedGene, this.app)
					}
				})

			const tableDiv = tableContainer.append('div')
			const selectedGenes: string[] = []
			let lastTouchedGene: string | null = null

			// Define lesion type colors and q-value threshold
			const lesionTypeColors = this.state.config.settings.manhattan.lesionTypeColors
			const qValueThreshold = this.state.config.settings.manhattan.qValueThreshold

			// Find column indices for q-values
			const columns = result.topGeneTable.columns

			// Map dt types to their column labels and lesion types
			const dtMapping = {
				[dtsnvindel]: [{ col: 'Q-value (Mutation)', type: 'mutation' }],
				[dtfusionrna]: [{ col: 'Q-value (Fusion)', type: 'fusion' }],
				[dtcnv]: [
					{ col: 'Q-value (Copy Loss)', type: 'loss' },
					{ col: 'Q-value (Copy Gain)', type: 'gain' }
				],
				[dtsv]: [{ col: 'Q-value (Structural Variant)', type: 'sv' }]
			}

			// Build qValue entries for enabled data types
			const qValueEntries: Array<{ colIndex: number; type: string }> = []
			Object.entries(this.state.config.settings.dtUsage).forEach(([key, isChecked]) => {
				if (isChecked && dtMapping[key]) {
					dtMapping[key].forEach(({ col, type }) => {
						const colIndex = columns.findIndex(c => c.label === col)
						if (colIndex !== -1) qValueEntries.push({ colIndex, type })
					})
				}
			})

			// Add significance column to the beginning
			const modifiedColumns = [{ label: '', width: '20px' }, ...result.topGeneTable.columns]

			// Cache the circles HTML
			const lesionTypeCircleCache = new Map(
				Object.entries(lesionTypeColors).map(([type, color]) => [
					type,
					`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${color};margin-right:3px;"></span>`
				])
			)

			// Process rows to add significance indicators
			const processedRows = result.topGeneTable.rows.map(row => {
				const circles = qValueEntries
					.filter(({ colIndex }) => {
						const qValue = row[colIndex]?.value
						return typeof qValue === 'number' && qValue < qValueThreshold
					})
					.map(({ type }) => lesionTypeCircleCache.get(type)!)

				return [{ value: '', html: circles.join('') }, ...row]
			})

			renderTable({
				columns: modifiedColumns,
				rows: processedRows,
				div: tableDiv,
				maxHeight: '400px',
				maxWidth: '100%',
				dataTestId: 'grin2-top-genes-table',
				noButtonCallback: (rowIndex, checkboxNode) => {
					// Get the gene name from the second column now (index 1) since we added a column
					const geneName = result.topGeneTable.rows[rowIndex][0]?.value

					if (checkboxNode.checked) {
						selectedGenes.push(geneName)
						lastTouchedGene = geneName
					} else {
						selectedGenes.splice(selectedGenes.indexOf(geneName), 1)
						lastTouchedGene = selectedGenes.length > 0 ? selectedGenes[selectedGenes.length - 1] : null
					}

					// Update lollipop button
					if (selectedGenes.length > 0) {
						lollipopBtn.text(`Lollipop (${lastTouchedGene})`)
						lollipopBtn.property('disabled', false)
					} else {
						lollipopBtn.text('Lollipop')
						lollipopBtn.property('disabled', true)
					}

					matrixBtn.text(`Matrix (${selectedGenes.length} genes selected)`).property('disabled', !selectedGenes.length)
				},
				selectAll: false,
				download: {
					fileName: `grin2_top_genes_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.tsv`
				},
				header: {
					allowSort: true,
					style: {
						'font-weight': 'bold',
						'background-color': this.backgroundColor
					}
				}
			})
		}

		// Display run stats information
		if (result.processingSummary) {
			// Create header with title
			const headerDiv = this.dom.div
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', this.btnMargin)

			headerDiv
				.append('h3')
				.style('margin', this.headerMargin)
				.style('font-size', `${this.headerFontSize}px`)
				.text('GRIN2 Processing Summary')

			// Container for tables
			const tablesContainer = this.dom.div.append('div')

			// General stats using table2col
			const generalTable = table2col({
				holder: tablesContainer.append('div'),
				margin: '0'
			})

			generalTable.addRow('Total Samples', result.processingSummary.totalSamples.toLocaleString())
			generalTable.addRow('Processed Samples', result.processingSummary.processedSamples.toLocaleString())
			generalTable.addRow('Unprocessed Samples', (result.processingSummary.unprocessedSamples ?? 0).toLocaleString())
			generalTable.addRow('Failed Samples', result.processingSummary.failedSamples.toLocaleString())
			generalTable.addRow(
				'Failed Files',
				result.processingSummary.failedFiles?.length
					? result.processingSummary.failedFiles.map(f => f.sampleName).join(', ')
					: '0'
			)
			generalTable.addRow('Total Lesions', result.processingSummary.totalLesions.toLocaleString())
			generalTable.addRow('Processed Lesions', result.processingSummary.processedLesions.toLocaleString())

			// Lesion type details in a proper table
			if (result.processingSummary.lesionCounts?.byType) {
				const byType = result.processingSummary.lesionCounts.byType

				const typeLabels: Record<string, string> = {
					mutation: 'Mutations',
					gain: 'Copy Gains',
					loss: 'Copy Losses',
					fusion: 'Fusions',
					sv: 'Structural Variants'
				}

				const table = tablesContainer
					.append('div')
					.style('margin', this.btnMargin)
					.append('table')
					.style('border-collapse', 'collapse')
					.style('width', 'auto')
					.style('font-size', 'inherit')

				// Helper to apply cell styles
				const styleCell = (cell: any, align?: string, isFirstCol = false) => {
					const padding = isFirstCol ? '8px 16px 8px 0' : '8px 16px' // No left padding for first column
					cell.style('padding', padding).style('border-bottom', '1px solid #eee')
					if (align) cell.style('text-align', align)
					return cell
				}

				// Headers
				const headerRow = table.append('thead').append('tr')
				;[
					['Lesion Type', 'left'],
					['Count', 'right'],
					['Capped', 'center'],
					['Samples', 'right']
				].forEach(([text, align], index) => {
					headerRow
						.append('th')
						.style('text-align', align)
						.style('padding', index === 0 ? '8px 16px 8px 0' : '8px 16px')
						.style('border-bottom', '2px solid #ddd')
						.style('font-weight', 'normal')
						.text(text)
				})

				// Data rows
				const tbody = table.append('tbody')
				for (const [type, typeData] of Object.entries(byType)) {
					const { count, capped, samples } = typeData as { count: number; capped: boolean; samples: number }
					const row = tbody.append('tr')

					styleCell(row.append('td'), undefined, true).text(typeLabels[type] || type) // First column
					styleCell(row.append('td'), 'right').text(count.toLocaleString())
					styleCell(row.append('td'), 'center').text(capped ? 'Yes' : 'No')
					styleCell(row.append('td'), 'right').text((samples ?? 0).toLocaleString())
				}
			}
		}

		// Display timing information
		if (result.timing) {
			this.dom.div
				.append('div')
				.style('margin', this.sectionMargin)
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('color', this.optionsTextColor)
				.text(
					`Analysis completed in ${result.timing.totalTime}s (Processing: ${result.timing.processingTime}s, GRIN2: ${result.timing.grin2Time}s)`
				)
		}

		// If we didn't process all samples, note that caps truncated the run
		const expectedToProcessSamples = result.processingSummary.totalSamples - result.processingSummary.failedSamples
		if (result.processingSummary.processedSamples < expectedToProcessSamples) {
			this.dom.div
				.append('div')
				.style('margin', this.sectionMargin)
				.style('font-size', `${this.optionsTextFontSize}px`)
				.style('color', this.optionsTextColor)
				.text(
					`Note: Per-type lesion caps were reached before all samples could be processed. ` +
						`Analysis ran on ${result.processingSummary.processedSamples} of ${expectedToProcessSamples} samples.`
				)
		}
	}

	private async createMatrixFromGenes(geneSymbols: string[]): Promise<void> {
		try {
			// Create termwrappers for mutation data
			const termwrappers = await Promise.all(
				geneSymbols.map(async (gene: string) => {
					const term = {
						type: 'geneVariant',
						gene: gene,
						name: gene
					}

					// Get minimal copy for $id generation
					const minTwCopy = this.app.vocabApi.getTwMinCopy({ term })

					return {
						$id: await get$id(minTwCopy),
						term,
						q: {}
					}
				})
			)

			// Create and dispatch matrix
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'matrix',
					dataType: 'geneVariant',
					termgroups: [
						{
							name: 'Genomic alterations',
							lst: termwrappers
						}
					]
				}
			})
		} catch (error) {
			sayerror(this.dom.div, `Error creating matrix: ${error instanceof Error ? error.message : error}`)
		}
	}
}

export const grin2Init = getCompInit(GRIN2)
export const componentInit = grin2Init

export function getDefaultSettings(opts) {
	const defaults = {
		manhattan: {
			// Core plot dimensions
			plotWidth: 1000,
			plotHeight: 400,
			pngDotRadius: 2,

			// Layout spacing
			yAxisX: 70,
			yAxisY: 40,
			yAxisSpace: 20,
			xAxisLabelPad: 20,
			yAxisPad: 5,
			axisColor: '#545454',
			showYAxisLine: true,

			// Typography
			fontSize: 12,

			// Legend settings
			showLegend: true,
			legendItemWidth: 80,
			legendDotRadius: 3,
			legendRightOffset: 15,
			legendTextOffset: 12,
			legendVerticalOffset: 4,
			legendFontSize: 12,

			// Interactive dots
			showInteractiveDots: true,
			interactiveDotRadius: 2,
			interactiveDotStrokeWidth: 1,

			// Download options
			showDownload: true,

			// Max genes to show in table
			maxGenesToShow: 500,

			// Q-value threshold for significance indicators in the table
			qValueThreshold: 0.05,

			// Colors for lesion types (currently used for table significance indicators. Long term will also be used for the rust code colors)
			lesionTypeColors: {
				mutation: '#44AA44', // green
				loss: '#4444FF', // blue
				gain: '#FF4444', // red
				fusion: '#FFA500', // orange
				sv: '#9932CC' // purple
			}
		}
	}

	return Object.assign(defaults, opts?.overrides)
}

export async function getPlotConfig(opts: GRIN2Opts, app: MassAppApi) {
	const queries = app.vocabApi.termdbConfig.queries
	const defaultSettings = getDefaultSettings(opts)

	const dtUsage: any = {}

	// Dynamically add data type options based on availability
	if (queries?.snvindel) {
		dtUsage[dtsnvindel] = { checked: true, label: 'SNV/INDEL (Mutation)' }
	}

	if (queries?.cnv) {
		dtUsage[dtcnv] = { checked: true, label: 'CNV (Copy Number Variation)' }
	}

	if (queries?.svfusion) {
		if (queries.svfusion.dtLst.includes(dtfusionrna)) {
			dtUsage[dtfusionrna] = { checked: false, label: 'Fusion (RNA Fusion Events)' }
		}
		if (queries.svfusion.dtLst.includes(dtsv)) {
			dtUsage[dtsv] = { checked: false, label: 'SV (Structural Variants)' }
		}
	}

	const config = {
		chartType: 'grin2',
		settings: {
			controls: {},
			dtUsage: dtUsage,
			runAnalysis: false,
			manhattan: {
				...defaultSettings.manhattan,
				...opts?.manhattan
			},
			snvindelOptions: queries?.snvindel
				? {
						minTotalDepth: 10,
						minAltAlleleCount: 2,
						consequences: [],
						hyperMutator: 1000
				  }
				: undefined,
			cnvOptions: queries?.cnv
				? {
						lossThreshold: -0.4,
						gainThreshold: 0.3,
						maxSegLength: 0,
						hyperMutator: 500
				  }
				: undefined,
			fusionOptions: queries?.svfusion?.dtLst?.includes(dtfusionrna) ? {} : undefined,
			svOptions: queries?.svfusion?.dtLst?.includes(dtsv) ? {} : undefined
		},
		hidePlotFilter: true
	}

	return copyMerge(config, opts)
}
