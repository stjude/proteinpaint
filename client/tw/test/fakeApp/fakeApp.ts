import { TwRouter } from '../../TwRouter.ts'
import { HandlerWithAddons, Addons, isPlotTwHandler } from './fakeTypes'
import { CatValuesAddons } from './CatValuesAddons'
import { CatPredefinedGSAddons } from './CatPredefinedGSAddons.ts'

// Below is an example of how to extend the handler instances that are returned
// by TwRouter.init(), so that a plot, app, or component (consumer code) can add
// handler methods or properties that it needs for all of its supported tw types.

const addons: { [className: string]: Addons } = {
	CategoricalValues: CatValuesAddons,
	CategoricalPredefinedGS: CatPredefinedGSAddons
}

export class FakeApp {
	#opts: any
	#handlers: HandlerWithAddons[]
	#dom: {
		svg: string
	}
	//test?: (any) => void

	constructor(opts) {
		this.#opts = opts
		this.#dom = { svg: '<svg></svg>' }
		this.#handlers = []
	}

	main(data) {
		this.#handlers = []
		for (const tw of this.#opts.twlst) {
			this.#handlers.push(this.#getHandler(tw))
		}

		this.#render(data)
	}

	// Create a tw-type agnostic function for getting handler instances using TwRouter.init().
	// Then apply addons using Object.assign() and use the type guard to safely return the extended handler.
	#getHandler(tw): HandlerWithAddons {
		const handler = TwRouter.init(tw, { vocabApi: this.#opts.vocabApi })
		const adds = addons[handler.constructor.name]
		if (!addons) throw `no addons for '${handler.constructor.name}'`
		else Object.assign(handler, adds)
		if (isPlotTwHandler(handler)) return handler
		else throw `mismatch`
	}

	#render(data) {
		let svg = '<svg></svg>'
		for (const h of this.#handlers) {
			const arg = { holder: svg, data }
			h.render(arg)
			svg = arg.holder
		}
		this.#dom.svg = svg
	}

	getInner() {
		return {
			dom: this.#dom,
			handlers: this.#handlers
		}
	}
}
