import { TwRouter } from '../../TwRouter.ts'
import { HandlerWithAddons, Addons, isPlotTwHandler, CatHandlerTypes } from './types'
import { TermWrapper } from '#updated-types'
import { CatValuesAddons } from './handlers/CatValues'
import { CatPredefinedGSAddons } from './handlers/CatPredefinedGS.ts'
import { FakeCatValuesHandler } from './handlers/CatValues'
import { FakeCatPredefinedGSHandler } from './handlers/CatPredefinedGS.ts'

// Below is an example of how to extend the handler instances that are returned
// by TwRouter.init(), so that a plot, app, or component (consumer code) can add
// handler methods or properties that it needs for all of its supported tw types.

const addons: { [className: string]: Addons } = {
	CatValuesHandler: CatValuesAddons,
	CatPredefinedGSHandler: CatPredefinedGSAddons
}

export class FakeApp {
	#opts: any
	#handlers: HandlerWithAddons[] | CatHandlerTypes[]
	#dom: {
		svg: string
	}
	#getHandler: any
	//test?: (any) => void

	constructor(opts) {
		this.#opts = opts
		this.#dom = { svg: '<svg></svg>' }
		this.#handlers = []
		this.#getHandler = this.#opts.mode == 'addons' ? this.#getHandler2 : this.#getHandler1
	}

	main(data) {
		this.#handlers = []
		for (const tw of this.#opts.twlst) {
			this.#handlers.push(this.#getHandler(tw))
		}
		this.#render(data)
	}

	#getHandler1(tw: TermWrapper): CatHandlerTypes {
		const opts = { vocabApi: this.#opts.vocabApi }
		if (tw.type == 'CatTWValues') return new FakeCatValuesHandler(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new FakeCatPredefinedGSHandler(tw, opts)
		else throw `no fakeApp handler for tw.type=${tw.type}]`
	}

	// Create a tw-type agnostic function for getting handler instances using TwRouter.init().
	// Then apply addons using Object.assign() and use the type guard to safely return the extended handler.
	#getHandler2(tw: TermWrapper): HandlerWithAddons {
		const handler = TwRouter.init(tw, { vocabApi: this.#opts.vocabApi })
		// not type checked, may need a type guard for each handler type
		if (tw.type == 'CatTWValues') Object.assign(handler, CatValuesAddons)
		else if (tw.type == 'CatTWPredefinedGS') Object.assign(handler, CatPredefinedGSAddons)
		else throw `no addons for '${handler.constructor.name}'`
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
