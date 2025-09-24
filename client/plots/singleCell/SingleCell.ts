import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'

class SingleCell extends PlotBase implements RxComponent {
	static type = 'singleCell'
	type: string

	parentId?: string // id of parent component, e.g. SC super app

	constructor(opts) {
		super(opts)
		this.type = SingleCell.type
		if (opts?.parentId) this.parentId = opts.parentId
	}

	main() {
		console.log('SingleCell.main()', this.id)
	}
}

export const singleCellInit = getCompInit(SingleCell)
export const componentInit = singleCellInit

export function getPlotConfig(opts) {
	const config = {
		chartType: 'singleCell'
	}

	return copyMerge(config, opts)
}
