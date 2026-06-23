import { appInit } from '#plots/plot.app.js'
import { copyMerge, type AppApi } from '#rx'
import type { Filter } from '#types'

type UpdateArg = {
	filter0?: Filter
	[key: string]: any
}

export async function init(
	arg: any,
	holder: HTMLElement,
	genomes: any
): Promise<{ update: (updateArg: UpdateArg) => Promise<void> }> {
	const useGenome = 'hg38'
	const useDslabel = 'GDC'
	const plotAppApi: AppApi = await appInit({
		holder,
		state: {
			genome: useGenome,
			dslabel: useDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: arg.state?.plots || [{ chartType: 'IDCViewer' }]
		},
		genome: genomes[useGenome],
		app: copyMerge({}, arg.opts?.app || {}),
		opts: {
			IDCViewer: arg.opts?.IDCViewer || {}
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
