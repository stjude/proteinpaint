import { renderAssayAndCohortRadios } from './proteomeAbundance.ts'
import { getDefaultVolcanoSettings } from './volcano/settings/defaults.ts'
import { getDefaultGseaSettings } from './gsea.js'
import { PROTEOME_DAP } from '#shared/terms.js'
import type { ProteomeDetails } from '#types'

export function makeChartBtnMenu(holder: any, chartsInstance: any): void {
	chartsInstance.dom.tip.clear()
	const organisms = chartsInstance.state.termdbConfig?.queries?.proteome?.organisms || {}
	const menuDiv = holder.append('div')

	let selectedProteomeDetails: Partial<ProteomeDetails> | undefined

	const launchBtn = menuDiv
		.append('button')
		.attr('class', 'sjpp_apply_btn sja_filter_tag_btn sja_sharp_border')
		.style('display', 'block')
		.style('margin', '10px auto 10px')
		.text('Launch Volcano')
		.on('click', () => {
			if (!selectedProteomeDetails?.organism || !selectedProteomeDetails?.assay || !selectedProteomeDetails?.cohort)
				return
			const { organism, assay, cohort } = selectedProteomeDetails

			chartsInstance.dom.tip.hide()
			chartsInstance.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'differentialAnalysis',
					childType: 'volcano',
					termType: PROTEOME_DAP,
					headerText: `${organism} ${assay}: ${cohort}`,
					proteomeDetails: { organism, assay, cohort },
					settings: {
						volcano: getDefaultVolcanoSettings({}, { termType: PROTEOME_DAP }),
						gsea: getDefaultGseaSettings({})
					},
					highlightedData: [],
					hidePlotFilter: true
				}
			})
		})

	const syncLaunchButtonState = () => {
		const hasDap =
			selectedProteomeDetails?.cohort &&
			organisms[selectedProteomeDetails?.organism || '']?.assays?.[selectedProteomeDetails?.assay || '']?.cohorts?.[
				selectedProteomeDetails.cohort
			]?.DAPfile
		if (hasDap) launchBtn.style('opacity', 1).style('pointer-events', 'auto')
		else launchBtn.style('opacity', 0.5).style('pointer-events', 'none')
	}

	renderAssayAndCohortRadios({
		holder: menuDiv,
		organisms,
		onChange: details => {
			selectedProteomeDetails = details
			syncLaunchButtonState()
		}
	})

	syncLaunchButtonState()
}
