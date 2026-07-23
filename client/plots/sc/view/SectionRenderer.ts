import type { Sections } from './Sections'
import type { Div, Elem } from '../../../types/d3'
import type { SCViewer } from '../SC'
import type { SingleCellSample } from '#types'
import type { GroupByOptions } from '../settings/Settings'

/** Manages the mapping and rendering of the sections based on the groupBy option.
 * sections{} maps the section key (i.e. sampleId, plotName, or none) to the section
 * wrapper, title, subplots div, and the sandboxes in that section.
 *
 * Initializing and destroying the plot components is within SC.ts
 * (i.e. sc.components.plots[plotId]). This ensures plots are responsive to state changes.
 */
export class SectionRenderer {
	sections: Sections
	holder: Div
	/** Maps the plotId to either the sampleId, plotName, or none (i.e. key in sections map)
	 * as a reverse lookup. Used in tandem with sections{} to manage the sandboxes
	 * within each section. */
	plotId2Key: Map<string, string>
	groupBy: (typeof GroupByOptions)[number]

	constructor(sectionsDiv: Div, groupBy: (typeof GroupByOptions)[number]) {
		this.sections = {}
		this.holder = sectionsDiv
		//Key may be either sampleId, plotName, or none
		this.plotId2Key = new Map()
		this.groupBy = groupBy
	}

	/** Send the sc with the updated state. May not be necessary long term. If not,
	 * remove and put in the constructor. */
	async update(sc: SCViewer, subplots: any, groupBy: (typeof GroupByOptions)[number]) {
		if (groupBy !== this.groupBy) {
			this.groupBy = groupBy
			this.regroupSections(sc, subplots)
			return
		}
		const activeSubplots = new Set(subplots.map(s => s.id))

		/** Reconcile stale sandbox wrappers using section state.
		 * Subplot lifecycle is managed by SubplotManager. */
		for (const plotId of Array.from(this.plotId2Key.keys())) {
			if (!activeSubplots.has(plotId)) this.removeSandbox(plotId)
		}

		for (const subplot of subplots) {
			const key = this.getKey(subplot, sc)
			if (!key) continue
			if (!this.sections[key]) this.initSection(key, sc)
			if (!this.sections[key].sandboxes[subplot.id]) {
				this.plotId2Key.set(subplot.id, key)
				sc.subplotManager.setSectionKey(subplot.id, key)
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

	/** Reparent existing sandboxes into new section containers
	 * without destroying/recreating plot components. */
	private regroupSections(sc: SCViewer, subplots: any[]) {
		// Detach existing sandbox from their parents before clearing
		const detached: Map<string, any> = new Map()
		for (const [plotId, key] of this.plotId2Key) {
			const sandboxNode = this.sections[key]?.sandboxes[plotId]
			if (sandboxNode) {
				// Remove from current parent without destroying
				sandboxNode.remove()
				detached.set(plotId, sandboxNode)
			}
		}

		// Clear the section wrappers since sandboxes are already detached
		this.holder.selectAll('*').remove()
		this.sections = {}
		this.plotId2Key = new Map()

		// Regroup into new sections, reparenting existing sandbox
		for (const subplot of subplots) {
			const key = this.getKey(subplot, sc)
			if (!key) continue
			if (!this.sections[key]) this.initSection(key, sc)

			this.plotId2Key.set(subplot.id, key)
			sc.subplotManager.setSectionKey(subplot.id, key)
			const existing = detached.get(subplot.id)
			if (existing) {
				// Reparent the existing sandbox into the new section
				this.sections[key].subplots.node()!.prepend(existing.node())
				this.sections[key].sandboxes[subplot.id] = existing
			}
		}
	}

	getKey(subplot: any, sc): string | undefined {
		if (this.groupBy === 'none') return 'none'
		if (this.groupBy === 'sample') return this.getSampleId(subplot)
		return sc.subplotManager.getPlotName(subplot)
	}

	/** Extract sID from a subplot's config.
	 * Actual subplots store sample as {sID, eID} at top level or on term.term.sample. */
	getSampleId(subplot: any): string | undefined {
		return subplot.sample?.sID || subplot.singleCellPlot?.sample?.sID || subplot.term?.term?.sample?.sID
	}

	initSection(key: string, sc: SCViewer) {
		const item = this.findSampleMetadata(key, sc)

		const titleAttrText =
			this.groupBy == 'sample' ? 'this sample section' : this.groupBy == 'plot' ? 'this plot section' : 'all plots'
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
			.attr('title', `Remove ${titleAttrText}`)
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
		if (titleText.length) {
			const arrow = titleWrapper
				.append('span')
				.style('font-size', '0.8em')
				.style('padding-left', '3px')
				.attr('title', `Show/hide plots in ${titleAttrText}`)
				.text('▼')

			titleWrapper.on('click', () => {
				const isHidden = this.sections[key].subplots.style('display') === 'none'
				this.sections[key].subplots.style('display', isHidden ? 'block' : 'none')
				arrow.text(isHidden ? '▼' : '▲')
			})
		}

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
		if (this.groupBy === 'none') return 'All plots'
		if (this.groupBy === 'plot') return key
		const caseText = item?.sample && item.sample !== key ? `Case: ${item.sample}` : ''
		const isMeta = item?.isMetaResult || false
		const itemText = `${isMeta ? '' : 'Sample: '}${key}`
		const projectText = item?.['project id'] ? `Project: ${item['project id']}` : ''
		return [itemText, caseText, projectText].filter(Boolean).join(' ')
	}

	async initSandbox(sc: any, subplot: any, key: string) {
		const sandboxHolder = this.sections[key].subplots
			.insert('div', ':first-child')
			.attr('data-testid', `sjpp-sc-sandbox-${subplot.id}`) as any as Elem

		const sandboxDiv = await sc.subplotManager.initSubplotSandbox(sandboxHolder, subplot, {
			sectionKey: key
		})
		this.sections[key].sandboxes[subplot.id] = sandboxDiv
	}

	removeSection(key: string, sc: SCViewer) {
		const subactions: { type: string; id: string; parentId: string }[] = []
		for (const plotId of Object.keys(this.sections[key].sandboxes || {})) {
			this.removeSandbox(plotId, key)
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

	removeSandbox(plotId: string, _key?: string) {
		const key = _key || this.plotId2Key.get(plotId)
		if (!key) return
		const section = this.sections[key]
		const sandbox = section?.sandboxes?.[plotId]
		if (sandbox) sandbox.remove()
		if (section?.sandboxes?.[plotId]) delete section.sandboxes[plotId]
		//Remove the reference to the plotId in plot2Sample map to avoid memory leak
		this.plotId2Key.delete(plotId)
	}
}
