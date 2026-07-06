import type { MassState, BasePlotConfig, MassAppApi } from '#mass/types/mass'
import type { GeomapConfig } from '#types'
import type { Elem, Div } from '../../types/d3.d'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu } from '#dom'
import { renderGeomap } from './render'

type GeomapDom = {
	holder: Div
	header?: Elem
	controls?: Elem
	tip: Menu
}

class Geomap extends PlotBase implements RxComponent {
	static type = 'geomap'
	type: string
	dom: GeomapDom

	constructor(opts: { holder: Div; header?: Elem; controls?: Elem }, api: ComponentApi) {
		super(opts, api)
		this.type = Geomap.type
		const holder = opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			header: opts.header,
			controls: opts.controls,
			tip: new Menu({ padding: '4px 8px' })
		}
		if (this.dom.header) this.dom.header.html('Site Map')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	reactsTo(action: { type: string; id?: string }) {
		if (action.type.startsWith('plot_')) return action.id === this.id
		return true
	}

	async main() {
		const geomap: GeomapConfig | undefined = this.state.config.geomap
		renderGeomap(this.dom.holder, geomap, this.dom.tip)
	}
}

export const componentInit = getCompInit(Geomap)

export async function getPlotConfig(opts: { geomap?: GeomapConfig }, app: MassAppApi) {
	// seed locations from the dataset-provided termdbConfig.geomap when the launcher
	// (chart catalog) passes only { chartType:'geomap' }
	const fromDs: GeomapConfig | undefined = app?.vocabApi?.termdbConfig?.geomap
	const config = {
		chartType: 'geomap',
		// the map is not filtered by dictionary terms, so hide the per-plot filter UI
		hidePlotFilter: true,
		geomap: fromDs ? structuredClone(fromDs) : { sites: [] }
	}
	return copyMerge(config, opts)
}
