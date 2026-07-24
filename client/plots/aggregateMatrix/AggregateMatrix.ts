import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'

/**** Plot in development ***
 * The aggregate matrix displays two aggregate values for two terms in a matrix format
 * by size and color gradient.*/
class AggregateMatrix extends PlotBase implements RxComponent {
    static type = 'aggregateMatrix'

	type: string
	components: { controls: any }

   
    constructor(opts: any, api: ComponentApi) {
        super(opts, api)
        this.type = AggregateMatrix.type
        this.components = { controls: {} }
    }

    async init(){
        console.log('TODO: AggregateMatrix.init()')
    }

    main() {
        console.log('TODO: AggregateMatrix.main()')
    }
}

export const aggMatrixInit = getCompInit(AggregateMatrix)
export const componentInit = aggMatrixInit

export function getPlotConfig(opts: any) {
    const config = {
        hidePlotFilter: true
    }

    return copyMerge(config, opts)
}