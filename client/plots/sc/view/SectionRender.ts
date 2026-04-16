import type { Sections } from '../SCTypes'
import type { Div } from '../../../types/d3'
import { newSandboxDiv } from '#dom'
import type { SCViewer } from '../SC'

export class SectionRender {
	sections: Sections
	holder: Div
	plot2Sample: Map<string, string>

	constructor(sectionsDiv: Div) {
		this.sections = {}
		this.holder = sectionsDiv
		this.plot2Sample = new Map()
	}

	//Send the sc with the updated state
	async update(sc: SCViewer, subplots: any) {
		const activeSubplots = new Set(subplots.map(s => s.id))

		/** Repeat the destory from the close button, as mass/app.ts
		 * cannot remove components from within a parent plot */
		for (const plotId of Object.keys(sc.components.plots)) {
			if (!activeSubplots.has(plotId)) {
				this.removeSandbox(plotId, sc)
			}
		}

		for (const subplot of subplots) {
			const item = subplot.scItem || subplot?.term?.term?.sample
			const sampleId = item.sample || item.sID
			if (!this.sections[sampleId]) this.initSection(sampleId, item)
			if (!this.sections[sampleId].sandboxes[subplot.id]) {
				this.plot2Sample.set(subplot.id, sampleId)
				await this.initSandbox(sc, subplot, sampleId)
			}
		}

		/** Remove sections after iterating through subplots to avoid
		 * deleting sections before they can be re-rendered with the correct plots */
		for (const sampleId of Object.keys(this.sections)) {
			if (Object.keys(this.sections[sampleId].sandboxes).length === 0) {
				this.removeSection(sampleId)
			}
		}
	}

	initSection(sampleId: string, item: any) {
		const sectionWrapper = this.holder
			.insert('div', ':first-child')
			.style('padding', '10px')
			.attr('data-testid', `sjpp-sc-section-wrapper-${sampleId}`)

		//delete section btn
		sectionWrapper
			.append('span')
			.attr('data-testid', `sjpp-sc-section-remove-btn-${sampleId}`)
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
				this.removeSection(sampleId)
			})

		const titleText = this.makeSectionTitleText(sampleId, item)
		const titleWrapper = sectionWrapper.append('span').style('font-weight', 600).style('opacity', 0.7).text(titleText)

		const arrow = titleWrapper
			.append('span')
			.style('font-size', '0.8em')
			.style('padding-left', '3px')
			.attr('title', 'Show or hide plots for this sample')
			.text('▼')

		titleWrapper.on('click', () => {
			const isHidden = this.sections[sampleId].subplots.style('display') === 'none'
			this.sections[sampleId].subplots.style('display', isHidden ? 'block' : 'none')
			arrow.text(isHidden ? '▼' : '▲')
		})

		this.sections[sampleId] = {
			sectionWrapper,
			title: titleWrapper,
			subplots: sectionWrapper.append('div').attr('data-testid', `sjpp-sc-subplots-${sampleId}`),
			sandboxes: {}
		}
	}

	//This needs to be ds specific. Placeholder for now
	makeSectionTitleText(sampleId: string, item: any) {
		const caseText = item.case ? `Case: ${item.case}` : ''
		const itemText = `Sample: ${sampleId}` //item.cell, etc.
		const projectText = item['project id'] ? `Project: ${item['project id']}` : ''
		return [itemText, caseText, projectText].join(' ')
	}

	async initSandbox(sc: any, subplot: any, sampleId: string) {
		const sandboxHolder = this.sections[sampleId].subplots
			.insert('div', ':first-child')
			.attr('data-testid', `sjpp-sc-sandbox-${subplot.id}`)

		const sandbox = newSandboxDiv(sandboxHolder, {
			close: () => {
				//Delete the component before calling dispatch
				//Prevents main attempting to re-init the component
				//Remove the reference to the plotId in plot2Sample map to avoid memory leak
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
		this.sections[sampleId].sandboxes[subplot.id] = sandbox.app_div
	}

	removeSection(sampleId: string) {
		this.sections[sampleId].sectionWrapper.remove()
		delete this.sections[sampleId]
	}

	removeSandbox(plotId: string, sc: SCViewer) {
		sc.removeComponent(plotId)
		const sampleId = this.plot2Sample.get(plotId)
		if (sampleId) {
			this.sections[sampleId].sandboxes[plotId].remove()
			delete this.sections[sampleId].sandboxes[plotId]
			this.plot2Sample.delete(plotId)
		}
	}
}
