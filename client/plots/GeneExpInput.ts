import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION } from '#shared/terms.js'
import { getGEunit } from '../tw/geneExpression'
import { getSCGEunit } from '../tw/singleCellGeneExpression'

/** Transient plot for users to pick gene(s) of interest and launch
 * the appropriate plot. */
export class GeneExpInput extends PlotBase implements RxComponent {
	static type = 'GeneExpInput'

	type: string
	genome!: string
	termType!: 'geneExpression' | 'singleCellGeneExpression'
	/** termType dependent */
	unit!: string

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = GeneExpInput.type
		this.opts = opts
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return config
	}

	async init(appState) {
		const state = this.getState(appState)

		this.genome = appState.vocab.genome
		this.termType = state.termType
		this.unit = this.termType === GENE_EXPRESSION ? getGEunit(this.app.vocabApi) : getSCGEunit(this.app.vocabApi)
	}

	main() {}
}

export const geneExpInputInit = getCompInit(GeneExpInput)
export const componentInit = geneExpInputInit

//Sanity check
const enabledTermTypes = new Set([GENE_EXPRESSION, SINGLECELL_GENE_EXPRESSION])

export function getPlotConfig(opts) {
	if (!opts?.termType) throw new Error('termType is required in opts')
	if (!enabledTermTypes.has(opts.termType)) throw new Error(`Invalid termType: ${opts.termType}`)

	const config = {
		chartType: 'GeneExpInput',
		termType: opts.termType,
		hidePlotFilter: true
	}

	return copyMerge(config, opts)
}
