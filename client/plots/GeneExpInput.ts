import { PlotBase } from './PlotBase.ts'
import { type ComponentApi, type RxComponent } from '#rx'

export class GeneExpInput extends PlotBase implements RxComponent {
	static type = 'GeneExpInput'

	type: string

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = GeneExpInput.type
	}

	async init() {}

	main() {}
}
