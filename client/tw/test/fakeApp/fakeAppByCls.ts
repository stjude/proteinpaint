import { termjson } from '../../../test/testdata/termjson'
import { TwRouter } from '../../TwRouter.ts'
import { HandlerWithAddons, FakeCatTypes } from './fakeTypes'
import { CatValuesCls } from './CatValuesAddons'
import { CatPredefinedGSCls } from './CatPredefinedGSAddons.ts'
import { TermWrapper } from '#updated-types'

const HandlerClsMap = {
	CategoricalValues: CatValuesCls,
	CategoricalPredefinedGS: CatPredefinedGSCls
}

export class FakeAppByCls {
	#opts: any
	#handlers: FakeCatTypes[]
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

	#getHandler(tw: TermWrapper): FakeCatTypes {
		const opts = { vocabApi: this.#opts.vocabApi }
		if (tw.type == 'CatTWValues') return new CatValuesCls(tw, opts)
		else if (tw.type == 'CatTWPredefinedGS') return new CatPredefinedGSCls(tw, opts)
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
