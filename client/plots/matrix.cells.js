import { convertUnits } from '#shared/helpers'
import { dtsnvindel, dtcnv, dtfusionrna, dtgeneexpression, dtsv, dtmetaboliteintensity } from '#shared/common'
import { TermTypes } from '../shared/terms'
/*
	cell: a matrix cell data
	tw: termwrapper
	anno: the current annotation
	values: the available annotation values for a term
	t: an entry in this.termOrder
	s: plotConfig.settings.matrix
*/
function setNumericCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const key = anno.key
	const values = tw.term.values || {}
	cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
	cell.fill = anno.color || values[anno.key]?.color

	cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
	if (tw.q?.mode == 'continuous') {
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
			const renderV = vc ? cell.key * vc.scaleFactor : cell.key
			cell.height = cell.key >= 0 ? t.scales.pos(renderV) : t.scales.neg(renderV)
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y =
				cell.key >= 0 ? t.counts.posMaxHt + t.tw.settings.gap - cell.height : t.counts.posMaxHt + t.tw.settings.gap
			cell.convertedValueLabel = vc ? convertUnits(cell.key, vc.fromUnit, vc.toUnit, vc.scaleFactor) : ''
		}
	} else {
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
		const group = tw.legend?.group || tw.$id
		return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
	}
}

function setCategoricalCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = tw.term.values || {}
	const key = anno.key
	cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
	cell.fill = anno.color || values[key]?.color
	cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
	cell.y = height * i
	const group = tw.legend?.group || tw.$id
	return { ref: t.ref, group, value: anno.key, entry: { key, label: cell.label, fill: cell.fill } }
}

export function setGeneVariantCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = anno.renderedValues || anno.filteredValues || anno.values || [anno.value]
	cell.label = value.label || self.mclass[value.class]?.label || ''
	const colorFromq = tw.q?.values && tw.q?.values[value.class]?.color
	// may overriden by a color scale by dt, if applicable below
	cell.fill = self.getValueColor?.(value.value) || colorFromq || value.color || self.mclass[value.class]?.color
	cell.class = value.class
	cell.value = value
	const colw = self.dimensions.colw
	if (s.cellEncoding == '') {
		cell.height = s.rowh / values.length
		cell.width = colw
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
	} else if (value.dt == dtsnvindel || value.dt == dtfusionrna) {
		if (s.cellEncoding == 'single') {
			// when CNV is not displayed, show as tall bar
			cell.height = s.rowh
			cell.width = colw
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = 0
		} else {
			const divisor = 3
			cell.height = s.rowh / divisor
			cell.width = colw
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = height * 0.33333
		}
	} else if (value.dt == dtcnv || value.dt == dtgeneexpression || value.dt == dtmetaboliteintensity) {
		cell.height = s.rowh
		cell.width = colw
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = 0
	} else {
		throw `cannot set cell props for dt = '${value.dt}'`
	}

	// need to distinguish between not tested or wildtype by dt: snvindel vs CNV vs SV, etc
	if (value.class == 'Blank' || value.class == 'WT') {
		cell.label = `${self.dt2label[value.dt]} ${cell.label}`
	}
	//if (value.origin) cell.label = `${self.morigin[value.origin].label} ${cell.label}`

	const byDt = self.state.termdbConfig.assayAvailability?.byDt
	// return the corresponding legend item data
	const order = value.class == 'CNV_loss' ? -2 : value.class?.startsWith('CNV_') ? -1 : 0
	if (value.dt == dtcnv) {
		if (t.scales && value.class.startsWith('CNV_')) {
			const max = t.scales.max // value.value < 0 ? self.cnvValues.maxLoss : self.cnvValues.maxGain
			const { maxLoss, maxGain, minLoss, minGain } = t.scales
			value.scaledValue = value.value < 0 ? value.value / minLoss : value.value / maxGain
			cell.fill = value.value < 0 ? t.scales.loss(value.scaledValue) : t.scales.gain(value.scaledValue)

			return {
				ref: t.ref,
				group: 'CNV',
				value: value.class,
				order: -1,
				entry: {
					key: value.class,
					label: cell.label,
					scale: value.class == 'CNV_loss' ? t.scales.loss : t.scales.gain,
					domain: value.class == 'CNV_loss' ? [0, -minLoss] : [0, maxGain],
					minLabel: 0,
					maxLabel: value.class == 'CNV_loss' ? minLoss : maxGain,
					order,
					dt: value.dt,
					origin: value.origin
				}
			}
		} else {
			const group = 'CNV'
			return {
				ref: t.ref,
				group,
				value: value.class,
				order: -1,
				entry: { key: value.class, label: cell.label, fill: cell.fill, order, dt: value.dt, origin: value.origin }
			}
		}
	} else if (value.dt == dtfusionrna && byDt?.[dtfusionrna]) {
		const group = 'Fusion RNA'
		return {
			ref: t.ref,
			group,
			value: value.class,
			order: -1,
			entry: { key: value.class, label: cell.label, fill: cell.fill, order, dt: value.dt, origin: value.origin }
		}
	} else if (value.dt == dtsv && byDt?.[dtsv]) {
		const group = 'Structural Variation'
		return {
			ref: t.ref,
			group,
			value: value.class,
			order: -1,
			entry: { key: value.class, label: cell.label, fill: cell.fill, order, dt: value.dt, origin: value.origin }
		}
	} else if (value.dt >= dtgeneexpression) {
		return {
			ref: t.ref,
			group: self.config.settings.hierCluster?.termGroupName || 'Expression',
			value: value.class,
			order: -1,
			entry: {
				key: value.class,
				label: '',
				scale: self.geneExpValues.scale,
				domain: [0, 0.5, 1],
				minLabel: self.geneExpValues.min,
				maxLabel: self.geneExpValues.max,
				order,
				dt: value.dt,
				origin: value.origin
			}
		}
	} else {
		const controlLabels = self.settings.matrix.controlLabels
		const group =
			tw.legend?.group ||
			(value.origin
				? `${value.origin[0].toUpperCase() + value.origin.slice(1)} ${controlLabels.Mutations}`
				: controlLabels.Mutations)
		return {
			ref: t.ref,
			group,
			value: value.class,
			order: -2,
			entry: { key: value.class, label: cell.label, fill: cell.fill, order, dt: value.dt, origin: value.origin }
		}
	}
}

export function getEmptyCell(cellTemplate, s, d) {
	const cell = Object.assign({}, cellTemplate)
	cell.fill = s.cellbg
	cell.height = s.rowh
	cell.width = d.colw
	cell.x = cell.totalIndex * d.dx + cell.grpIndex * s.colgspace
	cell.y = 0
	return cell
}

// NOTE: may move these code by term.type to matrix.[categorical|*].js
// if more term.type specific logic becomes harder to maintain here

/*
  Arguments
	cell: a matrix cell data
	tw: termwrapper
	anno: the current annotation
	value
	t: an entry in this.termOrder
	s: plotConfig.settings.matrix
*/
export const setCellProps = {
	categorical: setCategoricalCellProps,
	integer: setNumericCellProps,
	float: setNumericCellProps,
	[TermTypes.GENE_EXPRESSION]: setNumericCellProps,
	[TermTypes.METABOLITE_INTENSITY]: setNumericCellProps,
	/* !!! TODO: later, may allow survival terms as a matrix row in server/shared/termdb.usecase.js, 
	   but how - quantitative, categorical, etc? */
	//survival: setNumericCellProps,
	geneVariant: setGeneVariantCellProps
}

export const maySetEmptyCell = {
	geneVariant: setVariantEmptyCell,
	integer: setNumericEmptyCell,
	float: setNumericEmptyCell,
	geneExpression: setNumericEmptyCell,
	metaboliteIntensity: setNumericEmptyCell,
	categorical: setDefaultEmptyCell
}

function setVariantEmptyCell(siblingCells, cellTemplate, s, d) {
	if (siblingCells.find(c => c.value.dt == dtcnv)) return
	const cell = Object.assign({}, cellTemplate)
	cell.fill = s.cellbg
	cell.height = s.rowh
	cell.width = d.colw
	cell.x = cell.totalIndex * d.dx + cell.grpIndex * s.colgspace
	cell.y = 0
	return cell
}

function setNumericEmptyCell(siblingCells, cellTemplate, s, d) {
	const q = cellTemplate.tw.q
	if (q.mode != 'continuous') {
		if (siblingCells.length) return
		setDefaultEmptyCell(siblingCells, cellTemplate, s, d)
	} else {
		if (q?.mode != 'continuous') return
		const tws = cellTemplate.tw.settings
		const h = tws ? tws.barh + 2 * tws.gap : s.rowh
		if (cellTemplate.height >= h) return
		const cell = Object.assign({}, cellTemplate)
		cell.fill = s.cellbg
		cell.height = h || s.rowh
		cell.width = d.colw
		cell.x = cell.totalIndex * d.dx + cell.grpIndex * s.colgspace
		cell.y = 0
		return cell
	}
}

function setDefaultEmptyCell(siblingCells, cellTemplate, s, d) {
	// assumes that valid value(s) will fill-up the cell
	if (siblingCells.length) return
	const cell = Object.assign({}, cellTemplate)
	cell.fill = s.cellbg
	cell.height = s.rowh
	cell.width = d.colw
	cell.x = cell.totalIndex * d.dx + cell.grpIndex * s.colgspace
	cell.y = 0
	return cell
}
