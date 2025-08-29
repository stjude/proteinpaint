import type { ContinuousXTW, DiscreteXTW } from '#tw'
import { TwRouter } from '#tw'
import type { TermWrapper } from '#types'
import { convertUnits } from '#shared/helpers.js'

let addons

export function getTermGroups(termgroups, app) {
	const termGroups = structuredClone(termgroups)
	// should only set the addons once, it should not vary from one call to the next
	if (!addons)
		addons = {
			CatTWValues: discreteAddons,
			CatTWPredefinedGS: discreteAddons,
			CatTWCustomGS: discreteAddons,
			NumTWRegularBin: discreteAddons,
			NumTWCustomBin: discreteAddons,
			NumTWCont: continuousAddons
		}

	const opts = {
		vocabApi: app.vocabApi,
		addons
	}

	for (const [origIndex, tG] of termGroups.entries()) {
		tG.origIndex = origIndex
		if (tG.type == 'hierCluster') continue
		const xtwlst: (MatrixTWObj | TermWrapper)[] = []
		for (const tw of tG.lst) {
			xtwlst.push(tw.type in opts.addons ? TwRouter.init(tw, opts) : tw)
		}
		tG.lst = xtwlst
	}
	return termGroups
}

export type SetCellPropsSignature = {
	value: (
		/** a plain object for matrix cell data to be rendered, including sibling cells */
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
	) => any
}

interface MatrixTWObj {
	setCellProps: SetCellPropsSignature
}

const discreteAddons: MatrixTWObj = {
	setCellProps: {
		value: function (
			this: DiscreteXTW,
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
			const tw = this.getTw()
			const key = anno.key
			const values = tw.term.values || {}
			cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
			const tw$id = tw.$id
			cell.fill =
				self.config.settings.matrix.twSpecificSettings?.[tw$id!]?.[key]?.color ||
				anno.color ||
				values[anno.key]?.color ||
				self.data.refs.byTermId?.[tw$id!]?.bins?.find(b => anno.key == b.name)?.color
			// only for numeric terms for now
			// TODO: should also consider categorical term.values[*].order
			cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0

			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = height * i
			const group = tw.legend?.group || tw$id
			return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
		}
	}
}

const continuousAddons: MatrixTWObj = {
	setCellProps: {
		value: function (
			this: ContinuousXTW,
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
			const tw = this.getTw()
			const key = anno.key
			const values = tw.term.values || {}
			cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
			cell.fill = anno.color || values[anno.key]?.color
			const tw$id = tw.$id
			const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
			if (!twSpecificSettings[tw$id!]) twSpecificSettings[tw$id!] = {}
			const twSettings = twSpecificSettings[tw$id!]
			if (!twSettings.contBarH) twSettings.contBarH = s.barh
			if (!('gap' in twSettings)) twSettings.contBarGap = 4

			const specialValue = tw.term.values?.[cell.key]

			// handle uncomputable values
			// TODO: the server response data should not have uncomputable values when mode='continuous'
			// this may be implemented in getData(), but will require lots of testing since it is used
			// by multiple charts
			if (specialValue?.uncomputable) {
				cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
				cell.y = height * i
				cell.height = twSettings.contBarH
				cell.fill = 'transparent'
				cell.label = specialValue.label
				const group = tw.legend?.group || tw.$id
				return {
					ref: t.ref,
					group,
					value: specialValue.label || specialValue.key,
					entry: { key, label: cell.label, fill: cell.fill }
				}
			}

			// TODO: may use color scale instead of bars
			// for bars, use a hardcoded color; TODO: allow a user to customize the bar color?
			cell.fill = self.config.settings.matrix.twSpecificSettings?.[tw$id!]?.contBarColor || '#555'
			if (s.transpose) {
				cell.height = t.scale(cell.key)
				cell.x = twSettings.contBarGap // - cell.width
			} else {
				const vc = cell.term.valueConversion
				let renderV = vc ? cell.key * vc.scaleFactor : cell.key
				// todo: convert from a boolean into maybe `q.units or q.transform: 'zscore' | ...`
				if (this.q.convert2ZScore) {
					renderV = (renderV - t.mean) / t.std

					// show positive z-score as soft red and negative z-score as soft blue
					cell.fill = renderV > 0 ? '#FF6666' : '#6666FF'
					cell.zscoreLabel = ` (Z-score: ${renderV.toFixed(2)})`
				}
				cell.label =
					'label' in anno
						? anno.label
						: values[key]?.label
						? values[key].label
						: this.term.unit
						? `${cell.key.toFixed(2)} ${this.term.unit}`
						: cell.key.toFixed(2)
				cell.height = renderV >= 0 ? t.scales.pos(renderV) : t.scales.neg(renderV)
				cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
				cell.y =
					renderV >= 0
						? t.counts.posMaxHt + twSettings.contBarGap - cell.height
						: t.counts.posMaxHt + twSettings.contBarGap
				cell.convertedValueLabel = !vc ? '' : convertUnits(cell.key, vc.fromUnit, vc.toUnit, vc.scaleFactor)
			}
		}
	}
}
