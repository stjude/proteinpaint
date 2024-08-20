import { select } from 'd3-selection'
import { fillTermWrapper, termsettingInit } from '#termsetting'
import { isNumericTerm } from '../shared/terms'

export function setRenderers(self) {
	self.render = function () {
		const s = self.settings.matrix
		const l = self.layout
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0

		self.dom.clipRect
			.attr('x', d.xOffset - 1)
			.attr('y', 0)
			.attr('width', d.mainw + 3)
			// add 500 so that the column labels are not clipped
			.attr('height', d.mainh + 500)

		// const x = self.type == 'hierCluster' ? self.settings.hierCluster.xDendrogramHeight : 0
		// const y = self.type == 'hierCluster' ? self.settings.hierCluster.yDendrogramHeight : 0
		// self.dom.mainG
		// 	.attr('transform', `translate(${x},${y})`)

		self.renderSerieses(s, l, d, duration)
		self.renderLabels(s, l, d, duration)
		self.renderDivideByLabel(s, l, d, duration)

		self.dom.colBeam.attr('width', d.dx).attr('height', d.mainh).style('stroke', s.beamStroke)

		self.dom.rowBeam.attr('width', d.zoomedMainW).attr('height', s.rowh).style('stroke', s.beamStroke)
	}

	self.renderSerieses = function (s, l, d, duration) {
		if (self.prevUseCanvas != s.useCanvas) {
			self.dom.seriesesG.selectAll('g').remove()
		}
		if (s.useCanvas) {
			const _g = self.dom.seriesesG.selectAll('g')
			const g = /*(_g.size() && _g) ||*/ self.dom.seriesesG.append('g').datum(this.serieses)
			self.renderCanvas(this.serieses, g, d, s, _g, duration)
		} else {
			self.dom.seriesesG
				//.transition()
				//.duration(duration)
				.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

			const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(this.serieses, series => series.tw.$id)
			sg.exit().remove()
			sg.each(self.renderSeries)
			sg.enter().append('g').attr('class', 'sjpp-mass-series-g').style('opacity', 0.001).each(self.renderSeries)
			// need to reset imgBox and beam highlighters after rendering to avoid misaligned beam highlighters
			self.mouseout()
		}
		self.prevUseCanvas = s.useCanvas
	}

	self.renderSeries = async function (series) {
		const s = self.settings.matrix
		const d = self.dimensions
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g //.transition()
			//.duration(duration)
			.attr('transform', `translate(${series.x},${series.y})`)
			.style('opacity', 1)
		const last = series.cells[series.cells.length - 1]
		const height = series.y + last?.y + s.rowh

		const rects = g
			.selectAll('rect')
			.data(series.cells, cell => cell.sample + ';;' + cell.tw.$id + ';;' + cell.valueIndex)
		rects.exit().remove()
		rects.each(self.renderCell)
		rects.enter().append('rect').each(self.renderCell)
	}

	self.renderCanvas = async function (serieses, g, d, s, _g, duration) {
		const pxr = window.devicePixelRatio <= 1 ? 1 : window.devicePixelRatio
		// TODO: may not need to remove the image???
		g.selectAll('*').remove()
		const width = d.imgW
		const height = self.dimensions.mainh
		const canvas = window.OffscreenCanvas
			? new OffscreenCanvas(width * pxr, height * pxr)
			: // TODO: no need to support older browser versions???
			  self.dom.holder
					.append('canvas')
					.attr('width', pxr * width)
					.attr('height', pxr * height)
					.style('opacity', 0)
					.node()
		const ctx = canvas.getContext('2d')
		ctx.imageSmoothingEnabled = false
		ctx.imageSmoothingQuality = 'high'
		//ctx.lineWidth = 0.5
		//ctx.setTransform(pxr, 0, 0, pxr, 0, 0)
		ctx.scale(pxr, pxr)
		for (const series of serieses) {
			for (const cell of series.cells) {
				self.renderCellWithCanvas(ctx, cell, series, s, d, series.y)
			}
		}

		if (window.OffscreenCanvas) {
			const reader = new FileReader()
			reader.addEventListener(
				'load',
				() => {
					// remove a previously rendered image, if applicable, right before replacing it
					// so that there will be no flicker on update
					_g?.remove()
					self.dom.seriesesG
						//.transition()
						//.duration(duration)
						.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

					g.selectAll('image').remove()
					g.append('image')
						.attr('xlink:href', reader.result)
						.attr('x', d.xMin) //d.seriesXoffset + d.xMin) //d.xMin) // + d.xOffset) //d.seriesXoffset - d.xMin)
						.attr('width', width)
						.attr('height', height)
				},
				false
			)
			const blob = await canvas.convertToBlob({ quality: 1 })
			const dataURL = reader.readAsDataURL(blob)
		} else {
			_g?.remove()
			self.dom.seriesesG
				//.transition()
				//.duration(duration)
				.attr('transform', `translate(${d.xOffset + d.seriesXoffset},${d.yOffset})`)

			const dataURL = canvas.toDataURL()
			const ratio = window.devicePixelRatio * window.devicePixelRatio
			g.append('image').attr('width', width).attr('height', height).attr('xlink:href', dataURL)
			if (!window.OffscreenCanvas) canvas.remove()
		}
		// need to reset imgBox and beam highlighters after rendering to avoid misaligned beam highlighters
		self.mouseout()
	}

	self.renderCellWithCanvas = function (ctx, cell, series, s, d, _y) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const x = cell.x ? cell.x - d.xMin : 0
		const y = _y ? _y + cell.y : cell.y || 0
		const width = s.useMinPixelWidth ? Math.max(cell.width || d.colw, d.pxw) : cell.width || d.colw
		const height = 'height' in cell ? cell.height : s.rowh
		ctx.fillStyle = cell.fill
		ctx.fillRect(x, y, width, height)

		/* // lines don't render as well as rects
		ctx.lineWidth = width
		ctx.strokeStyle = cell.fill
		ctx.beginPath()
		ctx.moveTo(x,y)
		ctx.lineTo(x,height)
		ctx.stroke()
		*/
	}

	self.renderCell = function (cell) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const s = self.settings.matrix
		const rect = select(this)
			//.transition()
			// TODO: use s.duration if there is a way to avoid any remaining glitchy transitions
			// using the cell index in the .data() bind function seems to fix glitches in split cells,
			// but cells with overriden values flashes during a transition
			//.duration(0) //'x' in cell ? s.duration : 0)
			.attr('x', cell.x || 0)
			.attr('y', cell.y || 0)
			.attr('width', cell.width || self.dimensions.colw)
			.attr('height', 'height' in cell ? Math.max(0, cell.height) : s.rowh)
			.attr('shape-rendering', 'crispEdges')
			//.attr('stroke', cell.fill)
			.attr('stroke-width', 0)
			.attr('fill', cell.fill)
	}

	self.renderLabels = function (s, l, d, duration) {
		for (const direction of ['top', 'btm', 'left', 'right']) {
			const side = l[direction]
			side.box
				.style('display', side.display || '')
				//.transition()
				//.duration(duration)
				.attr('transform', side.attr.boxTransform)

			const labels = side.box.selectAll('.sjpp-matrix-label').data(side.data, side.key)
			labels.exit().remove()
			labels.each(renderLabel)
			labels.enter().append('g').attr('class', 'sjpp-matrix-label').each(renderLabel)

			function renderLabel(lab) {
				const g = select(this)
				//const textduration = g.attr('transform') ? duration : 0
				g //.transition()
					//.duration(textduration)
					.attr('transform', side.attr.labelGTransform)

				if (!g.select(':scope>text').size()) g.append('text')
				const showContAxis = !side.isGroup && lab.grp?.type !== 'hierCluster' && lab.tw?.q?.mode == 'continuous'
				const labelText = side.label(lab)
				const text = g.select(':scope>text').attr('fill', '#000')

				text
					//.transition()
					//.duration(textduration)
					.attr(
						'display',
						lab.grp?.type === 'hierCluster' && s.clusterRowh < 6
							? 'none'
							: side.attr.fontSize < 6 || labelText === 'configure'
							? 'none'
							: ''
					)
					.attr('font-size', lab.grp?.type === 'hierCluster' ? s.clusterRowh : side.attr.fontSize)
					.attr('text-anchor', side.attr.labelAnchor)
					.attr('transform', side.attr.labelTransform)
					.attr('cursor', 'pointer')
					.attr(side.attr.textpos.coord, side.attr.textpos.factor * (showContAxis ? 30 : 0))

				if (!Array.isArray(labelText)) {
					text.text(labelText)
					text.attr(
						'y',
						lab.grp?.type !== 'hierCluster' && lab.tw?.q?.mode == 'continuous'
							? 10
							: lab.grp?.type === 'hierCluster'
							? 0.3 * s.clusterRowh
							: 0
					)
				} else {
					// this is required because labelText in the if-condition is not wrapped in tspan,
					// so the text.selectAll('tspan') below will not remove previous label
					text.text('')

					const tspan = text.selectAll('tspan').data(labelText)
					//tspan.exit().remove()
					//tspan.attr('dx', getTspanDx).attr('font-size', getTspanFontSize).text(getTspanText)
					tspan
						.enter()
						.append('tspan')
						.attr('class', getTspanCls)
						.attr('dx', getTspanDx)
						.attr('font-size', getTspanFontSize)
						.text(getTspanText)
				}

				text
					.on('mouseover', labelText === 'configure' ? () => text.attr('opacity', 0.5) : null)
					.on('mouseout', labelText === 'configure' ? () => text.attr('opacity', 0) : null)

				const hasAxis = g.select('.sjpp-matrix-cell-axis').size() && true
				if (showContAxis && labelText) {
					if (!hasAxis) {
						g.append('g').attr('class', 'sjpp-matrix-cell-axis').attr('shape-rendering', 'crispEdges')
					}
					const axisg = g.select('.sjpp-matrix-cell-axis')
					axisg.selectAll('*').remove()
					const domain = [lab.counts.maxval, lab.counts.minval]
					if (s.transpose) domain.reverse()
					const d = self.dimensions
					const x = !s.transpose ? 0 : lab.tw.settings.gap - 1 - lab.labelOffset
					const y = !s.transpose ? lab.tw.settings.gap - 1 - lab.labelOffset : 0
					axisg
						.attr('shape-rendering', 'crispEdges')
						.attr('transform', `translate(${x},${y})`)
						.call(side.attr.axisFxn(lab.scales.full.domain(lab.scales.tickValues)).tickValues(lab.scales.tickValues))
				} else if (hasAxis) {
					g.select('.sjpp-matrix-cell-axis').remove()
				}
			}

			function getTspanCls(d) {
				return d.cls
			}
			function getTspanDx(d) {
				return d.dx
			}
			function getTspanFontSize(d) {
				return d.fontSize || side.attr.fontSize
			}
			function getTspanText(d) {
				return d.text
			}
		}
	}

	self.colLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		lab.labelOffset = 0.8 * d.colw
		const x = lab.grpIndex * s.colgspace + lab.totalIndex * d.dx + lab.labelOffset + lab.totalHtAdjustments
		const y = 0 //lab.tw?.q?.mode == 'continuous' ? -30 : 0
		return `translate(${x + d.seriesXoffset},${y})`
	}

	self.colGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const len = (lab.processedLst || lab.grp.lst).length
		const x =
			lab.grpIndex * s.colgspace +
			lab.prevGrpTotalIndex * d.dx +
			(len * d.dx) / 2 +
			s.grpLabelFontSize / 2 +
			lab.totalHtAdjustments
		return `translate(${x + d.seriesXoffset},0)`
	}

	self.rowLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = 0 // lab.tw?.q?.mode == 'continuous' ? -30 : 0
		lab.labelOffset = 0.7 * (lab.grp.type == 'hierCluster' ? s.clusterRowh : s.rowh)
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + lab.labelOffset + lab.totalHtAdjustments
		return `translate(${x},${y})`
	}

	self.rowGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const len = (lab.processedLst || lab.grp.lst).length
		const y =
			lab.grpIndex * s.rowgspace +
			lab.prevGrpTotalIndex * d.dy +
			(len * d.dy) / 2 +
			s.grpLabelFontSize / 2 +
			lab.totalHtAdjustments
		return `translate(0,${y})`
	}

	self.rowAxisGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = 0 // lab.tw?.q?.mode == 'continuous' ? -30 : 0
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + 0.7 * s.rowh + lab.totalHtAdjustments
		return `translate(${x},${y})`
	}

	self.renderDivideByLabel = async (s, l, d) => {
		self.dom.mainG.selectAll('.sjpp-matrix-divide-by-label').remove()
		if (!self.config.divideBy) return
		const name = self.config.divideBy?.term.name || ''
		const text = name.length <= s.rowlabelmaxchars ? name : name.slice(0, s.rowlabelmaxchars) + '…'
		const sides = !s.transpose ? [l.left, l.right] : [l.top, l.bottom]
		const box = sides.find(d => !d.isGroup)?.box
		const y = (s.collabelpos == 'top' ? d.mainh + s.collabelmaxchars : -s.collabelmaxchars) + 8
		const anchor = s.rowlabelpos == 'left' ? 'end' : 'start'
		const cl = s.controlLabels

		const gNote = box.append('g').attr('class', 'sjpp-matrix-divide-by-label').attr('transform', `translate(0, ${y})`)

		gNote
			.append('text')
			.attr('text-anchor', anchor)
			.attr('font-style', 'italic')
			.attr('y', -20)
			.text(`${cl.Samples} grouped by`)

		const g = box
			.datum({ tw: self.config.divideBy })
			.append('g')
			.attr('class', 'sjpp-matrix-divide-by-label')
			.attr('transform', `translate(0, ${y})`)

		const textElem = g
			.append('text')
			.attr('text-anchor', anchor)
			.attr('font-weight', 600)
			.text(text)
			.on('click', (event, d) => {
				pill.showMenu(event, textElem.node())
			})

		g.append('title').text(`${cl.Samples} are grouped by this gene or variable. Click to edit.`)

		const customMenuOptions = []
		const tvsKey = isNumericTerm(self.config.divideBy.term) ? 'ranges' : 'values'
		if (
			self.config.legendValueFilter.lst?.find(
				l => l.legendGrpName == self.config.divideBy.term.id || l.legendGrpName == self.config.divideBy.term.name
			)?.tvs[tvsKey]?.length
		) {
			customMenuOptions.push({ label: `Show filtered ${cl.samples}`, callback: self.showDeletedSampleGroups })
		}

		const pill = await termsettingInit({
			menuOptions: '{edit,replace,remove}',
			//numericEditMenuVersion: opts.numericEditMenuVersion,

			customMenuOptions, //custom menu options other than menuOptions
			vocabApi: self.app.vocabApi,
			vocab: self.state.vocab,
			//activeCohort: opts.state?.activeCohort,
			holder: g,
			debug: self.opts.debug,
			usecase: { target: 'matrix' },
			getBodyParams: () => {
				const currentGeneNames = self.termOrder
					.filter(t => t.tw.term.type === 'geneVariant')
					.map(t =>
						t.tw.term.chr ? `${t.tw.term.chr}:${t.tw.term.start}-${t.tw.term.stop}` : t.tw.term.gene || t.tw.term.name
					) // TODO term.gene replaces term.name
				return { currentGeneNames }
			},
			callback: async tw => {
				// data is object with only one needed attribute: q, never is null
				if (tw && !tw.q) throw 'data.q{} missing from pill callback'
				if (tw?.term && isNumericTerm(tw.term)) {
					// any numeric term should be discrete when used as divideBy term
					// tw is missing when dividedBy term deleted
					tw.q = { ...tw.q, mode: 'discrete' }
				}
				if (tw) await fillTermWrapper(tw, self.app.vocabApi)
				await pill.main(tw ? tw : { term: null, q: null })
				box.datum({ tw })
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						divideBy: tw,
						legendValueFilter: self.mayRemoveTvsEntry(self.config.divideBy)
					}
				})
			}
		})
		const arg = {
			term: self.config.divideBy.term,
			q: self.config.divideBy.q
		}
		if (self.config.divideBy.$id) arg.$id = self.config.divideBy.$id
		pill.main(arg)
	}

	self.adjustSvgDimensions = async function (prevTranspose) {
		const s = self.settings.matrix
		const hc = self.settings.hierCluster || {}
		const hcHeight = hc.yDendrogramHeight || 0
		const hcWidth = hc.xDendrogramHeight || 0
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0

		// wait for labels to render; when transposing, must wait for
		// the label rotation to end before measuring the label height and width
		await sleep(prevTranspose == s.transpose ? duration : s.duration)

		const l = self.layout
		// these are the label boxes
		const topBox = l.top.box.node().getBBox()
		const btmBox = l.btm.box.node().getBBox()
		const leftBox = l.left.box.node().getBBox()
		const rtBox = l.right.box.node().getBBox()
		const legendBox = self.dom.legendG.node().getBBox()
		const seriesBox = self.dom.seriesesG.node().getBBox()

		d.extraWidth = leftBox.width + rtBox.width + s.margin.left + s.margin.right + s.rowlabelgap * 2
		d.extraHeight = topBox.height + btmBox.height + s.margin.top + s.margin.bottom + s.collabelgap * 2
		d.svgw = d.mainw + d.extraWidth + hcWidth
		d.svgh = d.mainh + d.extraHeight + legendBox.height + 20 + s.scrollHeight + hcHeight
		self.dom.svg
			//.transition()
			//.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		//calculate the max gene label
		let maxLabelWidth = self.type == 'hierCluster' ? 0 : leftBox.width,
			maxLabelNumChars = 0
		if (hc.xDendrogramHeight) {
			self.dom.termLabelG.selectAll('.sjpp-matrix-label').each(function (d) {
				if (d.grp.type !== 'hierCluster') return
				// TODO: may enable this optimization to only detect the label box width
				//       if the text length difference is likely to affect the width
				//       DOM measurements like getBBox() may affect performance if there are lots of labels
				// if (d.label.length < maxLabelNumChars - 10) return
				const box = this.getBBox()
				if (box.width > maxLabelWidth) {
					maxLabelWidth = box.width
					maxLabelNumChars = d.label.length
				}
			})
		}

		// note: two leftBox.width terms cancels to zero
		const x = -l.left.offset + hcWidth + maxLabelWidth
		// with hierCluster:
		// in case the term dendrograms + max term label width is less than the leftBox.width of all row labels,
		// then the mainG and top/left dendrograms must be offset have an additional offset based on the difference
		const xAdjust = !hc.xDendrogramHeight ? 0 : Math.max(leftBox.width - (hc.xDendrogramHeight + maxLabelWidth), 0)
		const y = (l.top.display == 'none' ? 0 : topBox.height) - l.top.offset + hcHeight
		self.dom.mainG
			//.transition()
			//.duration(duration)
			.attr('transform', `translate(${x + xAdjust},${y})`)

		self.dom.clipRect
			// the cliprect has to be moved upwards, plus increased height to that adjustment value,
			// in order to display all characters of every column/group label
			.attr('y', -y)
			// add 500 so that the column labels are not clipped
			.attr('height', d.mainh + 500 + y)

		// this position is based on layout.btm.attr.boxTransform, plus box height and margins
		const legendX = d.xOffset + (s.transpose ? 20 : 0)
		const legendY = d.yOffset + d.mainh + s.collabelgap + (l.btm.display == 'none' ? 0 : btmBox.height) + 20

		self.dom.legendG
			//.transition()
			//.duration(duration)
			.attr('transform', `translate(${legendX},${legendY})`)

		if (hc.xDendrogramHeight) {
			const dendroX = maxLabelWidth + xAdjust - l.left.offset + d.xOffset - d.dx / 2
			self.dom.hcClipRect
				.attr('x', dendroX + hcWidth + d.dx / 2)
				.attr('y', 0)
				.attr('width', d.mainw + 3)
				// add 500 so that the column labels are not clipped
				.attr('height', d.mainh + hc.yDendrogramHeight + 500)

			// for easy reference when scrolling interactively
			self.topDendroX = dendroX + d.seriesXoffset
			self.dom.topDendrogram.attr('transform', `translate(${self.topDendroX}, 0)`)
			const y = l.top.display == 'none' ? 0 : topBox.height + s.collabelgap
			self.dom.leftDendrogram.attr('transform', `translate(${dendroX - maxLabelWidth - 10}, ${y})`)
		}
	}
}

function getRectFill(d) {
	if (d.fill) return d.fill
	/*** TODO: class should be for every values entry, as applicable ***/
	const cls = d.class || (Array.isArray(d.values) && d.values[0].class)
	if (!cls) console.log
	return cls ? mclass[cls].color : '#555'
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
