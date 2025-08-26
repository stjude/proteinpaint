import { convertUnits } from '#shared/helpers.js'
import { dtsnvindel, dtcnv, dtfusionrna, dtgeneexpression, dtsv, dtmetaboliteintensity } from '#shared/common.js'
import { TermTypes } from '#shared/terms.js'
import { colorScaleMap } from '#shared/common.js'
import { CNVkey2order } from './matrix.legend'
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
	cell.fill =
		self.config.settings.matrix.twSpecificSettings?.[tw.$id]?.[key]?.color ||
		anno.color ||
		values[anno.key]?.color ||
		self.data.refs.byTermId?.[tw.$id]?.bins?.find(b => anno.key == b.name)?.color
	cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
	if (tw.q?.mode == 'continuous') {
		const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
		if (!twSpecificSettings[tw.$id]) twSpecificSettings[tw.$id] = {}
		const twSettings = twSpecificSettings[tw.$id]
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
			//cell.label = specialValue.label
			const group = tw.legend?.group || tw.$id
			return //{ ref: t.ref, group, value: specialValue.label || specialValue.key, entry: { key, label: cell.label, fill: cell.fill } }
		}

		// TODO: may use color scale instead of bars
		cell.fill = self.config.settings.matrix.twSpecificSettings?.[tw.$id]?.contBarColor || '#555'
		if (s.transpose) {
			cell.height = t.scale(cell.key)
			cell.x = twSettings.contBarGap // - cell.width
		} else {
			const vc = cell.term.valueConversion
			let renderV = vc ? cell.key * vc.scaleFactor : cell.key
			if (tw.q.convert2ZScore) {
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
					: tw.term.unit
					? `${cell.key.toFixed(2)} ${tw.term.unit}`
					: cell.key.toFixed(2)
			cell.height = renderV >= 0 ? t.scales.pos(renderV) : t.scales.neg(renderV)
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y =
				renderV >= 0
					? t.counts.posMaxHt + twSettings.contBarGap - cell.height
					: t.counts.posMaxHt + twSettings.contBarGap
			cell.convertedValueLabel = !vc ? '' : convertUnits(cell.key, vc.fromUnit, vc.toUnit, vc.scaleFactor)
		}
	} else {
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
		const group = tw.legend?.group || tw.$id
		return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
	}
}

function setSurvivalCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const key = tw.q?.mode == 'continuous' ? anno.value : anno.key
	cell.key = key
	cell.label =
		tw.q?.mode == 'continuous'
			? tw.term.unit
				? `${key} ${tw.term.unit}`
				: key
			: tw.term.values?.[key].label
			? tw.term.values?.[key].label
			: 'Exit code: ' + key
	cell.fill =
		self.config.settings.matrix.twSpecificSettings?.[tw.$id]?.[key]?.color || (key == 1 ? '#a1a3a6' : '#a3c88b')
	cell.order = 0
	if (tw.q?.mode == 'continuous') {
		const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
		if (!twSpecificSettings[tw.$id]) twSpecificSettings[tw.$id] = {}
		const twSettings = twSpecificSettings[tw.$id]
		if (!twSettings.contBarH) twSettings.contBarH = s.barh
		if (!('gap' in twSettings)) twSettings.contBarGap = 4

		cell.exitCodeKey = tw.term.values?.[anno.key].label || 'Exit code: ' + anno.key
		cell.fill =
			self.config.settings.matrix.twSpecificSettings?.[tw.$id]?.[anno.key]?.color ||
			(anno.key == 1 ? '#a1a3a6' : '#a3c88b')
		if (s.transpose) {
			cell.height = t.scale(cell.key)
			cell.x = twSettings.contBarGap
		} else {
			const vc = cell.term.valueConversion
			let renderV = vc ? cell.key * vc.scaleFactor : cell.key
			if (tw.q.convert2ZScore) {
				renderV = (renderV - t.mean) / t.std
				cell.zscoreLabel = ` (Z-score: ${renderV.toFixed(2)})`
			}
			cell.label = tw.term.unit ? `${cell.key.toFixed(2)} ${tw.term.unit}` : cell.key.toFixed(2)
			cell.height = renderV >= 0 ? t.scales.pos(renderV) : t.scales.neg(renderV)
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y =
				renderV >= 0
					? t.counts.posMaxHt + twSettings.contBarGap - cell.height
					: t.counts.posMaxHt + twSettings.contBarGap
			cell.convertedValueLabel = !vc ? '' : convertUnits(cell.key, vc.fromUnit, vc.toUnit, vc.scaleFactor)
		}
	} else {
		const vc = cell.term.valueConversion
		cell.timeToEventKey = vc ? convertUnits(anno.value, vc.fromUnit, vc.toUnit, vc.scaleFactor) : anno.value.toFixed(2)
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
	cell.fill =
		self.config.settings.matrix.twSpecificSettings?.[tw.$id]?.[key]?.color || anno.color || values[anno.key]?.color
	cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
	cell.y = height * i
	const group = tw.legend?.group || tw.$id
	return { ref: t.ref, group, value: anno.key, entry: { key, label: cell.label, fill: cell.fill } }
}

export function setGeneVariantCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = anno.renderedValues || anno.filteredValues || anno.values || [anno.value]
	const colorFromq = tw.q?.values && tw.q?.values[value.class]?.color // TODO: may fill in tw.q.values{} based on groupsetting
	if (tw.q?.type == 'predefined-groupset' || tw.q?.type == 'custom-groupset') {
		// groupsetting in use
		// value is name of group assignment
		cell.label = value
		// TODO: import getColors() from client/shared/common.js
		cell.fill = ['Mutated', 'Protein-changing', 'Truncating'].includes(value)
			? '#FF0000'
			: ['Wildtype', 'Rest'].includes(anno.key)
			? /*'#D3D3D3'*/ '#0000FF'
			: anno.key == 'Not tested'
			? /*'#fff'*/ '#00FF00'
			: '#000000'
		cell.value = { value, dt: tw.q.dt, origin: tw.q.origin }
		cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
		cell.y = height * i
		const group =
			tw.legend?.group || tw.q.origin
				? `${tw.q.origin[0].toUpperCase() + tw.q.origin.slice(1)} ${self.dt2label[tw.q.dt]}`
				: self.dt2label[tw.q.dt]
		return {
			ref: t.ref,
			group,
			value: anno.key,
			order: -2,
			entry: { key: anno.key, label: cell.label, fill: cell.fill, dt: tw.q.dt, origin: tw.q.origin }
		}
	} else {
		// groupsetting not in use
		// value is mutation object
		cell.label = value.label || self.mclass[value.class].label
		// may be overriden by a color scale by dt, if applicable below
		cell.fill = self.getValueColor?.(value.value) || colorFromq || value.color || self.mclass[value.class]?.color
		cell.class = value.class
		cell.value = value

		const colw = self.dimensions.colw
		if (s.cellEncoding == '') {
			cell.height = s.rowh / values.length
			cell.width = colw
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = height * i
		} else if (value.dt == dtsnvindel || value.dt == dtfusionrna || value.dt == dtsv) {
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
				if (s.oncoPrintSNVindelCellBorder) {
					// show white cell border for SNVindel in oncoPrint mode
					cell.border = true
				}
			}
		} else if (value.dt == dtcnv || value.dt == dtgeneexpression) {
			cell.height = s.rowh
			cell.width = colw
			cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
			cell.y = 0
		} else {
			throw `cannot set cell props for dt='${value.dt}'`
		}

		// distinguish between not tested or wildtype by
		// dt: snvindel vs CNV vs SV, etc
		if (value.class == 'Blank' || value.class == 'WT') {
			cell.label = `${self.dt2label[value.dt]} ${cell.label}`
		}

		// return the corresponding legend item data
		const byDt = self.state.termdbConfig.assayAvailability?.byDt
		const order = CNVkey2order(value.class)
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
						domain: t.domain ? t.domain : value.class == 'CNV_loss' ? [0, -minLoss] : [0, maxGain],
						colors: t.range,
						scales: value.dt == 4 && t.scales,
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
		} else if (value.dt == dtgeneexpression) {
			return {
				ref: t.ref,
				group: self.config.settings.hierCluster?.termGroupName || 'Gene Expression',
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
}

export function setHierClusterCellProps(cell, tw, anno, value, s, t, self, width, height, dx, dy, i) {
	const values = anno.renderedValues || anno.filteredValues || anno.values || [anno.value]
	cell.label = value.value
	// may overriden by a color scale by dt, if applicable below
	cell.fill = self.getValueColor?.(value.value)
	cell.value = value
	const colw = self.dimensions.colw

	cell.height = s.clusterRowh
	cell.width = colw
	cell.x = cell.totalIndex * dx + cell.grpIndex * s.colgspace
	cell.y = height * i

	const hierCluster = self.config.settings.hierCluster
	let groupName
	if (hierCluster?.termGroupName) {
		groupName = hierCluster.termGroupName
	} else if (tw.term.type == 'geneExpression') {
		groupName = 'Gene Expression'
		const unit = self.app.vocabApi.termdbConfig.queries?.geneExpression?.unit
		if (hierCluster?.zScoreTransformation) groupName += ' (Z-score)'
		else if (unit) groupName += ` (${unit})`
	} else if (tw.term.type == 'metaboliteIntensity') {
		groupName = 'Intensity'
	} else {
		groupName = 'Heatmap color scale'
	}

	return {
		ref: t.ref,
		group: groupName,
		order: -1,
		entry: {
			label: '',
			scale: self.hierClusterValues.scale,
			domain: colorScaleMap[self.settings.hierCluster.colorScale].domain,
			minLabel: self.hierClusterValues.min,
			maxLabel: self.hierClusterValues.max,
			order: 0,
			dt: value.dt
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
	condition: setCategoricalCellProps,
	integer: setNumericCellProps,
	float: setNumericCellProps,
	survival: setSurvivalCellProps,
	geneVariant: setGeneVariantCellProps,
	hierCluster: setHierClusterCellProps,
	[TermTypes.GENE_EXPRESSION]: setNumericCellProps,
	[TermTypes.METABOLITE_INTENSITY]: setNumericCellProps
}

export const maySetEmptyCell = {
	geneVariant: setVariantEmptyCell,
	integer: setNumericEmptyCell,
	float: setNumericEmptyCell,
	categorical: setDefaultEmptyCell,
	condition: setDefaultEmptyCell,
	survival: setNumericEmptyCell,
	[TermTypes.GENE_EXPRESSION]: setNumericEmptyCell,
	[TermTypes.METABOLITE_INTENSITY]: setNumericEmptyCell
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
		const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
		const twSettings = twSpecificSettings[cellTemplate.$id]
		const h = twSettings ? twSettings.contBarH + 2 * contBarGap : s.rowh
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
