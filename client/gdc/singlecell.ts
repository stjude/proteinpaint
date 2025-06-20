import { appInit } from '#plots/plot.app.js'
import { copyMerge } from '#rx'

interface InitArg {
	filter0?: string
	state?: {
		plots?: Array<{ chartType: string; [key: string]: any }>
	}
	opts?: {
		app?: Record<string, any>
		singleCellPlot?: Record<string, any>
	}
}

interface UpdateArg {
	filter0?: string
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
			plots: arg.state?.plots || [{ chartType: 'singleCellPlot' }]
		},
		noheader: true,
		nobox: true,
		hide_dsHandles: true,
		genome: genomes[gdcGenome],
		app: copyMerge({}, arg.opts?.app || {}),
		opts: {
			singleCellPlot: arg.opts?.singleCellPlot || {}
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
