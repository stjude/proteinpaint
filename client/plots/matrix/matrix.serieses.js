import { setCellProps, getEmptyCell, maySetEmptyCell, setGeneVariantCellProps } from './matrix.cells'
import { TermTypes } from '#shared/terms.js'

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
		const cellht = t.grp.type == 'hierCluster' ? s.clusterRowh : dy
		const htAdjust = t.grp.type == 'hierCluster' ? 0 : t.totalHtAdjustments
		const y = s.transpose ? 0 : t.totalIndex * cellht + t.visibleGrpIndex * s.rowgspace + htAdjust
		const twSpecificSettings = this.config.settings.matrix.twSpecificSettings
		const hoverY0 = (twSpecificSettings[$id]?.contBarGap || 0) + y
		const series = {
			t,
			tw: t.tw,
			cells: [],
			y,
			hoverY0,
			hoverY1: hoverY0 + (twSpecificSettings[$id]?.contBarColor || cellht)
		}

		for (const so of this.unfilteredSampleOrder) {
			const { totalIndex, grpIndex, row } = so
			series.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace

			const anno = row[$id]
			const cellTemplate = {
				s: so,
				sample: row.sample,
				tw: t.tw,
				term: t.tw.term,
				termid,
				$id,
				totalIndex,
				grpIndex,
				row,
				t,
				seriesY: y
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

				let legend
				if (typeof t.tw.setCellProps == 'function') {
					// use extended tw method if present
					legend = t.tw.setCellProps(cell, anno, value, s, t, this, width, height, dx, dy, i)
				} else {
					// hierCluster terms have their own setCellProps
					// when groupsetting is used for geneVariant term, should treat as categorical term
					const cellProps =
						t.grp.type == 'hierCluster'
							? setCellProps['hierCluster']
							: (t.tw.term.type == 'geneVariant' &&
									(t.tw?.q?.type == 'predefined-groupset' || t.tw?.q?.type == 'custom-groupset')) ||
							  t.tw.term.type == 'samplelst'
							? setCellProps['categorical']
							: setCellProps[t.tw.term.type]

					// will assign x, y, width, height, fill, label, order, etc
					legend = cellProps(cell, t.tw, anno, value, s, t, this, width, height, dx, dy, i)
				}

				if (!s.useCanvas && (cell.x + cell.width < xMin || cell.x - cell.width > xMax)) continue
				if (legend) {
					for (const l of [legendGroups, so.grp.legendGroups]) {
						if (!l) continue
						if (!l[legend.group]) {
							l[legend.group] = {
								ref: legend.ref,
								values: {},
								order: legend.order,
								$id,
								origin: legend.entry.origin
							}
							// legend group dt needs to be an array because a legend group such as Mutations/Consequences
							// could have legend items from multiple dts (dt=1, dt=2, dt=5)
							if (legend.entry.dt) l[legend.group].dt = [legend.entry.dt]
						}

						const lg = l[legend.group]
						if (lg.dt && !lg.dt.includes(legend.entry.dt)) lg.dt.push(legend.entry.dt)
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
				const cell =
					t.grp.type == 'hierCluster'
						? getEmptyCell(cellTemplate, s, this.dimensions)
						: maySetEmptyCell[t.tw.term.type]?.(siblingCells, cellTemplate, s, this.dimensions)
				if (cell) emptyGridCells.push(cell)
			}
		}
		if (emptyGridCells.length) series.cells.unshift(...emptyGridCells)
		if (series.cells.length) serieses.push(series)
	}

	addAllHiddenLegendGroups(legendGroups, this)
	this.legendData = this.getLegendData(legendGroups, data.refs, this)
	for (const grp of this.sampleGroups) {
		grp.legendData = this.getLegendData(grp.legendGroups, data.refs, this)
	}
	return serieses
}

// Add a legendGroup for the a legend group whose legends are all hidden
function addAllHiddenLegendGroups(legendGroups, self) {
	for (const valueFilter of self.config.legendValueFilter.lst) {
		if (valueFilter.tvs.term.type == 'categorical' && !legendGroups[valueFilter.tvs.term.$id]) {
			legendGroups[valueFilter.tvs.term.$id] = {
				ref: {},
				values: {},
				$id: valueFilter.tvs.term.$id
			}
		} else if (valueFilter.tvs.term.type == 'geneVariant' && !legendGroups[valueFilter.legendGrpName]) {
			legendGroups[valueFilter.legendGrpName] = {
				ref: {},
				values: {},
				dt: [valueFilter.tvs.values[0].dt],
				origin: valueFilter.tvs.values[0].origin
			}
		} else if (
			(valueFilter.tvs.term.type == 'integer' || valueFilter.tvs.term.type == 'float') &&
			!legendGroups[valueFilter.tvs.term.$id]
		) {
			legendGroups[valueFilter.tvs.term.$id] = {
				ref: {},
				values: {},
				$id: valueFilter.tvs.term.$id
			}
		}
	}
}
