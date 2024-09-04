import { DiscreteBase, ContinuousBase, ContTWTypes, DiscreteTWTypes } from '../tw/index.ts'
import { TermWrapper } from '#updated-types'
import { convertUnits } from '#shared/helpers'

export function getTermGroups(termgroups, app) {
	const termGroups = structuredClone(termgroups)
	for (const tG of termGroups) {
		const xtwlst: (MatrixTWObj | TermWrapper)[] = []
		for (const tw of tG.lst) {
			xtwlst.push(getxtw(tw, { vocabApi: app.vocabApi }))
		}
		tG.lst = xtwlst
	}
	return termGroups
}

function getxtw(tw: TermWrapper, opts = {}): MatrixTWObj | TermWrapper {
	// NOTE: TwRouter.fill(), enabled by setting `serverconfig.features.usextw: true`,
	// will set the tw.type on rehydrated tw. Only migrated tw with corresponding
	// declared class in client/tw files will get replaced by the extended tw (xtw);
	// the same plain tw object will be returned for non-migrated term.types + q.type/mode
	switch (tw.type) {
		case 'CatTWValues':
		case 'CatTWPredefinedGS':
		case 'CatTWCustomGS':
		case 'NumTWRegularBin':
		case 'NumTWCustomBin':
			return new MatrixDiscrete(tw, opts)

		case 'NumTWCont':
			return new MatrixCont(tw, opts)

		default:
			return tw
	}
}

interface MatrixTWObj {
	setCellProps: (
		cell: any,
		anno: any,
		value: string | number,
		s: any,
		t: any,
		self: any,
		width: number,
		height: number,
		dx: number,
		dy: number,
		i: number
	) => void
}

type MatrixXTW = MatrixDiscrete

/**
	Extended TW to handle discrete-valued sample annotation

	todo: may move this class into its own file, if the class gets too big
*/
class MatrixDiscrete extends DiscreteBase implements MatrixTWObj {
	#tw: DiscreteTWTypes

	constructor(tw, opts) {
		super(tw, opts)
		this.#tw = tw
	}

	setCellProps(
		cell: any,
		anno: any,
		value: string | number,
		s: any,
		t: any,
		self: any,
		width: number,
		height: number,
		dx: number,
		dy: number,
		i: number
	) {
		const tw = this.#tw
		const key = anno.key
		const values = tw.term.values || {}
		cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
		cell.fill = anno.color || values[anno.key]?.color

		// only for numeric terms for now
		// TODO: should also consider categorical term.values[*].order
		cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0

		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
		const group = tw.legend?.group || tw.$id
		return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
	}
}

/**
	Extended TW to handle discrete-valued sample annotation

	todo: may move this class into its own file, if the class gets too big
*/
class MatrixCont extends ContinuousBase implements MatrixTWObj {
	#tw: ContTWTypes

	constructor(tw, opts) {
		super(tw, opts)
		this.#tw = tw
	}

	setCellProps(
		cell: any,
		anno: any,
		value: string | number,
		s: any,
		t: any,
		self: any,
		width: number,
		height: number,
		dx: number,
		dy: number,
		i: number
	) {
		const tw = this.#tw
		const key = anno.key
		const values = tw.term.values || {}
		cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
		cell.fill = anno.color || values[anno.key]?.color

		if (!tw.settings) tw.settings = {}
		if (!tw.settings.barh) tw.settings.barh = s.barh
		if (!('gap' in tw.settings)) tw.settings.gap = 4

		const specialValue = tw.term.values?.[cell.key]

		// handle uncomputable values
		// TODO: the server response data should not have uncomputable values when mode='continuous'
		// this may be implemented in getData(), but will require lots of testing since it is used
		// by multiple charts
		if (specialValue?.uncomputable) {
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = height * i
			cell.height = tw.settings.barh
			cell.fill = 'transparent'
			//cell.label = specialValue.label
			const group = tw.legend?.group || tw.$id
			return //{ ref: t.ref, group, value: specialValue.label || specialValue.key, entry: { key, label: cell.label, fill: cell.fill } }
		}

		// TODO: may use color scale instead of bars
		// for bars, use a hardcoded color; TODO: allow a user to customize the bar color?
		cell.fill = '#555'
		if (s.transpose) {
			cell.height = t.scale(cell.key)
			cell.x = tw.settings.gap // - cell.width
		} else {
			const vc = cell.term.valueConversion
			let renderV = vc ? cell.key * vc.scaleFactor : cell.key
			// todo: convert from a boolean into maybe `q.units or q.transform: 'zscore' | ...`
			if (this.#tw.q.convert2ZScore) {
				renderV = (renderV - t.mean) / t.std

				// show positive z-score as soft red and negative z-score as soft blue
				cell.fill = renderV > 0 ? '#FF6666' : '#6666FF'
				cell.zscoreLabel = ` (z-score: ${renderV.toFixed(2)})`
			}
			cell.label =
				'label' in anno
					? anno.label
					: values[key]?.label
					? values[key].label
					: this.#tw.term.unit
					? `${cell.key.toFixed(2)} ${this.#tw.term.unit}`
					: cell.key.toFixed(2)
			cell.height = renderV >= 0 ? t.scales.pos(renderV) : t.scales.neg(renderV)
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y =
				renderV >= 0 ? t.counts.posMaxHt + t.tw.settings.gap - cell.height : t.counts.posMaxHt + t.tw.settings.gap
			cell.convertedValueLabel = !vc ? '' : convertUnits(cell.key, vc.fromUnit, vc.toUnit, vc.scaleFactor)
		}
	}
}
