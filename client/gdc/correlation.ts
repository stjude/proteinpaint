import { appInit } from '#mass/app'

/*
launches mass ui, to display: 
1) dictionary chart button on top, click to launch dict ui
2) a dictionary plot on bottom, for user to select a term and launch summary plot

todo
- hide nav tabs, only show some plot buttons
- customize dictionary plot sandbox header text to 'Select variable for correlation plot'
- survival plot with gdc survival data
- more chart buttons for typical usecases, each button will show a tailored input ui
  1. "compare gene exp", tw1 is gene exp, tw2 is anything
  2. "compare survival", tw1 is survival, tw2 is anything
*/

interface InitArg {
	debugmode?: true
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

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function init(
	arg: InitArg,
	holder: HTMLElement,
	genomes: any
): Promise<{ update: (updateArg: UpdateArg) => Promise<void> }> {
	const massApi = await appInit({
		//debug: arg.debugmode, // is debug accepted?
		genome: genomes[gdcGenome],
		holder,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: arg.filter0 },
			nav: { activeTab: 1 }, // todo: header_mode='only_buttons'
			plots: [{ chartType: 'dictionary' }] // default shows dictionary ui, can change
			/* todo additional customizations
			opts:{
				dictionary:{header:'Select a variable to build Correlation Plot'}
				// some way to make gene exp violin/boxplot to use log scale by default, but numeric dict term should not
			}
			*/
		}
	})
	const api = {
		update: async (updateArg: UpdateArg) => {
			if (massApi!) return

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
			} else {
				massApi.dispatch({
					type: 'plot_edit',
					id: massApi.getState().plots[0].id, // FIXME mass ui can contain multiple plots
					config: updateArg
				})
			}
		}
	}

	return api
}
