import type { SCViewer } from '../SC'
import { newSandboxDiv } from '#dom'
import { dynamicSubplotInit } from './DynamicSubplot'
import type { SCActiveSubplot, SCSampleSandbox } from '../SCTypes'

/** Instead of managing multiple maps of the subplots (e.g within the 
 * SampleTableRenderer, SectionRenderer, etc.), use this manager to keep track
 * of all the subplots, their dom, sections, etc. 
 * 
 * Note: In this future, this can be reuseable by changing this.sc to this.parentPlot
 * 
 * TODO: 
 * - Need to delete subplots by sample when filtering removes the sample.
 * - Tie into both the viewModel for the tableData and view. 
 *      - Should use the manager here to decide plot buttons in the sample table renderer
 *     - The manager should also handle passing the correct section info to the subplots 
 *      within the section renderer
) */

export class SubplotManager {
	sc: SCViewer
	scCompPlots: { [key: string]: any }
	records: Map<string, SCActiveSubplot>

	constructor(sc: SCViewer) {
		this.sc = sc
		this.scCompPlots = this.sc.components.plots
		this.records = new Map()
	}

	map(subplots: any[]): SCActiveSubplot[] {
		const subplotIds = new Set(subplots.map(s => s.id))
		for (const compPlotId of Object.keys(this.scCompPlots)) {
			if (!subplotIds.has(compPlotId)) {
				this.removeSubplot(compPlotId)
			}
		}

		for (const recordId of Array.from(this.records.keys())) {
			if (!subplotIds.has(recordId)) this.records.delete(recordId)
		}

		for (const subplot of subplots) {
			this.initSubplot(subplot)
		}

		return this.getActiveSubplotsFlat()
	}

	initSubplot(subplot) {
		const existing = this.records.get(subplot.id)
		this.records.set(subplot.id, {
			plotId: subplot.id,
			sampleId: this.getSampleId(subplot),
			plotName: this.getPlotName(subplot),
			sectionKey: existing?.sectionKey,
			subplot,
			sandboxDiv: existing?.sandboxDiv
		})
	}

	removeSubplot(subplotId) {
		if (this.scCompPlots[subplotId]) this.scCompPlots[subplotId].destroy()
		delete this.scCompPlots[subplotId]
		this.records.delete(subplotId)
	}

	async initSubplotSandbox(sandboxHolder, subplot) {
		const sandbox = newSandboxDiv(sandboxHolder, {
			close: () => {
				/** destroy this dom and component before app.dispatch.
				 * Avoids the component attempting to update after
				 * the plot is deleted from the state. */
				this.removeSubplot(subplot.id)
				this.sc.app.dispatch({
					type: 'plot_delete',
					id: subplot.id,
					parentId: this.sc.id
				})
			},
			plotId: subplot.id
		})

		const opts = Object.assign({}, subplot, {
			app: this.sc.app,
			parentId: this.sc.id,
			id: subplot.id,
			holder: sandbox
		})

		// /** Summary is expecting entire sandbox object. Most other plots
		//  * expect the header and the holder (i.e. body).*/
		// if (subplot.chartType == 'summary') {
		//     opts.holder = sandbox
		// } else {
		//     opts.holder = sandbox.body
		//     opts.header = sandbox.header
		// }
		// await this.sc.initPlotComponent(subplot.id, opts)
		return await dynamicSubplotInit(opts)
	}

	setSandbox(plotId: string, sandboxDiv: any) {
		const record = this.records.get(plotId)
		if (!record) return
		record.sandboxDiv = sandboxDiv
		this.records.set(plotId, record)
	}

	setSectionKey(plotId: string, sectionKey?: string) {
		const record = this.records.get(plotId)
		if (!record) return
		record.sectionKey = sectionKey
		this.records.set(plotId, record)
	}

	getActiveSubplotsFlat(): SCActiveSubplot[] {
		return Array.from(this.records.values())
	}

	getSampleId(subplot: any): string | undefined {
		return subplot.sample?.sID || subplot.singleCellPlot?.sample?.sID || subplot.term?.term?.sample?.sID
	}

	getPlotName(subplot: any): string {
		let plotName = subplot?.plotName || subplot?.singleCellPlot?.name
		if (!plotName) {
			if (subplot.chartType === 'dictionary') plotName = 'Summary'
			else if (subplot.chartType === 'summary') plotName = 'Summary'
			else if (subplot.chartType === 'GeneExpInput') plotName = 'Gene expression'
			else if (subplot?.term?.term?.plot) plotName = subplot.term.term.plot
			else plotName = subplot.chartType || 'Plot'
		}
		return plotName
	}

	getSampleSandboxes(activeSubplots: SCActiveSubplot[] = this.getActiveSubplotsFlat()): Map<string, SCSampleSandbox[]> {
		const sandboxes = new Map<string, SCSampleSandbox[]>()
		for (const active of activeSubplots) {
			if (!active.sampleId || !active.sandboxDiv) continue
			if (!sandboxes.has(active.sampleId)) sandboxes.set(active.sampleId, [])
			sandboxes.get(active.sampleId)!.push({ plotId: active.plotId, div: active.sandboxDiv, plotName: active.plotName })
		}
		return sandboxes
	}

	activeSandboxes(activeSubplots: SCActiveSubplot[] = this.getActiveSubplotsFlat()) {
		return this.getSampleSandboxes(activeSubplots)
	}
}
