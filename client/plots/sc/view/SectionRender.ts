import type { Sections } from './Sections'
import type { Div } from '../../../types/d3'
import { newSandboxDiv } from '#dom'
import type { SCViewer } from '../SC'
import type { SingleCellSample } from '#types'

export class SectionRender {
	sections: Sections
	holder: Div
	/** Maps the plotId to either the sampleId or plotName (i.e. key in secions map)
	 * as a reverse lookup. */
	plotId2Key: Map<string, string>
	groupBy: string | undefined

	constructor(sectionsDiv: Div) {
		this.sections = {}
		this.holder = sectionsDiv
		//Key may be either sampleId or plotName
		this.plotId2Key = new Map()
		this.groupBy = undefined
	}

	//Send the sc with the updated state
	async update(sc: SCViewer, subplots: any, groupBy: 'none' | 'sample' | 'plot') {
		if (groupBy !== this.groupBy) {
			this.groupBy = groupBy
			//Reset sections and plotId2Key map when groupBy changes as the keys will be different
			//TODO: evaluate if there's a more performant way to update sections when
			//groupBy changes without needing to re-render all the sections and sandboxes
			this.sections = {}
			this.plotId2Key = new Map()
		}
		const activeSubplots = new Set(subplots.map(s => s.id))

		/** Repeat the destory from the close button, as mass/app.ts
		 * cannot remove components from within a parent plot */
		for (const plotId of Object.keys(sc.components.plots)) {
			if (!activeSubplots.has(plotId)) {
				this.removeSandbox(plotId, sc)
			}
		}

		for (const subplot of subplots) {
			const key = groupBy == 'sample' ? this.getSampleId(subplot) : this.getPlotName(subplot)
			if (!key) continue
			if (!this.sections[key]) this.initSection(key, sc)
			if (!this.sections[key].sandboxes[subplot.id]) {
				this.plotId2Key.set(subplot.id, key)
				await this.initSandbox(sc, subplot, key)
			}
		}

		/** Remove sections after iterating through subplots to avoid
		 * deleting sections before they can be re-rendered with the correct plots */
		for (const key of Object.keys(this.sections)) {
			if (Object.keys(this.sections[key].sandboxes).length === 0) {
				this.removeSection(key, sc)
			}
		}
	}

	/** Extract sID from a subplot's config.
	 * Actual subplots store sample as {sID, eID} at top level or on term.term.sample. */
	getSampleId(subplot: any): string | undefined {
		return subplot.sample?.sID || subplot.singleCellPlot?.sample?.sID || subplot.term?.term?.sample?.sID
	}

	getPlotName(subplot: any): string {
		let plotName = subplot?.plotName || subplot?.singleCellPlot?.name || subplot?.term?.term?.plot
		if (!plotName) {
			/** Harcoding logic for some transient and parent plots for now. May consider
			 * adding to the config if this becomes more complex. Must weight against
			 * adding unnecessary complexity to the config for edge cases though.*/
			if (subplot.chartType === 'dictionary') plotName = 'Summary'
			if (subplot.chartType === 'summary') plotName = 'Summary'
			if (subplot.chartType === 'GeneExpInput') plotName = 'Gene expression'
		}
		return plotName
	}

	initSection(key: string, sc: SCViewer) {
		const item = this.findSampleMetadata(key, sc)
		const sectionWrapper = this.holder
			.insert('div', ':first-child')
			.style('padding', '10px')
			.attr('data-testid', `sjpp-sc-section-wrapper-${key}`)

		//delete section btn
		sectionWrapper
			.append('span')
			.attr('data-testid', `sjpp-sc-section-remove-btn-${key}`)
			.style('margin', '0px 5px')
			.style('cursor', 'pointer')
			.attr('title', 'Remove all plots for this sample')
			.html(
				`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#000" class="bi bi-x-lg" viewBox="0 0 12 12">
                <path
                    stroke="#000"
                    transform="scale(0.75)"
                    d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>`
			)
			.on('click', () => {
				this.removeSection(key, sc)
			})

		const titleText = this.makeSectionTitleText(key, item)
		const titleWrapper = sectionWrapper.append('span').style('font-weight', 600).style('opacity', 0.7).text(titleText)

		const arrow = titleWrapper
			.append('span')
			.style('font-size', '0.8em')
			.style('padding-left', '3px')
			.attr('title', 'Show or hide plots for this sample')
			.text('▼')

		titleWrapper.on('click', () => {
			const isHidden = this.sections[key].subplots.style('display') === 'none'
			this.sections[key].subplots.style('display', isHidden ? 'block' : 'none')
			arrow.text(isHidden ? '▼' : '▲')
		})

		this.sections[key] = {
			sectionWrapper,
			title: titleWrapper,
			subplots: sectionWrapper.append('div').attr('data-testid', `sjpp-sc-subplots-${key}`),
			sandboxes: {}
		}
	}

	/** Look up sample metadata from the fetched items list.
	 * For experiment datasets, matches sID against experiments[].sampleName.
	 * For non-experiment datasets, matches sID against item.sample. */
	findSampleMetadata(sampleId: string, sc: SCViewer): SingleCellSample | undefined {
		if (!sc.items) return undefined
		return sc.items.find(item => item.sample === sampleId || item.experiments?.some(e => e.sampleName === sampleId))
	}

	makeSectionTitleText(key: string, item?: SingleCellSample) {
		if (this.groupBy === 'plot') return key
		const caseText = item?.sample && item.sample !== key ? `Case: ${item.sample}` : ''
		const itemText = `Sample: ${key}`
		const projectText = item?.['project id'] ? `Project: ${item['project id']}` : ''
		return [itemText, caseText, projectText].filter(Boolean).join(' ')
	}

	async initSandbox(sc: any, subplot: any, key: string) {
		const sandboxHolder = this.sections[key].subplots
			.insert('div', ':first-child')
			.attr('data-testid', `sjpp-sc-sandbox-${subplot.id}`)

		const sandbox = newSandboxDiv(sandboxHolder, {
			close: () => {
				//Delete the component before calling dispatch
				//Prevents main attempting to re-init the component
				this.removeSandbox(subplot.id, sc)
				sc.app.dispatch({
					type: 'plot_delete',
					id: subplot.id,
					parentId: sc.id
				})
			},
			plotId: subplot.id
		})

		const opts = Object.assign({}, subplot, {
			app: sc.app,
			parentId: sc.id,
			id: subplot.id
		})

		/** Summary is expecting entire sandbox object. Most other plots
		 * expect the header and the holder (i.e. body).*/
		if (subplot.chartType == 'summary') {
			opts.holder = sandbox
		} else {
			opts.holder = sandbox.body
			opts.header = sandbox.header
		}

		await sc.initPlotComponent(subplot.id, opts)
		this.sections[key].sandboxes[subplot.id] = sandbox.app_div
	}

	removeSection(key: string, sc: SCViewer) {
		const subactions: { type: string; id: string; parentId: string }[] = []
		for (const plotId of Object.keys(this.sections[key].sandboxes || {})) {
			this.removeSandbox(plotId, sc, key)
			/** Need to remove plots from the state to prevent main from re-rendering
			 * and memory leak from orphaned components after the section is deleted. */
			subactions.push({
				type: 'plot_delete',
				id: plotId,
				parentId: sc.id
			})
		}
		if (subactions.length > 0) {
			sc.app.dispatch({
				type: 'app_refresh',
				subactions
			})
		}
		this.sections[key].sectionWrapper.remove()
		delete this.sections[key]
	}

	removeSandbox(plotId: string, sc: SCViewer, _key?: string) {
		sc.removeComponent(plotId)
		const key = _key || this.plotId2Key.get(plotId)
		if (!key) return
		this.sections[key].sandboxes[plotId].remove()
		delete this.sections[key].sandboxes[plotId]
		//Remove the reference to the plotId in plot2Sample map to avoid memory leak
		this.plotId2Key.delete(plotId)
	}
}
