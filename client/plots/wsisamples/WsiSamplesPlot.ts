import { getCompInit } from '#rx'
import wsiSamplesDefaults from '#plots/wsisamples/defaults.ts'
import { dofetch3 } from '#src/client'
import { WSISample, WSISamplesResponse } from '@sjcrh/proteinpaint-types/routes/wsisamples.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'

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

		const holder = this.opts.holder

		const plotConfig = state.plots.find(p => p.id === this.id)

		const settings = plotConfig.settings as Settings

		const contentDiv = holder.append('div')

		const wsiImages: WSISample[] = plotConfig.wsimages

		for (const wsiImage of wsiImages) {
			contentDiv
				.append('a')
				.attr('href', `http://localhost:3000/example.wsi.viewer.html?sample_id=${wsiImage.sampleId}`)
				.attr('target', '_blank')
				.text(`View Sample: ${wsiImage.sampleId}`)
				.style('display', 'block')
		}
	}
}

export const wsiSamplesPlot = getCompInit(WSISamplesPlot)

export const componentInit = wsiSamplesPlot

export async function getPlotConfig(opts: any, app: any) {
	return {
		chartType: 'WSISamplesPlot',
		subfolder: 'wsisamples',
		extension: 'ts',
		wsimages: await getWSISamples(app),
		settings: wsiSamplesDefaults(opts.overrides)
	}
}

async function getWSISamples(app: any): Promise<WSISample[]> {
	const data: WSISamplesResponse = await dofetch3('wsisamples', {
		body: {
			genome: app.opts.state.vocab.genome,
			dslabel: app.opts.state.vocab.dslabel
		}
	})
	return data.samples
}
