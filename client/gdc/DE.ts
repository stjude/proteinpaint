import { appInit } from '#mass/app'

/*
launches submission UI for differental gene expression
*/

interface InitArg {
	debugmode?: true
	genome?: string
	dslabel?: string
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

export async function init(
	arg: InitArg,
	holder: HTMLElement,
	genomes: any
): Promise<{ update: (updateArg: UpdateArg) => Promise<void> }> {
	const useGenome = arg.genome || 'hg38'
	const useDslabel = arg.dslabel || 'GDC'
	const genome = genomes[useGenome]
	const massApi = await appInit({
		//debug: arg.debugmode, // is debug accepted?
		genome,
		holder,
		state: {
			genome: useGenome,
			dslabel: useDslabel,
			termfilter: { filter0: arg.filter0 },
			nav: { activeTab: 1, header_mode: 'only_buttons' },
			plots: [{ chartType: 'DEinput' }]
		},
		opts: Object.assign(
			{
				// todo additional customizations
				// dictionary:{header:'Select a variable to build Correlation Plot'}
				// some way to make gene exp violin/boxplot to use log scale by default, but numeric dict term should not
			},
			arg.opts || {}
		),
		app: arg.opts?.app || {}
	})
	const api = {
		update: async (updateArg: UpdateArg) => {
			if (!massApi) return

			// NOTE: changes inside the mass app (nav tabs, sandbox, etc) are handled internally
			// within the mass app instance; only embedder portal-dispatched changes, such as filter0,
			// should be handled below

			if ('filter0' in updateArg) {
				massApi.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'filter_replace',
							filter0: updateArg.filter0
						}
					]
				})
			}
		},
		triggerAbort: (reason = '') => massApi.triggerAbort(reason)
	}

	return api
}
