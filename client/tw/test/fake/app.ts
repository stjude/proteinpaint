import { TwRouter } from '../../TwRouter.ts'
import { HandlerWithAddons, Addons, isPlotTwHandler, CatHandlerTypes } from './types'
import { TermWrapper } from '#updated-types'
import { CatValuesAddons } from './handlers/CatValues'
import { CatPredefinedGSAddons } from './handlers/CatPredefinedGS.ts'
import { FakeCatValuesHandler } from './handlers/CatValues'
import { FakeCatPredefinedGSHandler } from './handlers/CatPredefinedGS.ts'
import { xCatValues } from './extended/xCatValues.ts'
import { xCatPredefinedGS } from './extended/xCatPredefinedGS.ts'

type xTwBase = xCatValues | xCatPredefinedGS

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
		this.#getHandler =
			this.#opts.mode == 'addons'
				? this.#getHandler2
				: this.#opts.mode == 'handler'
				? this.#getHandler1
				: this.#getExtTws
	}

	main(data) {
		this.#handlers = []
		for (const tw of this.#opts.twlst) {
			this.#handlers.push(this.#getHandler(tw))
		}
		this.#render(data)
		//console.log(40, this.#handlers, JSON.parse(JSON.stringify(this.#handlers)))
	}

	#getExtTws(tw: TermWrapper): xTwBase {
		const opts = { vocabApi: this.#opts.vocabApi }
		/* 
			Below are examples of using a discriminant property at the object root,
			it passes compiler checks and the code is simpler to write. To understand
			why there are compiler errors in the preceding examples, and why the code
			below works, see the detailed examples and explanations in
			https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
		*/
		if (tw.type == 'CatTWValues') return new xCatValues(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new xCatPredefinedGS(tw, opts)
		else throw `no fakeApp extended class for tw.type=${tw.type}`
	}

	#getHandler1(tw: TermWrapper): CatHandlerTypes {
		const opts = { vocabApi: this.#opts.vocabApi }
		// counter-examples below
		/*
			tsc error below, because a discriminant property cannot be on nested types/shapes.
			Even if tsc supports a nested discriminant prop:
			- it's still much more convenient to statically and runtime check only one property in downstream code
			- the type check error message is also much cleaner when the discriminant prop is on the root shape
		*/
		// if (tw.term.type == 'categorical' && tw.q.type == 'values') return new FakeCatValuesHandler(tw, opts)

		/*
			tsc error below, because the isCatTWValues flag is not defined for all types in the union. 
			Even if it is fixable by defining every optional isType flags on all types in the union, 
			it's still not preferred, because that fix:
			- is really inconvenient and bloats the type definition by adding unnecessary expected props 
			- makes it possible to accidentally set two istype flags to true at runtime (has happened when using copyMerge())
			- is not runtime safe and much less elegant than using a discriminant prop to indicate 
			  mutually exclusive types in a union, which is runtime safe, no possibility of isType flag collision
		*/
		// if (tw.isCatTWValues) return new FakeCatValuesHandler(tw, opts)

		/* 
			Below are examples of using a discriminant property at the object root,
			it passes compiler checks and the code is simpler to write. To understand
			why there are compiler errors in the preceding examples, and why the code
			below works, see the detailed examples and explanations in
			https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
		*/
		if (tw.type == 'CatTWValues') return new FakeCatValuesHandler(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new FakeCatPredefinedGSHandler(tw, opts)
		// else if (tw.type == 'CatTWCustomGS') {
		// 	// counter-example only
		// 	const noncat = {
		// 		type: tw.type,
		// 		// replace term.type with a mismatched value
		// 		term: {...tw.term, type: 'integer' as const},
		// 		q: tw.q
		// 	}
		// 	// tsc emits an error on noncat argument, expecting term.type to be 'categorical'
		// 	return new FakeCatValuesHandler(noncat, opts)
		// }
		else throw `no fakeApp handler for tw.type=${tw.type}]`
	}

	// !!! DO NOT FOLLOW THE ADDON EXAMPLE BELOW !!!
	// - prefer the class syntax above, which neatly combines type, interface, implementation
	//
	// apply addons using Object.assign() and use the type guard to safely return the extended handler.
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
