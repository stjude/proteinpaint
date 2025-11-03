import { select, pointer } from 'd3-selection'
import { format as d3format } from 'd3-format'
import { fillTermWrapper, termsettingInit } from '#termsetting'
import { icons, newSandboxDiv, Menu, renderTable, table2col } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { TermTypes, isNumericTerm, NUMERIC_DICTIONARY_TERM } from '#shared/terms.js'
import { mclass, dt2label, dtsnvindel, dtcnv, dtgeneexpression, dtmetaboliteintensity } from '#shared/common.js'
import { rgb2hex } from '#src/client'
import { getSamplelstTW, getFilter, addNewGroup } from '../../mass/groups.js'
import { TwBase } from '#tw/TwBase'

let inputIndex = 0
const svgIcons = {
	externalLink: '' //`<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512" transform="scale(0.8)" style="display: inline-block; position:relative; top: -2px; left:4px;" ><!--!Font Awesome Free 6.5.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.--><path d="M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z"/></svg>`
}

export function setInteractivity(self) {
	let t
	self.delayedMouseoutHandler = () => {
		if (t) clearTimeout(t)
		t = setTimeout(self.mouseout, 500)
	}
	self.showCellInfo = function (event) {
		if (self.activeLabel || self.zoomArea) return
		if (event.target.__data__?.isLegendItem) {
			// do not show info for matrix legend
			return
		}
		if (!(event.target.tagName == 'rect' || event.target.tagName == 'image')) {
			const d = event.target.__data__
			const grp = d?.grp
			if (grp?.legendData) {
				if (event.target.closest('.sjpp-matrix-series-group-label-g')) self.displaySampleGroupInfo(event, grp)
			} //else if (d?.isLegendItem) self.handleLegendMouseover(event, d)
			return
		}
		if (event.target.tagName !== 'rect' && !self.imgBox) self.imgBox = event.target.getBoundingClientRect()
		const d = event.target.tagName == 'rect' ? event.target.__data__ : self.getImgCell(event)
		// TODO: svg-rendered cell rects may be thin and hard to mouse over,
		// but the tooltip should still display info
		if (!d || !d.term || !d.sample) {
			self.dom.tip.hide()
			self.mouseout()
			return
		}

		const x = self.dimensions.xOffset + self.dimensions.seriesXoffset
		const y = self.dimensions.yOffset
		const s = self.settings.matrix
		const l = s.controlLabels

		const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
		const twBarh = twSpecificSettings[d.tw.$id]?.contBarH
		const twGap = twSpecificSettings[d.tw.$id]?.contBarGap

		self.dom.rowBeam
			.attr('x', x)
			.attr('y', y + d.seriesY)
			.attr('height', twBarh ? twBarh + 2 * twGap : d.t.grp.type == 'hierCluster' ? s.clusterRowh : s.rowh)
			.style('display', '')

		self.dom.colBeam
			.attr('x', x + d.x)
			.attr('y', y)
			.style('display', '')

		self.dom.matrixCellHoverOver.clear()
		const table = table2col({ holder: self.dom.matrixCellHoverOver.d.append('div') })

		if (d.term.type == 'geneVariant' && d.tw.q?.type == 'values') {
			{
				const [c1, c2] = table.addRow()
				c1.html(l.Sample)
				c2.html(d.row._ref_.label || d.value?.sample)
			}
			{
				const [c1, c2] = table.addRow()
				c1.html('Gene')
				c2.html(d.term.name)
			}

			const siblingCellLabels = {}
			if (d.siblingCells)
				for (const c of d.siblingCells) {
					if (c.$id != d.$id) continue
					const v = c.value
					const p = v.pairlst
					const dtLabel = v.origin ? `${v.origin} ${dt2label[v.dt]}` : dt2label[v.dt]
					// TODO: when the same label can apply to multiple values/hits in the same matrix cell,
					// list that label only once but with a hit count, instead of listing that same label
					// as multiple table rows in the mouseover
					const label = getLabel(c, v, p)
					/* display as two column tabel, do not display these info and do not show gradient CNV anymore
				const info = []
				if (v.label && v.label !== c.label) info.push(v.label)
				if ('value' in v) info.push(`${s.cnvUnit}=${v.value}`)
				if (v.chr) {
					const pos = v.pos ? `:${v.pos}` : v.start ? `:${v.start}-${v.stop}` : ''
					info.push(`${v.chr}${pos}`)
				}
				if (v.alt) info.push(`${v.ref}>${v.alt}`)

				const tds = !info.length
					? `<td colspan='2' style='text-align: center'>${label}</td>`
					: `<td style='text-align: right'>${label}</td><td>${info.map(i => `<span>${i}</span>`).join(' ')}</td>`
				*/
					const color = c.fill == v.color || v.class == 'Blank' ? '' : c.fill

					if (!siblingCellLabels[dtLabel]) {
						siblingCellLabels[dtLabel] = [{ label, color }]
					} else {
						siblingCellLabels[dtLabel].push({ label, color })
					}
					/*
				do not use gradient CNV anymore
				if (v.dt == 4 && 'value' in v) {
					const textColor = Math.abs(v.value) < 0.5 ? '#000' : '#fff'
					rows.push(
						`<tr style='background-color: ${color}; color: ${textColor}; padding-left: 2px; padding-right: 2px'>${tds}</tr>`
					)
				} else {
					rows.push(`<tr style='color: ${color}'>${tds}</tr>`)
				}
				*/
				}
			for (const [dtLabel, classArray] of Object.entries(siblingCellLabels).sort((a, b) => b.length - a.length)) {
				const [c1, c2] = table.addRow()
				c1.html(dtLabel)
				c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${classArray[0].color}" ></span>
					${classArray[0].label}`)
				for (const classType of classArray.slice(1)) {
					const [c1, c2] = table.addRow()
					c1.html('')
					c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${classType.color}" ></span>
						${classType.label}`)
				}
			}
		} else {
			{
				const [c1, c2] = table.addRow()
				c1.html(l.Sample)
				c2.html(d.row._ref_.label)
			}

			let survivalInfo
			if (d.term.type == TermTypes.SURVIVAL && d.exitCodeKey) {
				survivalInfo = d.term.values?.[d.exitCodeKey]?.label || d.exitCodeKey
			}

			if (survivalInfo || d.convertedValueLabel || d.label || d.label === 0) {
				// show term value row only when not undefined
				if (d.term.type == TermTypes.GENE_EXPRESSION) {
					{
						const [c1, c2] = table.addRow()
						c1.html('Gene')
						c2.html(d.term.gene)
					}
					{
						const colorSquare =
							(d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous') || d.tw.q.mode !== 'continuous'
								? `<span style="display:inline-block; width:12px; height:12px; background-color:${
										d.fill == '#fff' || d.fill == 'transparent' ? '' : d.fill
								  }" ></span>`
								: ''

						const [c1, c2] = table.addRow()
						c1.html('Gene Expression')
						c2.html(
							`${colorSquare} ${d.convertedValueLabel || d.label}${
								d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous' && d.zscoreLabel ? d.zscoreLabel : ''
							}`
						)
					}
				} else if (d.term.type == TermTypes.METABOLITE_INTENSITY) {
					{
						const [c1, c2] = table.addRow()
						c1.html('Metabolite')
						c2.html(d.term.name)
					}
					{
						const colorSquare =
							(d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous') || d.tw.q.mode !== 'continuous'
								? `<span style="display:inline-block; width:12px; height:12px; background-color:${
										d.fill == '#fff' || d.fill == 'transparent' ? '' : d.fill
								  }" ></span>`
								: ''

						const [c1, c2] = table.addRow()
						c1.html('Metabolite Intensity')
						c2.html(
							`${colorSquare} ${d.convertedValueLabel || d.label}${
								d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous' && d.zscoreLabel ? d.zscoreLabel : ''
							}`
						)
					}
				} else if (d.term.type == TermTypes.SURVIVAL) {
					{
						const [c1, c2] = table.addRow()
						c1.html(d.term.name)
						c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${
							d.fill == '#fff' || d.fill == 'transparent' ? '' : d.fill
						}" ></span>
							${survivalInfo || d.label}`)
					}

					const timeToEventKey =
						'Time to Event: ' +
						(d.timeToEventKey
							? d.timeToEventKey + (d.term.unit ? ` ${d.term.unit}` : '')
							: (d.convertedValueLabel || d.label) +
							  (d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous' && d.zscoreLabel ? d.zscoreLabel : ''))

					{
						const [c1, c2] = table.addRow()
						c1.html('')
						c2.html(timeToEventKey)
					}
				} else {
					const colorSquare =
						(d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous') || d.tw.q.mode !== 'continuous'
							? `<span style="display:inline-block; width:12px; height:12px; background-color:${
									d.fill == '#fff' || d.fill == 'transparent' ? '' : d.fill
							  }" ></span>`
							: ''

					const [c1, c2] = table.addRow()
					c1.html(d.term.name)
					c2.html(
						`${colorSquare} ${d.convertedValueLabel || d.label}${
							d.tw?.q?.convert2ZScore && d.tw.q.mode == 'continuous' && d.zscoreLabel ? d.zscoreLabel : ''
						}`
					)
				}
			}
		}
		self.dom.matrixCellHoverOver.show2(event.clientX, event.clientY)
		self.dom.mainG.on('mouseout', self.mouseout)
	}

	self.getImgCell = function (event) {
		if (!self.imgBox) {
			if (event.target.tagName == 'image') self.imgBox = event.target.getBoundingClientRect()
			else return
		}
		//const [x,y] = pointer(event, event.target)
		const y = event.clientY - self.imgBox.y - event.target.clientTop
		const d = event.target.__data__.find(series => series.hoverY0 <= y && y <= series.hoverY1)
		if (!d) return
		const { xMin, dx } = self.dimensions
		const x2 = event.clientX - self.imgBox.x - event.target.clientLeft + xMin
		for (const cell of d.cells) {
			const min = cell.x
			const max = cell.x + dx
			if (min <= x2 && x2 <= max) return cell
		}
		return null
	}

	self.mouseout = function () {
		if (!self.activeLabel && self.dom.tip) self.dom.tip.hide()
		delete self.imgBox
		if (self.dom.colBeam) self.dom.colBeam.style('display', 'none')
		if (self.dom.rowBeam) self.dom.rowBeam.style('display', 'none')
		if (self.dom.matrixCellHoverOver) self.dom.matrixCellHoverOver.clear()
	}

	self.mouseclick = async function (event, data) {
		// clicking only show actions for available genomic data; can later expand to non-genomic data and custom overrides
		const q = self.state.termdbConfig.queries
		if (!q) return // no genomic queries

		if (!(q.singleSampleGenomeQuantification || q.singleSampleMutation || q.NIdata || q.DZImages)) return // only works for these queries

		self.dom.mainG.on('mouseout', null)
		delete self.imgBox
		const sampleData = data || event.target.__data__

		if (!sampleData) return // !!! it's undefined when dragging on the sample names
		const s = self.config.settings.matrix
		// preliminary fix: assign string sample name for "sample_id", which is used by data queries below
		const sample = {
			sample_id: sampleData.row._ref_.label
		}
		//when clicking a cell in SV, CNV, mutation panels
		const geneName = sampleData.term?.type == 'geneVariant' ? sampleData.term.name : null

		self.dom.clickMenu.clear()
		self.dom.dendroClickMenu.clear()
		self.dom.brushMenu.clear()
		self.dom.matrixCellHoverOver.clear()

		if (self.dom.sampleListMenu) self.dom.sampleListMenu.destroy()

		if (q.singleSampleGenomeQuantification) {
			for (const k in q.singleSampleGenomeQuantification) {
				const menuDiv = self.dom.clickMenu.d
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.attr('data-testid', 'sjpp-ssgp-menu-btn')
					.text(k)
					.on('click', async event => {
						const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
						sandbox.header.text(sample.sample_id)
						await (
							await import('#plots/plot.ssgq.js')
						).plotSingleSampleGenomeQuantification(
							self.state.termdbConfig,
							self.state.vocab.dslabel,
							k,
							sample,
							sandbox.body.append('div').style('margin', '20px'),
							self.app.opts.genome,
							geneName
						)
						menuDiv.remove()
						self.dom.clickMenu.d.selectAll('*').remove()
					})
			}
		}
		if (q?.singleSampleMutation) {
			const menuDiv = self.dom.clickMenu.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('data-testid', 'oncoMatrix_termLabel_disco_button')
				.text('Disco plot')
				.on('click', async event => {
					const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
					sandbox.header.text(sample.sample_id)
					;(await import('#plots/plot.disco.js')).default(
						self.state.termdbConfig,
						self.state.vocab.dslabel,
						sample,
						sandbox.body,
						self.app.opts.genome
					)
					menuDiv.remove()
					self.dom.clickMenu.d.selectAll('*').remove()
				})
		}

		if (q.DZImages) {
			// no longer used. replaced by wsimages
			const menuDiv = self.dom.clickMenu.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('data-testid', 'oncoMatrix_termLabel_dzi_button')
				.style('display', 'none')
				.text(`${q.DZImages.type} Images (0)`)

			const data = await dofetch3('sampledzimages', {
				body: {
					genome: self.app.opts.genome.name,
					dslabel: self.state.vocab.dslabel,
					sample_id: sample.sample_id
				}
			})

			if (data.sampleDZImages?.length > 0) {
				menuDiv.style('display', 'block')
				menuDiv.text(`${q.DZImages.type} Images (${data.sampleDZImages.length})`)
				menuDiv.on('click', async _ => {
					const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
					sandbox.header.text(sample.sample_id)
					;(await import('#plots/dziviewer/plot.dzi.js')).default(
						self.state.vocab.dslabel,
						sandbox.body,
						self.app.opts.genome,
						sample.sample_id,
						data.sampleDZImages
					)

					menuDiv.remove()
					self.dom.clickMenu.d.selectAll('*').remove()
				})
			}
		}

		if (q.NIdata) {
			for (const [queryKey, ref] of Object.entries(q.NIdata)) {
				const menuDiv = self.dom.clickMenu.d
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Neuro Image: ' + queryKey)
					.on('click', async () => {
						self.dom.clickMenu.clear()

						const config = {
							chartType: 'brainImaging',
							queryKey,
							settings: {
								brainImaging: {
									brainImageL: ref.parameters.l,
									brainImageF: ref.parameters.f,
									brainImageT: ref.parameters.t
								}
							},
							selectedSampleFileNames: [sample.sample_id + '.nii']
						}
						self.app.dispatch({
							type: 'plot_create',
							config
						})
					})
			}
		}

		const l = self.settings.matrix.controlLabels
		const table = table2col({ holder: self.dom.clickMenu.d.append('div').append('span') })

		const templates = self.state.termdbConfig.urlTemplates
		if (templates?.sample) {
			const name = sampleData[templates.sample.namekey] || sampleData.sample || sampleData.row.sample
			const [c1, c2] = table.addRow()
			c1.html(l.Sample)
			c2.html(
				`<a href="${templates.sample.base}${name}" target="_blank">${sampleData.row._ref_.label} ${svgIcons.externalLink}</a>`
			)
		} else {
			const [c1, c2] = table.addRow()
			c1.html(l.Sample)
			c2.html(sampleData.row._ref_.label || sampleData.value.sample)
		}
		if (sampleData.term?.type == 'geneVariant' && sampleData.tw.q?.type == 'values') {
			if (sampleData.value) {
				if (templates?.gene) {
					const name = self.data.refs.byTermId[sampleData.tw.$id][templates.gene.namekey]
					const [c1, c2] = table.addRow()
					c1.html('Gene')
					c2.html(
						`<a href="${templates.gene.base}${name}" target="_blank">${sampleData.tw.term.name} ${svgIcons.externalLink}</a>`
					)
				} else {
					const [c1, c2] = table.addRow()
					c1.html('Gene')
					c2.html(sampleData.term.name)
				}

				const siblingCellLabels = {}
				for (const c of sampleData.siblingCells) {
					if (c.$id != sampleData.$id) continue
					const v = c.value
					const p = v.pairlst
					const dtLabel = v.origin ? `${v.origin} ${dt2label[v.dt]}` : dt2label[v.dt]
					const label = getLabel(c, v, p)
					const color = c.fill == v.color || v.class == 'Blank' ? '' : c.fill

					if (!siblingCellLabels[dtLabel]) {
						siblingCellLabels[dtLabel] = [{ label, color }]
					} else {
						siblingCellLabels[dtLabel].push({ label, color })
					}
				}
				for (const [dtLabel, classArray] of Object.entries(siblingCellLabels).sort((a, b) => b.length - a.length)) {
					const [c1, c2] = table.addRow()
					c1.html(dtLabel)
					c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${classArray[0].color}" ></span>
						${classArray[0].label}`)
					for (const classType of classArray.slice(1)) {
						const [c1, c2] = table.addRow()
						c1.html('')
						c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${classType.color}" ></span>
							${classType.label}`)
					}
				}
			}
		} else if (sampleData.term) {
			let survivalInfo
			if (sampleData.term.type == TermTypes.SURVIVAL && sampleData.exitCodeKey) {
				survivalInfo = sampleData.term.values?.[sampleData.exitCodeKey]?.label || sampleData.exitCodeKey
			}

			if (survivalInfo || sampleData.convertedValueLabel || sampleData.label || sampleData.label === 0) {
				// show term value row only when not undefined
				if (sampleData.term.type == TermTypes.GENE_EXPRESSION) {
					{
						const [c1, c2] = table.addRow()
						c1.html('Gene')
						c2.html(sampleData.term.name)
					}
					{
						const colorSquare =
							(sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous') ||
							sampleData.tw.q.mode !== 'continuous'
								? `<span style="display:inline-block; width:12px; height:12px; background-color:${
										sampleData.fill == '#fff' || sampleData.fill == 'transparent' ? '' : sampleData.fill
								  }" ></span>`
								: ''

						const [c1, c2] = table.addRow()
						c1.html('Gene Expression')
						c2.html(
							`${colorSquare} ${sampleData.convertedValueLabel || sampleData.label}${
								sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous' && sampleData.zscoreLabel
									? sampleData.zscoreLabel
									: ''
							}`
						)
					}
				} else if (sampleData.term.type == TermTypes.METABOLITE_INTENSITY) {
					{
						const [c1, c2] = table.addRow()
						c1.html('Metabolite')
						c2.html(sampleData.term.name)
					}
					{
						const colorSquare =
							(sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous') ||
							sampleData.tw.q.mode !== 'continuous'
								? `<span style="display:inline-block; width:12px; height:12px; background-color:${
										sampleData.fill == '#fff' || sampleData.fill == 'transparent' ? '' : sampleData.fill
								  }" ></span>`
								: ''

						const [c1, c2] = table.addRow()
						c1.html('Metabolite Intensity')
						c2.html(
							`${colorSquare} ${sampleData.convertedValueLabel || sampleData.label}${
								sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous' && sampleData.zscoreLabel
									? sampleData.zscoreLabel
									: ''
							}`
						)
					}
				} else if (sampleData.term.type == TermTypes.SURVIVAL) {
					{
						const [c1, c2] = table.addRow()
						c1.html(sampleData.term.name)
						c2.html(`<span style="display:inline-block; width:12px; height:12px; background-color:${
							sampleData.fill == '#fff' || sampleData.fill == 'transparent' ? '' : sampleData.fill
						}" ></span>
							${survivalInfo || sampleData.label}`)
					}
					const timeToEventKey =
						'Time to Event: ' +
						(sampleData.timeToEventKey
							? sampleData.timeToEventKey + (sampleData.term.unit ? ` ${sampleData.term.unit}` : '')
							: (sampleData.convertedValueLabel || sampleData.label) +
							  (sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous' && sampleData.zscoreLabel
									? sampleData.zscoreLabel
									: ''))
					{
						const [c1, c2] = table.addRow()
						c1.html('')
						c2.html(timeToEventKey)
					}
				} else {
					const colorSquare =
						(sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous') ||
						sampleData.tw.q.mode !== 'continuous'
							? `<span style="display:inline-block; width:12px; height:12px; background-color:${
									sampleData.fill == '#fff' || sampleData.fill == 'transparent' ? '' : sampleData.fill
							  }" ></span>`
							: ''

					const [c1, c2] = table.addRow()
					c1.html(sampleData.term.name)
					c2.html(
						`${colorSquare} ${sampleData.convertedValueLabel || sampleData.label}${
							sampleData.tw?.q?.convert2ZScore && sampleData.tw.q.mode == 'continuous' && sampleData.zscoreLabel
								? sampleData.zscoreLabel
								: ''
						}`
					)
				}
			}
		}
		self.dom.clickMenu.show(event.clientX, event.clientY, false, true)
	}

	self.legendClick = function () {}

	self.svgMousemove = function (event) {
		if (!self.dragged) return
		const s = self.config.settings.matrix
		const d = self.dragged
		const x2 = !s.transpose ? d.x : d.x - d.clientX + event.clientX
		const y2 = !s.transpose ? d.y - d.clientY + event.clientY : d.y
		d.clone.attr('transform', `translate(${x2},${y2})`)
	}

	self.svgMouseup = function (event) {
		if (!self.dragged) return
		self.dragged.clone.remove()
		delete self.dragged
		delete self.clicked
	}

	self.getVisibleCenterCell = function (dx) {
		//const s = self.settings.matrix
		const d = self.dimensions
		if (d.seriesXoffset <= 0 && d.mainw >= d.zoomedMainW) {
			return self.sampleOrder[Math.floor(self.sampleOrder.length / 2)]
		}
		const w = 0.5 * d.mainw - d.seriesXoffset - dx
		const i = Math.round(w / d.dx)
		return self.sampleOrder[i]
	}

	//setSampleActions(self)
	setTermActions(self)
	setTermGroupActions(self)
	setSampleGroupActions(self)
	setZoomPanActions(self)
	setResizeHandler(self)
	setLengendActions(self)
	setMutationSelectionActions(self)
}

function setResizeHandler(self) {
	let resizeId
	select(window).on(`resize.sjpp-${self.id}`, () => {
		if (resizeId) clearTimeout(resizeId)
		if (self.dimensions && self.layout) resizeId = setTimeout(resize, 200)
	})

	function resize() {
		// !!! this.abortCtl.abort()
		if (self.dimensions && self.layout) self.main()
	}
}

function setTermActions(self) {
	setLabelDragEvents(self, 'term')

	self.setPill = function (appState) {
		// will reuse a pill instance to show term edit menu
		self.pill = termsettingInit({
			tip: self.customTipApi,
			menuOptions: 'all',
			menuLayout: 'horizontal',
			vocabApi: self.app.vocabApi,
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			numericEditMenuVersion: ['discrete', 'continuous'],
			usecase: { target: 'matrix' },

			getBodyParams: () => {
				const currentGeneNames = []
				for (const g of self.config.termgroups) {
					// only consider hierCluster group for hierCluster plot
					if (self.chartType == 'hierCluster' && g.type != 'hierCluster') continue

					for (const t of g.lst) {
						if (t.term.chr) {
							currentGeneNames.push(`${t.term.chr}:${t.term.start}-${t.term.stop}`)
						} else if (t.term.gene) {
							currentGeneNames.push(t.term.gene)
						}
					}
				}
				if (currentGeneNames.length) return { currentGeneNames }
				return {}
			},

			//holder: {}, //self.dom.inputTd.append('div'),
			//debug: opts.debug,
			renderAs: 'none',
			callback: tw => {
				// data is object with only one needed attribute: q, never is null
				if (tw && !tw.q) throw 'data.q{} missing from pill callback'
				const t = self.activeLabel || self.lastactiveLabel
				if (tw) {
					// users could modify the term label, need to update tw.label to the latest label
					tw.label = t.tw.label
					if (t && t.tw) tw.$id = t.tw.$id
					const legendValueFilter = self.mayRemoveTvsEntry(tw)
					self.pill.main(Object.assign({ filter: self.state.filter }, tw))
					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.lstIndex],
								value: tw
							},
							{
								nestedKeys: ['legendValueFilter'],
								value: legendValueFilter
							}
						]
					})
				} else {
					self.removeTerm()
				}
				self.dom.tip.hide()
			}
		})
	}

	self.getMenuOptions = function (t) {
		return self.config.chartType == 'hierCluster' && t.grp.type === 'hierCluster'
			? '{remove,}'
			: t.tw.term.type == 'geneVariant'
			? '{edit,replace,remove}'
			: '*'
	}

	self.showTermMenu = async function (event) {
		const t = event.target.__data__
		if (!t || !t.tw || !t.grp) return
		const s = self.settings.matrix
		const l = s.controlLabels
		self.activeLabel = t
		self.dom.menutop.style('display', '').selectAll('*').remove()
		self.dom.menubody.style('padding', 0).selectAll('*').remove()

		// display loading... upon clicking a term row label
		const termMenuWaitDiv = self.dom.menutop.append('div').style('display', 'block').text('Loading...')
		self.dom.tip.show(event.clientX - 20, event.clientY - 20)

		await self.pill.main(
			Object.assign(
				{ tw: t.tw, menuOptions: self.getMenuOptions(t), filter: self.state.filter },
				t.tw ? t.tw : { term: null, q: null }
			)
		)
		termMenuWaitDiv.remove()

		self.dom.shortcutDiv = self.dom.menutop.append('div').style('z-index', 10000)
		self.showShortcuts(t, self.dom.shortcutDiv)

		self.dom.twMenuDiv = self.dom.menutop.append('div')
		const labelEditDiv = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		labelEditDiv.append('span').text(`${l.Term} `)

		const twlabel = t.tw.label || t.tw.term.name
		const vartype =
			t.tw.term.type == 'geneVariant' || t.tw.term.type == TermTypes.GENE_EXPRESSION
				? 'gene'
				: t.tw.term.type == TermTypes.METABOLITE_INTENSITY
				? 'metabolite'
				: 'variable'
		self.dom.twLabelInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', twlabel.length + 3)
			.attr('aria-label', `Type to edit the ${vartype} label`)
			.style('padding', '1px 5px')
			.style('text-align', 'center')
			.property('value', twlabel)
			.on('input', () => {
				const value = self.dom.twLabelInput.property('value')
				self.dom.twLabelInput.attr('size', value.length + 3)
				self.dom.twLabelEditBtn.style('display', value.trim() === twlabel ? 'none' : 'inline')
			})

		self.dom.twLabelEditBtn = labelEditDiv
			.append('button')
			.style('display', 'none')
			.style('margin-left', '5px')
			.html('submit')
			.on('click', () => {
				if (twlabel != self.dom.twLabelInput.property('value').trim()) self.updateTermLabel()
				self.dom.tip.hide()
			})

		if (vartype == 'gene') {
			// is gene, may show extra button for quick data access
			if (t.tw.term.type == 'geneVariant') {
				// lollipop btn for plotting gene-level mut data
				self.dom.gbButton = labelEditDiv
					.append('button')
					.style('text-align', 'center')
					.html('Lollipop')
					.attr('data-testid', 'oncoMatrix_cell_lollipop_button')
					.on('click', async () => {
						await self.launchGB(t)
						self.dom.tip.hide()
					})
			}
			// might add new btn to support other type, e.g. boxplot for geneexp
		}

		// Add gene summary button
		if (self.state.termdbConfig.urlTemplates?.gene && vartype == 'gene') {
			const templates = self.state.termdbConfig.urlTemplates
			self.dom.geneSummaryLink = labelEditDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-left', '5px')
				.style('text-align', 'center')
				.style('color', 'rgb(0, 0, 238)')
				.style('cursor', 'pointer')
				.style('text-decoration', 'underline')
				.html(`${templates.gene.defaultText || ''}${svgIcons.externalLink}`)
				.on('click', async () => {
					const name = self.data.refs.byTermId[t.tw.$id][templates.gene.namekey]
					window.open(`${templates.gene.base}${name}`, '_blank')
					self.dom.tip.hide()
				})
		}

		const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
		if (!twSpecificSettings[t.tw.$id]) twSpecificSettings[t.tw.$id] = {}
		const twSettings = twSpecificSettings[t.tw.$id]

		const rowHeightColorEditDiv = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		if (t.grp?.type !== 'hierCluster' && t.tw?.q?.mode == 'continuous') {
			rowHeightColorEditDiv.append('span').text('Row Height')
			self.dom.twRowheightInput = rowHeightColorEditDiv
				.append('input')
				.attr('type', 'number')
				.attr('aria-label', `edit the row height`)
				.style('padding', '1px 5px')
				.style('text-align', 'center')
				.style('width', '60px')
				.property('value', twSettings.contBarH)
				.on('keyup', async event => {
					if (event.code != 'Enter') return
					const newBarh = parseFloat(self.dom.twRowheightInput.node().value)
					twSettings.contBarH = newBarh

					self.app.dispatch({
						type: 'plot_edit',
						id: self.opts.id,
						config: { settings: { matrix: { twSpecificSettings } } }
					})
					self.dom.tip.hide()
				})
		}

		if (
			t.grp?.type !== 'hierCluster' &&
			t.tw?.q?.mode == 'continuous' &&
			t.tw.term.type != 'survival' &&
			t.tw.q.convert2ZScore != true
		) {
			rowHeightColorEditDiv.append('span').text('Bar Color')

			self.dom.twRowColorInput = rowHeightColorEditDiv
				.append('input')
				.attr('type', 'color')
				.attr('aria-label', `change the bar color`)
				.style('padding', '1px 5px')
				.attr('value', twSettings.contBarColor)
				.on('change', async () => {
					const color = self.dom.twRowColorInput.node().value
					twSettings.contBarColor = color
					self.app.dispatch({
						type: 'plot_edit',
						id: self.opts.id,
						config: { settings: { matrix: { twSpecificSettings } } }
					})
					self.dom.tip.hide()
				})
		}

		if (self.config.settings.matrix.maxSample) {
			self.dom.twMenuDiv
				.append('div')
				.style('text-align', 'center')
				.style('margin', '5px')
				.text(`#${l.samples}: ${t.counts.samples} rendered, ${t.allCounts.samples - t.counts.samples} not rendered`)
		}

		self.dom.twMenuBar = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		//menuBtnsDiv.on('click', () => menuBtnsDiv.style('display', 'none'))
		// must remember event target since it's cleared after async-await
		const clickedElem = event.target
		self.pill.showMenu(event, clickedElem, self.dom.twMenuBar)

		self.dom.grpMenuDiv = self.dom.menutop.append('div').style('margin-top', '10px')
		//self.showTermGroupInputs(self.dom.grpMenuDiv)
		//self.dom.tip.showunder(clickedElem)
		//self.dom.tip.show(event.clientX - 20, event.clientY - 20)
	}

	self.launchGB = t => {
		self.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'genomeBrowser',
				snvindel: { shown: true },
				geneSearchResult: { geneSymbol: t.tw.term.name }
			}
		})
	}

	self.updateTermLabel = () => {
		const value = self.dom.twLabelInput.property('value').trim()
		const t = self.activeLabel
		if (t.tw.label === value) return
		t.tw.label = value
		t.grp.lst[t.lstIndex] = t.tw
		self.app.dispatch({
			type: 'plot_nestedEdits',
			id: self.opts.id,
			edits: [
				{
					nestedKeys: ['termgroups', t.grpIndex],
					value: t.grp
				}
			]
		})
	}

	self.showShortcuts = (t, div) => {
		const l = self.settings.matrix.controlLabels
		div.style('text-align', 'center')
		//div.append('span').html('Shortcuts: ')

		// sorting icons
		const vartype =
			t.tw.term.type == 'geneVariant' || t.tw.term.type == TermTypes.GENE_EXPRESSION
				? 'gene'
				: t.tw.term.type == TermTypes.METABOLITE_INTENSITY
				? 'metabolite'
				: 'variable'
		const sortRevertable = self.type != 'hierCluster' && t.tw.sortSamples?.priority !== undefined
		div
			.append('span')
			.selectAll('div')
			.data(
				[
					{
						icon: 'corner',
						title: `Sort ${l.samples} against this ${vartype}, and position this ${vartype} at the top left corner`,
						disabled:
							t.grp.lst.length < 1 || (t.index === 0 && t.tw.sortSamples?.priority === 0) || self.type == 'hierCluster',
						handler: self.sortSamplesAgainstCornerTerm
					},
					{
						icon: 'left',
						title: `Sort ${l.samples} against this ${vartype}`,
						// should not disable sorting when hierCluster has top dendrogram
						disabled: t.tw.sortSamples?.priority === 0 && !self.config.settings.hierCluster?.clusterSamples,
						fill: sortRevertable ? 'rgba(200,100,100,0.5)' : '',
						handler: sortRevertable ? self.unsortSamplesAgainstTerm : self.sortSamplesAgainstTerm
					},
					{
						html: '&nbsp;|&nbsp;'
					},
					{
						icon: 'up',
						title: `Move this ${vartype} up`,
						disabled: t.index === 0 || self.type == 'hierCluster',
						handler: self.moveTermUp
					},

					{
						icon: 'down',
						title: `Move this ${vartype} down`,
						disabled: t.index === t.grp.lst.length - 1 || self.type == 'hierCluster',
						handler: self.moveTermDown
					}
				],
				d => d.icon
			)
			.enter()
			.append('div')
			.style('display', 'inline-block')
			.each(function (d) {
				const elem = select(this)
				if (d.icon) icons[d.icon](elem, d)
				else elem.html(d.html)
			})
	}

	self.sortSamplesAgainstCornerTerm = event => {
		event.stopPropagation()
		const t = self.activeLabel
		const termgroups = JSON.parse(JSON.stringify(self.termGroups))
		const grp = termgroups[t.grpIndex]
		const [tcopy, sorterTerms] = self.getSorterTerms(t)
		const removed = grp.lst.splice(t.lstIndex, 1)
		grp.lst.unshift(tcopy)
		grp.sortTermsBy = 'asListed'

		for (const g of termgroups) {
			if (g == grp) {
				for (const [priority, tw] of g.lst.entries()) {
					// the `by: 'values'` may be overridden by self.config.settings.matrix.sortPriority, if available
					if (!tw.sortSamples) tw.sortSamples = { priority, by: 'values' }
					tw.sortSamples.priority = priority
				}
			} else {
				for (const tw of g.lst) {
					if (!tw.sortSamples) continue
					tw.sortSamples.priority = sorterTerms.findIndex(t => t.tw?.$id === tw.$id) + grp.lst.length
				}
			}
		}

		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: {
				termgroups,
				settings: {
					matrix: {
						sortTermsBy: 'asListed'
					}
				}
			}
		})
		self.dom.tip.hide()
	}

	self.sortSamplesAgainstTerm = event => {
		event?.stopPropagation()
		const t = self.activeLabel
		const [tcopy] = self.getSorterTerms(t)
		if (t.grp.type == 'hierCluster') tcopy.sortSamples.by = 'values'
		const termgroups = self.termGroups
		termgroups[t.grpIndex].lst[t.lstIndex] = tcopy
		for (const g of termgroups) {
			for (const tw of g.lst) {
				if (!tw.sortSamples) continue
				if (tw.$id === t.tw.$id) {
					tw.sortSamples.priority = 0
				} else tw.sortSamples.priority += 1
			}
		}

		if (self.chartType == 'hierCluster') {
			// remove top dendrogram after sortting samples in hierCluster
			self.config.settings.hierCluster.clusterSamples = false
			self.config.settings.hierCluster.yDendrogramHeight = 0
		}

		self.config.termgroups = termgroups
		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: self.config
		})
		self.dom.tip.hide()
	}

	self.unsortSamplesAgainstTerm = (event, d) => {
		event.stopPropagation()
		const t = self.activeLabel || d.data.t
		const [tcopy] = self.getSorterTerms(t)
		const termgroups = self.termGroups
		termgroups[t.grpIndex].lst[t.lstIndex] = tcopy
		for (const g of termgroups) {
			for (const tw of g.lst) {
				if (!tw.sortSamples) continue
				if (tw.$id === t.tw.$id) {
					delete tw.sortSamples //.priority
				} else if ('sortSamples' in tw && 'priority' in tw.sortSamples) {
					if (tw.sortSamples.priority > t.sortSamples?.priority) tw.sortSamples.priority -= 1
				}
			}
		}
		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: {
				termgroups
			}
		})
		self.dom.tip.hide()
	}

	self.moveTermUp = event => {
		event.stopPropagation()
		const t = self.activeLabel
		const grp = self.termGroups[t.grpIndex]
		grp.lst.splice(t.lstIndex, 1)
		grp.lst.splice(t.lstIndex - 1, 0, t.tw)
		grp.sortTermsBy = 'asListed'

		self.app.dispatch({
			type: 'plot_nestedEdits',
			id: self.opts.id,
			edits: [
				{
					nestedKeys: ['termgroups', t.grpIndex],
					value: grp
				},
				{
					nestedKeys: ['settings', 'matrix', 'sortTermsBy'],
					value: 'asListed'
				}
			]
		})
		self.dom.tip.hide()
	}

	self.moveTermDown = event => {
		event.stopPropagation()
		const t = self.activeLabel
		const grp = self.termGroups[t.grpIndex]
		grp.lst.splice(t.lstIndex, 1)
		grp.lst.splice(t.lstIndex + 1, 0, t.tw)
		grp.sortTermsBy = 'asListed'

		self.app.dispatch({
			type: 'plot_nestedEdits',
			id: self.opts.id,
			edits: [
				{
					nestedKeys: ['termgroups', t.grpIndex],
					value: grp
				},
				{
					nestedKeys: ['settings', 'matrix', 'sortTermsBy'],
					value: 'asListed'
				}
			]
		})
		self.dom.tip.hide()
	}

	self.showTermEditMenu = async () => {
		self.dom.menubody.selectAll('*').remove()
		const t = self.activeLabel
		const s = self.config.settings.matrix
		const l = s.controlLabels

		if (t.tw.term.type == 'geneVariant') {
			const div = self.dom.menubody.append('div')
			const label = div.append('label')
			label.append('span').html(`Minimum # ${l.samples} to be visible`)

			const minNumSamples = 'minNumSamples' in t.tw ? t.tw.minNumSamples : ''
			const input = label
				.append('input')
				.attr('type', 'number')
				.style('margin-left', '5px')
				.style('width', '50px')
				.property('value', minNumSamples)

			div
				.append('div')
				.append('button')
				.html('Submit')
				.on('click', () => {
					const value = input.property('value')
					if (value === minNumSamples) return
					if (value === '') {
						delete t.tw.minNumSamples
					} else {
						t.tw.minNumSamples = Number(value)
					}

					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.lstIndex],
								value: t.tw
							}
						]
					})
					self.dom.tip.hide()
				})
		} else {
			await self.pill.main(
				Object.assign({ menuOptions: self.getMenuOptions(t), filter: self.state.filter }, self.activeLabel.tw)
			)
			self.pill.showMenu()
		}
	}

	self.showMoveMenu = async () => {
		self.dom.menubody.selectAll('*').remove()
		self.termBeingMoved = self.activeLabel
		const div = self.dom.menubody.append('div')
		div.append('span').html('Click on another label')
		self.makeInsertPosRadios(div)
	}

	self.showTermInsertMenu = () => {
		//self.dom.tip.clear()
		//self.dom.menutop = self.dom.tip.d.append('div')
		self.dom.menubody.selectAll('*').remove()

		self.dom.editbtns = self.dom.menubody.append('div')
		self.dom.editbody = self.dom.menubody.append('div')

		if (self.activeLabel.grp.type == 'hierCluster') {
			// for hierCluster term group, only allow to add current hierCluster term to current group
			self.showDictTermSelection(self.dom.editbody)
			return
		}

		const grpNameDiv = self.dom.editbtns.append('div').style('margin', '10px 5px')
		grpNameDiv.append('label').html(`Insert genes or variables in `)
		self.dom.grpNameSelect = grpNameDiv.append('select').on('change', () => {
			const value = self.dom.grpNameSelect.property('value')
			self.dom.grpNameTextInput
				.property('disabled', value == 'current')
				.property('value', value == 'current' ? self.activeLabel.grp.name : newGrpName)
		})
		self.dom.grpNameSelect
			.selectAll('option')
			.data([
				{ label: 'current', value: 'current', selected: true },
				{ label: 'new', value: 'new' }
			])
			.enter()
			.append('option')
			.attr('selected', d => d.selected)
			.html(d => d.label)

		grpNameDiv.append('span').html('&nbsp;group: &nbsp;')

		let newGrpName = ''
		self.dom.grpNameTextInput = grpNameDiv
			.append('input')
			.attr('type', 'text')
			.property('disabled', true)
			.property('value', self.activeLabel.grp.name)
			.on('change', () => {
				const name = self.dom.grpNameTextInput.property('value')
				if (name == self.activeLabel.grp.name) {
				} else {
					newGrpName = self.dom.grpNameTextInput.property('value')
				}
			})

		self.makeInsertPosRadios(self.dom.editbtns)

		//const termSrcDiv = self.dom.editbtns.append('div')
		//termSrcDiv.append('span').html('Source&nbsp;')
		self.showDictTermSelection(self.dom.editbody)
	}

	self.makeInsertPosRadios = function (div) {
		const insertPosInput = div
			.append('div') /*.style('display', 'inline-block')*/
			.style('margin', '10px 5px')
		insertPosInput.append('div').style('display', 'inline-block').style('padding-right', '10px').html('Insert&nbsp')

		const insertRadiosDiv = insertPosInput.append('div').style('display', 'inline-block')

		self.insertRadioId = `sjpp-matrix-${self.id}-insert-pos`
		const aboveLabel = insertRadiosDiv.append('label')
		aboveLabel
			.append('input')
			.attr('type', 'radio')
			.attr('value', 'above')
			.property('checked', true)
			.attr('name', self.insertRadioId)
		aboveLabel.append('span').html('above')

		insertRadiosDiv.append('span').html('&nbsp;&nbsp')

		const belowLabel = insertRadiosDiv.append('label')
		belowLabel.append('input').attr('type', 'radio').attr('value', 'below').attr('name', self.insertRadioId)
		belowLabel.append('span').html('&nbsp;below')
	}

	self.showDictTermSelection = async holder => {
		//self.dom.dictTermBtn.style('text-decoration', 'underline')
		//self.dom.textTermBtn.style('text-decoration', '')

		const usecase = { target: 'matrix', detail: 'termgroups' }
		if (self.chartType == 'hierCluster') {
			if (
				self.config.dataType == NUMERIC_DICTIONARY_TERM &&
				(!self.activeLabel || self.activeLabel.grp.type == 'hierCluster')
			) {
				usecase.target = 'numericDictTermCluster'
				usecase.detail = { exclude: self.state.termdbConfig.numericDictTermCluster?.exclude }
			} else if (
				self.config.dataType == TermTypes.METABOLITE_INTENSITY &&
				(!self.activeLabel || self.activeLabel.grp.type == 'hierCluster')
			) {
				usecase.target = TermTypes.METABOLITE_INTENSITY
				usecase.detail = 'term'
			} else {
				usecase.target = self.activeLabel.tw.term.type
				usecase.detail = 'term'
			}
		}
		const termdb = await import('#termdb/app')
		holder.selectAll('*').remove()
		termdb.appInit({
			holder: holder.append('div'),
			vocabApi: self.app.vocabApi,
			state: {
				vocab: self.state.vocab,
				activeCohort: self.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					usecase
				},
				...(!self.activeLabel || self.activeLabel.grp.type == 'hierCluster'
					? { selectedTerms: self.hcTermGroup.lst.map(t => t.term) }
					: {})
			},
			tree: {
				submit_lst
			},
			search: {
				handleGeneVariant: term => submit_lst([term])
			}
		})
	}

	async function submit_lst(termlst) {
		const newterms = await Promise.all(
			termlst.map(async _term => {
				const term = structuredClone(_term)
				const tw = 'id' in term ? { id: term.id, term } : { term }
				await fillTermWrapper(tw, self.app.vocabApi)
				return tw
			})
		)
		const t = self.activeLabel
		const termgroups = self.termGroups

		const isNumericDictTermCBut = self.config.dataType == NUMERIC_DICTIONARY_TERM && !t
		const isMetaboliteIntensityCBut = self.config.dataType == TermTypes.METABOLITE_INTENSITY && !t
		if (isNumericDictTermCBut || isMetaboliteIntensityCBut || t.grp.type == 'hierCluster') {
			const grp = isNumericDictTermCBut || isMetaboliteIntensityCBut ? termgroups[0] : termgroups[t.grpIndex]
			// for hiercluster group, use selected terms as new group.lst
			grp.lst.splice(0, grp.lst.length, ...newterms)
			self.app.dispatch({
				type: 'plot_nestedEdits',
				id: self.opts.id,
				edits: [
					{
						nestedKeys: ['termgroups', isNumericDictTermCBut || isMetaboliteIntensityCBut ? 0 : t.grpIndex, 'lst'],
						value: grp.lst
					}
				]
			})
		} else if (self.dom.grpNameSelect.property('value') == 'current') {
			const pos = self.insertRadioId && select(`input[name='${self.insertRadioId}']:checked`)?.property('value')
			const grp = termgroups[t.grpIndex]
			const i = pos == 'above' ? t.lstIndex : t.lstIndex + 1
			// remove this element
			grp.lst.splice(i, 0, ...newterms)
			self.app.dispatch({
				type: 'plot_nestedEdits',
				id: self.opts.id,
				edits: [
					{
						nestedKeys: ['termgroups', t.grpIndex, 'lst'],
						value: grp.lst
					}
				]
			})
		} else {
			const pos = self.insertRadioId && select(`input[name='${self.insertRadioId}']:checked`)?.property('value')
			const i = pos == 'above' ? t.grpIndex : t.grpIndex + 1
			termgroups.splice(i, 0, {
				name: self.dom.grpNameTextInput.property('value'),
				lst: newterms
			})
			self.app.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: { termgroups }
			})
		}
		self.dom.tip.hide()
	}

	self.showSortMenu = () => {
		/*
			sort rows and samples by:
			- #hits

			sort samples by #hits against
			- draggable divs of term names


			-- OR --

			[ ] move this row [above || below] [all rows || term names]

			[ ] sort samples against this term:
					// by: *hits _values _mutation class
					// priority: *first _last _order# [ ]

			Apply
		*/

		const t = self.activeLabel
		self.dom.menubody.selectAll('*').remove()

		self.dom.menubody.append('div').style('margin-top', '10px').style('text-align', 'center').html(t.tw.term.name)

		self.moveInput = undefined
		//if (t.grp.lst.length > 1) self.showTermMoveOptions(t)
		self.showSortOptions(t)
	}

	self.showTermMoveOptions = t => {
		const moveDiv = self.dom.menubody.append('div').style('margin-top', '10px')

		const moveLabel = moveDiv.append('label')
		self.moveInput = moveLabel.append('input').attr('type', 'checkbox').style('text-align', 'center')

		moveLabel.append('span').html(`&nbsp;move this row&nbsp;`)

		const movePos = moveDiv.append('select')
		movePos
			.selectAll('option')
			.data([
				{ label: 'before', value: 0 },
				{ label: 'after', value: 1 }
			])
			.enter()
			.append('option')
			.attr('value', d => d.value)
			.html(d => d.label)

		moveDiv.append('span').html('&nbsp;')

		const otherTermsInGrp = t.grp.lst
			.filter(tw => tw.$id != t.tw.$id)
			.map(tw => {
				return { label: tw.term.name, value: tw.$id }
			})
		const moveTarget = moveDiv.append('select')
		moveTarget
			.selectAll('option')
			.data([{ label: 'all', value: '*' }, ...otherTermsInGrp])
			.enter()
			.append('option')
			.attr('value', d => d.value)
			.html(d => d.label)
	}

	self.showSortOptions = t => {
		const sortColDiv = self.dom.menubody.append('div').style('margin-top', '10px')
		const sortColLabel = sortColDiv.append('label')
		const sortColInput = sortColLabel
			.append('input')
			.attr('type', 'checkbox')
			.property('checked', true)
			.style('text-align', 'center')

		const l = self.settings.matrix.controlLabels
		sortColLabel.append('span').html(`&nbsp;sort ${l.samples} against (in order of priority):`)

		const tcopy = self.showSorterTerms(sortColDiv, t)

		self.dom.menubody
			.append('button')
			.html('Apply')
			.on('click', () => {
				const matrix = JSON.parse(JSON.stringify(self.config.settings.matrix)) || {}
				delete tcopy.div
				delete tcopy.up
				delete tcopy.down
				delete tcopy.delete

				//if (self.moveInput.property('checked')) {}

				if (sortColInput.property('checked') || self.moveInput?.property('checked')) {
					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.lstIndex],
								value: tcopy
							}
						]
					})
				}

				self.dom.tip.hide()
			})
	}

	self.showSorterTerms = (sortColDiv, t) => {
		const [tcopy, sorterTerms] = self.getSorterTerms(t)
		const s = self.settings.matrix
		const l = s.controlLabels
		sortColDiv
			.append('div')
			.style('margin', '5px')
			.style('padding', '5px 10px')
			.selectAll('div')
			.data(sorterTerms, s => s.$id)
			.enter()
			.append('div')
			.style('width', 'fit-content')
			.style('margin', '3px')
			.style('cursor', 'default')
			.style('padding', '3px 10px')
			.style('border-radius', '5px')
			.style('color', 'black')
			.style('background-color', 'rgb(238, 238, 238)')
			.each(function (st, i) {
				st.sortSamples.priority = i
				st.div = select(this)
				const label = st.$id == 'sample' ? `${l.Sample} name` : st.term.name
				st.div.append('span').style('margin-right', '10px').html(label)
				st.up = st.div
					.append('span')
					.html(' &#9650; ')
					.style('display', i === 0 ? 'none' : 'inline')
					.style('color', '#555')
					.on('click', () => {
						this.parentNode.insertBefore(this, this.previousSibling)
						sorterTerms.splice(st.priority, 1)
						sorterTerms.splice(st.priority - 1, 0, st)
						updateSorterDivStyles()
					})

				st.down = st.div
					.append('span')
					.html(' &#9660; ')
					.style('display', i < sorterTerms.length - 1 ? 'inline' : 'none')
					.style('color', '#555')
					.on('click', () => {
						this.parentNode.insertBefore(this, this.nextSibling.nextSibling)
						sorterTerms.splice(st.priority, 1)
						sorterTerms.splice(st.priority + 1, 0, st)
						updateSorterDivStyles()
					})

				st.delete = st.div
					.append('span')
					.html(' &#10005; ')
					.style('display', 'inline')
					.style('color', 'rgb(255, 100, 100)')
					.on('click', () => {
						st.div.remove()
						sorterTerms.splice(st.priority, 1)
						updateSorterDivStyles()
					})
			})

		function updateSorterDivStyles() {
			for (const [i, st] of sorterTerms.entries()) {
				st.priority = i
				st.up.style('display', st.priority > 0 ? 'inline' : 'none')
				st.down.style('display', st.priority < sorterTerms.length - 1 ? 'inline' : 'none')
			}
		}

		return tcopy
	}

	self.getSorterTerms = t => {
		const sorterTerms = [
			...self.termOrder
				.filter(t => t.tw.sortSamples)
				.map(t => JSON.parse(JSON.stringify(t.tw)))
				.sort((a, b) => a.sortSamples.priority - b.sortSamples.priority),
			...self.config.settings.matrix.sortSamplesTieBreakers.map(st => JSON.parse(JSON.stringify(st)))
		]

		const s = self.settings.matrix
		const activeOption = s.sortOptions[s.sortSamplesBy]
		if (!activeOption) {
			throw `unsupported s.sortSamplesBy='${s.sortSamplesBy}'`
		}
		const matchingSortSamples = activeOption.sortPriority?.find(o => o.types.includes(t.tw?.term?.type))?.tiebreakers[0]
		const sortSamples = matchingSortSamples
			? {} // will let matrix.sort fill-in based on the first matching tiebreaker
			: t.tw?.term?.type == 'geneVariant'
			? {
					by: 'class',
					order: [
						'Fuserna',
						'CNV_homozygous_deletion',
						'CNV_amplification',
						'CNV_loss',
						'CNV_amp',
						'CNV_loh',
						// truncating
						'F',
						'N',
						// indel
						'D',
						'I',
						// point
						'M',
						'P',
						'L',
						// noncoding
						'Utr3',
						'Utr5',
						'S',
						'Intron',
						'WT',
						'Blank'
					]
			  }
			: { by: 'values' }

		const i = sorterTerms.findIndex(st => st.$id === t.tw?.$id)
		const tcopy = JSON.parse(JSON.stringify(t.tw || {}))
		// will let the matrix.sorter code fill-in the sortSamples with tiebreakers
		tcopy.sortSamples = sortSamples
		if (i == -1) {
			sorterTerms.unshift(tcopy)
		} else {
			if (sortSamples.order) tcopy.sortSamples.order = sortSamples.order
		}

		return [tcopy, sorterTerms]
	}

	self.removeTerm = () => {
		const t = self.activeLabel
		const legendValueFilter = self.mayRemoveTvsEntry(t.tw)
		const termgroups = self.termGroups
		const grp = termgroups[t.grpIndex]
		// remove this element
		grp.lst.splice(t.lstIndex, 1)
		if (grp.lst.length) {
			self.app.dispatch({
				type: 'plot_nestedEdits',
				id: self.opts.id,
				edits: [
					{
						nestedKeys: ['termgroups', t.grpIndex, 'lst'],
						value: grp.lst
					},
					{
						nestedKeys: ['legendValueFilter'],
						value: legendValueFilter
					}
				]
			})
		} else {
			// remove this now-empty group
			termgroups.splice(t.grpIndex, 1)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: {
					termgroups,
					legendValueFilter
				}
			})
		}
		self.dom.tip.hide()
	}

	self.removeTermGroup = () => {
		const t = self.activeLabel
		const termgroups = self.termGroups
		termgroups.splice(t.grpIndex, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: { termgroups }
		})
		self.dom.tip.hide()
	}

	self.mayRemoveTvsEntry = tw => {
		if (!self.config.legendValueFilter?.lst.length) return self.config.legendValueFilter
		const lst = structuredClone(self.config.legendValueFilter.lst)
		const items = lst.filter(
			f =>
				f.tvs?.term.type === tw?.term.type &&
				((('id' in f.tvs.term || 'id' in tw.term) && f.tvs.term.id === tw.term.id) || f.tvs.term.name === tw.term.name)
		)
		if (!items.length) return self.config.legendValueFilter
		else {
			for (const t of items) {
				const tvs = t.tvs
				if (tvs.term.type != tw.term.type) continue
				if (('id' in tvs.term || 'id' in tw.term) && tvs.term.id !== tw.term.id) continue
				else if (tvs.term.name != tw.term.name) continue
				// always remove a legendValueFilter.lst entry that corresponds to an edited term
				// TODO: may improve the logic to not remove a tvs entry when the tw edits are not data related, such as for colors
				const i = lst.findIndex(t => t === tvs)
				lst.splice(i, 1)
			}
		}
		return { in: true, join: 'and', type: 'tvslst', lst }
	}

	self.launchBrowser = event => {
		event.stopPropagation()
		const tw = self.activeLabel.tw
		const custom_variants = []
		for (const row of self.data.lst) {
			if (row[tw.$id]?.values) custom_variants.push(...row[tw.$id].values)
		}

		self.app.dispatch({
			type: 'plot_create',
			config: {
				term: tw,
				chartType: 'variantBrowser',
				insertBefore: self.id,
				custom_variants
			}
		})
	}
}

function setSampleGroupActions(self) {
	self.showSampleGroupMenu = function (event) {
		const d = event.target.__data__
		if (!d) return
		self.activeLabel = d
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody.style('padding', 0).selectAll('*').remove()

		const options = JSON.parse(JSON.stringify(self.config.menuOpts?.sampleGroup || [])).map(d => {
			d.callback = self[d.callback]
			return d
		})
		const menuOptions = [...options, { label: 'Delete', callback: self.removeSampleGroup }]

		self.dom.menutop
			.append('div')
			.selectAll(':scope>.sja_menuoption')
			.data(menuOptions)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.style('display', 'block')
			.html(d => d.label)
			.on('click', (event, d) => {
				event.stopPropagation()
				d.callback(d)
			})

		self.dom.tip.showunder(event.target)
	}

	self.showNewChartMenu = () => {
		self.dom.menubody.selectAll('*').remove()
	}

	self.launchSurvivalPlot = async menuOpt => {
		self.dom.menubody.selectAll('*').remove()
		self.dom.menubody
			.append('div')
			.style('padding-top', '10px')
			.html(`Use "<b>${self.config.divideBy.term.name}</b>" to`)

		const radioDiv = self.dom.menubody.append('div').style('padding', '0 10px')

		const radioName = 'sjpp-matrix-surv-termnum-' + inputIndex++
		const label1 = radioDiv.append('label')
		label1
			.append('input')
			.attr('type', 'radio')
			.attr('name', radioName)
			.attr('value', 'term2')
			.property('checked', true)
		label1.append('span').html(' overlay')

		const label2 = radioDiv.append('label').style('margin-left', '10px')
		label2.append('input').attr('type', 'radio').attr('name', radioName).attr('value', 'term0')
		label2.append('span').html(' divide')

		self.dom.menubody.append('div').style('padding-bottom', '10px').html(`the selected survival variable below:`)

		const termdb = await import('#termdb/app')
		termdb.appInit({
			holder: self.dom.menubody.append('div'),
			vocabApi: self.app.vocabApi,
			state: {
				vocab: self.state.vocab,
				activeCohort: self.state.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase: { target: 'survival', detail: 'term' } }
			},
			tree: {
				click_term: term => {
					self.dom.tip.hide()
					const termNum = radioDiv.select(`input[name='${radioName}']:checked`).property('value')
					self.dom.menubody.selectAll('*').remove()
					const config = {
						chartType: 'survival',
						term,
						[termNum]: JSON.parse(JSON.stringify(self.config.divideBy)),
						insertBefore: self.id
					}

					if (menuOpt.config) {
						Object.assign(config, menuOpt.config)
					}
					self.app.dispatch({ type: 'plot_create', config })
				}
			}
		})
	}

	self.removeSampleGroup = () => {
		// this should not happen, but making sure
		if (!self.config.divideBy) return

		const tw = self.activeLabel.grp.tw
		const term = tw.term
		if (term.type == 'categorical' || term.type == 'survival') {
			term.$id = tw.$id
			const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(l => l.legendGrpName == tw.term.id)
			if (filterGrpIndex == -1) {
				const filterNew = {
					legendGrpName: tw.term.id,
					type: 'tvs',
					tvs: {
						isnot: true,
						term,
						values: [{ key: self.activeLabel.grp.id }]
					}
				}
				self.config.legendValueFilter.lst.push(filterNew)
			} else {
				// the filter for the categorical or survival term exist, but the current legend key is not there.
				self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.push({ key: self.activeLabel.grp.id })
			}
		} else if (isNumericTerm(term)) {
			term.$id = tw.$id
			const filterNew = {
				legendGrpName: tw.term.id || tw.term.name,
				type: 'tvs',
				tvs: {
					isnot: true,
					term,
					ranges: [self.data.refs.byTermId[tw.$id].bins.find(b => self.activeLabel.grp.id == b.name)]
				}
			}
			self.config.legendValueFilter.lst.push(filterNew)
		}

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { legendValueFilter: self.config.legendValueFilter }
		})
		self.dom.tip.hide()
	}

	self.showDeletedSampleGroups = () => {
		// this should not happen, but making sure
		if (!self.config.divideBy) return

		const tw = self.activeLabel?.grp?.tw || self.config.divideBy
		self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
			l => l.legendGrpName !== tw.term.id && l.legendGrpName != tw.term.name
		)

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { legendValueFilter: self.config.legendValueFilter }
		})
		self.dom.tip.hide()
	}

	self.displaySampleGroupInfo = (event, grp) => {
		const l = self.settings.matrix.controlLabels
		const n = grp.lst.length
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody.selectAll('*').remove()
		self.dom.menubody
			.append('div')
			.style('text-align', 'center')
			.html(`<b>${grp.name}</b> (${n} ${n < 2 ? l.sample : l.samples})`)
		const div = self.dom.menubody.append('div').style('max-width', '400px').style('padding', '5px')
		for (const key in event.target.__data__.grp.legendData) {
			const g = event.target.__data__.grp.legendData[key]
			div.append('div').style('padding-top', '10px').html(`<b>${g.name}</b>`)
			const t = div.append('table')
			for (const i of g.items) {
				const tr = t.append('tr')
				// icon
				tr.append('td')
					.append('div')
					.style('width', '12px')
					.style('height', '12px')
					.style('background-color', i.color)
					.style('border', `1px soloid ${i.stroke}`)
				tr.append('td').html(i.text)
			}
		}
		self.dom.tip.show(event.clientX, event.clientY)
	}

	// TODO: may use this later to sort legend, mouseover items by count
	self.legendItemSorter = (a, b) => {
		if (a.order && b.order) return a.order - b.order
		if (Number.isFinite(a.order) || b.order == -1) return -1
		if (Number.isFinite(b.order) || a.order == -1) return 1
		if (a.count) return b.count - a.count
		if (Number.isFinite(a.count)) return -1
		if (Number.isFinite(b.count)) return 1
		return 0
	}

	self.handleLegendItemClick = d => {
		const dvt = structuredClone(self.config.divideBy || {})
		const id = 'id' in dvt ? dvt.id : dvt.name
		if (d.termid == id) {
			if (!dvt.exclude) dvt.exclude = []
			const i = dvt.exclude?.indexOf(d.key)
			if (i == -1) dvt.exclude.push(d.key)
			else dvt.exclude.splice(i, 1)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					divideBy: dvt
				}
			})
		}
	}

	self.handleLegendMouseover = (event, d) => {
		const dvt = structuredClone(self.config.divideBy || {})
		const id = 'id' in dvt ? dvt.id : dvt.name
		if (d.termid == id) {
			self.dom.menutop.selectAll('*').remove()
			self.dom.menubody.selectAll('*').remove()
			self.dom.menubody.html(`Click to ${d.isExcluded ? 'show' : 'hide'}`)
			self.dom.tip.show(event.clientX, event.clientY)
		}
	}
}

function setTermGroupActions(self) {
	setLabelDragEvents(self, 'termGrp')

	self.showTermGroupMenu = function (event) {
		const d = event.target.tagName.toLowerCase() == 'tspan' ? event.target.parentNode.__data__ : event.target.__data__
		if (!d) return
		self.activeLabel = d
		self.dom.menutop.style('display', '').selectAll('*').remove()
		self.showTermGroupInputs(self.dom.menutop.append('div'))
		self.dom.tip.showunder(event.target)
	}

	self.showTermGroupInputs = function (div) {
		const holder = div
		const labelEditDiv = holder.append('div').style('text-align', 'center')
		labelEditDiv.append('span').text('Group ')

		self.dom.grpNameInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', (self.activeLabel.grp.name?.length || 0) + 5)
			.style('padding', '1px 5px')
			.style('text-align', 'center')
			.property('value', self.activeLabel.grp.name)
			.on('input', () => {
				const value = self.dom.grpNameInput.property('value')
				self.dom.grpNameInput.attr('size', value.length + 5)
				self.dom.grpEditBtn.style('display', value === self.activeLabel.grp.name ? 'none' : '')
			})
		//.on('change', self.updateTermGrpName)

		self.dom.grpEditBtn = labelEditDiv
			.append('button')
			.style('display', 'none')
			.style('margin-left', '5px')
			.html('submit')
			.on('click', () => {
				self.updateTermGrpName()
				self.dom.tip.hide()
			})

		self.dom.menubody.style('padding', 0).selectAll('*').remove()

		const menuOptions = [{ label: 'Add Rows', callback: self.showTermInsertMenu }]
		// try to maintain a familiar button order
		if (self.chartType != 'hierCluster') {
			menuOptions.push(
				{ label: 'Edit', callback: self.showTermGroupEditMenu }
				//{ label: 'Sort', callback: self.showSortMenu },
			)
		}
		if (self.activeLabel.grp.type != 'hierCluster') {
			menuOptions.push({ label: 'Delete', callback: self.removeTermGroup })
		}

		holder
			.append('div')
			.style('text-align', 'center')
			.selectAll(':scope>.sja_menuoption')
			.data(menuOptions)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.style('display', 'inline-block')
			.html(d => d.label)
			.on('click', (event, d) => {
				event.stopPropagation()
				self.dom.menutop.style('display', 'none')
				d.callback(d)
			})
	}

	self.updateTermGrpName = () => {
		const value = self.dom.grpNameInput.property('value')
		const t = self.activeLabel
		if (t.grp.name === value) return
		t.grp.name = value
		self.app.dispatch({
			type: 'plot_nestedEdits',
			id: self.opts.id,
			edits: [
				{
					nestedKeys: ['termgroups', t.grpIndex],
					value: t.grp
				}
			]
		})
	}

	self.showTermGroupEditMenu = async () => {
		self.dom.menubody.selectAll('*').remove()

		const menu = self.dom.menubody.append('div').style('padding', '5px')
		menu.append('div').style('width', '100%').style('font-weight', 600).html('Group options')

		const label = menu.append('div').append('label')
		const l = self.settings.matrix.controlLabels
		label
			.append('span')
			.html(
				`Minimum # of mutated ${l.samples} for the ${l.term.charAt(0).toLowerCase() + l.term.slice(1)} to be visible `
			)
			.attr('aria-label', `May be overridden by a row-specific minNumSamples`)
		const minNumSampleInput = label
			.append('input')
			.attr('type', 'number')
			.style('margin-left', '5px')
			.style('width', '50px')
			.property('value', self.activeLabel.grp.settings?.minNumSamples || 0)

		menu
			.append('div')
			.append('button')
			.html('Submit')
			.on('click', () => {
				const settings = self.activeLabel.grp.settings || {}
				settings.minNumSamples = minNumSampleInput.property('value')

				self.app.dispatch({
					type: 'plot_nestedEdits',
					id: self.id,
					edits: [
						{
							nestedKeys: ['termgroups', self.activeLabel.grpIndex, 'settings'],
							value: settings
						}
					]
				})
			})
	}

	self.removeTermGroup = () => {
		const termgroups = self.termGroups
		termgroups.splice(self.activeLabel.grpIndex, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				termgroups
			}
		})
		self.dom.tip.hide()
	}
	const labelParentSelectors = ['series', 'series-group', 'term', 'term-group']
		.map(d => `.sjpp-matrix-${d}-label-g`)
		.join(',')
	self.enableTextHighlight = event => {
		select(event.target.closest(labelParentSelectors))
			.selectAll('.sjpp-matrix-label text')
			//.selectAll('text')
			.style('-webkit-user-select', 'auto')
			.style('-moz-user-select', 'auto')
			.style('-ms-user-select', 'auto')
			.style('user-select', 'auto')

		select('body').on('mouseup.sjppMatrixLabelText', self.disableTextHighlight)
	}

	self.disableTextHighlight = event => {
		select(event.target.closest(labelParentSelectors))
			.selectAll('.sjpp-matrix-label text')
			.style('-webkit-user-select', 'none')
			.style('-moz-user-select', 'none')
			.style('-ms-user-select', 'none')
			.style('user-select', 'none')

		select('body').on('mouseup.sjppMatrixLabelText', null)
	}
}

// prefix = "term" | "termGrp"
function setLabelDragEvents(self, prefix) {
	self[`${prefix}LabelMousedown`] = (event, d) => {
		self.clicked = { event, d }
	}

	self[`${prefix}LabelMouseover`] = (event, t) => {
		if (prefix == 'term' && event.target.__data__?.tw && event.target.__data__.grp) {
			if (event.target.__data__.grp.type == 'hierCluster') {
				// do allow to be dragged/dropped and do not show term label hover over tooltip for hier cluster
				return
			}
			//show counts in each subgroup when hover over term label
			if (self.activeLabel || self.zoomArea) {
				// when an edit menu is open or when users are selecting a portion of matrix to zoom
				return
			}
			self.dom.menutop.selectAll('*').remove()
			self.dom.menubody.selectAll('*').remove()
			const groupName = event.target.__data__.grp.name
			const termName = event.target.__data__.tw.term.name

			//Add subGroup name
			const titleDiv = self.dom.menubody
				.append('div')
				.style('text-align', 'left')
				.style('font-size', '1.1em')
				.html(groupName ? `<b>${groupName}: ${termName}</b>` : `<b>${termName}</b>`)

			const div = self.dom.menubody.append('div').style('max-width', '400px')

			const data = event.target.__data__

			if (data.tw.term.type == 'geneVariant' && data.tw.q?.type == 'values') {
				// for geneVariant term, when groupsetting is <not?> used, use subGroupCounts to
				// show number of counted samples (WT and Blank are not counted)
				// and number of each class in the subGroup

				//Sum of not tested samples in all group
				const notTestedSum = Object.values(data.counts.subGroupCounts).reduce(
					(sum, curr) => sum + curr.samplesNotTested,
					0
				)

				//Add number of tested samples
				titleDiv
					.append('div')
					.style('text-align', 'left')
					.style('font-size', '0.9em')
					.html(`(tested ${self.samples.length - notTestedSum} of ${self.samples.length})`)

				for (const [grpName, counts] of Object.entries(data.counts.subGroupCounts)) {
					const groupSampleTotal = self.sampleGroups.find(g => g.name == grpName).lst.length
					const mRate =
						groupSampleTotal - counts.samplesNotTested
							? counts.samplesTotal / (groupSampleTotal - counts.samplesNotTested)
							: 0
					div
						.append('div')
						.style('padding-top', '10px')
						.html(
							grpName
								? `<b>${grpName}</b>: Mutated samples (${counts.samplesTotal} of ${
										groupSampleTotal - counts.samplesNotTested
								  }, ${d3format('.1%')(mRate)})`
								: `<b>Mutated samples (${counts.samplesTotal} of ${
										groupSampleTotal - counts.samplesNotTested
								  }, ${d3format('.1%')(mRate)})`
						)
					const t = div.append('table').style('margin-left', '15px')
					for (const [classType, num] of Object.entries(counts.classes).sort((a, b) => b[1] - a[1])) {
						const tr = t.append('tr')
						// icon
						tr.append('td')
							.append('div')
							.style('width', '12px')
							.style('height', '12px')
							.style('background-color', mclass[classType].color)
						tr.append('td').html(`${mclass[classType].label}: ${num}`)
					}
					if (counts.notTestedClasses) {
						div.append('div').style('margin-left', '15px').style('padding-top', '12px').html('<b> Not counted:</b>')
						const t = div.append('table').style('margin-left', '15px')
						for (const [classType, num] of Object.entries(counts.notTestedClasses).sort((a, b) => b[1] - a[1])) {
							const tr = t.append('tr')
							// icon
							tr.append('td')
								.append('div')
								.style('width', '12px')
								.style('height', '12px')
								.style('background-color', mclass[classType].color)
							tr.append('td').html(`${mclass[classType].label}: ${num}`)
						}
					}
				}
			} else if (!self.config.divideBy) {
				// non-geneVariant term, when matrix is not divided into multiple subGorups
				const termLegend = self.legendData.find(t => t.name == data.tw.term.name)
				if (termLegend && termLegend.items) {
					// when legend data is available
					const t = div.append('table')
					for (const classType of termLegend.items) {
						const tr = t.append('tr')
						// icon
						tr.append('td')
							.append('div')
							.style('width', '12px')
							.style('height', '12px')
							.style('background-color', classType.color)
						tr.append('td').html(`${classType.key}: ${classType.count}`)
					}
				} else {
					// when legend data is not available, use subGroupCounts
					for (const [grpName, counts] of Object.entries(data.counts.subGroupCounts)) {
						const groupSampleTotal = self.sampleGroups.find(g => g.name == grpName).totalCountedValues
						div
							.append('div')
							.style('padding-top', '10px')
							.html(
								grpName !== ''
									? `<b>${grpName}</b>: ${counts.samplesTotal} of ${groupSampleTotal}`
									: `<b>${counts.samplesTotal} of ${groupSampleTotal}`
							)
						const t = div.append('table').style('margin-left', '15px')
						for (const [classType, num] of Object.entries(counts.classes).sort((a, b) => b[1] - a[1])) {
							const classColor = data.tw.term.values?.[classType]?.color
							if (!classColor) continue
							const tr = t.append('tr')
							// icon
							tr.append('td')
								.append('div')
								.style('width', '12px')
								.style('height', '12px')
								.style('background-color', classColor)
							tr.append('td').html(`${classType}: ${num}`)
						}
					}
				}
			} else {
				// non-geneVariant term, when matrix is divided into multiple subGorups
				for (const [grpName, counts] of Object.entries(data.counts.subGroupCounts)) {
					const groupSampleTotal = self.sampleGroups.find(g => g.name == grpName).totalCountedValues
					div
						.append('div')
						.style('padding-top', '10px')
						.html(
							grpName !== ''
								? `<b>${grpName}</b>: ${counts.samplesTotal} of ${groupSampleTotal}`
								: `<b>${counts.samplesTotal} of ${groupSampleTotal}`
						)
					const subGrp = self.sampleGroups.find(g => g.name == grpName)
					const termLegend = subGrp.legendData.find(t => t.name == data.tw.term.name)

					if (termLegend && termLegend.items) {
						// when legend data is available
						const t = div.append('table').style('margin-left', '15px')
						for (const classType of termLegend.items) {
							const tr = t.append('tr')
							// icon
							tr.append('td')
								.append('div')
								.style('width', '12px')
								.style('height', '12px')
								.style('background-color', classType.color)
							tr.append('td').html(`${classType.key}: ${classType.count}`)
						}
					} else {
						// when legend data is not available, use subGroupCounts
						const t = div.append('table').style('margin-left', '15px')
						for (const [classType, num] of Object.entries(counts.classes).sort((a, b) => b[1] - a[1])) {
							const classColor = data.tw.term.values?.[classType]?.color
							if (!classColor) continue
							const tr = t.append('tr')
							// icon
							tr.append('td')
								.append('div')
								.style('width', '12px')
								.style('height', '12px')
								.style('background-color', classColor)
							tr.append('td').html(`${classType}: ${num}`)
						}
					}
				}
			}
			self.dom.tip.show(event.clientX, event.clientY)
		}
		//const cls = event.target.className?.baseVal || event.target.parentNode.className?.baseVal || ''
		if (event.target.innerHTML.includes('grouped by')) return
		if (event.target.tagName === 'text') {
			select(event.target).style('fill', 'blue')
		}
		if (!self.dragged) return
		// TODO: why is the element-bound __data__ (t) not provided as a second argument by d3??
		self.hovered = event.target.__data__
	}

	self[`${prefix}LabelMouseout`] = event => {
		select(event.target).style('fill', '')
		//if (!this.dragged) return
	}

	self[`${prefix}LabelMousemove`] = (event, data) => {
		const s = self.config.settings.matrix
		if (self.clicked && !self.dragged) {
			self.dom[`${prefix}LabelG`]
				.selectAll('text')
				.style('-webkit-user-select', 'none')
				.style('-moz-user-select', 'none')
				.style('-ms-user-select', 'none')
				.style('user-select', 'none')

			const label = self.clicked.event.target.closest('.sjpp-matrix-label')
			const t = label?.__data__
			if (!t) return
			if (self.type == 'hierCluster' && t.tw && t.grp?.name == self.config.settings.hierCluster?.termGroupName) return
			// TODO: use a native or D3 transform accessor
			const [x, y] = select(label).attr('transform').split('translate(')[1].split(')')[0].split(',').map(Number)
			const node = label.cloneNode(true)
			self.dom[`${prefix}LabelG`].node().prepend(node)
			self.dragged = {
				orig: label,
				clone: select(node).style('cursor', 'move').style('pointer-events', 'none'),
				node,
				x,
				y,
				clientX: event.clientX,
				clientY: event.clientY
			}
			self.dragged.clone.selectAll('text').style('fill', 'red')
		}
		if (!self.dragged) return
		const d = self.dragged
		const x2 = !s.transpose ? d.x : d.x - d.clientX + event.clientX
		const y2 = !s.transpose ? d.y - d.clientY + event.clientY : d.y
		d.clone.attr('transform', `translate(${x2},${y2})`)
	}

	self[`${prefix}LabelMouseup`] = event => {
		delete self.clicked
		const s = self.config.settings.matrix
		if (self.dragged) {
			self.dragged.clone.remove()
			//self.dragged.bgrect.remove()
			if (self.hovered) {
				// reposition the dragged row/column
				const d = self.dragged
				const t = d.orig.__data__
				const h = self.hovered

				if (prefix == 'termGrp') {
					const grp = self.config.termgroups.splice(t.grpIndex, 1)[0]
					self.config.termgroups.splice(h.grpIndex, 0, grp)
				} else {
					// NOTE: currently, the rendered order does not have to match the termgroup.lst order
					// ??? actually resort termgroup.lst to reflect the current term order ???
					for (const grp of self.config.termgroups) {
						grp.lst.sort((a, b) => {
							const a1 = self.termOrder.find(t => t.tw.$id === a.$id)
							const b1 = self.termOrder.find(t => t.tw.$id === b.$id)
							if (!a1 && !b1) return 0
							if (!a1) return 1
							if (!b1) return -1
							return a1.totalIndex - b1.totalIndex
						})
					}

					const tw = self.config.termgroups[t.grpIndex].lst.splice(t.index, 1)[0]
					self.config.termgroups[h.grpIndex].lst.splice(h.index, 0, t.tw)
					// if the "source" term group was emptied, then remove that group
					if (!self.config.termgroups[t.grpIndex].lst.length) self.config.termgroups.splice(t.grpIndex, 1)
				}

				const sortKey = prefix == 'term' ? 'sortTermsBy' : 'sortTermGroupsBy'
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						termgroups: self.config.termgroups,
						settings: {
							matrix: {
								[sortKey]: 'asListed'
							}
						}
					}
				})
			}

			self.dom[`${prefix}LabelG`]
				.selectAll('text')
				.style('fill', '')
				.style('-webkit-user-select', '')
				.style('-moz-user-select', '')
				.style('-ms-user-select', '')
				.style('user-select', '')

			delete self.dragged
		} else if (prefix == 'term') {
			self.showTermMenu(event)
		} else {
			self.showTermGroupMenu(event)
		}
	}
}

function setZoomPanActions(self) {
	self.resetInteractions = function () {
		if (self.zoomArea) {
			self.zoomArea.remove()
			delete self.zoomArea
			//self.dom.seriesesG.on('mouseup.zoom', null)
			select('body').on('mouseup.matrixZoom', null)
		}
		delete self.clickedSeriesCell
	}

	self.seriesesGMousedown = function (event) {
		event.stopPropagation()
		self.resetInteractions()
		const startCell = self.getCellByPos(event)
		if (!startCell) return
		self.clickedSeriesCell = { event, startCell }
		if (self.settings.matrix.mouseMode == 'pan') {
			self.seriesesGdragInit()
		} else {
			self.zoomPointer = pointer(event, self.dom.seriesesG.node())
			self.dom.seriesesG
				.on('mousemove', self.seriesesGoutlineZoom)
				.on('mouseup', self.seriesesGtriggerZoom)
				.on('contextmenu', self.resetInteractions)
		}
		self.dom.mainG
			.selectAll('text')
			.style('-webkit-user-select', 'none')
			.style('-moz-user-select', 'none')
			.style('-ms-user-select', 'none')
			.style('user-select', 'none')
	}

	self.getCellByPos = function (event) {
		const s = self.settings.matrix
		const d = self.dimensions
		if (event.target.tagName == 'rect') {
			if (event.target.__data__?.sample) return event.target.__data__
			if (event.target.__data__?.xg) {
				const width = event.clientX - event.target.getBoundingClientRect().x + d.seriesXoffset
				const i = Math.floor(width / d.dx)
				return self.sampleOrder[i]
			}
		}
		if (event.target.tagName == 'image' && s.useCanvas) {
			return self.getImgCell(event)
		}
	}

	self.seriesesGdragInit = function () {
		//self.dom.seriesesG.on('mousemove', self.seriesesGdrag).on('mouseup', self.seriesesGcancelDrag)
		select('body')
			.on('mousemove.sjppMatrixDrag', self.seriesesGdrag)
			.on('mouseup.sjppMatrixDrag', self.seriesesGcancelDrag)
		const s = self.settings.matrix
		const d = self.dimensions
		const c = self.clickedSeriesCell
		c.dxPad = 20 // to show edge that limits drag, and to "bounce back" on mouseup
		//const pos = d.seriesXoffset s.zoomCenterPct * d.mainw /// d.mainw
		c.dxMax = -d.seriesXoffset
		c.dxMaxPad = c.dxMax + c.dxPad
		c.dxMin = d.mainw - d.zoomedMainW - d.seriesXoffset
		c.dxMinPad = c.dxMin - c.dxPad
		const halfw = 0.5 * d.mainw
		c.center = {
			max: halfw + (d.zoomedMainW - d.mainw),
			min: halfw
		}
	}

	self.seriesesGdrag = function (event) {
		const s = self.settings.matrix
		const c = self.clickedSeriesCell
		const d = self.dimensions
		const dx = event.clientX - c.event.clientX
		if (Math.abs(dx) < 1) return
		if (dx < c.dxMinPad || dx > c.dxMaxPad) return
		self.clickedSeriesCell.dx = dx
		self.translateElems(dx, d, s, c)
	}

	self.translateElems = function (dx, d, s, c) {
		self.dom.seriesesG.attr('transform', `translate(${d.xOffset + d.seriesXoffset + dx},${d.yOffset})`)
		self.layout.top.attr.adjustBoxTransform(dx)
		self.layout.btm.attr.adjustBoxTransform(dx)
		const computedCenter = s.zoomCenterPct * d.mainw - d.seriesXoffset - dx
		self.controlsRenderer.svgScrollApi.update({ zoomCenter: computedCenter })
	}

	self.seriesesGcancelDrag = function (event) {
		select('body').on('mousemove.sjppMatrixDrag', null).on('mouseup.sjppMatrixDrag', null)
		const s = self.settings.matrix
		const d = self.dimensions
		const cc = self.clickedSeriesCell
		const _dx = event.clientX - cc.event.clientX
		const dx = Math.min(cc.dxMax, Math.max(_dx, cc.dxMin))
		if (Math.abs(_dx) < 1 || Math.abs(dx) < 1) {
			self.translateElems(0, d, s, cc)
			return
		}
		self.translateElems(dx, d, s, cc)
		const c = self.getVisibleCenterCell(dx)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					matrix: {
						zoomCenterPct: 0.5,
						zoomIndex: c.totalIndex,
						zoomGrpIndex: c.grpIndex
					}
				}
			}
		})
	}

	self.seriesesGoutlineZoom = function (event) {
		if (!self.clickedSeriesCell) return
		const s = self.config.settings.matrix
		const e = self.clickedSeriesCell.event

		if (self.clickedSeriesCell && !self.zoomArea) {
			self.zoomArea = self.dom.seriesesG.append('rect').attr('fill', 'rgba(50, 50, 50, 0.3)')

			select('body').on('mouseup.matrixZoom', self.mouseup)

			self.dom.mainG
				.selectAll('text')
				.style('-webkit-user-select', 'none')
				.style('-moz-user-select', 'none')
				.style('-ms-user-select', 'none')
				.style('user-select', 'none')
		}

		const dx = event.clientX - e.clientX
		const dy = event.clientY - e.clientY
		const x = dx > 0 ? self.zoomPointer[0] : self.zoomPointer[0] + dx + 3
		self.zoomWidth = Math.abs(dx)
		self.zoomArea
			.attr('transform', `translate(${x},0)`)
			.attr('width', Math.max(0, self.zoomWidth - 2))
			.attr('height', self.dimensions.mainh)

		if (!self.clickedSeriesCell.endCell) self.clickedSeriesCell.endCell = self.getCellByPos(event)
	}

	self.seriesesGtriggerZoom = function (event) {
		event.stopPropagation()
		self.dom.seriesesG.on('mousemove', null).on('mouseup', null)
		//const d = event.target.__data__
		select('body').on('mouseup.matrixZoom', null)

		self.dom.mainG
			.selectAll('text')
			.style('-webkit-user-select', '')
			.style('-moz-user-select', '')
			.style('-ms-user-select', '')
			.style('user-select', '')

		const c = self.clickedSeriesCell
		const endCell = self.getCellByPos(event)
		if (!c || !c.startCell) {
			self.dom.mainG.on('mouseout', null)
			delete self.clickedSeriesCell
			return
		} else if (!c.endCell || endCell === c.startCell) {
			self.dom.mainG.on('mouseout', null)
			self.dom.tip.hide()
			const cell = event.target.tagName == 'rect' ? event.target.__data__ : c.startCell
			if (cell) {
				if (self.opts.cellClick) {
					self.opts.cellClick(
						structuredClone({
							sampleData: cell.row,
							term: cell.term,
							value: cell.value,
							s: cell.s,
							t: cell.t,
							siblingCells: cell.siblingCells
								.filter(c => c !== cell)
								.map(c => ({
									term: c.term,
									value: c.value,
									s: c.s,
									t: c.t
								}))
						})
					)
				} else {
					self.mouseclick(event, cell)
				}
			}
			delete self.clickedSeriesCell
			delete self.zoomArea
			return
		}

		const s = self.settings.matrix
		const l = s.controlLabels
		c.endCell = endCell
		const ss = self.opts.allow2selectSamples

		const startCellTouched = c.startCell.totalIndex < c.endCell.totalIndex ? c.startCell : c.endCell
		const endCellTouched = c.startCell.totalIndex < c.endCell.totalIndex ? c.endCell : c.startCell
		const samplesSet = new Set()
		for (let i = startCellTouched.totalIndex; i <= endCellTouched.totalIndex; i++) {
			samplesSet.add(self.sampleOrder[i].row)
		}
		const samples = [...samplesSet]

		const optionArr = [
			{
				label: 'Zoom in',
				callback: self.triggerZoomArea
			},
			{
				label: `List ${samples.length} ${l.samples}`,
				callback: () => {
					self.resetInteractions()
					self.dom.tip.hide()
					showTable(self, samples, event.clientX, event.clientY)
				}
			}
		]

		if (ss) {
			optionArr.push({
				label: ss.buttonText || `Select ${l.Samples}`,
				callback: async () => {
					ss.callback({
						samples: samples.map(c => {
							return { 'cases.case_id': c.sample }
						}),
						source: `Selected ${l.samples} from OncoMatrix`
					})
					self.zoomArea.remove()
					delete self.zoomArea
					delete self.clickedSeriesCell
				}
			})
		} else {
			if (self.state.nav && self.state.nav.header_mode !== 'hidden') {
				for (const s of samples) {
					if (!s.sampleId) s.sampleId = s.sample
				}
				optionArr.push({
					label: 'Add to a group',
					callback: async () => {
						self.resetInteractions()
						const group = {
							name: 'Group',
							items: samples
						}
						self.addGroup(group)
					}
				})
			}
		}

		self.dom.dendroClickMenu.clear() // close the dendrogram clicking menu when brushing
		self.dom.clickMenu.clear() // close the matrix cell click menu when brushing
		self.mouseout()
		self.dom.tip.hide()
		self.dom.brushMenu.clear()
		self.dom.brushMenu.d
			.selectAll('div')
			.data(optionArr)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.html(d => d.label)
			.on('click', event => {
				self.dom.brushMenu.d.selectAll('*').remove()
				event.target.__data__.callback()
			})
		self.dom.brushMenu.show(event.clientX, event.clientY)
	}

	// show the list of clicked samples as a table
	const showTable = function (self, samples, x, y) {
		delete self.clickedSeriesCell
		const templates = self.state.termdbConfig.urlTemplates
		const rows = templates?.sample
			? samples.map(c => [{ value: c._ref_.label, url: `${templates.sample.base}${c.sample}` }])
			: samples.map(c => [{ value: c._ref_.label }])

		const columns = [{ label: self.settings.matrix.controlLabels.Samples }]

		if (!self.dom.sampleListMenu) self.dom.sampleListMenu = new Menu({ padding: '5px' })
		else self.dom.sampleListMenu.clear()
		const div = self.dom.sampleListMenu.d.append('div')

		renderTable({
			rows,
			columns,
			div,
			showLines: true,
			maxWidth: columns.length * '30' + 'vw',
			maxHeight: '35vh',
			resize: true
		})
		self.dom.sampleListMenu.show(x, y)
	}

	// add the selected samples into a group
	self.addGroup = async function (group) {
		const tw = getSamplelstTW([group])
		const filter = getFilter(tw)
		addNewGroup(self.app, filter, self.state.groups)
	}
	self.triggerZoomArea = function () {
		if (self.zoomArea) {
			self.zoomArea.remove()
			delete self.zoomArea
		}
		const c = self.clickedSeriesCell
		delete self.clickedSeriesCell
		const s = self.settings.matrix
		const d = self.dimensions
		const start = c.startCell.totalIndex < c.endCell.totalIndex ? c.startCell : c.endCell
		const zoomIndex = Math.floor(start.totalIndex + Math.abs(c.endCell.totalIndex - c.startCell.totalIndex) / 2)
		const centerCell = self.sampleOrder[zoomIndex] || self.getImgCell(event)
		const colw = self.computedSettings.colw || self.settings.matrix.colw
		const maxZoomLevel = s.colwMax / colw
		const minZoomLevel = s.colwMin / colw

		// 0.75 is used to add left and right padding to the zoom.
		const tentativeZoomLevel = ((s.zoomLevel * d.mainw) / self.zoomWidth) * 0.75
		const zoomLevel = Math.max(minZoomLevel, Math.min(tentativeZoomLevel, maxZoomLevel))
		const zoomCenter = centerCell.totalIndex * d.dx + (centerCell.grpIndex - 1) * s.colgspace + d.seriesXoffset

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					matrix: {
						zoomLevel,
						// try to keep the center of the grey zoom rectangle in the same position before and after zoom
						// this could aslo support mouse scroll zoom in the future.
						zoomCenterPct: zoomLevel < 1 && d.mainw >= d.zoomedMainW ? 0.5 : zoomCenter / d.mainw,
						zoomIndex,
						zoomGrpIndex: centerCell.grpIndex
					}
				}
			}
		})

		self.resetInteractions()
	}
}

function setLengendActions(self) {
	self.legendLabelMouseover = event => {
		const targetData = event.target.__data__
		if (!targetData || targetData.dt == dtgeneexpression || targetData.dt == dtmetaboliteintensity) {
			// for gene expression don't use legend as filter
			return
		}
		if (!targetData.isLegendItem && !targetData.dt) {
			// do not change color when its a non-genevariant legend group name
			return
		}
		const legendGrpHidden =
			self.config.legendGrpFilter.lst.find(
				f => f.dt?.includes(targetData.dt) && (!f.origin || f.origin == targetData.origin)
			) && true
		if (targetData.isLegendItem && legendGrpHidden) {
			// when the legend's group is hidden
			return
		}
		const term = self.termOrder.find(t => t.tw.$id == targetData.$id)
		if (term?.tw?.q?.type == 'predefined-groupset' || term?.tw?.q?.type == 'custom-groupset') {
			// when the term has customized groupsetting
			return
		}
		if (event.target.nodeName == 'rect') select(event.target).style('stroke', 'blue').style('cursor', 'pointer')
		else select(event.target).style('fill', 'blue').style('cursor', 'pointer')
	}

	self.legendLabelMouseout = event => {
		if (event.target.nodeName == 'rect') select(event.target).style('stroke', '#aaa')
		else select(event.target).style('fill', '')
	}

	self.legendLabelMouseup = event => {
		const targetData = event.target.__data__
		if (!targetData || targetData.dt == dtgeneexpression || targetData.dt == dtmetaboliteintensity) {
			// for gene expression don't use legend as filter
			return
		}

		const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin
		const menuGrp = self.dom.legendMenu.clear()

		// When clicking a legend group name
		if (!targetData.isLegendItem) {
			if (!targetData.dt) {
				// do not use as filter when its a non-genevariant legend group name
				// or when its a genevariant legend group name for hierCluster
				return
			}

			//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
			const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
				f =>
					f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
					(!byOrigin || f.origin == targetData.origin)
			)

			//legendFilterIndex is the index of the first filter (in this filter group being clicked) that is already in self.config.legendValueFilter.lst, if there's any
			const legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
				l =>
					l.legendGrpName == targetData.name &&
					l.tvs.values.find(v => targetData.dt.includes(v.dt) && (!byOrigin || v.origin == targetData.origin))
			)
			const div = menuGrp.d.append('div')

			// when the legend group is not hidden
			if (legendGrpFilterIndex == -1) {
				// for consequences/mutations legend group
				if (targetData.dt.includes(dtsnvindel)) {
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text(`Show only truncating mutations`)
						.on('click', () => {
							showOnlyTrunc(menuGrp, targetData, self)
						})

					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text(`Show only protein-changing mutations`)
						.on('click', () => {
							showOnlyPC(menuGrp, targetData, self)
						})
				}
				const onlyGeneGroupShown =
					self.legendData.filter(
						l =>
							l.dt && !l.crossedOut && (l.name == targetData.name || l.items.find(i => !i.greyedOut && !i.crossedOut))
					).length <= 1
				div
					.append('div')
					.attr(
						'class',
						onlyGeneGroupShown ? 'sja_menuoption_not_interactive sja_sharp_border' : 'sja_menuoption sja_sharp_border'
					)
					.text(`Do not show ${targetData.name}`)
					.style('opacity', onlyGeneGroupShown ? '0.5' : '1')
					.on('click', () => {
						if (!onlyGeneGroupShown) showNone(menuGrp, targetData, self)
					})
			}
			// when the legend group is hidden or when a legend filter belongs to the legend group exist in legendValueFilter, show the "show all" option
			if (legendGrpFilterIndex !== -1 || legendFilterIndex !== -1) {
				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(`Show all ${targetData.name}`)
					.on('click', () => {
						showAll(menuGrp, targetData, self)
					})
			}
			// adding the option to specify criteria for a CNV alteration for numeric CNV
			const cnv =
				Object.keys(self.config.cnvCutoffs).length !== 0
					? self.config.cnvCutoffs
					: self.state.termdbConfig?.queries?.cnv
			const keys = Object.keys(cnv)

			if (
				targetData.dt.includes(dtcnv) &&
				legendGrpFilterIndex == -1 &&
				(keys.includes('cnvGainCutoff') || keys.includes('cnvLossCutoff' || keys.includes('cnvMaxLength')))
			) {
				const existingCnvSetDiv = div.select('.cnv-set-div')
				if (!existingCnvSetDiv.empty()) existingCnvSetDiv.remove()

				const cnvSetDiv = div.append('div').classed('cnv-set-div', true)
				cnvSetDiv.style('margin', '10px')
				const tip = new Menu({ padding: '5px' })
				cnvSetDiv.append('div').style('margin-bottom', '10px').text('Specify criteria for a CNV alteration:')
				const settingsDiv = cnvSetDiv.append('div').style('margin-left', '10px')

				let cnvGainCutoff
				cnvGainCutoff = cnv.cnvGainCutoff
				const cnvGainDiv = settingsDiv.append('div').style('margin-bottom', '5px')
				cnvGainDiv.append('span').style('opacity', 0.7).text('Minimum CNV Gain (log2 ratio)')
				cnvGainDiv
					.append('input')
					.attr('type', 'number')
					.property('value', cnvGainCutoff)
					.style('width', '100px')
					.style('margin-left', '15px')
					.on('change', event => {
						const value = event.target.value
						if (value === '' || !Number.isFinite(Number(value))) {
							window.alert('Please enter a numeric value.')
							event.target.value = cnvGainCutoff
							return
						}
						const newValue = Number(value)
						if (newValue < 0) {
							window.alert('Value must be a positive value.')
							event.target.value = cnvGainCutoff
							return
						}
						cnvGainCutoff = newValue
					})

				let cnvLossCutoff
				cnvLossCutoff = cnv.cnvLossCutoff
				const cnvLossDiv = settingsDiv.append('div').style('margin-bottom', '5px')
				cnvLossDiv.append('span').style('opacity', 0.7).text('Maximum CNV Loss (log2 ratio)')
				cnvLossDiv
					.append('input')
					.attr('type', 'number')
					.property('value', cnvLossCutoff)
					.style('width', '100px')
					.style('margin-left', '15px')
					.on('change', event => {
						const value = event.target.value
						if (value === '' || !Number.isFinite(Number(value))) {
							window.alert('Please enter a numeric value.')
							event.target.value = cnvLossCutoff
							return
						}
						const newValue = Number(value)
						if (newValue > 0) {
							window.alert('Value must be a negative value.')
							event.target.value = cnvLossCutoff
							return
						}
						cnvLossCutoff = newValue
					})

				let cnvMaxLength
				cnvMaxLength = cnv.cnvMaxLength
				const cnvLengthDiv = settingsDiv.append('div').style('margin-bottom', '5px')
				cnvLengthDiv.append('span').style('opacity', 0.7).text('CNV Max Length')
				cnvLengthDiv
					.append('input')
					.attr('type', 'number')
					.property('value', cnvMaxLength)
					.style('width', '100px')
					.style('margin-left', '15px')
					.on('change', event => {
						const value = event.target.value
						if (value === '' || !Number.isFinite(Number(value))) {
							window.alert('Please enter a numeric value.')
							event.target.value = cnvMaxLength
							return
						}
						const newValue = Number(value)
						// no max length if value == -1
						cnvMaxLength = newValue == -1 ? null : newValue
					})
					.on('mouseover', event => {
						tip.clear()
						tip.d
							.append('div')
							.text('Max segment length. Please enter a positive value. Set 0 for not restricting by max length.')
						tip.showunder(event.target)
					})
					.on('mouseout', () => {
						tip.hide()
					})

				// Apply button
				cnvSetDiv
					.append('div')
					.append('button')
					.style('margin-top', '15px')
					.text('Apply')
					.on('click', () => {
						menuGrp.hide()
						self.config.cnvCutoffs = { cnvGainCutoff, cnvLossCutoff, cnvMaxLength }
						for (const termgroup of self.config.termgroups) {
							for (const t of termgroup.lst) {
								if (t.term.type == 'geneVariant') {
									t.q.cnvGainCutoff = cnvGainCutoff
									t.q.cnvLossCutoff = cnvLossCutoff
									t.q.cnvMaxLength = cnvMaxLength
								}
							}
						}
						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
			}
			menuGrp.showunder(event.target)
			return
		}

		// when clicking a legend item
		const legendGrpHidden =
			self.config.legendGrpFilter.lst.find(
				f => f.dt?.includes(targetData.dt) && (!f.origin || f.origin == targetData.origin)
			) && true
		if (targetData.isLegendItem && legendGrpHidden) {
			// when the legend's group is hidden
			return
		}

		const term = self.terms.find(t => t.tw.$id == targetData.$id)
		if (term?.tw?.q?.type == 'predefined-groupset' || term?.tw?.q?.type == 'custom-groupset') {
			// when the term has customized groupsetting
			return
		}
		//legendFilterIndex is the index of the filter that is already in self.config.legendValueFilter.lst
		// All the filters in self.config.legendValueFilter.lst is joined by 'and' and for all of them the isnot is true.
		let legendFilterIndex
		if (targetData.dt) {
			// when its geneVariant term
			legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
				l =>
					l.legendGrpName == targetData.termid &&
					l.tvs.values.find(
						v =>
							v.dt == targetData.dt && (!byOrigin || v.origin == targetData.origin) && v.mclasslst[0] == targetData.key
					)
			)
		} else {
			// when its non-geneVariant term
			const legendTerm = self.termOrder.find(to => to.tw.$id == targetData.$id)?.tw?.term
			if (!legendTerm) {
				// legend value filter works for the terms in self.termOrder
				return
			}
			if (legendTerm.type == 'categorical' || legendTerm.type == 'survival') {
				legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
					l => l.legendGrpName == targetData.termid && l.tvs.values.find(v => v.key == targetData.key)
				)
			} else if (isNumericTerm(legendTerm)) {
				legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
					l => l.legendGrpName == targetData.termid && l.tvs.ranges.find(r => r.name == targetData.key)
				)
			}
		}
		const controlLabels = self.settings.matrix.controlLabels

		const div = menuGrp.d.append('div')

		/** targetItemData may either be the target or parent data (i.e. the original parent mclass key for a merged
		 * legend item.) */
		const addMenuOptions = targetItemData => {
			//Add the hard filter option
			if (!targetItemData.dt || self.type !== 'hierCluster' || legendFilterIndex !== -1) {
				// Do not show the hard filter option for hierCluster geneVariant legend items.

				// ********* TODO  ********
				// allow to hard filter geneVariant legend for hierCluster
				// ********* TODO  ********
				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(
						targetItemData.dt
							? legendFilterIndex == -1
								? `Hide ${controlLabels.samples} with ${mclass[targetItemData.key].label}`
								: `Show ${controlLabels.samples} with ${mclass[targetItemData.key].label}`
							: legendFilterIndex == -1
							? 'Hide'
							: 'Show'
					)
					.on('click', () => {
						menuGrp.hide()
						if (legendFilterIndex == -1) {
							// when its shown and now hide it
							if (targetItemData.dt) {
								// for a geneVariant term
								// add a new "hard filter" to filter out samples that have genes' values match with the legend's origin + legend's dt + legend's class
								const filterNew = {
									legendGrpName: targetItemData.termid,
									type: 'tvs',
									tvs: {
										isnot: true,
										legendFilterType: 'geneVariant_hard', // indicates this matrix legend filter is hard filter
										term: { type: 'geneVariant' },
										values: [
											{
												dt: targetItemData.dt,
												origin: targetItemData.origin,
												mclasslst: [targetItemData.key]
											}
										]
									}
								}
								self.config.legendValueFilter.lst.push(filterNew)
							} else {
								// for a non-geneVariant term
								const term = self.termOrder.find(t => t.tw.$id == targetItemData.$id).tw.term
								if (term.type == 'categorical' || term.type == 'survival') {
									term.$id = targetItemData.$id
									const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
										l => l.legendGrpName == targetItemData.termid
									)
									if (filterGrpIndex == -1) {
										const filterNew = {
											legendGrpName: targetItemData.termid,
											type: 'tvs',
											tvs: {
												isnot: true,
												term,
												values: [{ key: targetItemData.key }]
											}
										}
										self.config.legendValueFilter.lst.push(filterNew)
									} else {
										// the filter for the categorical or survival term exist, but the current legend key is not there.
										self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.push({ key: targetItemData.key })
									}
								} else if (isNumericTerm(term)) {
									term.$id = targetItemData.$id
									const filterNew = {
										legendGrpName: targetItemData.termid,
										type: 'tvs',
										tvs: {
											isnot: true,
											term,
											ranges: [self.data.refs.byTermId[targetItemData.$id].bins.find(b => targetItemData.key == b.name)]
										}
									}
									self.config.legendValueFilter.lst.push(filterNew)
								}
							}
						} else {
							// when the legend is crossed-out, either by clicking hide or by clicking another legend and show-only,
							// A filter to filter out the legend's dt + legend's class exist in self.config.legendValueFilter
							// So remove the filter that filters out the legend's dt + legend's class
							if (targetItemData.dt) self.config.legendValueFilter.lst.splice(legendFilterIndex, 1)
							else {
								const term = self.termOrder.find(t => t.tw.$id == targetItemData.$id).tw.term
								if (term.type == 'categorical' || term.type == 'survival') {
									const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
										l => l.legendGrpName == targetItemData.termid
									)
									const filterIndex = self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.findIndex(
										v => v.key == targetItemData.key
									)
									self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.splice(filterIndex, 1)
								} else self.config.legendValueFilter.lst.splice(legendFilterIndex, 1)
							}
						}
						if (self.state.config.settings.matrix.addMutationCNVButtons && self.chartType !== 'hierCluster') {
							if (targetItemData.dt == dtsnvindel) {
								self.config.settings.matrix.showMatrixMutation = 'bySelection'
								const cl = self.settings.matrix.controlLabels
								if (
									self.legendData.find(l => l.name == cl.Mutations)?.items?.length ==
									self.config.legendValueFilter.lst.filter(l => l.legendGrpName == cl.Mutations)?.length
								) {
									//when all mutation items are hidden by applying legend value filter
									self.config.settings.matrix.allMatrixMutationHidden = true
								} else self.config.settings.matrix.allMatrixMutationHidden = false
							}
							if (targetItemData.dt == dtcnv) {
								self.config.settings.matrix.showMatrixCNV = 'bySelection'
								if (
									self.legendData.find(l => l.name == 'CNV')?.items?.length ==
									self.config.legendValueFilter.lst.filter(l => l.legendGrpName == 'CNV')?.length
								) {
									//when all CNV items are hidden by applying legend value filter
									self.config.settings.matrix.allMatrixCNVHidden = true
									if (self.config.settings.matrix.cellEncoding == 'oncoprint')
										self.config.settings.matrix.cellEncoding = 'single'
								} else {
									self.config.settings.matrix.allMatrixCNVHidden = false
									if (self.config.settings.matrix.cellEncoding !== '')
										self.config.settings.matrix.cellEncoding = 'oncoprint'
								}
							}
						}

						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: self.config
						})
					})
			}

			if (targetItemData.isLegendItem) {
				// Add the soft filter option only for the not already hidden geneVariant legend
				if (targetItemData.dt && legendFilterIndex == -1) {
					// only when filtering a not already hidden geneVariant legend, show the soft filter
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text(`Do not show ${mclass[targetItemData.key]?.label}`)
						.on('click', () => {
							menuGrp.hide()
							// add a new "soft filter" to filter out the legend's origin + legend's dt + legend's class
							// add a new "soft filter" to filter out samples that only have mutation match with (the legend's origin + legend's dt + legend's class) and no other mutation
							// and then hide the selected mutation on samples that have this selected mutation if the sample was not filtered out by this soft filter.

							const filterNew = {
								legendGrpName: targetItemData.termid,
								type: 'tvs',
								tvs: {
									isnot: true,
									legendFilterType: 'geneVariant_soft', // indicates this matrix legend filter is soft filter
									term: { type: 'geneVariant' },
									values: [{ dt: targetItemData.dt, origin: targetItemData.origin, mclasslst: [targetItemData.key] }]
								}
							}
							self.config.legendValueFilter.lst.push(filterNew)

							if (self.state.config.settings.matrix.addMutationCNVButtons && self.chartType !== 'hierCluster') {
								if (targetItemData.dt == dtsnvindel) {
									self.config.settings.matrix.showMatrixMutation = 'bySelection'
									const cl = self.settings.matrix.controlLabels
									if (
										self.legendData.find(l => l.name == cl.Mutations)?.items?.length ==
										self.config.legendValueFilter.lst.filter(l => l.legendGrpName == cl.Mutations)?.length
									) {
										//when all mutation items are hidden by applying legend value filter
										self.config.settings.matrix.allMatrixMutationHidden = true
									} else self.config.settings.matrix.allMatrixMutationHidden = false
								}
								if (targetItemData.dt == dtcnv) {
									self.config.settings.matrix.showMatrixCNV = 'bySelection'
									if (
										self.legendData.find(l => l.name == 'CNV')?.items?.length ==
										self.config.legendValueFilter.lst.filter(l => l.legendGrpName == 'CNV')?.length
									) {
										//when all CNV items are hidden by applying legend value filter
										self.config.settings.matrix.allMatrixCNVHidden = true
										if (self.config.settings.matrix.cellEncoding == 'oncoprint')
											self.config.settings.matrix.cellEncoding = 'single'
									} else self.config.settings.matrix.allMatrixCNVHidden = false
								}
							}
							self.app.dispatch({
								type: 'plot_edit',
								id: self.id,
								config: self.config
							})
						})
				}

				//Add the show only option only for non-genevariant legend
				if (!targetItemData.dt) {
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Show only')
						.on('click', () => {
							menuGrp.hide()
							const term = self.termOrder.find(t => t.tw.$id == targetItemData.$id)?.tw?.term
							const legendGrp =
								self.legendData.find(lg => lg.name == targetItemData.termid) ||
								self.legendData.find(lg => lg.$id == targetItemData.$id)

							// reset self.config.legendValueFilter.lst to remove all the filters in the lst that's in the same legendGrp
							self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
								l => l.legendGrpName !== targetItemData.termid
							)

							/*
						if (targetItemData.dt) {
							// for a geneVariant term
							for (const l of legendGrp.items) {
								if (l.dt == targetItemData.dt && (l.origin ? l.origin == targetItemData.origin : true) && l.key == targetItemData.key)
									continue
								const filterNew = {
									legendGrpName: targetItemData.termid,
									type: 'tvs',
									tvs: {
										isnot: true,
										legendFilterType: 'geneVariant_soft', // indicates this matrix legend filter is soft filter
										term: { type: 'geneVariant' },
										values: [{ dt: l.dt, origin: l.origin, mclasslst: [l.key] }]
									}
								}
								if (!self.config.legendValueFilter.lst.length) self.config.legendValueFilter.lst = [filterNew]
								else self.config.legendValueFilter.lst.push(filterNew)
							}
						} else {
							const term = self.termOrder.find(t => t.tw.$id == targetItemData.$id).tw.term
						*/

							// for a non-geneVariant term
							if (term.type == 'categorical' || term.type == 'survival') {
								term.$id = targetItemData.$id
								for (const l of legendGrp.items) {
									if (l.key == targetItemData.key) continue
									const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
										l => l.legendGrpName == targetItemData.termid
									)
									if (filterGrpIndex == -1) {
										const filterNew = {
											legendGrpName: targetItemData.termid,
											type: 'tvs',
											tvs: {
												isnot: true,
												term,
												values: [{ key: l.key }]
											}
										}
										self.config.legendValueFilter.lst.push(filterNew)
									} else {
										self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.push({ key: l.key })
									}
								}
							} else if (isNumericTerm(term)) {
								term.$id = targetItemData.$id
								for (const l of legendGrp.items) {
									if (l.key == targetItemData.key) continue
									const filterNew = {
										legendGrpName: targetItemData.termid,
										type: 'tvs',
										tvs: {
											isnot: true,
											term,
											ranges: [self.data.refs.byTermId[targetItemData.$id].bins.find(b => l.key == b.name)]
										}
									}
									if (!self.config.legendValueFilter.lst.length) self.config.legendValueFilter.lst = [filterNew]
									else self.config.legendValueFilter.lst.push(filterNew)
								}
							}
							self.app.dispatch({
								type: 'plot_edit',
								id: self.id,
								config: self.config
							})
						})
				}

				//Add the show all option only for non-genevariant legend
				if (!targetItemData.dt) {
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Show all')
						.on('click', () => {
							menuGrp.hide()
							self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
								l => l.legendGrpName !== targetItemData.termid
							)

							self.app.dispatch({
								type: 'plot_edit',
								id: self.id,
								config: self.config
							})
						})
				}

				// adding the change color option
				if (!targetData.domain) {
					div.append('span').text('Color').style('padding', '5px 10px').style('margin', '1px')
					self.dom.legendColorInput = div
						.append('input')
						.attr('type', 'color')
						.attr('aria-label', `change the bar color`)
						.attr('value', targetData.color?.startsWith('rgb') ? rgb2hex(targetData.color) : targetData.color)
						.on('change', async () => {
							menuGrp.hide()
							const color = self.dom.legendColorInput.node().value
							if (targetData.dt) {
								if (!mclass[targetData.key].origColor) mclass[targetData.key].origColor = mclass[targetData.key].color
								mclass[targetData.key].color = color
								self.main()
								return
							}

							const twSpecificSettings = self.config.settings.matrix.twSpecificSettings
							if (!twSpecificSettings[targetData.$id]) twSpecificSettings[targetData.$id] = {}
							const twSettings = twSpecificSettings[targetData.$id]

							if (!twSettings[targetData.key]) twSettings[targetData.key] = {}
							twSettings[targetData.key].color = color

							self.app.dispatch({
								type: 'plot_edit',
								id: self.opts.id,
								config: { settings: { matrix: { twSpecificSettings } } }
							})
						})
					if (targetData.dt && mclass[targetData.key].origColor) {
						const resetDiv = div.append('div').style('display', 'inline-block')
						const handler = () => {
							menuGrp.hide()
							mclass[targetData.key].color = mclass[targetData.key].origColor
							delete mclass[targetData.key].origColor
							self.main()
						}
						icons['restart'](resetDiv, { handler, title: 'Reset to original color' })
					}
				}
				menuGrp.showunder(event.target)
			}
		}
		if (targetData.parents) {
			for (const p of targetData.parents) {
				addMenuOptions(p)
			}
		} else {
			addMenuOptions(targetData)
		}
	}
}

function setMutationSelectionActions(self) {
	self.mutationSelectionActions = {
		onlyTruncating: showOnlyTrunc,
		onlyPC: showOnlyPC,
		none: showNone,
		all: showAll,
		bySelection: showByLegendFilter
	}
	self.mutationControlCallback = mutationSelection => {
		const menuGrp = self.dom.legendMenu.clear()
		const targetData = self.legendData.find(l => l.dt?.includes(dtsnvindel))
		self.mutationSelectionActions[mutationSelection](menuGrp, targetData, self, 'mutation')
	}
	self.CNVControlCallback = CNVSelection => {
		const menuGrp = self.dom.legendMenu.clear()
		const targetData = self.legendData.find(l => l.dt?.includes(dtcnv))
		self.mutationSelectionActions[CNVSelection](menuGrp, targetData, self, 'CNV')
	}

	self.geneStyleControlCallback = styleSelection => {
		const targetData = self.legendData.find(l => l.dt?.includes(dtcnv))
		if (styleSelection == '') showStackedStyle(targetData, self) //stacked style
		else if (styleSelection == 'single') showSingleStyle(targetData, self)
		else if (styleSelection == 'oncoprint') showOncoprintStyle(targetData, self)
	}
}

function showSingleStyle(targetData, self) {
	if (self.state.config.settings.matrix.addMutationCNVButtons && self.chartType !== 'hierCluster') {
		if (targetData) {
			// there are CNV data
			const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin

			//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
			const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
				f =>
					f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
					(!byOrigin || f.origin == targetData.origin)
			)
			if (legendGrpFilterIndex == -1) {
				// when the legend group is shown and now hide it
				// add a new "legend group filter" to filter out the legend group's origin + legend group's dt
				const filterNew = { dt: targetData.dt }
				if (byOrigin) {
					// when distinguish between germline and somatic for the dt
					filterNew.origin = targetData.origin
				}
				// when the legend group is hidden, need to remove the individual legend filter belongs to this legend group
				self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
					f => f.legendGrpName !== targetData.name
				)
				self.config.legendGrpFilter.lst.push(filterNew)
			}
		}
		self.config.settings.matrix.cellEncoding = 'single'
	}

	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

function showOncoprintStyle(targetData, self) {
	if (self.state.config.settings.matrix.addMutationCNVButtons && self.chartType !== 'hierCluster') {
		if (targetData) {
			// there are CNV data
			const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin

			//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
			const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
				f =>
					f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
					(!byOrigin || f.origin == targetData.origin)
			)
			if (legendGrpFilterIndex !== -1) self.config.legendGrpFilter.lst.splice(legendGrpFilterIndex, 1)
			// when changing to oncoPrint, need to remove the CNV legend filters
			self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
				f => f.legendGrpName !== targetData.name
			)
		}
		self.config.settings.matrix.showMatrixCNV = 'all'
		self.config.settings.matrix.allMatrixCNVHidden = false
	}
	self.config.settings.matrix.cellEncoding = 'oncoprint'
	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

function showStackedStyle(targetData, self) {
	if (self.state.config.settings.matrix.addMutationCNVButtons && self.chartType !== 'hierCluster') {
		if (targetData) {
			// there are CNV data
			const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin

			//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
			const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
				f =>
					f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
					(!byOrigin || f.origin == targetData.origin)
			)
			if (legendGrpFilterIndex !== -1) self.config.legendGrpFilter.lst.splice(legendGrpFilterIndex, 1)
			// when changing to oncoPrint, need to remove the CNV legend filters
			self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
				f => f.legendGrpName !== targetData.name
			)
		}
	}

	self.config.settings.matrix.cellEncoding = ''
	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

function showOnlyTrunc(menuGrp, targetData, self) {
	menuGrp.hide()
	// when the legend group is not hidden and show a "show only the truncating mutations" option
	// add a new "soft legend filter" to for all the legends in the legend group whose mclass
	// is not in the truncatingM

	if (targetData) {
		// there are mutations data
		//remove the individual legend filter in the group
		self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
			f => f.legendGrpName !== targetData.name
		)

		// remove the grp legend filter for the group
		self.config.legendGrpFilter.lst = self.config.legendGrpFilter.lst.filter(
			f => !(f.dt.includes(dtsnvindel) && f.origin == targetData.origin)
		)

		const truncatingM = self.config.settings.matrix.truncatingMutations
		const controlLabels = self.config.settings.matrix.controlLabels
		for (const [k, v] of Object.entries(mclass)) {
			if (truncatingM.includes(k) || v.dt != dtsnvindel) continue
			const filterNew = {
				legendGrpName: targetData.origin
					? `${targetData.origin[0].toUpperCase() + targetData.origin.slice(1)} ${controlLabels.Mutations}`
					: controlLabels.Mutations,
				type: 'tvs',
				tvs: {
					isnot: true,
					legendFilterType: 'geneVariant_soft',
					term: { type: 'geneVariant' },
					values: [{ dt: dtsnvindel, origin: targetData.origin, mclasslst: [k] }]
				}
			}
			self.config.legendValueFilter.lst.push(filterNew)
		}
	}

	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

function showOnlyPC(menuGrp, targetData, self) {
	menuGrp.hide()
	// when the legend group is not hidden and show a "show only non-truncating protein-changing mutations" option
	// add a new "soft legend filter" for all the legends in the legend group (origin + dt) whose mclass
	// is not in the nonTruncatingPCM

	if (targetData) {
		// there are mutations data
		//remove the individual legend filter in the group
		self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
			f => f.legendGrpName !== targetData.name
		)

		// remove the grp legend filter for the group
		self.config.legendGrpFilter.lst = self.config.legendGrpFilter.lst.filter(
			f => !(f.dt.includes(dtsnvindel) && f.origin == targetData.origin)
		)

		const proteinChangingMutations = self.config.settings.matrix.proteinChangingMutations
		const controlLabels = self.config.settings.matrix.controlLabels
		for (const [k, v] of Object.entries(mclass)) {
			if (proteinChangingMutations.includes(k) || v.dt != dtsnvindel) continue
			const filterNew = {
				legendGrpName: targetData.origin
					? `${targetData.origin[0].toUpperCase() + targetData.origin.slice(1)} ${controlLabels.Mutations}`
					: controlLabels.Mutations,
				type: 'tvs',
				tvs: {
					isnot: true,
					legendFilterType: 'geneVariant_soft',
					term: { type: 'geneVariant' },
					values: [{ dt: dtsnvindel, origin: targetData.origin, mclasslst: [k] }]
				}
			}
			self.config.legendValueFilter.lst.push(filterNew)
		}
	}

	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

function showNone(menuGrp, targetData, self, target) {
	menuGrp.hide()
	if (targetData) {
		// there are data
		const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin
		// when the legend group is shown and now hide it
		// add a new "legend group filter" to filter out the legend group's origin + legend group's dt

		//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
		const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
			f =>
				f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
				(!byOrigin || f.origin == targetData.origin)
		)
		if (legendGrpFilterIndex == -1) {
			const filterNew = { dt: targetData.dt }
			if (byOrigin) {
				// when distinguish between germline and somatic for the dt
				filterNew.origin = targetData.origin
			}
			// when the legend group is hidden, need to remove the individual legend filter belongs to this legend group
			self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
				f => f.legendGrpName !== targetData.name
			)
			self.config.legendGrpFilter.lst.push(filterNew)
		}
	}

	if (
		self.state.config.settings.matrix.addMutationCNVButtons &&
		self.chartType !== 'hierCluster' &&
		(target == 'CNV' || targetData?.dt?.includes(dtcnv)) &&
		self.config.settings.matrix.cellEncoding == 'oncoprint'
	) {
		self.config.settings.matrix.cellEncoding = 'single'
	}

	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: self.config
	})
}

export function getConfigForShowAll(self, targetData, target) {
	if (targetData) {
		// there are  data
		const byOrigin = self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin

		//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
		const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
			f =>
				f.dt.slice().sort().toString() === targetData.dt.slice().sort().toString() &&
				(!byOrigin || f.origin == targetData.origin)
		)

		//legendFilterIndex is the index of the first filter (in this filter group being clicked) that is already in self.config.legendValueFilter.lst, if there's any
		const legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
			l =>
				l.legendGrpName == targetData.name &&
				l.tvs.values.find(v => targetData.dt.includes(v.dt) && (!byOrigin || v.origin == targetData.origin))
		)

		if (legendGrpFilterIndex !== -1) self.config.legendGrpFilter.lst.splice(legendGrpFilterIndex, 1)
		if (legendFilterIndex !== -1)
			self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
				f => f.legendGrpName != targetData.name
			)
	}

	const s = self.config.settings.matrix
	if (
		s.addMutationCNVButtons &&
		self.chartType !== 'hierCluster' &&
		(target == 'CNV' || targetData?.dt?.includes(dtcnv)) &&
		s.cellEncoding !== ''
	) {
		s.cellEncoding = 'oncoprint'
	}

	return self.config
}

export function showAll(menuGrp, targetData, self, target) {
	menuGrp.hide()

	self.app.dispatch({
		type: 'plot_edit',
		id: self.id,
		config: getConfigForShowAll(self, targetData, target)
	})
}

function showByLegendFilter(menuGrp, targetData, self, target) {
	menuGrp.hide()
	const s = self.config.settings.matrix
	if (!targetData) {
		//there are no mutatons data
		if (s.addMutationCNVButtons && self.chartType !== 'hierCluster' && target == 'mutation') {
			s.showMatrixMutation = 'bySelection'
		} else if (s.addMutationCNVButtons && self.chartType !== 'hierCluster' && target == 'CNV') {
			s.showMatrixCNV = 'bySelection'
		}

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: self.config
		})
		return
	}
	self.app.tip.d.selectAll('.byLFClassDiv').remove()
	const classDiv = self.app.tip.d.append('div').attr('class', 'byLFClassDiv')

	const checkboxName = Math.random().toString()
	const mClassDiv = classDiv
		.selectAll(':scope>div')
		.data(target == 'mutation' ? s.mutationClasses : s.CNVClasses)
		.enter()
		.append('label')
		.style('margin', '5px')
		.style('margin-left', '30px')
		.style('display', 'block')
		.each(function (d) {
			const mclassDisabled = self.config.legendValueFilter.lst.find(
				f =>
					f.tvs.legendFilterType == 'geneVariant_hard' &&
					f.tvs.values[0].dt == mclass[d].dt &&
					f.tvs.values[0].mclasslst.includes(d)
			)
			const mclassHidden = target == 'mutation' ? s.hiddenMutations.includes(d) : s.hiddenCNVs.includes(d)

			const oneClassDiv = select(this).attr('class', 'sjpp_row_wrapper')
			oneClassDiv
				.append('input')
				.attr('type', 'checkbox')
				.attr('name', checkboxName)
				.property('disabled', mclassDisabled ? true : false)
				.property('checked', mclassDisabled || mclassHidden ? false : true)
				.style('vertical-align', 'top')
				.style('margin-right', '3px')
				.on('change', function () {
					const anyChecked = mClassDiv.selectAll(`input[type='checkbox'][name='${checkboxName}']:checked`).empty()
					applyBtn.property('disabled', anyChecked)
				})
			oneClassDiv
				.append('span')
				.style('margin-left', '3px')
				.html(mclass[d].label)
				//.style('color', d.color)
				.style('text-decoration', mclassDisabled ? 'line-through' : '')
		})

	const applyBtn = classDiv
		.append('button')
		.property('disabled', true)
		.style('margin-top', '3px')
		.text('Apply')
		.on('click', () => {
			const checkedCheckboxes = mClassDiv.selectAll(`input[type='checkbox'][name='${checkboxName}']:checked`)
			const checkedItems = checkedCheckboxes.nodes().map(c => select(c).datum())
			menuGrp.hide()

			//remove the individual legend filter in the group
			self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
				f => f.legendGrpName !== targetData.name || f.tvs.legendFilterType == 'geneVariant_hard'
			)

			// remove the grp legend filter for the group
			self.config.legendGrpFilter.lst = self.config.legendGrpFilter.lst.filter(
				f =>
					!(
						(f.dt.includes(dtsnvindel) && targetData.dt.includes(dtsnvindel)) ||
						(f.dt.includes(dtcnv) && targetData.dt.includes(dtcnv))
					)
			)

			for (const item of target == 'mutation' ? s.mutationClasses : s.CNVClasses) {
				if (checkedItems.includes(item)) continue
				// add a new "soft filter" to filter out the legend's origin + legend's dt + legend's class
				// add a new "soft filter" to filter out samples that only have mutation match with (the legend's origin + legend's dt + legend's class) and no other mutation
				// and then hide the selected mutation on samples that have this selected mutation if the sample was not filtered out by this soft filter.
				const filterNew = {
					legendGrpName: targetData.name,
					type: 'tvs',
					tvs: {
						isnot: true,
						legendFilterType: 'geneVariant_soft', // indicates this matrix legend filter is soft filter
						term: { type: 'geneVariant' },
						values: [{ dt: mclass[item].dt, origin: targetData.origin, mclasslst: [item] }]
					}
				}
				self.config.legendValueFilter.lst.push(filterNew)
			}

			if (
				self.state.config.settings.matrix.addMutationCNVButtons &&
				self.chartType !== 'hierCluster' &&
				(target == 'CNV' || targetData?.dt?.includes(dtcnv))
			) {
				if (checkedItems.length == 0 && self.config.settings.matrix.cellEncoding == 'oncoprint') {
					//when all CNV items are hidden by applying legend value filter
					self.config.settings.matrix.cellEncoding = 'single'
				} else if (checkedItems.length > 0 && self.config.settings.matrix.cellEncoding == 'single') {
					self.config.settings.matrix.cellEncoding = 'oncoprint'
				}
			}
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: self.config
			})
		})
}

//used by self.showCellInfo and self.mouseclick to get appropriate label
function getLabel(c, v, p) {
	let fusionLabel
	if (p)
		fusionLabel =
			p[0].a.name && p[0].b.name
				? p[0].a.name + '::' + p[0].b.name
				: p[0].a.name
				? p[0].a.name + '::' + '?'
				: p[0].b.name
				? '?' + '::' + p[0].b.name
				: ''
	const label =
		c.t.grp.type == 'hierCluster'
			? v.value
			: v && v.dt == dtcnv && v.value
			? `${mclass[v.class].label} (${v.value.toFixed(2)})`
			: p
			? fusionLabel
			: v.mname
			? `${v.mname} ${mclass[v.class].label}`
			: mclass[v.class].label

	return label
}
