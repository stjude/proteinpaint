import { make_radios, renderTable } from '#dom'
import { Menu } from './menu'
import { isoformRangeSelect } from './isoformSelect'
import type { GeneModel, BreakpointMarker } from './types/isoformSelect'
import type { TermValues, BaseValue, BreakpointRange, BreakpointEntry } from '#types'
import { filterInit } from '#filter'
import { dt2label, dtsnvindel, dtsv, dtfusionrna, mclass } from '#shared/common.js'

// a selectable value: either a mutation class (no .mname) or a
// specific variant, i.e. amino acid change (.mname set, .key is its class)
type VariantValue = BaseValue & {
	value?: string
	mname?: string
	gene?: string
	/** sv/fusion only: restricts the breakpoint on the partner gene named by .mname */
	partnerBreakpointRange?: BreakpointRange
}

// an amino acid change of the term, from /termdb/categories
// gene is present when the mutation data is annotated with it
// for a sv/fusion, mname is the partner gene and breakpoints are those of its events
type MnameItem = {
	mname: string
	class: string
	samplecount: number
	gene?: string
	breakpoints?: BreakpointEntry[]
	noPositionCount?: number
}

type Config = {
	genotype: 'variant' | 'wt' | 'nt'
	values: VariantValue[]
	mcount?: 'any' | 'single' | 'multiple' | 'all'
	mafFilter?: any
	/** sv/fusion only: restricts the breakpoint on the term's own gene. always present
	 * for a sv/fusion, and undefined when cleared, so that the caller can tell a cleared
	 * range from an untouched one */
	selfBreakpointRange?: BreakpointRange
}

type Arg = {
	holder: any // D3 holder where UI is rendered
	header?: string // UI header
	values: TermValues // mutation classes of term
	mnames?: MnameItem[] // amino acid changes of term, sorted by descending sample count
	selectedValues?: VariantValue[] // selected mutation classes/variants, when missing will default to all classes of term
	genotype?: 'variant' | 'wt' | 'nt' // genotype (variant, wildtype, not tested)
	dt: number // dt value, rendering of some elements are based on this value
	mcount?: 'any' | 'single' | 'multiple' | 'all' // mutation count, when missing will default to 'any'
	mafFilter?: any // maf filter
	/** gene of the term, only when it has exactly one. a breakpoint range on the term's
	 * own gene is not scoped to a gene, so the control is only offered for such a term */
	gene?: string
	/** returns the isoform models of a gene, to chart its breakpoints over. when missing,
	 * the sv/fusion breakpoint controls are not offered */
	getGeneModels?: (gene: string) => Promise<GeneModel[]>
	/** breakpoint range already registered on the term's own gene */
	selfBreakpointRange?: BreakpointRange
	callback: (config: Config) => void
}

/** format a range the way it is shown on the controls and in a pill */
export function breakpointRangeLabel(r: BreakpointRange) {
	return `${r.chr}:${r.start.toLocaleString()}-${r.stop.toLocaleString()}`
}

export function renderVariantConfig(arg: Arg) {
	const { holder, dt, mafFilter } = arg
	const genotype = arg.genotype || 'variant'
	if (!['variant', 'wt', 'nt'].includes(genotype)) throw 'invalid genotype'
	const values: VariantValue[] = Object.entries(arg.values).map(([k, v]) => {
		return { key: k, label: v.label, value: k }
	})
	// selected specific variants (amino acid changes)
	const selectedMnames = (arg.selectedValues || []).filter(v => v.mname)
	// a class is selected when it appears in any selected value, either
	// class-wide (no .mname) or narrowed to specific variants (.mname set);
	// when nothing is selected at all, default to all classes selected
	const selectedValues = arg.selectedValues?.length ? arg.selectedValues : values
	// a selected variant may be absent from the current data, e.g. when another
	// filter term excludes all of its samples. such a selection is preserved as a
	// zero-count entry so that it stays checked and is not silently widened to
	// its class on apply
	const preservedMnames: MnameItem[] = selectedMnames
		.filter(s => !arg.mnames?.some(m => m.mname == s.mname && m.class == s.key && (!s.gene || s.gene == m.gene)))
		.map(s => {
			const m: MnameItem = { mname: s.mname as string, class: s.key as string, samplecount: 0 }
			if (s.gene) m.gene = s.gene
			return m
		})
	const mnames: MnameItem[] = [...(arg.mnames || []), ...preservedMnames]
	// a preserved variant is only displayable when its class is listed, so
	// preserve the class as well when the current data has no mutation of it
	for (const m of preservedMnames) {
		if (!values.some(v => v.key == m.class))
			values.push({ key: m.class, label: mclass[m.class]?.label || m.class, value: m.class })
	}
	if (!Number.isInteger(dt)) throw 'unexpected dt value'
	const mcount = arg.mcount || 'any'
	if (!['any', 'single', 'multiple', 'all'].includes(mcount)) throw 'invalid mcount'

	/* a sv/fusion event has a breakpoint on the term's own gene and one on the partner
	gene of the event, either of which may be restricted to a range. the breakpoints come
	from the same tally as the mnames (see BreakpointEntry), so the controls are only
	offered when the dt is a sv/fusion and the caller can supply isoform models to chart
	them over */
	const isSvFusion = dt == dtsv || dt == dtfusionrna
	const canSelectBreakpoint = isSvFusion && !!arg.getGeneModels && mnames.some(m => m.breakpoints?.length)
	/* a sv/fusion has a single mutation class, hardcoded per dt by the data query, so a
	checklist of it is a checkbox with nothing to choose between. it is not rendered, and
	the class is implied to be selected instead: classTableDiv stays undefined, which both
	getCheckedClasses() and the apply handler read as all classes being selected */
	const hideClassList = isSvFusion && values.length == 1
	// range on the term's own gene, undefined when there is none
	let selfBreakpointRange = arg.selfBreakpointRange
	// ranges on the partner gene of a variant, k: index of the variant in mnames[]
	const partnerBreakpointRanges = new Map<number, BreakpointRange>()
	for (const [i, m] of mnames.entries()) {
		const selected = selectedMnames.find(s => s.mname == m.mname && s.key == m.class && (!s.gene || s.gene == m.gene))
		if (selected?.partnerBreakpointRange) partnerBreakpointRanges.set(i, selected.partnerBreakpointRange)
	}
	/* one menu for both controls, so that opening one closes the other. created on first
	use, as a menu attaches to the document body and this ui is rendered anew on each edit */
	let breakpointTip: Menu | undefined

	holder.style('margin', '10px')

	// header
	if (arg.header) {
		holder.append('div').style('font-weight', 'bold').style('font-size', '.9em').text(arg.header)
	}

	// mutant vs. wildtype radio buttons
	const genotypeDiv = holder
		.append('div')
		.attr('data-testid', 'sjpp-variantConfig-genotype')
		.style('margin-top', '10px')
	genotypeDiv
		.append('div')
		.style('display', 'inline-block')
		.style('margin-right', '5px')
		.style('opacity', 0.7)
		.text('Genotype')
	const genotypeRadio = make_radios({
		holder: genotypeDiv,
		styles: { display: 'inline-block' },
		options: [
			{ label: dt2label[dt], value: 'variant', checked: genotype == 'variant' },
			{ label: 'Wildtype', value: 'wt', checked: genotype == 'wt' },
			{ label: 'Not tested', value: 'nt', checked: genotype == 'nt' }
		],
		callback: value => {
			variantsDiv.style('display', value == 'variant' ? 'block' : 'none')
			applyBtn.property('disabled', value == 'variant' && !values.length)
		}
	})

	// variants
	const variantsDiv = holder
		.append('div')
		.attr('data-testid', 'sjpp-variantConfig-variant')
		.style('display', genotype == 'variant' ? 'block' : 'none')
		.style('margin-top', '10px')

	let countRadio
	let classTableDiv // holds the class checklist table
	// filters the specific variants list by checked classes, assigned when
	// the list is rendered and invoked on class checkbox changes
	let updateMnameRowDisplay = () => {}
	// returns the specific variants (amino acid changes) checked in the list
	let getCheckedMnames = (): { m: MnameItem; i: number }[] => []
	// note saying the variants list is restricted by the range on the term's own gene
	let selfRangeNote: any
	// true when the variants span multiple genes, so labels name the gene
	let showGeneInMnames = false
	if (values.length) {
		/* variant data present, display class checklist and specific variants list (when
		available) side by side. with the checklist hidden (see hideClassList) its column
		would hold the breakpoint control alone, next to a variants list that the control
		filters; the control is stacked above the list instead */
		const aboveDiv = hideClassList ? variantsDiv.append('div') : undefined
		const flexDiv = variantsDiv.append('div').style('display', 'flex').style('gap', '25px')
		const classDiv = hideClassList ? undefined : flexDiv.append('div').attr('data-testid', 'sjpp-variantConfig-class')
		if (!hideClassList) {
			classDiv.append('div').style('opacity', 0.7).style('margin-bottom', '5px').text(dt2label[dt])
			const tableDiv = classDiv.append('div').style('margin-left', '5px').style('font-size', '0.8rem')
			classTableDiv = tableDiv
			const rows: any[] = []
			const selectedIdxs: number[] = []
			for (const [i, m] of values.entries()) {
				const label = m.label || m.key
				rows.push([{ value: label }])
				if (selectedValues.find(s => s.key == m.key)) selectedIdxs.push(i)
			}
			const columns: any[] = [{ label: 'tvs' }]
			renderTable({
				rows,
				columns,
				div: tableDiv,
				maxWidth: '40vw',
				maxHeight: '40vh',
				noButtonCallback: () => updateMnameRowDisplay(),
				showHeader: false,
				striped: false,
				showLines: false,
				selectedRows: selectedIdxs
			})
		}
		if (canSelectBreakpoint && arg.gene) {
			// control to restrict the breakpoint on the term's own gene, e.g. to select
			// the cases of only one of the two BCR breakpoint clusters of BCR::ABL1
			const selfDiv = (aboveDiv || classDiv)
				.append('div')
				.attr('data-testid', 'sjpp-variantConfig-selfBreakpoint')
				// under the checklist when beside the variants list, above it when stacked
				.style('margin', aboveDiv ? '0 0 8px 5px' : '8px 0 0 5px')
			selfDiv.append('span').style('opacity', 0.7).text(`${arg.gene} breakpoint `)
			const selfBtn = selfDiv
				.append('span')
				.attr('class', 'sja_clbtext')
				.attr('data-testid', 'sjpp-variantConfig-selfBreakpoint-btn')
				.style('cursor', 'pointer')
			const updateSelfBtn = () => {
				selfBtn
					.style('color', selfBreakpointRange ? '#1e6edc' : '#858585')
					.text(selfBreakpointRange ? breakpointRangeLabel(selfBreakpointRange) : 'any position')
			}
			updateSelfBtn()
			selfBtn.on('click', (event: MouseEvent) => {
				// only the breakpoints of the checked classes are charted, so that the
				// range is placed over the events the tvs will actually match
				const checkedClasses = getCheckedClasses()
				const markers = collectMarkers(
					mnames.filter(m => checkedClasses.has(m.class)),
					m => m.breakpoints?.map(b => ({ pos: b.pos, samplecount: b.samplecount })) || []
				)
				openBreakpointMenu({
					event,
					gene: arg.gene as string,
					markers,
					range: selfBreakpointRange,
					noPositionCount: mnames
						.filter(m => checkedClasses.has(m.class))
						.reduce((n, m) => n + (m.noPositionCount || 0), 0),
					callback: range => {
						selfBreakpointRange = range || undefined
						updateSelfBtn()
						// the variants list only holds those still reachable under the range
						updateMnameRowDisplay()
					}
				})
			})
		}
		if (mnames.length) {
			// specific variants (amino acid changes, e.g. KRAS G12D) are
			// available for this term, render as a collapsible checkbox list
			const section = flexDiv.append('div').attr('data-testid', 'sjpp-variantConfig-mname')
			// folded by default, expand when the tvs already has specific variants selected
			let expanded = selectedMnames.length > 0
			const toggle = section
				.append('div')
				.style('cursor', 'pointer')
				.style('opacity', 0.7)
				.style('margin-bottom', '5px')
			const listWrapper = section.append('div').style('margin-left', '5px')
			// number of variants displayed in the list, quoted in the toggle label
			let visibleMnameCount = mnames.length
			const updateToggle = () => {
				toggle.html(`${expanded ? '&#9660;' : '&#9658;'} Specific variants (${visibleMnameCount})`)
				listWrapper.style('display', expanded ? 'block' : 'none')
			}
			toggle.on('click', () => {
				expanded = !expanded
				updateToggle()
			})
			updateToggle()
			listWrapper
				.append('div')
				.style('font-size', '.75em')
				.style('opacity', 0.6)
				.style('margin', '3px 0')
				.text('Checked variants replace the class selection; classes apply when no variant is checked.')
			// says that the list is restricted by the range on the term's own gene,
			// filled by updateMnameRowDisplay()
			if (canSelectBreakpoint && arg.gene) {
				selfRangeNote = listWrapper
					.append('div')
					.attr('data-testid', 'sjpp-variantConfig-selfBreakpoint-note')
					.style('font-size', '.75em')
					.style('opacity', 0.6)
					.style('margin', '3px 0')
					.style('display', 'none')
			}
			const mnameListDiv = listWrapper.append('div').style('font-size', '0.8rem')
			// when the term covers multiple genes (geneset), indicate the gene of
			// each variant in its own column
			const showGene = new Set(mnames.map(m => m.gene).filter(g => g)).size > 1
			showGeneInMnames = showGene
			const mnameRows: any[] = []
			const selectedMnameIdxs: number[] = []
			for (const [i, m] of mnames.entries()) {
				// a preserved entry is not in the current data, flag its count cell
				// so it reads as absent rather than as a variant with no samples
				const countCell: any = { value: m.samplecount }
				if (!m.samplecount) countCell.dataTestId = 'sjpp-variantConfig-mname-absent'
				const row = [{ value: m.mname }, { value: arg.values[m.class]?.label || m.class }, countCell]
				if (showGene) row.unshift({ value: m.gene || '' })
				// cell to fill with the breakpoint control of this variant after render
				if (canSelectBreakpoint) row.push({ value: '' })
				mnameRows.push(row)
				// a selected value without .gene matches regardless of gene, so that
				// a selection saved before gene was tracked still displays as checked
				if (selectedMnames.some(s => s.mname == m.mname && s.key == m.class && (!s.gene || s.gene == m.gene)))
					selectedMnameIdxs.push(i)
			}
			const mnameColumns: any[] = [{ label: 'Variant' }, { label: 'Class' }, { label: 'Samples', align: 'right' }]
			if (showGene) mnameColumns.unshift({ label: 'Gene' })
			if (canSelectBreakpoint) mnameColumns.push({ label: 'Breakpoint' })
			renderTable({
				rows: mnameRows,
				columns: mnameColumns,
				div: mnameListDiv,
				maxWidth: '40vw',
				maxHeight: '30vh',
				noButtonCallback: () => updateMnameRowDisplay(),
				showHeader: false,
				striped: false,
				showLines: false,
				selectedRows: selectedMnameIdxs
			})
			if (canSelectBreakpoint) {
				/* fill the breakpoint cell of each variant, to restrict the breakpoint on
				the partner gene of that fusion, e.g. to select only the BCR::ABL1 cases
				breaking in a given part of ABL1. the range is only applied when the
				variant is checked, as only checked variants become tvs values */
				for (const [i, row] of mnameRows.entries()) {
					const m = mnames[i]
					const cell = row[row.length - 1]
					const btn = cell.__td
						.append('span')
						.attr('data-testid', 'sjpp-variantConfig-partnerBreakpoint-btn')
						.style('font-size', '.9em')
					const update = () => {
						const r = partnerBreakpointRanges.get(i)
						btn.style('color', r ? '#1e6edc' : '#858585').text(r ? breakpointRangeLabel(r) : 'any position')
					}
					update()
					if (!m.breakpoints?.length) {
						// no charted breakpoint of the partner gene to select a range over
						btn.style('opacity', 0.4).text('n/a').attr('title', 'no breakpoint position for this variant')
						continue
					}
					btn
						.attr('class', 'sja_clbtext')
						.style('cursor', 'pointer')
						.on('click', (event: MouseEvent) => {
							openBreakpointMenu({
								event,
								// the partner gene of a fusion is named by the mname
								gene: m.mname,
								markers: collectMarkers([m], e =>
									(e.breakpoints || []).map(b => ({
										pos: b.partnerPos,
										chr: b.partnerChr,
										samplecount: b.samplecount
									}))
								),
								range: partnerBreakpointRanges.get(i),
								noPositionCount: m.noPositionCount || 0,
								callback: range => {
									if (range) partnerBreakpointRanges.set(i, range)
									else partnerBreakpointRanges.delete(i)
									update()
								}
							})
						})
				}
			}
			updateMnameRowDisplay = () => {
				const checkedClasses = getCheckedClasses()
				// show only variants of checked classes, and of the range on the term's
				// own gene when one is set; unchecking a class or narrowing the range also
				// clears the checked variants it hides, so that a hidden selection cannot
				// be applied
				// NOTE: the checkbox value attribute is the original row index (see renderTable)
				let visibleCount = 0
				mnameListDiv
					.select('tbody')
					.selectAll('tr')
					.style('display', function (this: any) {
						const checkbox = this.querySelector('input[type=checkbox]')
						const m = mnames[Number(checkbox.value)]
						if (checkedClasses.has(m.class) && isInSelfBreakpointRange(m)) {
							visibleCount++
							return ''
						}
						checkbox.checked = false
						return 'none'
					})
				visibleMnameCount = visibleCount
				updateToggle()
				if (selfRangeNote) {
					selfRangeNote
						.style('display', selfBreakpointRange ? 'block' : 'none')
						.text(
							selfBreakpointRange
								? `Only variants with a ${arg.gene} breakpoint in ${breakpointRangeLabel(
										selfBreakpointRange
								  )} are listed.`
								: ''
						)
				}
			}
			getCheckedMnames = () => {
				const checked: { m: MnameItem; i: number }[] = []
				mnameListDiv
					.select('tbody')
					.selectAll('input[type=checkbox]')
					.each(function (this: any) {
						// the checkbox value attribute is the index in mnames[], which also
						// keys the breakpoint range of the variant
						if (this.checked) checked.push({ m: mnames[Number(this.value)], i: Number(this.value) })
					})
				return checked
			}
			// apply initial class filter to the list
			updateMnameRowDisplay()
		}
		if (dt == dtsnvindel) {
			// snvindel
			// render mutation count radios
			const countDiv = variantsDiv.append('div').style('margin-top', '5px')
			countDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-right', '5px')
				.style('opacity', 0.7)
				.text('Occurrence')
			const countOpts: any = [
				{ label: 'Any', value: 'any' },
				{ label: 'Single', value: 'single' },
				{ label: 'Multiple', value: 'multiple' }
			]
			countOpts.forEach((opt: any) => {
				if (opt.value == mcount) opt.checked = true
			})
			// not displaying the 'all' option by default because its usecase
			// is currently limited (e.g. for tvs in biallelic/monoallelic groupset)
			// can display the option by default if needed more broadly
			if (!countOpts.some((opt: any) => opt.checked)) {
				if (mcount == 'all') countOpts.push({ label: 'All', value: 'all', checked: true })
			}
			countRadio = make_radios({
				holder: countDiv,
				styles: { display: 'inline-block' },
				options: countOpts,
				callback: () => {}
			})
			// render maf filter, if defined
			if (mafFilter) {
				const mafDiv = variantsDiv.append('div').style('margin-top', '5px')
				mafDiv
					.append('div')
					.style('display', 'inline-block')
					.style('margin-right', '5px')
					.style('opacity', 0.7)
					.text('MAF filter')
				filterInit({
					emptyLabel: '+',
					holder: mafDiv,
					header_mode: 'hide_search',
					isMafFilter: true, // will be handled by "client/filter/tvs.numeric.js"
					vocab: { terms: mafFilter.terms },
					callback: async filter => {
						mafFilter.active = filter
					}
				}).main(mafFilter.active)
			}
		}
	} else {
		// no variant data
		variantsDiv
			.append('div')
			.style('display', values.length ? 'none' : 'block')
			.text(`No ${dt2label[dt]} found`)
	}

	// Apply button
	const applyBtn = holder
		.append('div')
		.append('button')
		.attr('data-testid', 'sjpp-variantConfig-apply')
		.style('margin-top', '15px')
		.property('disabled', genotype == 'variant' && !values.length)
		.text('APPLY')
		.on('click', () => {
			// get genotype
			const selectedGenotype: any = genotypeRadio.inputs.nodes().find(r => r.checked)
			if (!selectedGenotype) throw 'no genotype selected'
			const config: Config = { values: [], genotype: selectedGenotype.value }
			if (config.genotype == 'variant') {
				// variant genotype
				// get selected specific variants (amino acid changes)
				const checkedMnames = getCheckedMnames()
				if (checkedMnames.length) {
					// specific variants are selected, they refine the selection and
					// override the checked classes: each selected variant becomes a
					// class-scoped value entry with .mname, and .gene when annotated
					for (const { m, i } of checkedMnames) {
						const v: VariantValue = {
							key: m.class,
							label: showGeneInMnames && m.gene ? `${m.gene} ${m.mname}` : m.mname,
							value: m.mname,
							mname: m.mname
						}
						if (m.gene) v.gene = m.gene
						// a range on the partner gene only applies to this variant
						const partnerRange = partnerBreakpointRanges.get(i)
						if (partnerRange) v.partnerBreakpointRange = partnerRange
						config.values.push(v)
					}
				} else if (classTableDiv) {
					// no specific variant selected, use the checked mutation classes
					// NOTE: the checkbox value attribute is the original row index (see renderTable)
					const checkboxes = classTableDiv.select('tbody').selectAll('input').nodes()
					for (const c of checkboxes) {
						if (c.checked) config.values.push(values[Number(c.value)])
					}
				} else {
					// the checklist is not rendered, so its classes are all selected. for a
					// sv/fusion this is its single class (see hideClassList); with no variant
					// data at all there is no class to apply and values[] is empty
					config.values.push(...values)
				}
				if (dt == dtsnvindel) {
					// get mutation count
					const selectedCount: any = countRadio.inputs.nodes().find(r => r.checked)
					if (!selectedCount) throw 'no mutation count selected'
					config.mcount = selectedCount.value
					// get maf filter
					if (mafFilter) config.mafFilter = mafFilter.active
				} else {
					config.mcount = 'any'
				}
				/* always set for a sv/fusion, so that the caller can tell a cleared range
				(undefined) from a dt that does not have the control at all (absent key) */
				if (isSvFusion) config.selfBreakpointRange = selfBreakpointRange
			}
			arg.callback(config)
		})

	/* whether a variant still has an event under the range on the term's own gene, i.e.
	whether checking it could match any sample. a variant whose events all break outside
	the range, or that has no charted breakpoint at all, has none: an event without a
	coordinate cannot satisfy a range on the server either (see isSelfBreakpointInRange
	in server/src/svfusion.breakpoint.ts).
	an entry absent from the current data is exempt, as it is only listed to preserve a
	saved selection, and hiding it would silently widen that selection to its class */
	function isInSelfBreakpointRange(m: MnameItem) {
		if (!selfBreakpointRange) return true
		if (!m.samplecount) return true
		const { start, stop } = selfBreakpointRange
		return !!m.breakpoints?.some(b => b.pos >= start && b.pos <= stop)
	}

	/** classes currently checked in the class table, or all of them when it is not rendered */
	function getCheckedClasses() {
		const checked = new Set()
		if (!classTableDiv) {
			// no checklist to read, e.g. the single class of a sv/fusion (see hideClassList)
			for (const v of values) checked.add(v.key)
			return checked
		}
		// NOTE: iterating position matches values[], as the class table is never filtered
		const checkboxes = classTableDiv.select('tbody').selectAll('input').nodes()
		for (const [i, c] of checkboxes.entries()) {
			if ((c as any).checked) checked.add(values[i].key)
		}
		return checked
	}

	/* merge the breakpoints of the given variants at the same position, summing their
	samples. NOTE the tally is per pair of breakpoints (see BreakpointEntry), so a sample
	with two events at one position, to different partners, is counted once per event */
	function collectMarkers(items: MnameItem[], get: (m: MnameItem) => MarkerInput[]): MarkerInput[] {
		const byKey = new Map<string, MarkerInput>()
		for (const m of items) {
			for (const b of get(m)) {
				if (!Number.isFinite(b.pos)) continue
				const key = `${b.chr || ''}|${b.pos}`
				const entry = byKey.get(key)
				if (entry) entry.samplecount += b.samplecount
				else byKey.set(key, { ...b })
			}
		}
		return [...byKey.values()]
	}

	/** chr of most of the markers, by samples; markers of the term's own gene have none */
	function mostCommonChr(markers: MarkerInput[]) {
		const count = new Map<string, number>()
		for (const m of markers) {
			if (m.chr) count.set(m.chr, (count.get(m.chr) || 0) + m.samplecount)
		}
		let best: string | undefined
		let bestCount = 0
		for (const [chr, n] of count) {
			if (n > bestCount) {
				best = chr
				bestCount = n
			}
		}
		return best
	}

	/** chart the breakpoints of a gene in a menu and select a range of them */
	async function openBreakpointMenu(a: {
		event: MouseEvent
		gene: string
		markers: MarkerInput[]
		range?: BreakpointRange
		noPositionCount: number
		callback: (range: BreakpointRange | null) => void
	}) {
		if (!breakpointTip)
			breakpointTip = new Menu({
				padding: '10px',
				/* this ui is rendered inside a menu, e.g. the tvs edit menu. declaring that
				menu as the parent keeps it, and its own ancestors, open when clicking inside
				this one; without it every other open menu treats a click here as a click
				outside itself and hides. same idiom as getDom() in termsetting/TermSetting.ts,
				and the ancestors above the parent are picked up from it (see setRelatedMenus
				in dom/menu.js) */
				parent_menu: holder.node()?.closest('.sja_menu_div')
			})
		const tip = breakpointTip
		tip.clear().showunder(a.event.target as HTMLElement)
		const div = tip.d.append('div')
		div.append('div').style('opacity', 0.6).text('Loading...')
		let gmlst: GeneModel[] = []
		try {
			gmlst = (await arg.getGeneModels!(a.gene)) || []
		} catch (e: any) {
			// the isoform models are optional context: a gene without them, e.g. a fusion
			// partner that is an unannotated locus, still has its breakpoints charted
			console.warn(`no gene model for ${a.gene}: ${e?.message || e}`)
		}
		div.selectAll('*').remove()
		/* the chr of the markers decides the locus, so that the range is on the same chr
		as the events it will match; the breakpoints of the term's own gene carry no chr,
		so fall back to its default isoform, which is also what the server resolves a gene
		to when querying its events */
		const chr = mostCommonChr(a.markers) || (gmlst.find(g => g.isdefault) || gmlst[0])?.chr
		if (!chr) {
			div.append('div').text(`Unknown chromosome of ${a.gene}`)
			return
		}
		div
			.append('div')
			.style('margin-bottom', '5px')
			.style('font-size', '.9em')
			.style('opacity', 0.7)
			.text(`${a.gene} breakpoints`)
		if (a.noPositionCount) {
			div
				.append('div')
				.style('font-size', '.75em')
				.style('opacity', 0.6)
				.style('margin-bottom', '5px')
				.text(
					`${a.noPositionCount} samples have events without a breakpoint position; they are not charted and do not match a range`
				)
		}
		isoformRangeSelect({
			holder: div.append('div'),
			allgm: gmlst,
			chr,
			markers: a.markers.filter(m => !m.chr || m.chr == chr),
			// a range of another chr is not of this locus, so is not shown as the current one
			range: a.range?.chr == chr ? a.range : undefined,
			callback: range => {
				tip.hide()
				a.callback(range)
			}
		})
	}
}

/** a breakpoint to chart. .chr is only known for those on a partner gene */
type MarkerInput = BreakpointMarker & { chr?: string; samplecount: number }
