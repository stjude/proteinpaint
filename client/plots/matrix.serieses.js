import { setCellProps, getEmptyCell, maySetEmptyCell } from './matrix.cells'

export function getSerieses(data) {
	const s = this.settings.matrix
	const serieses = []
	const { colw, dx, dy, xMin, xMax } = this.dimensions
	const dvt = this.config.divideBy || {}
	const divideByTermId = 'id' in dvt ? dvt.id : dvt.name
	const legendGroups = {}
	this.colorScaleByTermId = {}

	for (const t of this.termOrder) {
		const $id = t.tw.$id
		const termid = 'id' in t.tw.term ? t.tw.term.id : t.tw.term.name
		const isDivideByTerm = termid === divideByTermId
		const emptyGridCells = []
		const y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + t.totalHtAdjustments : 0
		const hoverY0 = (t.tw.settings?.gap || 0) + y
		const series = {
			t,
			tw: t.tw,
			cells: [],
			y,
			hoverY0,
			hoverY1: hoverY0 + (t.tw.settings?.barh || dy)
		}

		for (const so of this.unfilteredSampleOrder) {
			const { totalIndex, grpIndex, row } = so
			series.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace

			const anno = row[$id]
			const cellTemplate = {
				s: so,
				sample: row.sample,
				_SAMPLENAME_: row.sampleName,
				tw: t.tw,
				term: t.tw.term,
				termid,
				$id,
				totalIndex,
				grpIndex,
				row,
				t
			}

			if (!anno) {
				if (!so.grp.isExcluded && (s.useCanvas || so.grp)) {
					const cell = getEmptyCell(cellTemplate, s, this.dimensions)
					series.cells.push(cell)
				}
				continue
			}

			const key = anno.key

			const values = anno.filteredValues || anno.values || [anno.value]

			const numRects = s.cellEncoding == 'oncoprint' ? 1 : values.length
			const height = !s.transpose ? s.rowh / numRects : colw
			const width = !s.transpose ? colw : colw / values.length
			const siblingCells = []

			if (!anno || !anno.renderedValues?.length) {
				if (!so.grp.isExcluded && (s.useCanvas || so.grp)) {
					const cell = getEmptyCell(cellTemplate, s, this.dimensions)
					series.cells.push(cell)
				}
				continue
			}

			for (const [i, value] of values.entries()) {
				const cell = Object.assign({ key, siblingCells }, cellTemplate)
				cell.valueIndex = i

				// will assign x, y, width, height, fill, label, order, etc
				const legend = setCellProps[t.tw.term.type](cell, t.tw, anno, value, s, t, this, width, height, dx, dy, i)
				if (!s.useCanvas && (cell.x + cell.width < xMin || cell.x - cell.width > xMax)) continue
				if (legend) {
					for (const l of [legendGroups, so.grp.legendGroups]) {
						if (!l) continue
						if (!l[legend.group])
							l[legend.group] = {
								ref: legend.ref,
								values: {},
								order: legend.order,
								$id,
								dt: legend.entry.dt,
								origin: legend.entry.origin
							}
						const lg = l[legend.group]
						const legendK = legend.entry.origin ? legend.entry.origin + legend.value : legend.value

						if (!lg.values[legendK]) {
							lg.values[legendK] = JSON.parse(JSON.stringify(legend.entry))
							if (legend.entry.scale) lg.values[legendK].scale = legend.entry.scale
						}
						if (!lg.values[legendK].samples) lg.values[legendK].samples = new Set()
						lg.values[legendK].samples.add(row.sample)

						if (isDivideByTerm) {
							lg.values[legend.value].isExcluded = so.grp.isExcluded
						}
					}
				}

				if (!so.grp.isExcluded) {
					if (anno.renderedValues.includes(value)) series.cells.push(cell)
					siblingCells.push(cell)
				}
			}

			if (s.showGrid == 'rect' && !so.grp.isExcluded) {
				const cell = maySetEmptyCell[t.tw.term.type]?.(siblingCells, cellTemplate, s, this.dimensions)
				if (cell) emptyGridCells.push(cell)
			}
		}
		if (emptyGridCells.length) series.cells.unshift(...emptyGridCells)
		if (series.cells.length) serieses.push(series)
	}

	this.legendData = this.getLegendData(legendGroups, data.refs, this)
	for (const grp of this.sampleGroups) {
		grp.legendData = this.getLegendData(grp.legendGroups, data.refs, this)
	}
	return serieses
}
