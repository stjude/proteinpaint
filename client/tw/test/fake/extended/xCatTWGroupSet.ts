import {
	CategoricalTerm,
	CatTWPredefinedGS,
	CatTWCustomGS,
	PredefinedGroupSettingQ,
	CustomGroupSettingQ,
	BaseGroupSet,
	ValuesQ
} from '#types'
import { HandlerOpts } from '../../../Handler'
import { PlotTwRenderOpts } from '../types'
import { TwBase } from '../../../TwBase'

export class xCatTWGroupSet extends TwBase {
	term: CategoricalTerm
	q: PredefinedGroupSettingQ | CustomGroupSettingQ
	#groupset: BaseGroupSet
	#tw: CatTWPredefinedGS | CatTWCustomGS
	#opts: HandlerOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: CatTWPredefinedGS | CatTWCustomGS, opts: HandlerOpts = {}) {
		super(tw, opts)
		this.term = tw.term
		this.q = tw.q
		this.#groupset =
			this.q.type == 'predefined-groupset' ? this.term.groupsetting[this.q.predefined_groupset_idx] : this.q.customset
		this.#tw = tw
		this.#opts = opts
	}

	render(arg: PlotTwRenderOpts) {
		// the tw is guaranteed to have term.type=categorical, q.type='predefined-groupset'
		const t = this.term
		for (const [sampleId, d] of Object.entries(arg.data)) {
			const keys = Object.keys(d)
			// lots of terms indicate benchmark testing, must not by influenced by string-based svg simulated render
			if (keys.length > 10 || !keys.includes(t.id)) continue
			// for the tw in this typed context, use a svg:rect element
			const shape = `<rect width=10 height=10></rect></svg>`
			arg.holder = arg.holder.replace(`</svg>`, `<text>${sampleId}, ${d[t.id]}</text>${shape}`)
		}
	}
}

// test only
const term = {
	type: 'categorical' as const,
	id: 'abc',
	name: 'ABC',
	values: {
		x: { label: 'x' },
		y: { label: 'y' }
	},
	groupsetting: {
		lst: [
			{
				name: 'test',
				groups: []
			}
		]
	}
}

const tw0 = {
	type: 'CatTWPredefinedGS' as const,
	term,
	q: {
		type: 'predefined-groupset' as const,
		predefined_groupset_idx: 0
	}
}

const a0 = new xCatTWGroupSet(tw0)

const tw1 = {
	type: 'CatTWCustomGS' as const,
	term,
	q: {
		type: 'custom-groupset' as const,
		customset: {
			groups: []
		}
	}
}

const a1 = new xCatTWGroupSet(tw1)
