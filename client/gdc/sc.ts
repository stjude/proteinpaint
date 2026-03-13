import { appInit } from '#plots/plot.app.js'
import { type AppApi, copyMerge } from '#rx'
import type { Filter } from '#types'

type InitArg = {
	genome?: string
	dslabel?: string
	filter0?: Filter
	state?: {
		plots?: Array<{ chartType: string; [key: string]: any }>
	}
	opts?: {
		app?: Record<string, any>
		sc?: Record<string, any>
	}
}

type UpdateArg = {
	filter0?: Filter
	[key: string]: any
}

export async function init(
	arg: InitArg,
	holder: HTMLElement,
	genomes: any
): Promise<{ update: (updateArg: UpdateArg) => Promise<void> }> {
	const useGenome = arg.genome || 'hg38'
	const useDslabel = arg.dslabel || 'gdc'

	const plotAppApi: AppApi = await appInit({
		holder,
		state: {
			genome: useGenome,
			dslabel: useDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: arg.state?.plots || [{ chartType: 'sc' }]
		},
		genome: genomes[useGenome],
		app: copyMerge({}, arg.opts?.app || {}),
		opts: {
			sc: arg.opts?.sc || {}
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
