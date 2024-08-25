import { CatTypes } from './types'
import { FakeCatValuesHandler } from './handlers/CatValues'
import { FakeCatPredefinedGSHandler } from './handlers/CatPredefinedGS.ts'
import { TermWrapper } from '#updated-types'

export class FakeAppByCls {
	#opts: any
	#handlers: CatTypes[]
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

	#getHandler(tw: TermWrapper): CatTypes {
		const opts = { vocabApi: this.#opts.vocabApi }
		if (tw.type == 'CatTWValues') return new FakeCatValuesHandler(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new FakeCatPredefinedGSHandler(tw, opts)
		else throw `no fakeApp handler for tw.type=${tw.type}]`
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
