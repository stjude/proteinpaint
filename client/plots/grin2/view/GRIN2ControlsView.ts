import { table2col, make_one_checkbox } from '#dom'
import { dtsnvindel, mclass, dtcnv, dtfusionrna, dtsv, proteinChangingMutations, dt2lesion } from '#shared/common.js'
import { filterInit } from '#filter'
import type { GRIN2ControlsCallbacks, DtUsage } from '../GRIN2Types'
import {
	CNV_LOSS_THRESHOLD_FALLBACK,
	CNV_GAIN_THRESHOLD_FALLBACK,
	CNV_MAX_SEG_LENGTH_FALLBACK
} from '../settings/defaults'

// Styling constants used only by the controls view
const optionsTextFontSize = 12
const tableFontSize = 11
const inputWidth = '80px'
const inputPadding = '2px 4px'
const inputBorderColor = '#ddd'
const inputBorderRadius = '2px'
const checkboxContainerMaxHeight = '150px'
const checkboxContainerBorder = '1px solid #ddd'
const controlGap = '8px'
const checkboxMarginBottom = '2px'

/** Builds and owns the GRIN2 config form (citation header + data-type rows + run button).
 *  Reads its own state from the live DOM and exposes it to the controller via getDtUsage/getConfigValues. */
export class GRIN2ControlsView {
	private headerHolder: any
	private controlsHolder: any
	private config: any
	private vocabApi: any
	private callbacks: GRIN2ControlsCallbacks

	private snvindelCheckbox: any = null
	private cnvCheckbox: any = null
	private fusionCheckbox: any = null
	private svCheckbox: any = null
	private runButton: any = null
	private consequenceCheckboxes: Record<string, any> = {}
	private snvindelSelectAllBtn: any = null
	private snvindelClearAllBtn: any = null
	private snvindelDefaultBtn: any = null

	private cnv_lossThreshold: any = null
	private cnv_gainThreshold: any = null
	private cnv_maxSegLength: any = null

	private snvindelMafFilter: any = null

	constructor(opts: {
		headerHolder: any
		controlsHolder: any
		config: any
		vocabApi: any
		callbacks: GRIN2ControlsCallbacks
	}) {
		this.headerHolder = opts.headerHolder
		this.controlsHolder = opts.controlsHolder
		this.config = opts.config
		this.vocabApi = opts.vocabApi
		this.callbacks = opts.callbacks
	}

	build() {
		this.headerHolder
			.style('margin', '15px')
			.html(
				'GRIN2 stands for Genomic Random Interval (GRIN) statistical model. For details, see <a href=https://pubmed.ncbi.nlm.nih.gov/23842812/ target=_blank>Pounds, S. et al. Bioinformatics 2013</a>.'
			)

		const table = table2col({ holder: this.controlsHolder, disableScroll: true })
		const queries = this.vocabApi.termdbConfig.queries
		if (queries.snvindel) this.addSnvindelRow(table)
		if (queries.cnv) this.addCnvRow(table)
		if (queries.svfusion?.dtLst?.includes(dtfusionrna)) this.addFusionRow(table)
		if (queries.svfusion?.dtLst?.includes(dtsv)) this.addSvRow(table)

		this.runButton = this.controlsHolder
			.append('button')
			.attr('data-testid', 'sjpp-grin2-run-button')
			.style('margin-left', '100px')
			.text('Run GRIN2')
			.on('click', () => this.callbacks.onRun())

		this.updateRunButtonFromCheckboxes()
	}

	getDtUsage(): DtUsage {
		const dtUsage = structuredClone(this.config.settings.dtUsage) as DtUsage
		if (dtUsage[dtsnvindel]) dtUsage[dtsnvindel].checked = this.snvindelCheckbox.property('checked')
		if (dtUsage[dtcnv]) dtUsage[dtcnv].checked = this.cnvCheckbox.property('checked')
		if (dtUsage[dtfusionrna]) dtUsage[dtfusionrna].checked = this.fusionCheckbox.property('checked')
		if (dtUsage[dtsv]) dtUsage[dtsv].checked = this.svCheckbox.property('checked')
		return dtUsage
	}

	getConfigValues(dtUsage: DtUsage): any {
		const requestConfig: any = {}
		if (dtUsage[dtsnvindel]?.checked) {
			requestConfig.snvindelOptions = {
				consequences: this.getSelectedConsequences()
			}
			if (this.snvindelMafFilter) {
				requestConfig.snvindelOptions.mafFilter = this.snvindelMafFilter
			}
		}
		if (dtUsage[dtcnv]?.checked) {
			requestConfig.cnvOptions = {
				lossThreshold: parseFloat(this.cnv_lossThreshold.property('value')),
				gainThreshold: parseFloat(this.cnv_gainThreshold.property('value')),
				maxSegLength: parseFloat(this.cnv_maxSegLength.property('value'))
			}
		}
		if (dtUsage[dtfusionrna]?.checked) requestConfig.fusionOptions = {}
		if (dtUsage[dtsv]?.checked) requestConfig.svOptions = {}
		return requestConfig
	}

	setBusy(busy: boolean) {
		this.controlsHolder?.style('pointer-events', busy ? 'none' : 'auto').style('opacity', busy ? '0.5' : '1')
		this.runButton?.property('disabled', busy).text(busy ? 'Running GRIN2...' : 'Run GRIN2')
	}

	private updateRunButtonFromCheckboxes() {
		const dtUsage = this.snvindelCheckbox ? this.getDtUsage() : (this.config.settings.dtUsage as DtUsage)
		const anyChecked = Object.values(dtUsage).some(info => info.checked)
		this.runButton?.property('disabled', !anyChecked)
	}

	private getSelectedConsequences(): string[] {
		const consequences: string[] = []
		Object.entries(this.consequenceCheckboxes).forEach(([classKey, checkbox]) => {
			if (checkbox.property('checked')) consequences.push(classKey)
		})
		return consequences
	}

	private addSnvindelRow(table: any) {
		const [left, right] = table.addRow()
		const t2 = table2col({ holder: right })

		// Consequences section header + checkbox grid
		{
			const [labelCell, containerCell] = t2.addRow()
			labelCell.text('Consequences').style('padding-top', '8px')
			this.createConsequenceCheckboxes(containerCell)
		}

		// MAF filter UI (only if dataset config provides it)
		const mafFilterConfig = this.vocabApi.termdbConfig.queries?.snvindel?.mafFilter
		if (mafFilterConfig) {
			this.snvindelMafFilter = structuredClone(
				this.config.settings?.snvindelOptions?.mafFilter || mafFilterConfig.filter
			)
			const [td1, td2] = t2.addRow()
			td1.text('MAF filter')
			filterInit({
				emptyLabel: '+',
				holder: td2,
				header_mode: 'hide_search',
				vocab: { terms: mafFilterConfig.terms },
				callback: async (filter: any) => {
					this.snvindelMafFilter = filter
				}
			}).main(this.snvindelMafFilter)
		}

		const isChecked = this.config.settings.dtUsage[dtsnvindel].checked
		t2.table.style('display', isChecked ? '' : 'none')
		this.snvindelCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtsnvindel].uilabel,
			checked: isChecked,
			testid: 'sjpp-grin2-checkbox-snvindel',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	private addCnvRow(table: any) {
		const [left, right] = table.addRow()
		const t2 = table2col({ holder: right })

		// Only use saved CNV settings if a previous run completed
		const useSaved = this.config.settings.runAnalysis === true
		const savedCnv = useSaved ? this.config.settings.cnvOptions : undefined
		const cnvQuery = this.vocabApi.termdbConfig.queries.cnv

		this.cnv_lossThreshold = this.addOptionRowToTable(
			t2,
			'Loss Threshold',
			savedCnv?.lossThreshold ?? cnvQuery?.cnvLossCutoff ?? CNV_LOSS_THRESHOLD_FALLBACK,
			-5,
			0,
			0.05
		)
		this.cnv_gainThreshold = this.addOptionRowToTable(
			t2,
			'Gain Threshold',
			savedCnv?.gainThreshold ?? cnvQuery?.cnvGainCutoff ?? CNV_GAIN_THRESHOLD_FALLBACK,
			0,
			5,
			0.05
		)
		this.cnv_maxSegLength = this.addOptionRowToTable(
			t2,
			'Max Segment Length',
			savedCnv?.maxSegLength ?? cnvQuery?.cnvMaxLength ?? CNV_MAX_SEG_LENGTH_FALLBACK,
			0,
			1e9,
			1000
		)

		const dtUsage = this.config.settings.dtUsage
		const isChecked = useSaved && dtUsage[dtcnv]?.checked !== undefined ? dtUsage[dtcnv].checked : !!cnvQuery
		t2.table.style('display', isChecked ? '' : 'none')

		this.cnvCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtcnv].uilabel,
			checked: isChecked,
			testid: 'sjpp-grin2-checkbox-cnv',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	private addFusionRow(table: any) {
		const [left, right] = table.addRow()
		const t2 = table2col({ holder: right })
		const isChecked = this.config.settings.dtUsage[dtfusionrna].checked
		t2.table.style('display', isChecked ? '' : 'none')

		this.fusionCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtfusionrna].uilabel,
			checked: isChecked,
			testid: 'grin2-checkbox-fusion',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	private addSvRow(table: any) {
		const [left, right] = table.addRow()
		const t2 = table2col({ holder: right })
		const isChecked = this.config.settings.dtUsage[dtsv].checked
		t2.table.style('display', isChecked ? '' : 'none')

		this.svCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtsv].uilabel,
			checked: isChecked,
			testid: 'sjpp-grin2-checkbox-sv',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	private addOptionRowToTable(
		table: any,
		label: string,
		defaultValue: number,
		min?: number,
		max?: number,
		step?: number
	) {
		const [labelCell, inputCell] = table.addRow()
		labelCell.text(label)

		const input = inputCell
			.append('input')
			.attr('type', 'number')
			.attr('value', defaultValue)
			.style('width', inputWidth)
			.style('padding', inputPadding)
			.style('border', `1px solid ${inputBorderColor}`)
			.style('border-radius', inputBorderRadius)
			.style('font-size', `${optionsTextFontSize}px`)

		if (min !== null && min !== undefined) input.attr('min', min)
		if (max !== null && max !== undefined) input.attr('max', max)
		if (step !== null && step !== undefined) input.attr('step', step)
		return input
	}

	private createConsequenceCheckboxes(container: any) {
		const snvIndelClasses = Object.entries(mclass).filter(
			([key, cls]: [string, any]) => cls.dt === dtsnvindel && key !== 'Blank' && key !== 'WT'
		)

		const saved = this.config.settings.snvindelOptions?.consequences as string[] | undefined
		const useSaved = this.config.settings.runAnalysis === true && !!saved && saved.length > 0
		const canonicalDefault = new Set<string>([...proteinChangingMutations, 'StartLost', 'StopLost'])
		const initialChecked = useSaved ? new Set<string>(saved!) : canonicalDefault

		const controlDiv = container
			.append('div')
			.style('margin-bottom', '6px')
			.style('display', 'flex')
			.style('gap', controlGap)

		this.snvindelSelectAllBtn = controlDiv.append('button').style('font-size', `${tableFontSize}px`).text('Select All')
		this.snvindelClearAllBtn = controlDiv.append('button').style('font-size', `${tableFontSize}px`).text('Clear All')
		this.snvindelDefaultBtn = controlDiv.append('button').style('font-size', `${tableFontSize}px`).text('Default')

		const checkboxContainer = container
			.append('div')
			.style('max-height', checkboxContainerMaxHeight)
			.style('overflow-y', 'auto')
			.style('border', checkboxContainerBorder)

		this.consequenceCheckboxes = {}
		snvIndelClasses.forEach(([classKey, classInfo]: [string, any]) => {
			const checkboxDiv = checkboxContainer.append('div').style('margin-bottom', checkboxMarginBottom)
			const checkbox = make_one_checkbox({
				holder: checkboxDiv,
				labeltext: classInfo.label,
				checked: initialChecked.has(classKey),
				divstyle: { 'font-size': `${tableFontSize}px` },
				callback: () => {}
			})
			checkboxDiv.select('label').attr('title', classInfo.desc)
			this.consequenceCheckboxes[classKey] = checkbox
		})

		this.snvindelSelectAllBtn.on('click', () => {
			Object.values(this.consequenceCheckboxes).forEach(cb => cb.property('checked', true))
		})
		this.snvindelClearAllBtn.on('click', () => {
			Object.values(this.consequenceCheckboxes).forEach(cb => cb.property('checked', false))
		})
		this.snvindelDefaultBtn.on('click', () => {
			Object.entries(this.consequenceCheckboxes).forEach(([classKey, checkbox]) => {
				checkbox.property('checked', canonicalDefault.has(classKey))
			})
		})
	}
}
