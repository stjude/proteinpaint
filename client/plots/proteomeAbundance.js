import { NumericModes } from '#shared/terms.js'

export function renderAssayAndCohortRadios({
	holder,
	organisms,
	selectedProteomeDetails,
	onChange,
	organismTitle = 'Organism',
	assayTitle = 'Assay Type',
	cohortTitle = 'Cohort'
}) {
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

	let selectedOrganism = organisms[initialProteomeDetails.organism]
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
		const assays = organisms[selectedOrganism]?.assays || {}
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
		const cohorts = Object.keys(organisms[selectedOrganism]?.assays?.[selectedAssay]?.cohorts || {})
		if (!cohorts.length) {
			selectedCohort = undefined
			cohortListDiv
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '8px')
				.text('No cohorts available.')
			return
		}

		if (!selectedCohort || !organisms[selectedOrganism]?.assays?.[selectedAssay]?.cohorts?.[selectedCohort]) {
			selectedCohort = cohorts.includes(initialProteomeDetails.cohort) ? initialProteomeDetails.cohort : cohorts[0]
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

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const organisms = chartsInstance.state.termdbConfig?.queries?.proteome?.organisms || {}
	const menuDiv = holder.append('div')

	let selectedProteomeDetails
	let launchOption

	const syncLaunchButtonState = () => {
		if (!launchOption) return
		if (selectedProteomeDetails?.cohort) launchOption.style('opacity', 1).style('pointer-events', 'auto')
		else launchOption.style('opacity', 0.5).style('pointer-events', 'none')
	}

	renderAssayAndCohortRadios({
		holder: menuDiv,
		organisms,
		onChange: proteomeDetails => {
			selectedProteomeDetails = proteomeDetails
			syncLaunchButtonState()
		}
	})

	launchOption = menuDiv
		.append('button')
		.attr('class', 'sjpp_apply_btn sja_filter_tag_btn sja_sharp_border')
		.style('display', 'block')
		.style('margin', '10px auto 10px')
		.text('Select Protein')
		.on('click', () => {
			if (!selectedProteomeDetails?.cohort) return
			const { organism, assay, cohort } = selectedProteomeDetails
			const assayCohortTitle = `${assay}: ${cohort}`
			const chart = {
				label: 'Protein Abundance',
				chartType: 'proteomeAbundance',
				usecase: {
					target: 'proteomeAbundance',
					detail: 'term',
					proteomeDetails: { organism, assay, cohort },
					label: `Organism: ${organism}; Assay: ${assay}; Cohort: ${cohort}`
				},
				processSelection: termlst => termlst,
				updateActionBySelectedTerms: (action, termlst) => {
					action.config.assayCohortTitle = assayCohortTitle
					const { organism, assay, cohort } = selectedProteomeDetails
					action.config.proteomeDetails = { organism, assay, cohort }
					const twlst = termlst.map(term => {
						const t = structuredClone(term)
						t.proteomeDetails = { organism, assay, cohort }
						return { term: t, q: { mode: NumericModes.continuous } }
					})

					if (twlst.length == 1) {
						action.config.chartType = 'summary'
						action.config.term = twlst[0]
						const proteomeOverlayTerm =
							chartsInstance.state.termdbConfig?.queries?.proteome?.organisms?.[organism]?.overlayTerm
						if (proteomeOverlayTerm) action.config.term2 = { term: structuredClone(proteomeOverlayTerm), q: {} }
						return
					}
					if (twlst.length == 2) {
						action.config.chartType = 'summary'
						action.config.term = twlst[0]
						action.config.term2 = twlst[1]
						return
					}

					action.config.chartType = 'hierCluster'
					action.config.dataType = 'proteomeAbundance'
					action.config.termgroups = [{ name: 'Protein Abundance Cluster', lst: twlst, type: 'hierCluster' }]
				}
			}
			chartsInstance.dom.tip.clear()
			chartsInstance.showTree_selectlst(chart)
		})

	syncLaunchButtonState()
}

export function toTvslstFilter(filterConfig) {
	if (filterConfig && Array.isArray(filterConfig) && filterConfig.length)
		return {
			type: 'tvslst',
			in: true,
			join: filterConfig.length > 1 ? 'and' : '',
			lst: filterConfig.map(tvs => ({ type: 'tvs', tvs }))
		}
}
