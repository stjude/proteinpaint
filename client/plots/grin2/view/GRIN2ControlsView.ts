import { table2col, make_one_checkbox, make_radios } from '#dom'
import {
	dtsnvindel,
	mclass,
	dtcnv,
	dtfusionrna,
	dtsv,
	dtitd,
	proteinChangingMutations,
	dt2lesion,
	mclasscnvgain,
	mclasscnvAmp,
	mclasscnvloss,
	mclasscnvHomozygousDel,
	mclasscnvloh
} from '#shared/common.js'

// display order for categorical cnv-class checkboxes: gains first (gain, amplification), then losses
// (heterozygous deletion, homozygous deletion) so the two deletions sit next to each other. Any class not
// listed here (dataset-specific) is appended after, in its declared order.
const CNV_CLASS_ORDER = [mclasscnvgain, mclasscnvAmp, mclasscnvloss, mclasscnvHomozygousDel, mclasscnvloh]
import { filterInit } from '#filter'
import type { GRIN2ControlsCallbacks, DtUsage } from '../GRIN2Types'
import {
	CNV_MAX_SEG_LENGTH_FALLBACK,
	CNV_TYPE_CONFIG,
	EXCLUDE_OVERLAP_FRAC_FALLBACK,
	SNVINDEL_HYPERMUTATOR_FALLBACK,
	CNV_HYPERMUTATOR_FALLBACK
} from '../settings/defaults'
import type { CnvType } from '../settings/defaults'

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
// shared width for the "Consequences" / "Classes" label cells so their checkbox boxes line up vertically
// (each lives in its own table2col, whose label column would otherwise size to its own label text)
const checkboxRowLabelWidth = '110px'

/** Builds and owns the GRIN2 config form (citation header + data-type rows + run button).
 *  Reads its own state from the live DOM and exposes it to the controller via getDtUsage/getConfigValues. */
export class GRIN2ControlsView {
	private headerHolder: any
	private controlsHolder: any
	private actionsHolder: any
	private config: any
	private vocabApi: any
	private callbacks: GRIN2ControlsCallbacks

	private snvindelCheckbox: any = null
	private cnvCheckbox: any = null
	private fusionCheckbox: any = null
	private svCheckbox: any = null
	private itdCheckbox: any = null
	private runButton: any = null
	private consequenceCheckboxes: Record<string, any> = {}
	private snvindelSelectAllBtn: any = null
	private snvindelClearAllBtn: any = null
	private snvindelDefaultBtn: any = null
	// one checkbox per supported categorical cnv-segment class (populated only for ds.queries.cnv.type='category')
	private cnvCategoryCheckboxes: Record<string, any> = {}

	private cnv_lossThreshold: any = null
	private cnv_gainThreshold: any = null
	private cnv_maxSegLength: any = null
	private cnv_hyperMutator: any = null
	private snvindel_hyperMutator: any = null
	/** how this ds quantifies cnv values; from the selected cnv type or ds.queries.cnv.type, default 'log2ratio' */
	private cnvType: CnvType = 'log2ratio'
	/** id of the user-selected cnv file type, when the ds exposes singleSampleMutation.cnvTypes (else null) */
	private cnvSelectedTypeId: string | null = null

	// one checkbox per genome-declared blacklist source, keyed by source name
	private excludeCheckboxes: Record<string, any> = {}
	private exclude_overlapFrac: any = null

	private snvindelMafFilter: any = null

	private genome: any

	constructor(opts: {
		headerHolder: any
		controlsHolder: any
		config: any
		vocabApi: any
		genome: any
		actionsHolder: any
		callbacks: GRIN2ControlsCallbacks
	}) {
		this.headerHolder = opts.headerHolder
		this.controlsHolder = opts.controlsHolder
		this.config = opts.config
		this.vocabApi = opts.vocabApi
		this.genome = opts.genome
		this.actionsHolder = opts.actionsHolder
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
		if (queries.cnv || queries.singleSampleMutation?.cnvTypes?.length) this.addCnvRow(table)
		if (queries.svfusion?.dtLst?.includes(dtfusionrna)) this.addFusionRow(table)
		if (queries.svfusion?.dtLst?.includes(dtsv)) this.addSvRow(table)
		if (queries.itd) this.addItdRow(table)

		// Artifact-region exclude mask (applies to all lesion types).
		this.addExcludeRow(table)

		this.runButton = this.actionsHolder
			.append('button')
			.attr('data-testid', 'sjpp-grin2-run-button')
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
		if (dtUsage[dtitd]) dtUsage[dtitd].checked = this.itdCheckbox.property('checked')
		return dtUsage
	}

	getConfigValues(dtUsage: DtUsage): any {
		const requestConfig: any = {}
		if (dtUsage[dtsnvindel]?.checked) {
			requestConfig.snvindelOptions = {
				consequences: this.getSelectedConsequences()
			}
			if (this.snvindel_hyperMutator) {
				// a cleared input yields NaN; fall back to the default so we never send NaN (which would silently
				// disable the cutoff server-side and leak "NaN" into summary strings)
				const v = parseFloat(this.snvindel_hyperMutator.property('value'))
				requestConfig.snvindelOptions.hyperMutator = Number.isFinite(v) ? v : SNVINDEL_HYPERMUTATOR_FALLBACK
			}
			if (this.snvindelMafFilter) {
				requestConfig.snvindelOptions.mafFilter = this.snvindelMafFilter
			}
		}
		if (dtUsage[dtcnv]?.checked) {
			requestConfig.cnvOptions = {
				maxSegLength: parseFloat(this.cnv_maxSegLength.property('value'))
			}
			if (this.cnv_hyperMutator) {
				// cleared input => NaN; fall back to the default (see snvindel hyperMutator above)
				const v = parseFloat(this.cnv_hyperMutator.property('value'))
				requestConfig.cnvOptions.hyperMutator = Number.isFinite(v) ? v : CNV_HYPERMUTATOR_FALLBACK
			}
			// id of the selected cnv file type (datasets exposing singleSampleMutation.cnvTypes, e.g. GDC)
			if (this.cnvSelectedTypeId) requestConfig.cnvOptions.cnvType = this.cnvSelectedTypeId
			// 'category' is a qualitative call with no numeric thresholds; the rows aren't rendered
			if (this.cnv_lossThreshold && this.cnv_gainThreshold) {
				requestConfig.cnvOptions.lossThreshold = parseFloat(this.cnv_lossThreshold.property('value'))
				requestConfig.cnvOptions.gainThreshold = parseFloat(this.cnv_gainThreshold.property('value'))
			}
			// categorical cnv: the checked cnv-segment classes to include (e.g. GDC gain/loss/amp/homdel)
			if (Object.keys(this.cnvCategoryCheckboxes).length) {
				requestConfig.cnvOptions.cnvCategories = this.getSelectedCnvCategories()
			}
		}
		if (dtUsage[dtfusionrna]?.checked) requestConfig.fusionOptions = {}
		if (dtUsage[dtsv]?.checked) requestConfig.svOptions = {}
		if (dtUsage[dtitd]?.checked) requestConfig.itdOptions = {}
		// excludeOptions.blacklists = names of the checked genome-declared sources.
		// Only emitted when the genome declares blacklists (otherwise the mask is unavailable).
		if (Object.keys(this.excludeCheckboxes).length > 0) {
			const blacklists = Object.entries(this.excludeCheckboxes)
				.filter(([, cb]) => cb.property('checked'))
				.map(([name]) => name)
			const overlapFracRaw = this.exclude_overlapFrac
				? parseFloat(this.exclude_overlapFrac.property('value'))
				: EXCLUDE_OVERLAP_FRAC_FALLBACK
			requestConfig.excludeOptions = {
				blacklists,
				overlapFrac: Number.isFinite(overlapFracRaw) ? overlapFracRaw : EXCLUDE_OVERLAP_FRAC_FALLBACK
			}
		}
		return requestConfig
	}

	setBusy(busy: boolean) {
		this.controlsHolder?.style('pointer-events', busy ? 'none' : 'auto').style('opacity', busy ? '0.5' : '1')
		this.runButton?.property('disabled', busy).text(busy ? 'Running GRIN2...' : 'Run GRIN2')
	}

	private updateRunButtonFromCheckboxes() {
		const dtUsage = this.snvindelCheckbox ? this.getDtUsage() : (this.config.settings.dtUsage as DtUsage)
		// A run needs at least one data type that would actually contribute data. A ticked data type usually
		// qualifies, except when it has an explicit include-list with nothing selected: snvindel with no
		// consequence checked, or categorical CNV with no class checked, both match nothing (an empty list =
		// "include none"), so they can't drive a run on their own.
		const anyEffective = Object.entries(dtUsage).some(([dt, info]) => {
			if (!info.checked) return false
			if (Number(dt) === dtsnvindel && Object.keys(this.consequenceCheckboxes).length > 0) {
				return this.getSelectedConsequences().length > 0
			}
			if (Number(dt) === dtcnv && Object.keys(this.cnvCategoryCheckboxes).length > 0) {
				return this.getSelectedCnvCategories().length > 0
			}
			return true
		})
		this.runButton?.property('disabled', !anyEffective)
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
			labelCell.text('Consequences').style('padding-top', '8px').style('min-width', checkboxRowLabelWidth)
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

		// Hypermutator cutoff: samples with more SNV/indel records than this are excluded from snvindel (0 disables)
		this.snvindel_hyperMutator = this.addOptionRowToTable(
			t2,
			'Hypermutator Cutoff',
			this.config.settings?.snvindelOptions?.hyperMutator ?? SNVINDEL_HYPERMUTATOR_FALLBACK,
			0,
			undefined,
			1
		).attr('title', 'Exclude a sample from SNV/indel when it has more than this many records. 0 disables.')

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
		// container toggled by the cnv checkbox; holds the type radios (if any) + threshold inputs
		const cnvBody = right.append('div')

		// Only use saved CNV settings if a previous run completed
		const useSaved = this.config.settings.runAnalysis === true
		const savedCnv = useSaved ? this.config.settings.cnvOptions : undefined
		const cnvQuery = this.vocabApi.termdbConfig.queries.cnv
		// datasets that serve multiple cnv file types per sample (e.g. GDC masked vs allele-specific)
		const cnvTypes = this.vocabApi.termdbConfig.queries.singleSampleMutation?.cnvTypes as
			| { id: string; label: string; valueType: CnvType; dataType: string }[]
			| undefined

		// radios (if any) sit above the threshold inputs, which are rebuilt when the selected type changes
		const radioHolder = cnvTypes?.length ? cnvBody.append('div').style('margin-bottom', '6px') : null
		const thresholdHolder = cnvBody.append('div')

		if (cnvTypes?.length) {
			// initial selection: a saved & still-valid type, else the first declared type
			const savedId = savedCnv?.cnvType
			this.cnvSelectedTypeId = (savedId && cnvTypes.find(t => t.id === savedId)?.id) || cnvTypes[0].id

			// one radio per declared cnv type; switching rebuilds the threshold rows for the new valueType
			make_radios({
				holder: radioHolder,
				options: cnvTypes.map(t => ({
					label: t.label,
					value: t.id,
					checked: t.id === this.cnvSelectedTypeId,
					testid: `sjpp-grin2-cnvtype-${t.id}`
				})),
				styles: { display: 'block' },
				callback: (value: string) => {
					this.cnvSelectedTypeId = value
					const def = cnvTypes.find(t => t.id === value)
					// only reuse saved thresholds when the user is back on the saved type; otherwise show defaults
					const savedForType = value === savedCnv?.cnvType ? savedCnv : undefined
					this.renderCnvThresholdRows(thresholdHolder, def?.valueType ?? 'log2ratio', savedForType, cnvQuery)
				}
			})
		} else {
			this.cnvSelectedTypeId = null
		}

		// initial threshold rows. valueType from the selected type (cnvTypes ds) or ds-level cnv.type (file ds)
		const initialValueType: CnvType =
			(cnvTypes?.length ? cnvTypes.find(t => t.id === this.cnvSelectedTypeId)?.valueType : cnvQuery?.type) ??
			'log2ratio'
		// savedCnv only applies to the initially-selected type (or to the single-type file ds case)
		const initialSaved = !cnvTypes?.length || this.cnvSelectedTypeId === savedCnv?.cnvType ? savedCnv : undefined
		this.renderCnvThresholdRows(thresholdHolder, initialValueType, initialSaved, cnvQuery)

		const dtUsage = this.config.settings.dtUsage
		const isChecked =
			useSaved && dtUsage[dtcnv]?.checked !== undefined ? dtUsage[dtcnv].checked : !!(cnvQuery || cnvTypes?.length)
		cnvBody.style('display', isChecked ? '' : 'none')

		this.cnvCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtcnv].uilabel,
			checked: isChecked,
			testid: 'sjpp-grin2-checkbox-cnv',
			callback: (checked: boolean) => {
				cnvBody.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	/** (Re)build the loss/gain/maxSeg inputs for a given cnv value type. Called on first render and whenever
	 *  the user switches cnv type — segmean/copyNumber/log2ratio have type-specific defaults and ranges, and
	 *  'category' is qualitative and hides the thresholds entirely. */
	private renderCnvThresholdRows(holder: any, valueType: CnvType, savedCnv: any, cnvQuery: any) {
		holder.selectAll('*').remove()
		this.cnvType = valueType
		const cfg = CNV_TYPE_CONFIG[valueType]
		// reset per-render; only categorical cnv populates category checkboxes (below)
		this.cnvCategoryCheckboxes = {}

		if (cfg.hideThresholds) {
			// qualitative call: no numeric thresholds; instead offer one checkbox per supported cnv-segment
			// class (mirrors the snvindel consequence checkboxes). Rendered in its own table (before the
			// Max Segment Length table below) so that label doesn't widen the "Classes" column, keeping the
			// checkbox box aligned with "Consequences" above. Clear stale threshold inputs.
			this.cnv_lossThreshold = null
			this.cnv_gainThreshold = null
			this.createCnvCategoryCheckboxes(holder, savedCnv)
		}

		const t2 = table2col({ holder })

		if (!cfg.hideThresholds) {
			this.cnv_lossThreshold = this.addOptionRowToTable(
				t2,
				cfg.unitLabel ? `Loss Threshold (${cfg.unitLabel})` : 'Loss Threshold',
				savedCnv?.lossThreshold ?? cnvQuery?.cnvLossCutoff ?? cfg.lossDefault,
				cfg.lossMin,
				cfg.lossMax,
				cfg.step
			)
			this.cnv_gainThreshold = this.addOptionRowToTable(
				t2,
				cfg.unitLabel ? `Gain Threshold (${cfg.unitLabel})` : 'Gain Threshold',
				savedCnv?.gainThreshold ?? cnvQuery?.cnvGainCutoff ?? cfg.gainDefault,
				cfg.gainMin,
				cfg.gainMax,
				cfg.step
			)
		}
		this.cnv_maxSegLength = this.addOptionRowToTable(
			t2,
			'Max Segment Length',
			savedCnv?.maxSegLength ?? cnvQuery?.cnvMaxLength ?? CNV_MAX_SEG_LENGTH_FALLBACK,
			0,
			1e9,
			1000
		)
		// Hypermutator cutoff: samples with more cnv segments than this are excluded from cnv (0 disables)
		this.cnv_hyperMutator = this.addOptionRowToTable(
			t2,
			'Hypermutator Cutoff',
			savedCnv?.hyperMutator ?? CNV_HYPERMUTATOR_FALLBACK,
			0,
			undefined,
			1
		).attr('title', 'Exclude a sample from CNV when it has more than this many segments. 0 disables.')
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

	private addItdRow(table: any) {
		const [left, right] = table.addRow()
		const t2 = table2col({ holder: right })
		const isChecked = this.config.settings.dtUsage[dtitd].checked
		t2.table.style('display', isChecked ? '' : 'none')

		this.itdCheckbox = make_one_checkbox({
			holder: left,
			labeltext: dt2lesion[dtitd].uilabel,
			checked: isChecked,
			testid: 'sjpp-grin2-checkbox-itd',
			callback: (checked: boolean) => {
				t2.table.style('display', checked ? '' : 'none')
				this.updateRunButtonFromCheckboxes()
			}
		})
	}

	/** Artifact-region mask row. Renders one checkbox per blacklist source declared for the genome
	 * (Genome.blacklists, exposed to the client as {name}[]), plus the gene-overlap-fraction input.
	 * Skipped entirely when the genome declares no blacklists. Unchecking all sources disables the
	 * mask (server resolves an empty source list to no masking). */
	private addExcludeRow(table: any) {
		const blacklists: { name: string }[] = this.genome?.blacklists || []
		if (!blacklists.length) return

		const [left, right] = table.addRow()
		left.text('Exclude genes overlapping').style('padding-top', '4px')

		// default = all sources on; if a previous run saved a selection, restore exactly that set
		const savedExclude = this.config.settings.runAnalysis === true ? this.config.settings.excludeOptions : undefined
		const savedNames: string[] | undefined = savedExclude?.blacklists
		const isChecked = (name: string) => (savedNames ? savedNames.includes(name) : true)

		this.excludeCheckboxes = {}
		const cbContainer = right.append('div').style('margin-bottom', '6px')
		blacklists.forEach(bl => {
			const div = cbContainer.append('div').style('margin-bottom', checkboxMarginBottom)
			this.excludeCheckboxes[bl.name] = make_one_checkbox({
				holder: div,
				labeltext: bl.name,
				checked: isChecked(bl.name),
				divstyle: { 'font-size': `${tableFontSize}px` },
				callback: () => {}
			})
		})

		const t2 = table2col({ holder: right })
		this.exclude_overlapFrac = this.addOptionRowToTable(
			t2,
			'Min gene overlap',
			savedExclude?.overlapFrac ?? EXCLUDE_OVERLAP_FRAC_FALLBACK,
			0,
			1,
			0.05
		)
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
				// clearing every consequence includes nothing, which can disable the run button (see
				// updateRunButtonFromCheckboxes), so re-evaluate it on each toggle
				callback: () => this.updateRunButtonFromCheckboxes()
			})
			checkboxDiv.select('label').attr('title', classInfo.desc)
			this.consequenceCheckboxes[classKey] = checkbox
		})

		this.snvindelSelectAllBtn.on('click', () => {
			Object.values(this.consequenceCheckboxes).forEach(cb => cb.property('checked', true))
			this.updateRunButtonFromCheckboxes()
		})
		this.snvindelClearAllBtn.on('click', () => {
			Object.values(this.consequenceCheckboxes).forEach(cb => cb.property('checked', false))
			this.updateRunButtonFromCheckboxes()
		})
		this.snvindelDefaultBtn.on('click', () => {
			Object.entries(this.consequenceCheckboxes).forEach(([classKey, checkbox]) => {
				checkbox.property('checked', canonicalDefault.has(classKey))
			})
			this.updateRunButtonFromCheckboxes()
		})
	}

	private getSelectedCnvCategories(): string[] {
		const categories: string[] = []
		Object.entries(this.cnvCategoryCheckboxes).forEach(([classKey, checkbox]) => {
			if (checkbox.property('checked')) categories.push(classKey)
		})
		return categories
	}

	/** One checkbox per categorical cnv-segment class supported by this dataset, all checked by default —
	 * the cnv analog of the snvindel consequence checkboxes. The supported classes are the CNV entries the
	 * dataset declares in termdbConfig.mclass (e.g. GDC: Gain / Heterozygous Deletion / Amplification /
	 * Homozygous Deletion), identified via the global mclass dt; labels prefer the dataset override. Rendered
	 * in its own table2col with a fixed label width so the checkbox box aligns with "Consequences" above. */
	private createCnvCategoryCheckboxes(holder: any, savedCnv: any) {
		const dsMclass = this.vocabApi.termdbConfig?.mclass || {}
		const cnvClasses = Object.keys(dsMclass)
			.filter(key => mclass[key]?.dt === dtcnv)
			.map(key => ({ key, label: dsMclass[key]?.label || mclass[key]?.label || key, desc: mclass[key]?.desc || '' }))
			// gains together, deletions together (see CNV_CLASS_ORDER); unlisted classes keep declared order at end
			.sort((a, b) => {
				const ia = CNV_CLASS_ORDER.indexOf(a.key)
				const ib = CNV_CLASS_ORDER.indexOf(b.key)
				return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
			})
		this.cnvCategoryCheckboxes = {}
		if (!cnvClasses.length) return

		// default = all classes on; restore an exact saved selection only after a completed run
		const saved = savedCnv?.cnvCategories as string[] | undefined
		const useSaved = this.config.settings.runAnalysis === true && Array.isArray(saved)
		const initialChecked = useSaved ? new Set<string>(saved!) : new Set<string>(cnvClasses.map(c => c.key))

		// own table so the wide "Max Segment Length" label doesn't push these checkboxes right; fixed label
		// width matches the snvindel "Consequences" cell so the two checkbox boxes line up vertically
		const t2 = table2col({ holder })
		const [labelCell, containerCell] = t2.addRow()
		labelCell.text('Classes').style('padding-top', '8px').style('min-width', checkboxRowLabelWidth)

		const controlDiv = containerCell
			.append('div')
			.style('margin-bottom', '6px')
			.style('display', 'flex')
			.style('gap', controlGap)
		const selectAllBtn = controlDiv.append('button').style('font-size', `${tableFontSize}px`).text('Select All')
		const clearAllBtn = controlDiv.append('button').style('font-size', `${tableFontSize}px`).text('Clear All')

		const checkboxContainer = containerCell
			.append('div')
			.style('max-height', checkboxContainerMaxHeight)
			.style('overflow-y', 'auto')
			.style('border', checkboxContainerBorder)
			.style('margin-bottom', '6px')

		cnvClasses.forEach(c => {
			const checkboxDiv = checkboxContainer.append('div').style('margin-bottom', checkboxMarginBottom)
			const checkbox = make_one_checkbox({
				holder: checkboxDiv,
				labeltext: c.label,
				checked: initialChecked.has(c.key),
				divstyle: { 'font-size': `${tableFontSize}px` },
				// clearing every class excludes all cnv, which can disable the run button (see
				// updateRunButtonFromCheckboxes), so re-evaluate it on each toggle
				callback: () => this.updateRunButtonFromCheckboxes()
			})
			if (c.desc) checkboxDiv.select('label').attr('title', c.desc)
			this.cnvCategoryCheckboxes[c.key] = checkbox
		})

		selectAllBtn.on('click', () => {
			Object.values(this.cnvCategoryCheckboxes).forEach(cb => cb.property('checked', true))
			this.updateRunButtonFromCheckboxes()
		})
		clearAllBtn.on('click', () => {
			Object.values(this.cnvCategoryCheckboxes).forEach(cb => cb.property('checked', false))
			this.updateRunButtonFromCheckboxes()
		})
	}
}
