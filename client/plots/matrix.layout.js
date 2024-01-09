import { getCompInit, copyMerge, deepEqual } from '../rx'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10, interpolateReds, interpolateBlues } from 'd3-scale-chromatic'
import { axisLeft, axisTop, axisRight, axisBottom } from 'd3-axis'

export function setAutoDimensions(xOffset) {
	const m = this.state.config.settings.matrix
	if (!this.autoDimensions) this.autoDimensions = new Set()

	if (!m.colw) this.autoDimensions.add('colw')
	else this.autoDimensions.delete('colw')
	if (!m.rowh) this.autoDimensions.add('rowh')
	else this.autoDimensions.delete('rowh')

	const s = this.settings.matrix
	this.computedSettings = {
		useCanvas: this.sampleOrder.length > m.svgCanvasSwitch
	}

	if (s.availContentWidth) {
		this.availContentWidth = s.availContentWidth
	} else {
		let boundingWidth = this.dom.contentNode.getBoundingClientRect().width
		if (boundingWidth < 600) boundingWidth = window.document.body.clientWidth

		const padding = 65
		// should be estimated based on label-fontsize and longest label
		// const labelOffset = !s.transpose
		// 	? s.termLabelOffset + s.termGrpLabelOffset
		// 	: s.sampleLabelOffset + s.sampleGrpLabelOffset
		const hcw = this.state.config.settings.hierCluster?.xDendrogramHeight || 0
		this.availContentWidth = boundingWidth - padding - s.margin.right - xOffset - hcw //- 0.5*labelOffset
	}

	if (this.autoDimensions.has('colw')) {
		const totalColgspace = s.colgspace * Math.max(0, this.visibleSampleGrps.size - 1)
		const tentativeGaps = this.sampleOrder.length * s.colspace + totalColgspace
		const spacedColw = (this.availContentWidth - tentativeGaps) / this.sampleOrder.length
		const tentativeColw = Math.max(s.colwMin, Math.min(spacedColw, s.colwMax))
		// detect if using colspace will cause the tentative computed widths to be exceeded
		if (s.zoomLevel * tentativeColw < 2) {
			this.computedSettings.colw = (this.availContentWidth - totalColgspace) / this.sampleOrder.length
			this.computedSettings.colspace = s.zoomLevel <= 1 || s.zoomLevel * this.computedSettings.colw < 2 ? 0 : s.colspace
		} else {
			this.computedSettings.colw = tentativeColw
			this.computedSettings.colspace = s.colspace
		}
	}

	if (this.autoDimensions.has('rowh')) {
		this.computedSettings.rowh = Math.max(5, Math.round(screen.availHeight / this.numTerms))
	}

	copyMerge(this.settings.matrix, this.computedSettings)
}

export function setLabelsAndScales() {
	const s = this.settings.matrix
	this.cnvValues = {}
	// ht: standard cell dimension for term row or column
	const ht = s.transpose ? s.colw : s.rowh
	const grpTotals = {}
	const processedLabels = { sampleGrpByName: {}, termGrpByName: {} }
	let totalHtAdjustments = 0

	for (const t of this.termOrder) {
		const countedSamples = new Set()
		t.counts = { samples: 0, hits: 0 }

		// store counts for each subGroup in subGroupCounts
		t.counts.subGroupCounts = {}
		for (const group of this.sampleGroups) {
			t.counts.subGroupCounts[group.name] = {
				samplesTotal: 0, // number of counted (not Blank or WT) samples
				classes: {} // number of each class
			}
			if (t.tw.term.type == 'geneVariant') {
				// for a geneVariant term, the number of samples not tested
				t.counts.subGroupCounts[group.name].samplesNotTested = 0 //number of samples not tested
			}
		}
		if (!processedLabels.termGrpByName[t.grp.name || '']) {
			const name = t.grp.name || ''
			t.grp.label = name.length < s.termGrpLabelMaxChars ? name : name.slice(0, s.termGrpLabelMaxChars) + '...'
			processedLabels.termGrpByName[name] = t.grp.label
		}

		for (const sample of this.sampleOrder) {
			if (countedSamples.has(sample.row.sample)) continue
			const name = sample.grp.name || ''
			if (!(name in processedLabels.sampleGrpByName)) {
				sample.grp.label =
					name.length < s.sampleGrpLabelMaxChars ? name : name.slice(0, s.sampleGrpLabelMaxChars) + '...'
				if (this.config.divideBy) sample.grp.label += ` (${sample.grp.lst.length})`
				processedLabels.sampleGrpByName[name] = sample.grp.label
			}
			const sampleName = sample.row._ref_.label || ''
			sample.label =
				sampleName.length < s.collabelmaxchars ? sampleName : sampleName.slice(0, s.collabelmaxchars) + '...'

			const anno = sample.row[t.tw.$id]
			if (!anno) continue
			// This is the second call to classifyValues(), to determine case/hit counts for row labels
			const { filteredValues, countedValues, renderedValues } = this.classifyValues(
				anno,
				t.tw,
				t.grp,
				this.settings.matrix,
				sample.row
			)
			anno.filteredValues = filteredValues
			anno.countedValues = countedValues
			anno.renderedValues = renderedValues
			if (anno.countedValues?.length) {
				t.counts.samples += 1
				t.counts.hits += anno.countedValues.length
				if (t.tw.q?.mode == 'continuous') {
					const v = anno.value
					if (!t.tw.term.values?.[v]?.uncomputable) {
						if (!('minval' in t.counts) || t.counts.minval > v) t.counts.minval = v
						if (!('maxval' in t.counts) || t.counts.maxval < v) t.counts.maxval = v
					}
				}
				if (t.tw.term.type == 'geneVariant' && anno.values) {
					for (const val of anno.values) {
						if (val.dt == 4 && 'value' in val && !s.ignoreCnvValues) {
							const v = val.value
							const minKey = v < 0 ? 'minLoss' : 'minGain'
							const maxKey = v < 0 ? 'maxLoss' : 'maxGain'
							if (!(minKey in this.cnvValues) || this.cnvValues[minKey] > v) this.cnvValues[minKey] = v
							if (!(maxKey in this.cnvValues) || this.cnvValues[maxKey] < v) this.cnvValues[maxKey] = v
						}
					}
				}
			}
			const subGroup = t.counts.subGroupCounts?.[sample.grp.name]

			const countedValuesNoSkip = anno.filteredValues.filter(v => {
				// doesn't consider geneVariantCountSamplesSkipMclass as countedValues does
				if (t.tw.term.type == 'geneVariant') {
					// do not count wildtype and not tested as hits
					if (v.class == 'WT' || v.class == 'Blank') return false
				}
				return true
			})

			if (countedValuesNoSkip.length) {
				//count the samples and classes in each subGroup
				if (t.tw.term.type == 'geneVariant') {
					let sampleCounted = false
					for (const countedValue of countedValuesNoSkip) {
						if (s.geneVariantCountSamplesSkipMclass.includes(countedValue.class)) {
							if (!subGroup.notTestedClasses) subGroup.notTestedClasses = {}
							if (!(countedValue.class in subGroup.notTestedClasses)) subGroup.notTestedClasses[countedValue.class] = 1
							else subGroup.notTestedClasses[countedValue.class] += 1
						} else if (!(countedValue.class in subGroup.classes)) {
							if (!sampleCounted) {
								subGroup.samplesTotal += 1
								sampleCounted = true
							}
							subGroup.classes[countedValue.class] = 1
						} else {
							if (!sampleCounted) {
								subGroup.samplesTotal += 1
								sampleCounted = true
							}
							subGroup.classes[countedValue.class] += 1
						}
					}
				} else {
					subGroup.samplesTotal += 1
					for (const countedValue of countedValuesNoSkip) {
						if (!(countedValue in subGroup.classes)) subGroup.classes[countedValue] = 1
						else subGroup.classes[countedValue] += 1
					}
				}
			}

			if (anno.filteredValues?.length && t.tw.term.type == 'geneVariant') {
				//count the samples that are not tested in each subGroup
				const notTested = anno.filteredValues.every(v => v.class == 'Blank')
				if (notTested) {
					// sample not tested for all assays
					subGroup.samplesNotTested += 1
				}
			}
		}

		t.label = t.tw.label || t.tw.term.name
		if (t.label.length > s.rowlabelmaxchars) t.label = t.label.slice(0, s.rowlabelmaxchars) + '...'
		const termGroupName = this.config?.settings.hierCluster?.termGroupName
		if (s.samplecount4gene && t.tw.term.type.startsWith('gene') && (!termGroupName || t.grp.name !== termGroupName)) {
			const count =
				s.samplecount4gene === 'abs'
					? t.counts.samples
					: ((100 * t.counts.samples) / this.sampleOrder.length).toFixed(1) + '%'
			t.label = `${t.label} (${count})`
		}

		if (t.tw.q?.mode == 'continuous') {
			if (!t.tw.settings) t.tw.settings = {}
			if (!t.tw.settings.barh) t.tw.settings.barh = s.barh
			if (!('gap' in t.tw.settings)) t.tw.settings.gap = 4
			const barh = t.tw.settings.barh
			const absMin = Math.abs(t.counts.minval)
			const rangeSpansZero = t.counts.minval < 0 && t.counts.maxval > 0
			const ratio = t.counts.minval >= 0 ? 1 : t.counts.maxval / (absMin + t.counts.maxval)
			t.counts.posMaxHt = ratio * barh

			const vc = t.tw.term.valueConversion
			if (vc) {
				// convert values
				t.counts.minval *= vc.scaleFactor
				t.counts.maxval *= vc.scaleFactor
			}

			const tickValues =
				// rangeSpansZero || t.counts.maxval <= 0
				// 	? [t.counts.minval, t.counts.maxval]
				// 	: [t.counts.maxval, t.counts.minval]
				[t.counts.maxval, t.counts.minval]

			t.scales = {
				tickValues,
				full: scaleLinear().domain(tickValues).range([1, barh])
			}
			if (t.counts.maxval >= 0) {
				const domainMin = rangeSpansZero ? 0 : t.counts.minval
				t.scales.pos = scaleLinear().domain([domainMin, t.counts.maxval]).range([1, t.counts.posMaxHt])
			}
			if (t.counts.minval < 0) {
				const domainMax = rangeSpansZero ? 0 : t.counts.maxval
				t.scales.neg = scaleLinear()
					.domain([domainMax, t.counts.minval])
					.range([1, barh - t.counts.posMaxHt - t.tw.settings.gap])
			}
		} else if (t.tw.term.type == 'geneVariant') {
			if ('maxLoss' in this.cnvValues || 'maxGain' in this.cnvValues) {
				const maxVals = []
				if ('maxLoss' in this.cnvValues) maxVals.push(this.cnvValues.maxLoss)
				if ('maxGain' in this.cnvValues) maxVals.push(this.cnvValues.maxGain)
				t.scales = {
					loss: interpolateBlues,
					gain: interpolateReds,
					max: Math.max(...maxVals)
				}
			}
		}

		t.totalHtAdjustments = totalHtAdjustments
		t.rowHt = t.tw.settings ? t.tw.settings.barh + 2 * t.tw.settings.gap : ht
		const adjustment = t.rowHt - ht
		totalHtAdjustments += adjustment

		// adjustment when last row is in continous mode
		t.cumulativeAdjustment = totalHtAdjustments

		if (!(t.visibleGrpIndex in grpTotals)) grpTotals[t.visibleGrpIndex] = { htAdjustment: 0 }
		grpTotals[t.visibleGrpIndex].htAdjustment += adjustment
		t.grpTotals = grpTotals[t.visibleGrpIndex]
	}
}

export function setLayout() {
	const s = this.settings.matrix
	const [col, row] = !s.transpose ? ['sample', 'term'] : ['term', 'sample']
	const [_t_, _b_] = s.collabelpos == 'top' ? ['', 'Grp'] : ['Grp', '']
	const [_l_, _r_] = s.rowlabelpos == 'left' ? ['', 'Grp'] : ['Grp', '']
	const top = col + _t_
	const btm = col + _b_
	const left = row + _l_
	const right = row + _r_

	// TODO: should not need aliases, rename class properties to simplify
	this.samples = this.sampleOrder
	this.sampleGrps = this.sampleOrder.filter(s => s.index === 0)
	this.terms = this.termOrder
	this.termGrps = this.termOrder.filter(t => t.index === 0)

	const layout = {}
	const sides = { top, btm, left, right }
	for (const direction in sides) {
		const d = sides[direction]
		const Direction = direction[0].toUpperCase() + direction.slice(1)
		layout[direction] = {
			prefix: d,
			data: this[`${d}s`],
			offset: s[`${d}LabelOffset`],
			box: this.dom[`${d}LabelG`],
			key: this[`${d}Key`],
			label: this[`${d}Label`],
			render: this[`render${Direction}Label`],
			isGroup: sides[direction].includes('Grp')
		}
	}

	const yOffset = layout.top.offset + s.margin.top + s.scrollHeight
	const xOffset = layout.left.offset + s.margin.left

	this.setAutoDimensions(xOffset)
	this.setLabelsAndScales()

	const colw = Math.max(s.colwMin, Math.min(s.colwMax, s.colw * s.zoomLevel))
	const dx = colw + s.colspace
	const nx = this[`${col}s`].length
	const dy = s.rowh + s.rowspace
	const ny = this[`${row}s`].length
	const mainwByColDimensions =
		nx * (colw + s.colspace) +
		this[`${col}Grps`].length * s.colgspace +
		(this[`${col}s`].slice(-1)[0]?.totalHtAdjustments || 0)
	const mainw = Math.min(mainwByColDimensions, this.availContentWidth)

	const lastRow = this[`${row}s`].slice(-1)[0]
	const mainh = ny * dy + (this[`${row}Grps`].length - 1) * s.rowgspace + (lastRow?.cumulativeAdjustment || 0)

	const colLabelFontSize = Math.min(
		Math.max(colw + s.colspace - 2 * s.collabelpad - s.colspace, s.minLabelFontSize),
		s.maxLabelFontSize
	)

	const topFontSize = _t_ == 'Grp' ? s.grpLabelFontSize : colLabelFontSize
	layout.top.attr = {
		boxTransform: `translate(${xOffset}, ${yOffset - s.collabelgap})`,
		adjustBoxTransform: dx =>
			layout.top.box.attr('transform', `translate(${xOffset + dx}, ${yOffset - s.collabelgap})`),
		labelTransform: 'rotate(-90)',
		labelAnchor: 'start',
		labelGY: 0,
		labelGTransform: this[`col${_t_}LabelGTransform`],
		fontSize: topFontSize,
		textpos: { coord: 'y', factor: -1 },
		axisFxn: axisTop
	}
	if (layout.top.prefix == 'sample') layout.top.display = colw >= s.minLabelFontSize ? '' : 'none'

	const btmFontSize = _b_ == 'Grp' ? s.grpLabelFontSize : colLabelFontSize
	layout.btm.attr = {
		boxTransform: `translate(${xOffset}, ${yOffset + mainh + s.collabelgap})`,
		adjustBoxTransform: dx =>
			layout.btm.box.attr('transform', `translate(${xOffset + dx}, ${yOffset + mainh + s.collabelgap})`),
		labelTransform: 'rotate(-90)',
		labelAnchor: 'end',
		labelGY: 0,
		labelGTransform: this[`col${_b_}LabelGTransform`],
		fontSize: btmFontSize,
		textpos: { coord: 'y', factor: 1 },
		axisFxn: axisBottom
	}
	if (layout.btm.prefix == 'sample') layout.btm.display = colw >= s.minLabelFontSize ? '' : 'none'

	const leftFontSize =
		_l_ == 'Grp'
			? s.grpLabelFontSize
			: Math.max(s.rowh + s.rowspace - 2 * s.rowlabelpad - s.rowspace, s.minLabelFontSize)
	layout.left.attr = {
		boxTransform: `translate(${xOffset - s.rowlabelgap}, ${yOffset})`,
		labelTransform: '',
		labelAnchor: 'end',
		labelGX: 0,
		labelGTransform: this[`row${_l_}LabelGTransform`],
		fontSize: leftFontSize,
		textpos: { coord: 'x', factor: -1 },
		axisFxn: axisLeft
	}

	const rtFontSize =
		_r_ == 'Grp' ? s.grpLabelFontSize : Math.max(s.rowh + s.rowspace - 2 * s.rowlabelpad, s.minLabelFontSize)
	layout.right.attr = {
		boxTransform: `translate(${xOffset + mainw + s.rowlabelgap}, ${yOffset})`,
		labelTransform: '',
		labelAnchor: 'start',
		labelGX: 0,
		labelGTransform: this[`row${_r_}LabelGTransform`],
		fontSize: rtFontSize,
		textpos: { coord: 'x', factor: 1 },
		axisFxn: axisRight
	}

	this.dom.sampleLabelsPG.attr('clip-path', s.transpose ? '' : `url(#${this.seriesClipId})`)
	this.dom.termLabelsPG.attr('clip-path', s.transpose ? `url(#${this.seriesClipId})` : '')

	this.layout = layout
	if (!s.zoomCenterPct) {
		s.zoomCenterPct = 0.5
		s.zoomIndex = Math.round((s.zoomCenterPct * mainw) / dx)
		s.zoomGrpIndex = this.sampleOrder[s.zoomIndex]?.grpIndex || 0
	}
	// zoomCenter relative to mainw
	const zoomCenter = s.zoomCenterPct * mainw
	const centerCellX = s.zoomIndex * dx + s.zoomGrpIndex * s.colgspace
	const zoomedMainW = nx * dx + (this[`${col}Grps`].length - 1) * s.colgspace
	const seriesXoffset =
		s.zoomLevel <= 1 && mainw >= zoomedMainW ? 0 : Math.max(zoomCenter - centerCellX, mainw - zoomedMainW)

	//
	// canvas-related dimensions, computed to not exceed an ultrawide, zoomed-in
	// image width limit that causes the canvas to not render, and also
	// the possibly narrowed image must be positioned correctly
	//
	// for a canvas-generated image, the image is sharper when the image width is not an integer,
	// so subtract a negligible decimal value to have a numeric real/float width value
	const imgW = (s.imgWMax > zoomedMainW ? zoomedMainW : s.imgWMax) - 0.0000001
	const halfImgW = 0.5 * imgW
	// determine how the canvas image will be offset relative to the center of mainw (the visible width)
	const unwantedRightOvershoot = Math.max(0, centerCellX + halfImgW - zoomedMainW)
	const imgLeftMin = Math.max(0, centerCellX - Math.min(halfImgW, imgW) - unwantedRightOvershoot)
	// canvas cells with x posistions that fall outside of xMin and xMax will not be rendered,
	// since they will be outside the computed allowed image width
	const xMin = s.zoomLevel <= 1 && mainw >= zoomedMainW ? 0 : imgLeftMin
	const xMax = imgW + xMin
	// console.log({ imgW, mainw, xMin, xMax, seriesXoffset, imgLeftMin, xOffset, centerCellX, zoomedMainW, imgWMax: s.imgWMax })

	this.dimensions = {
		xMin,
		xMax,
		dx,
		dy,
		xOffset,
		yOffset,
		mainw,
		mainh,
		colw,
		zoomedMainW,
		seriesXoffset: seriesXoffset > 0 ? 0 : seriesXoffset,
		maxMainW: Math.max(mainwByColDimensions, this.availContentWidth),
		imgW,
		// recompute the resolvable "pixel width", in case the pixel ratio changes
		// when moving the browser window to a different monitor,
		// will be used to sharpen canvas shapes that are smaller than this pixel width
		pxw: 1 / window.devicePixelRatio
	}
}
