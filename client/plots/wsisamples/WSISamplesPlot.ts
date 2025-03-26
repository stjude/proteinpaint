import { getCompInit } from '#rx'
import wsiViewerImageFiles from '#plots/wsiviewer/wsimagesloaded.ts'
import wsiSamplesDefaults from '#plots/wsisamples/defaults.ts'
import WSIViewer from '#plots/wsiviewer/WSIViewer.ts'
import { dofetch3 } from '#src/client'

export default class WSISamplesPlot {
	// following attributes are required by rx
	private type: string
	private id: any
	private opts: any
	private app: any

	constructor(opts: any) {
		this.type = 'WSISamplesPlot'
		this.opts = opts
	}

	async main(): Promise<void> {
		const state = this.app.getState()
	}
}

export const wSISamplesPlot = getCompInit(WSISamplesPlot)

export const componentInit = wSISamplesPlot

export async function getPlotConfig(opts: any, app: any) {
	return {
		chartType: 'WSISamplesPlot',
		subfolder: 'wsisamples',
		extension: 'ts',
		wsimages: await getWSISamples(opts, app),
		settings: wsiSamplesDefaults(opts.overrides)
	}
}

async function getWSISamples(opts: any, app: any) {
	const data = await dofetch3('wsisamples', {
		body: {
			genome: opts.app.opts.state.vocab.genome,
			dslabel: opts.app.opts.state.vocab.dslabel
		}
	})
	return data.sampleWSImages
}
