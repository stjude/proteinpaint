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

	//cell.y = height * i //t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * i + t.totalHtAdjustments

	cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
	if (tw.q?.mode == 'continuous') {
		if (!tw.settings) tw.settings = {}
		if (!tw.settings.barh) tw.settings.barh = s.barh
		if (!('gap' in tw.settings)) tw.settings.gap = 0
		// TODO: may use color scale instead of bars
		if (s.transpose) {
			cell.height = t.scale(cell.key)
			cell.x = tw.settings.gap // - cell.width
		} else {
			cell.height = cell.key >= 0 ? t.scales.pos(cell.key) : t.scales.neg(cell.key)
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = cell.key >= 0 ? t.counts.posMaxHt + t.tw.settings.gap - cell.height : 0
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

function setGeneVariantCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = anno.renderedValues || anno.filteredValues || anno.values || [anno.value]
	cell.label = value.label || self.mclass[value.class].label
	const colorFromq = tw.q?.values && tw.q?.values[value.class]?.color
	// may overriden by a color scale by dt, if applicable below
	cell.fill = colorFromq || value.color || self.mclass[value.class]?.color
	cell.class = value.class
	cell.value = value

	const colw = self.dimensions.colw
	if (s.cellEncoding != 'oncoprint') {
		cell.height = s.rowh / values.length
		cell.width = colw
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
	} else if (value.dt == 1) {
		const divisor = 3
		cell.height = s.rowh / divisor
		cell.width = colw
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * 0.33333
	} else if (value.dt == 4) {
		cell.height = s.rowh
		cell.width = colw
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = 0
	} else {
		throw `cannot set cell props for dt='${value.dt}'`
	}

	// need to distinguish between not tested or wildtype by dt: snvindel vs CNV vs SV, etc
	if (value.class == 'Blank' || value.class == 'WT') {
		cell.label = `${self.dt2label[value.dt]} ${cell.label}`
	}
	if (value.origin) cell.label = `${self.morigin[value.origin].label} ${cell.label}`

	// return the corresponding legend item data
	const order = value.class == 'CNV_loss' ? -2 : value.class.startsWith('CNV_') ? -1 : 0
	if (value.dt == 4) {
		if (t.scales && value.class.startsWith('CNV_')) {
			const max = t.scales.max // value.value < 0 ? self.cnvValues.maxLoss : self.cnvValues.maxGain
			value.scaledValue = Math.abs(value.value / max)
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
					domain: value.class == 'CNV_loss' ? [max, 0] : [0, max],
					minLabel: value.class == 'CNV_loss' ? -max : 0,
					maxLabel: value.class == 'CNV_loss' ? 0 : max,
					order
				}
			}
		} else {
			const group = 'CNV'
			return {
				ref: t.ref,
				group,
				value: value.class,
				order: -1,
				entry: { key: value.class, label: cell.label, fill: cell.fill, order }
			}
		}
	} else {
		const group = tw.legend?.group || 'Mutation Types'
		return {
			ref: t.ref,
			group,
			value: value.class,
			order: -2,
			entry: { key: value.class, label: cell.label, fill: cell.fill, order }
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
	/* !!! TODO: later, may allow survival terms as a matrix row in server/shared/termdb.usecase.js, 
	   but how - quantitative, categorical, etc? */
	//survival: setNumericCellProps,
	geneVariant: setGeneVariantCellProps
}

export const maySetEmptyCell = {
	geneVariant: setVariantEmptyCell,
	integer: setNumericEmptyCell,
	float: setNumericEmptyCell,
	categorical: setDefaultEmptyCell
}

function setVariantEmptyCell(siblingCells, cellTemplate, s, d) {
	if (siblingCells.find(c => c.value.dt == 4)) return
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
