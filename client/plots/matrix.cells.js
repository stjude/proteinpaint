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
	cell.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments
	cell.y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * i + t.totalHtAdjustments : 0

	cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
	if (tw.q?.mode == 'continuous') {
		if (!tw.settings) tw.settings = {}
		if (!tw.settings.barh) tw.settings.barh = 30
		if (!('gap' in tw.settings)) tw.settings.gap = 0
		// TODO: may use color scale instead of bars
		if (s.transpose) {
			cell.width = t.scale(cell.key)
			cell.x += tw.settings.gap // - cell.width
		} else {
			cell.height = t.scale(cell.key)
			cell.y += tw.settings.barh + t.tw.settings.gap - cell.height
		}
	} else {
		const group = tw.legend?.group || tw.$id
		return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
	}
}

function setCategoricalCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = tw.term.values || {}
	const key = anno.key
	cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
	cell.fill = anno.color || values[key]?.color
	cell.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments
	cell.y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * i + t.totalHtAdjustments : 0
	const group = tw.legend?.group || tw.$id
	return { ref: t.ref, group, value, entry: { key, label: cell.label, fill: cell.fill } }
}

function setGeneVariantCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = anno.filteredValues || anno.values || [anno.value]
	cell.label = value.label || self.mclass[value.class].label
	const colorFromq = tw.q?.values && tw.q?.values[value.class]?.color
	cell.fill = colorFromq || value.color || self.mclass[value.class]?.color
	cell.class = value.class
	cell.value = value

	const colw = self.dimensions.colw
	if (s.cellEncoding != 'oncoprint') {
		cell.height = !s.transpose ? s.rowh / values.length : colw
		cell.width = !s.transpose ? colw : colw / values.length
		cell.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments
		cell.y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * i + t.totalHtAdjustments : 0
	} else if (value.dt == 1) {
		const divisor = s.cellEncoding == 'oncoprint' ? 3 : values.length
		cell.height = !s.transpose ? s.rowh / divisor : colw
		cell.width = !s.transpose ? colw : colw / values.length
		cell.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments
		cell.y = !s.transpose
			? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * 0.33333 + t.totalHtAdjustments
			: 0
	} else if (value.dt == 4) {
		cell.height = !s.transpose ? s.rowh : colw
		cell.width = !s.transpose ? colw : colw / values.length
		cell.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments
		cell.y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + t.totalHtAdjustments : 0
	} else {
		throw `cannot set cell props for dt='${value.dt}'`
	}

	const group = tw.legend?.group || 'Mutation Types'
	return { ref: t.ref, group, value: value.class, entry: { key: value.class, label: cell.label, fill: cell.fill } }
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
