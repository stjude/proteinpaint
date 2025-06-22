import { newSandboxDiv } from '#dom'
import { appInit } from '#plots/plot.app.js'
import { copyMerge } from '#rx'
import type { Elem } from '../types/d3'

/*
launches dictionary plot; on selecting any variable, create summary plot
instruct users to use Edit menu to select 2nd variable to make it "correlation" plot

use of dictionary ui avoids creating any custom interface for selecting two terms
*/

interface InitArg {
	filter0?: object
	state?: {
		plots?: Array<{ chartType: string; [key: string]: any }>
	}
	opts?: {
		app?: Record<string, any>
	}
}

interface UpdateArg {
	filter0?: object
	[key: string]: any
}

interface Plot {
	chartType: string
	insertBefore?: string
	id: string
	[key: string]: any
}

interface PlotAppAPI {
	dispatch: (action: any) => void
	getState: () => {
		plots: Plot[]
	}
}

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function init(
	arg: InitArg,
	holder: HTMLElement,
	genomes: any
): Promise<{ update: (updateArg: UpdateArg) => Promise<void> }> {
	const plotAppApi: PlotAppAPI = await appInit({
		holder,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: [{ chartType: 'dictionary' }]
		},
		genome: genomes[gdcGenome],
		// must define opts.app.getPlotHolder() to return sandbox, otherwise summary plot breaks by not getting sandbox
		app: copyMerge(
			{
				getPlotHolder: (plot: any, div: Elem) => {
					const sandbox = newSandboxDiv(div)
					return sandbox
				}
			},
			arg.opts?.app || {} // todo if copyMerge() from arg.opts.app is necessary; copied from singlecell
		),
		opts: {
			// TODO not working
			dictionary: { headerText: 'Select a variable below to build Correlation Plot' }
		}
	})

	const api = {
		update: async (updateArg: UpdateArg) => {
			if (!plotAppApi) return

			if ('filter0' in updateArg) {
				plotAppApi.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'filter_replace',
							filter0: updateArg.filter0
						}
					]
				})
			} else {
				plotAppApi.dispatch({
					type: 'plot_edit',
					id: plotAppApi.getState().plots[0].id,
					config: updateArg
				})
			}
		}
	}

	return api
}
