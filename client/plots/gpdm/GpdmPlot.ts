import { sayerror } from '#dom'
import { GpdmModel } from './GpdmModel'
import { GpdmView } from './GpdmView'
import type { GpdmOpts, GpdmDom } from './GpdmTypes'

/**
 * Standalone GPDM (Gaussian Process Differential Methylation) visualization.
 * Launched from the diffMeth volcano plot when a user clicks on a DM promoter
 * to drill down to probe-level GP analysis.
 *
 * Expected to be rendered inside a PP sandbox (created by the caller).
 */
export class GpdmPlot {
	opts: GpdmOpts
	dom: GpdmDom

	constructor(opts: GpdmOpts) {
		this.opts = opts
		this.dom = this.initDom()
		this.run()
	}

	private initDom(): GpdmDom {
		const holder = this.opts.holder
		const error = holder.append('div').style('color', 'red')
		const wait = holder
			.append('div')
			.style('padding', '20px')
			.style('color', '#666')
			.text('Running GPDM analysis... This may take a moment.')
		const content = holder.append('div')

		return { holder, error, wait, content } as any as GpdmDom
	}

	private async run() {
		try {
			const model = new GpdmModel(this.opts)
			const data = await model.getData()

			this.dom.wait.remove()

			new GpdmView(this.dom, data, this.opts.group1Name, this.opts.group2Name, this.opts.geneName)
		} catch (e: any) {
			this.dom.wait.remove()
			sayerror(this.dom.error, e.message || e)
		}
	}
}
