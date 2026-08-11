import { make_radios, renderTable } from '#dom'
import type { TermValues, BaseValue } from '#types'
import { filterInit } from '#filter'
import { dt2label, dtsnvindel, mclass } from '#shared/common.js'

// a selectable value: either a mutation class (no .mname) or a
// specific variant, i.e. amino acid change (.mname set, .key is its class)
type VariantValue = BaseValue & { value?: string; mname?: string; gene?: string }

// an amino acid change of the term, from /termdb/categories
// gene is present when the mutation data is annotated with it
type MnameItem = { mname: string; class: string; samplecount: number; gene?: string }

type Config = {
	genotype: 'variant' | 'wt' | 'nt'
	values: VariantValue[]
	mcount?: 'any' | 'single' | 'multiple' | 'all'
	mafFilter?: any
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
	callback: (config: Config) => void
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
	let getCheckedMnames = (): MnameItem[] => []
	// true when the variants span multiple genes, so labels name the gene
	let showGeneInMnames = false
	if (values.length) {
		// variant data present, display class checklist and specific
		// variants list (when available) side by side
		const flexDiv = variantsDiv.append('div').style('display', 'flex').style('gap', '25px')
		const classDiv = flexDiv.append('div').attr('data-testid', 'sjpp-variantConfig-class')
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
				mnameRows.push(row)
				// a selected value without .gene matches regardless of gene, so that
				// a selection saved before gene was tracked still displays as checked
				if (selectedMnames.some(s => s.mname == m.mname && s.key == m.class && (!s.gene || s.gene == m.gene)))
					selectedMnameIdxs.push(i)
			}
			const mnameColumns: any[] = [{ label: 'Variant' }, { label: 'Class' }, { label: 'Samples', align: 'right' }]
			if (showGene) mnameColumns.unshift({ label: 'Gene' })
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
			updateMnameRowDisplay = () => {
				// classes currently checked in the class table
				const classCheckboxes = tableDiv.select('tbody').selectAll('input').nodes()
				const checkedClasses = new Set()
				for (const [i, c] of classCheckboxes.entries()) {
					if ((c as any).checked) checkedClasses.add(values[i].key)
				}
				// show only variants of checked classes; unchecking a class also
				// clears its checked variants so a hidden selection cannot be applied
				// NOTE: the checkbox value attribute is the original row index (see renderTable)
				let visibleCount = 0
				mnameListDiv
					.select('tbody')
					.selectAll('tr')
					.style('display', function (this: any) {
						const checkbox = this.querySelector('input[type=checkbox]')
						const m = mnames[Number(checkbox.value)]
						if (checkedClasses.has(m.class)) {
							visibleCount++
							return ''
						}
						checkbox.checked = false
						return 'none'
					})
				visibleMnameCount = visibleCount
				updateToggle()
			}
			getCheckedMnames = () => {
				const checked: MnameItem[] = []
				mnameListDiv
					.select('tbody')
					.selectAll('input[type=checkbox]')
					.each(function (this: any) {
						if (this.checked) checked.push(mnames[Number(this.value)])
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
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin-top', '15px')
		.style('font-size', '.8em')
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
					for (const m of checkedMnames) {
						const v: VariantValue = {
							key: m.class,
							label: showGeneInMnames && m.gene ? `${m.gene} ${m.mname}` : m.mname,
							value: m.mname,
							mname: m.mname
						}
						if (m.gene) v.gene = m.gene
						config.values.push(v)
					}
				} else {
					// no specific variant selected, use the checked mutation classes
					// NOTE: the checkbox value attribute is the original row index (see renderTable)
					const checkboxes = classTableDiv ? classTableDiv.select('tbody').selectAll('input').nodes() : []
					for (const c of checkboxes) {
						if (c.checked) config.values.push(values[Number(c.value)])
					}
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
			}
			arg.callback(config)
		})
}
