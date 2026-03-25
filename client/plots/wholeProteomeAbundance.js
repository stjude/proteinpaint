import { NumericModes } from '#shared/terms.js'

export function renderAssayAndCohortRadios({
	holder,
	assays,
	selectedAssayKey,
	selectedCohortKey,
	onChange,
	assayTitle = 'Assay Type',
	cohortTitle = 'Cohort'
}) {
	const assayEntries = Object.entries(assays || {})
	if (!assayEntries.length) {
		holder.append('div').attr('class', 'sja_sharp_border').style('padding', '8px').text('No proteome assays available.')
		return {
			getSelected: () => ({ assayKey: undefined, cohortKey: undefined })
		}
	}

	const assayRadioName = `sjpp-proteome-assay-${Math.random().toString().slice(-6)}`
	const cohortRadioName = `sjpp-proteome-cohort-${Math.random().toString().slice(-6)}`

	let selectedAssay = assays[selectedAssayKey] ? selectedAssayKey : assayEntries[0][0]
	let selectedCohort = selectedCohortKey

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
				onChange?.({ assayKey: selectedAssay, cohortKey: selectedCohort })
			})
		assayLabel.append('span').text(assayKey)
	}

	renderCohortOptions()
	onChange?.({ assayKey: selectedAssay, cohortKey: selectedCohort })

	return {
		getSelected: () => ({ assayKey: selectedAssay, cohortKey: selectedCohort })
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
			selectedCohort = cohorts.includes(selectedCohortKey) ? selectedCohortKey : cohorts[0]
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
					onChange?.({ assayKey: selectedAssay, cohortKey: selectedCohort })
				})

			cohortLabel.append('span').text(cohortKey)
		}
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const assays = chartsInstance.state.termdbConfig?.queries?.proteome?.assays || {}
	const menuDiv = holder.append('div')

	let selectedAssayKey
	let selectedCohortKey
	let launchOption

	const syncLaunchButtonState = () => {
		if (!launchOption) return
		if (selectedCohortKey) launchOption.style('opacity', 1).style('pointer-events', 'auto')
		else launchOption.style('opacity', 0.5).style('pointer-events', 'none')
	}

	renderAssayAndCohortRadios({
		holder: menuDiv,
		assays,
		onChange: ({ assayKey, cohortKey }) => {
			selectedAssayKey = assayKey
			selectedCohortKey = cohortKey
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
			if (!selectedCohortKey) return

			const chart = {
				label: 'Protein Abundance',
				chartType: 'wholeProteomeAbundance',
				usecase: {
					target: 'wholeProteomeAbundance',
					detail: 'term',
					assayKey: selectedAssayKey,
					cohortKey: selectedCohortKey,
					label: `Assay: ${selectedAssayKey}; Cohort: ${selectedCohortKey}`
				},
				processSelection: termlst => termlst,
				updateActionBySelectedTerms: (action, termlst) => {
					action.config.assayKey = selectedAssayKey
					action.config.cohortKey = selectedCohortKey
					action.config.filter = buildFilter(
						chartsInstance.state.termdbConfig.queries.proteome.assays[selectedAssayKey].cohorts[selectedCohortKey]
							.filter
					)
					const twlst = termlst.map(term => {
						const t = structuredClone(term)
						t.assayKey = selectedAssayKey
						t.cohortKey = selectedCohortKey
						return { term: t, q: { mode: NumericModes.continuous } }
					})

					if (twlst.length == 1) {
						action.config.chartType = 'summary'
						action.config.term = twlst[0]
						return
					}
					if (twlst.length == 2) {
						action.config.chartType = 'summary'
						action.config.term = twlst[0]
						action.config.term2 = twlst[1]
						return
					}

					action.config.chartType = 'hierCluster'
					action.config.dataType = 'wholeProteomeAbundance'
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
