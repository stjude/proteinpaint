import type { ProteomeDetails } from '#types'

type RenderAssayAndCohortRadiosOpts = {
	holder: any
	organisms: any
	selectedProteomeDetails?: Partial<ProteomeDetails>
	onChange?: (details: Partial<ProteomeDetails>) => void
	organismTitle?: string
	assayTitle?: string
	cohortTitle?: string
}

export function renderAssayAndCohortRadios({
	holder,
	organisms,
	selectedProteomeDetails,
	onChange,
	organismTitle = 'Organism',
	assayTitle = 'Assay Type',
	cohortTitle = 'Sample Set'
}: RenderAssayAndCohortRadiosOpts) {
	const organismEntries = Object.entries(organisms || {})
	if (!organismEntries.length) {
		holder
			.append('div')
			.attr('class', 'sja_sharp_border')
			.style('padding', '8px')
			.text('No proteome organisms available.')
		return {
			getSelected: () => ({ organism: undefined, assay: undefined, cohort: undefined })
		}
	}

	const initialProteomeDetails = selectedProteomeDetails || {}

	const organismRadioName = `sjpp-proteome-organism-${Math.random().toString().slice(-6)}`
	const assayRadioName = `sjpp-proteome-assay-${Math.random().toString().slice(-6)}`
	const cohortRadioName = `sjpp-proteome-cohort-${Math.random().toString().slice(-6)}`

	let selectedOrganism = organisms[initialProteomeDetails.organism || '']
		? initialProteomeDetails.organism
		: organismEntries[0][0]
	let selectedAssay = initialProteomeDetails.assay
	let selectedCohort = initialProteomeDetails.cohort

	holder
		.append('div')
		.style('margin', '3px 5px')
		.style('padding', '3px 5px')
		.style('font-weight', 600)
		.text(organismTitle)
	const organismListDiv = holder.append('div').style('margin-bottom', '10px')

	holder.append('div').style('margin', '3px 5px').style('padding', '3px 5px').style('font-weight', 600).text(assayTitle)
	const assayListDiv = holder.append('div').style('margin-bottom', '10px')

	holder
		.append('div')
		.style('margin', '3px 5px')
		.style('padding', '3px 5px')
		.style('font-weight', 600)
		.text(cohortTitle)
	const cohortListDiv = holder
		.append('div')
		.style('max-height', '300px')
		.style('overflow-y', 'auto')
		.style('border', '1px solid #ddd')
		.style('border-radius', '4px')
		.style('padding', '5px')

	for (const [organismKey] of organismEntries) {
		const organismLabel = organismListDiv
			.append('label')
			.attr('class', 'sja_sharp_border')
			.style('display', 'block')
			.style('cursor', 'pointer')
			.style('padding', '6px 8px')
			.style('border-radius', '4px')

		organismLabel
			.append('input')
			.attr('type', 'radio')
			.attr('name', organismRadioName)
			.attr('value', organismKey)
			.property('checked', organismKey === selectedOrganism)
			.style('margin-right', '6px')
			.on('change', () => {
				selectedOrganism = organismKey
				selectedAssay = undefined
				selectedCohort = undefined
				renderAssayOptions()
				renderCohortOptions()
				onChange?.({ organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort })
			})
		organismLabel.append('span').text(organismKey)
	}

	renderAssayOptions()
	renderCohortOptions()
	onChange?.({ organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort })

	return {
		getSelected: () => ({ organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort })
	}

	function renderAssayOptions() {
		assayListDiv.selectAll('*').remove()
		const assays = organisms[selectedOrganism || '']?.assays || {}
		const assayEntries = Object.entries(assays)
		if (!assayEntries.length) {
			selectedAssay = undefined
			selectedCohort = undefined
			assayListDiv.append('div').attr('class', 'sja_sharp_border').style('padding', '8px').text('No assays available.')
			return
		}

		if (!selectedAssay || !assays[selectedAssay]) {
			selectedAssay = assayEntries.some(([k]) => k === initialProteomeDetails.assay)
				? initialProteomeDetails.assay
				: assayEntries[0][0]
		}

		for (const [assayKey] of assayEntries) {
			const assayLabel = assayListDiv
				.append('label')
				.attr('class', 'sja_sharp_border')
				.style('display', 'block')
				.style('cursor', 'pointer')
				.style('padding', '6px 8px')
				.style('border-radius', '4px')

			assayLabel
				.append('input')
				.attr('type', 'radio')
				.attr('name', assayRadioName)
				.attr('value', assayKey)
				.property('checked', assayKey === selectedAssay)
				.style('margin-right', '6px')
				.on('change', () => {
					selectedAssay = assayKey
					selectedCohort = undefined
					renderCohortOptions()
					onChange?.({ organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort })
				})
			assayLabel.append('span').text(assayKey)
		}
	}

	function renderCohortOptions() {
		cohortListDiv.selectAll('*').remove()
		const cohorts = Object.keys(organisms[selectedOrganism || '']?.assays?.[selectedAssay || '']?.cohorts || {})
		if (!cohorts.length) {
			selectedCohort = undefined
			cohortListDiv
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '8px')
				.text('No cohorts available.')
			return
		}

		if (
			!selectedCohort ||
			!organisms[selectedOrganism || '']?.assays?.[selectedAssay || '']?.cohorts?.[selectedCohort]
		) {
			selectedCohort = cohorts.includes(initialProteomeDetails.cohort || '')
				? initialProteomeDetails.cohort
				: cohorts[0]
		}

		for (const cohortKey of cohorts) {
			const cohortLabel = cohortListDiv
				.append('label')
				.attr('class', 'sja_sharp_border')
				.style('display', 'block')
				.style('cursor', 'pointer')
				.style('padding', '6px 8px')
				.style('border-radius', '4px')
			cohortLabel
				.append('input')
				.attr('type', 'radio')
				.attr('name', cohortRadioName)
				.attr('value', cohortKey)
				.property('checked', cohortKey === selectedCohort)
				.style('margin-right', '6px')
				.on('change', () => {
					selectedCohort = cohortKey
					onChange?.({ organism: selectedOrganism, assay: selectedAssay, cohort: selectedCohort })
				})

			cohortLabel.append('span').text(cohortKey)
		}
	}
}

export function makeChartBtnMenu(holder: any, chartsInstance: any): void {
	chartsInstance.dom.tip.clear()
	const organisms = chartsInstance.state.termdbConfig?.queries?.proteome?.organisms || {}
	const menuDiv = holder.append('div')

	let selectedProteomeDetails: Partial<ProteomeDetails> | undefined

	const toolsBtnHolder = menuDiv.append('div').style('text-align', 'center')
	const toolsBtn = toolsBtnHolder
		.append('button')
		.attr('class', 'sjpp_apply_btn sja_filter_tag_btn sja_sharp_border')
		.style('display', 'block')
		.style('margin', '10px auto 10px')
		.text('Analytics Tools')
		.on('click', () => {
			const current = selectedProteomeDetails
			if (!current?.organism || !current.assay || !current.cohort) return
			chartsInstance.dom.tip.hide()
			chartsInstance.prepPlot({
				config: {
					chartType: 'ProteomeInput',
					proteomeDetails: { organism: current.organism, assay: current.assay, cohort: current.cohort },
					hidePlotFilter: true
				}
			})
		})

	const syncButtonState = () => {
		if (selectedProteomeDetails?.cohort) toolsBtn.style('opacity', 1).style('pointer-events', 'auto')
		else toolsBtn.style('opacity', 0.5).style('pointer-events', 'none')
	}

	renderAssayAndCohortRadios({
		holder: menuDiv,
		organisms,
		onChange: details => {
			selectedProteomeDetails = details
			syncButtonState()
		}
	})

	syncButtonState()
}

export function toTvslstFilter(filterConfig: any): any {
	if (filterConfig && Array.isArray(filterConfig) && filterConfig.length)
		return {
			type: 'tvslst',
			in: true,
			join: filterConfig.length > 1 ? 'and' : '',
			lst: filterConfig.map((tvs: any) => ({ type: 'tvs', tvs }))
		}
}
