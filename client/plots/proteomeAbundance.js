import { NumericModes } from '#shared/terms.js'

export function renderAssayAndCohortRadios({
	holder,
	assays,
	selectedProteomeDetails,
	onChange,
	assayTitle = 'Assay Type',
	cohortTitle = 'Cohort'
}) {
	const assayEntries = Object.entries(assays || {})
	if (!assayEntries.length) {
		holder.append('div').attr('class', 'sja_sharp_border').style('padding', '8px').text('No proteome assays available.')
		return {
			getSelected: () => ({ assay: undefined, cohort: undefined })
		}
	}

	const initialProteomeDetails = selectedProteomeDetails || {}

	const assayRadioName = `sjpp-proteome-assay-${Math.random().toString().slice(-6)}`
	const cohortRadioName = `sjpp-proteome-cohort-${Math.random().toString().slice(-6)}`

	let selectedAssay = assays[initialProteomeDetails.assay] ? initialProteomeDetails.assay : assayEntries[0][0]
	let selectedCohort = initialProteomeDetails.cohort

	holder.append('div').style('margin', '3px 5px').style('padding', '3px 5px').style('font-weight', 600).text(assayTitle)
	const assayListDiv = holder.append('div').style('margin-bottom', '10px')

	holder
		.append('div')
		.style('margin', '3px 5px')
		.style('padding', '3px 5px')
		.style('font-weight', 600)
		.text(cohortTitle)
	const cohortListDiv = holder.append('div')

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
				onChange?.({ assay: selectedAssay, cohort: selectedCohort })
			})
		assayLabel.append('span').text(assayKey)
	}

	renderCohortOptions()
	onChange?.({ assay: selectedAssay, cohort: selectedCohort })

	return {
		getSelected: () => ({ assay: selectedAssay, cohort: selectedCohort })
	}

	function renderCohortOptions() {
		cohortListDiv.selectAll('*').remove()
		const cohorts = Object.keys(assays[selectedAssay]?.cohorts || {})
		if (!cohorts.length) {
			selectedCohort = undefined
			cohortListDiv
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '8px')
				.text('No cohorts available.')
			return
		}

		if (!selectedCohort || !assays[selectedAssay]?.cohorts?.[selectedCohort]) {
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
					onChange?.({ assay: selectedAssay, cohort: selectedCohort })
				})

			cohortLabel.append('span').text(cohortKey)
		}
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const assays = chartsInstance.state.termdbConfig?.queries?.proteome?.assays || {}
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
		assays,
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
			const { assay, cohort } = selectedProteomeDetails
			const assayCohortTitle = `${assay}: ${cohort}`
			const chart = {
				label: 'Protein Abundance',
				chartType: 'proteomeAbundance',
				usecase: {
					target: 'proteomeAbundance',
					detail: 'term',
					proteomeDetails: { assay, cohort },
					label: `Assay: ${assay}; Cohort: ${cohort}`
				},
				processSelection: termlst => termlst,
				updateActionBySelectedTerms: (action, termlst) => {
					action.config.assayCohortTitle = assayCohortTitle
					const { assay, cohort } = selectedProteomeDetails
					action.config.proteomeDetails = { assay, cohort }
					const cohortSelected = chartsInstance.state.termdbConfig.queries.proteome.assays[assay].cohorts[cohort]
					if (cohortSelected.filter) action.config.filter = buildFilter(cohortSelected.filter)
					const twlst = termlst.map(term => {
						const t = structuredClone(term)
						t.proteomeDetails = { assay, cohort }
						return { term: t, q: { mode: NumericModes.continuous } }
					})

					if (twlst.length == 1) {
						action.config.chartType = 'summary'
						action.config.term = twlst[0]
						if (cohortSelected.overlayTerm) action.config.term2 = { term: structuredClone(cohortSelected.overlayTerm) }
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

function buildFilter(filterConfig) {
	if (!filterConfig) return
	const lst = []
	for (const filterTvs of filterConfig) {
		lst.push({
			type: 'tvs',
			tvs: filterTvs
		})
	}
	return {
		type: 'tvslst',
		in: true,
		join: lst.length > 1 ? 'and' : '',
		lst
	}
}
