import { select, pointer } from 'd3-selection'
import { fillTermWrapper, termsettingInit } from '#termsetting'
import { icons } from '#dom/control.icons'
import { newSandboxDiv } from '../dom/sandbox.ts'
import { mclass, dt2label } from '#shared/common'
import { format as d3format } from 'd3-format'
import { Menu } from '#dom/menu'

let inputIndex = 0

export function setInteractivity(self) {
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
		if (!d || !d.term || !d.sample || !d.siblingCells?.length) {
			self.dom.tip.hide()
			return
		}
		const s = self.settings.matrix
		const l = s.controlLabels
		const rows = []
		if (d.term.type != 'geneVariant') {
			rows.push(`<tr><td>${l.Sample}:</td><td>${d._SAMPLENAME_ || d.sample}</td></tr>`)
			rows.push(
				`<tr><td>${d.term.name}:</td><td style='color: ${d.fill == '#fff' || d.fill == 'transparent' ? '' : d.fill}'> ${
					d.convertedValueLabel || d.label
				}</td></tr>`
			)
		} else if (d.term.type == 'geneVariant' && d.value) {
			rows.push(`<tr><td>${l.Sample}:</td><td>${d._SAMPLENAME_ || d.value._SAMPLENAME_ || d.value.sample}</td></tr>`)
			rows.push(`<tr><td>Gene:</td><td>${d.term.name}</td></tr>`)

			const siblingCellLabels = {}
			for (const c of d.siblingCells) {
				if (c.$id != d.$id) continue
				const v = c.value
				const p = v.pairlst
				const dtLabel = v.origin ? `${v.origin} ${dt2label[v.dt]}` : dt2label[v.dt]
				// TODO: when the same label can apply to multiple values/hits in the same matrix cell,
				// list that label only once but with a hit count, instead of listing that same label
				// as multiple table rows in the mouseover
				const label =
					c.label == 'Gene Expression'
						? v.value
						: p
						? (p[0].a.name || p[0].a.chr) + '::' + (p[0].b.name || p[0].b.chr)
						: v.mname
						? `${v.mname} ${mclass[v.class].label}`
						: mclass[v.class].label

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
				rows.push(`<tr><td>${dtLabel}:</td><td  style='color: ${classArray[0].color}'>${classArray[0].label}</td></tr>`)
				for (const classType of classArray.slice(1)) {
					rows.push(`<tr><td></td><td style='color: ${classType.color}'>${classType.label}</td></tr>`)
				}
			}
		}
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		self.dom.tip.show(event.clientX, event.clientY)
		self.dom.mainG.on('mouseout', self.mouseout)
	}

	self.getImgCell = function (event) {
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
		if (!self.activeLabel) self.dom.tip.hide()
		delete self.imgBox
	}

	self.mouseclick = function (event, data) {
		// clicking only show actions for available genomic data; can later expand to non-genomic data and custom overrides
		const q = self.state.termdbConfig.queries
		if (!q) return // no genomic queries
		if (!q.singleSampleGenomeQuantification && !q.singleSampleMutation) return // only works for these queries

		self.dom.mainG.on('mouseout', null)
		delete self.imgBox
		const sampleData = data || event.target.__data__

		if (!sampleData) return // !!! it's undefined when dragging on the sample names

		// preliminary fix: assign string sample name for "sample_id", which is used by data queries below
		const sample = {
			sample_id: sampleData._SAMPLENAME_ || sampleData.row.sampleName || sampleData.row.sample
		}
		//when clicking a cell in SV, CNV, mutation panels
		const geneName = sampleData.term?.type == 'geneVariant' ? sampleData.term.name : null

		self.dom.clickMenu.d.selectAll('*').remove()
		if (q.singleSampleGenomeQuantification) {
			for (const k in q.singleSampleGenomeQuantification) {
				const menuDiv = self.dom.clickMenu.d
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(k)
					.on('click', async event => {
						const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
						sandbox.header.text(sample.sample_id)
						await (
							await import('./plot.ssgq.js')
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
				.text('Disco plot')
				.on('click', async event => {
					const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
					sandbox.header.text(sample.sample_id)
					;(await import('./plot.disco.js')).default(
						self.state.termdbConfig,
						self.state.vocab.dslabel,
						sample,
						sandbox.body,
						self.app.opts.genome,
						{
							label: {
								prioritizeGeneLabelsByGeneSets: true // TODO control this at dataset-level
							}
						}
					)
					menuDiv.remove()
					self.dom.clickMenu.d.selectAll('*').remove()
				})
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
		const s = self.settings.matrix
		const d = self.dimensions
		const i = Math.round((0.5 * d.mainw - d.seriesXoffset - dx) / d.dx)
		return self.sampleOrder[i]
	}

	//setSampleActions(self)
	setTermActions(self)
	setTermGroupActions(self)
	setSampleGroupActions(self)
	setZoomPanActions(self)
	setResizeHandler(self)
	setLengendActions(self)
}

function setResizeHandler(self) {
	let resizeId
	select(window).on(`resize.sjpp-${self.id}`, () => {
		clearTimeout(resizeId)
		resizeId = setTimeout(resize, 200)
	})
	function resize() {
		self.main()
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

			getBodyParams: () => {
				const currentGeneNames = []
				for (const g of self.config.termgroups) {
					for (const t of g.lst) {
						if (t.term.type == 'geneVariant') {
							if (t.term.gene) {
								currentGeneNames.push(t.term.gene)
							} else if (t.term.name) {
								currentGeneNames.push(t.term.name)
							}
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
					if (t && t.tw) tw.$id = t.tw.$id
					self.pill.main(tw)
					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.lstIndex],
								value: tw
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

	self.showTermMenu = async function (event) {
		const t = event.target.__data__
		if (!t || !t.tw || !t.grp) return
		const s = self.settings.matrix
		const l = s.controlLabels
		self.activeLabel = t
		self.dom.menutop.style('display', '').selectAll('*').remove()
		self.dom.menubody.style('padding', 0).selectAll('*').remove()

		self.dom.shortcutDiv = self.dom.menutop.append('div')
		self.showShortcuts(t, self.dom.shortcutDiv)

		self.dom.twMenuDiv = self.dom.menutop.append('div')
		const labelEditDiv = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		labelEditDiv.append('span').text(`${l.Term} `)

		const twlabel = t.tw.label || t.tw.term.name
		const vartype = t.tw.term.type == 'geneVariant' ? 'gene' : 'variable'
		self.dom.twLabelInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', twlabel.length + 3)
			.attr('title', `Type to edit the ${vartype} label`)
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
			self.dom.gbButton = labelEditDiv
				.append('button')
				.style('text-align', 'center')
				.html('Lollipop')
				.on('click', async () => {
					await self.launchGB(t)
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
		await self.pill.main(t.tw ? t.tw : { term: null, q: null })
		self.pill.showMenu(event, clickedElem, self.dom.twMenuBar)

		self.dom.grpMenuDiv = self.dom.menutop.append('div').style('margin-top', '10px')
		//self.showTermGroupInputs(self.dom.grpMenuDiv)
		//self.dom.tip.showunder(clickedElem)
		self.dom.tip.show(event.clientX - 20, event.clientY - 20)
	}

	self.launchGB = async t => {
		const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
		sandbox.header.text(t.tw.term.name)
		const arg = {
			holder: sandbox.body.append('div').style('margin', '20px'),
			genome: self.app.opts.genome,
			nobox: true,
			query: t.tw.term.name,
			tklst: [
				{
					type: 'mds3',
					dslabel: self.app.opts.state.vocab.dslabel
				}
			]
		}
		const _ = await import('#src/block.init')
		await _.default(arg)
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
		const vartype = t.tw.term.type == 'geneVariant' ? 'gene' : 'variable'
		div
			.append('span')
			.selectAll('div')
			.data(
				[
					{
						icon: 'corner',
						title: `Sort ${l.samples} against this ${vartype}, and position this ${vartype} at the top left corner`,
						disabled:
							t.grp.lst.length < 1 ||
							(t.index === 0 && t.tw.sortSamples?.priority === 0) ||
							(self.type == 'hierCluster' && t.grpIndex === 0),
						handler: self.sortSamplesAgainstCornerTerm
					},
					{
						icon: 'left',
						title: `Sort ${l.samples} against this ${vartype}`,
						disabled: t.tw.sortSamples?.priority === 0 || (self.type == 'hierCluster' && t.grpIndex === 0),
						handler: self.sortSamplesAgainstTerm
					},
					{
						html: '&nbsp;|&nbsp;'
					},
					{
						icon: 'up',
						title: `Move this ${vartype} up`,
						disabled: t.index === 0 || (self.type == 'hierCluster' && t.grpIndex === 0),
						handler: self.moveTermUp
					},

					{
						icon: 'down',
						title: `Move this ${vartype} down`,
						disabled: t.index === t.grp.lst.length - 1 || (self.type == 'hierCluster' && t.grpIndex === 0),
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
		event.stopPropagation()
		const t = self.activeLabel
		const [tcopy] = self.getSorterTerms(t)
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
			await self.pill.main(self.activeLabel.tw)
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
		self.showDictTermSelection()
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

	self.showDictTermSelection = async () => {
		//self.dom.dictTermBtn.style('text-decoration', 'underline')
		//self.dom.textTermBtn.style('text-decoration', '')

		const termdb = await import('../termdb/app')
		self.dom.editbody.selectAll('*').remove()
		termdb.appInit({
			holder: self.dom.editbody.append('div'),
			vocabApi: self.app.vocabApi,
			state: {
				vocab: self.state.vocab,
				activeCohort: self.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					usecase: { target: 'matrix', detail: 'termgroups' }
				}
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
			termlst.map(async term => {
				const tw = 'id' in term ? { id: term.id, term } : { term }
				await fillTermWrapper(tw)
				return tw
			})
		)
		const pos = select(`input[name='${self.insertRadioId}']:checked`).property('value')
		const t = self.activeLabel
		const termgroups = self.termGroups
		if (self.dom.grpNameSelect.property('value') == 'current') {
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

				if (sortColInput.property('checked') || self.moveInput.property('checked')) {
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
		const matchingSortSamples = activeOption.sortPriority?.find(o => o.types.includes(t.tw.term.type))?.tiebreakers[0]
		const sortSamples = matchingSortSamples
			? {} // will let matrix.sort fill-in based on the first matching tiebreaker
			: t.tw.term.type == 'geneVariant'
			? {
					by: 'class',
					order: [
						'Fuserna',
						'CNV_loss',
						'CNV_amp',
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

		const i = sorterTerms.findIndex(st => st.$id === t.tw.$id)
		const tcopy = JSON.parse(JSON.stringify(t.tw))
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
					}
				]
			})
		} else {
			// remove this now-empty group
			termgroups.splice(t.grpIndex, 1)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: { termgroups }
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
	self.showSampleGroupMenu = function () {
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
			.style('display', 'inline-block')
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

		const termdb = await import('../termdb/app')
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
		const divideBy = JSON.parse(JSON.stringify(self.config.divideBy))
		if (!divideBy.exclude) divideBy.exclude = []
		divideBy.exclude.push(self.activeLabel.grp.id)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				divideBy
			}
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
			.on('click', self.updateTermGrpName)

		self.dom.menubody.style('padding', 0).selectAll('*').remove()

		const menuOptions = [
			{ label: 'Edit', callback: self.showTermGroupEditMenu },
			{ label: 'Add Rows', callback: self.showTermInsertMenu },
			{ label: 'Sort', callback: self.showSortMenu },
			{ label: 'Delete', callback: self.removeTermGroup }
		]

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
			.attr('title', `May be overridden by a row-specific minNumSamples`)
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
			if (self.chartType == 'hierCluster') {
				// do not show term label hover over tooltip for hier claster
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

			if (data.tw.term.type == 'geneVariant') {
				// for geneVariant term, use subGroupCounts to show number of counted samples (WT and Blank are not counted)
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
				const termLegend = self.legendData.find(t => t.name == data.label)
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
					const termLegend = subGrp.legendData.find(t => t.name == data.label)

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
		if (event.target.tagName === 'text') select(event.target).style('fill', 'blue')
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
			if (self.type == 'hierCluster' && t.tw && t.grp?.name == 'Gene Expression') return
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
			const width = event.clientX - event.target.getBoundingClientRect().x + d.xMin
			const i = Math.floor(width / d.dx)
			return self.sampleOrder[i]
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
			delete self.clickedSeriesCell
			delete self.zoomArea
			return
		}

		const s = self.settings.matrix
		const l = s.controlLabels
		c.endCell = endCell
		const ss = self.opts.allow2selectSamples
		if (ss) {
			self.dom.tip.hide()
			self.app.tip.clear()
			self.app.tip.d
				.selectAll('div')
				.data([
					{
						label: 'Zoom in',
						callback: self.triggerZoomArea
					},
					{
						label: ss.buttonText || `Select ${l.Samples}`,
						callback: async () => {
							const c = self.clickedSeriesCell
							delete self.clickedSeriesCell
							const d = self.dimensions
							const start = c.startCell.totalIndex < c.endCell.totalIndex ? c.startCell : c.endCell
							const xy = self.zoomArea.attr('transform').split('(')[1].split(')')[0].split(',').map(Number)
							const xMin = xy[0]
							const xMax = xMin + self.zoomWidth
							const processed = new Set()
							const filter = c => c.row && c.x >= xMin && c.x <= xMax
							const addRow = c => samples.add(c.row)
							const samples = new Set()
							for (const series of self.serieses) {
								series.cells.filter(filter).forEach(addRow)
							}
							ss.callback({
								samples: await self.app.vocabApi.convertSampleId([...samples], ss.attributes),
								source: `Selected ${l.samples} from OncoMatrix`
							})
							self.zoomArea.remove()
							delete self.zoomArea
							delete self.clickedSeriesCell
						}
					}
				])
				.enter()
				.append('div')
				.attr('class', 'sja_menuoption')
				.html(d => d.label)
				.on('click', event => {
					self.app.tip.hide()
					event.target.__data__.callback()
				})

			self.app.tip.show(event.clientX, event.clientY)
		} else {
			self.triggerZoomArea()
		}
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
		const colw = self.computedSettings.colw
		const maxZoomLevel = s.colwMax / colw
		const minZoomLevel = s.colwMin / colw
		const tentativeZoomLevel = (s.zoomLevel * d.mainw) / self.zoomWidth
		const zoomLevel = Math.max(minZoomLevel, Math.min(tentativeZoomLevel, maxZoomLevel))
		const zoomCenter = centerCell.totalIndex * d.dx + (centerCell.grpIndex - 1) * s.colgspace + d.seriesXoffset

		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				settings: {
					matrix: {
						zoomLevel,
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
		if (targetData.dt == 3) {
			// for gene expression don't use legend as filter
			return
		}
		if (!targetData.isLegendItem && !targetData.dt) {
			// when its a non-genevariant legend group name
			return
		}

		const legendGrpHidden = self.config.legendGrpFilter.lst.find(f => f.legendData.name == targetData.termid) && true
		if (targetData.isLegendItem && legendGrpHidden) {
			// when the legend's group is hidden
			return
		}
		select(event.target).style('fill', 'blue').style('cursor', 'pointer')
	}

	self.legendLabelMouseout = event => {
		select(event.target).style('fill', '')
	}

	self.legendLabelMouseup = event => {
		const targetData = event.target.__data__
		if (targetData.dt == 3) {
			// for gene expression don't use legend as filter
			return
		}
		if (!targetData.isLegendItem) {
			// for legend group name
			if (!targetData.dt) {
				// when its a non-genevariant legend group name
				return
			}

			//legendGrpFilterIndex is the index of the filter that is already in self.config.legendGrpFilter.lst
			const legendGrpFilterIndex = self.config.legendGrpFilter.lst.findIndex(
				f => f.dt == targetData.dt && (!f.origin || f.origin == targetData.origin)
			)
			const menuGrp = new Menu({ padding: '0px' })
			const div = menuGrp.d.append('div')
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(legendGrpFilterIndex == -1 ? `Do not show ${targetData.name}` : `Show ${targetData.name}`)
				.on('click', () => {
					menuGrp.hide()
					if (legendGrpFilterIndex == -1) {
						// when the legend group is shown and now hide it
						// add a new "legend group filter" to filter out the legend group's origin + legend group's dt
						const legendData = structuredClone(targetData)
						legendData.crossedOut = true
						const filterNew = { dt: targetData.dt, legendData }
						if (self.state.termdbConfig.assayAvailability?.byDt?.[parseInt(targetData.dt)]?.byOrigin) {
							// when distinguish between germline and somatic for the dt
							filterNew.origin = targetData.origin
						}
						// when the legend group is hidden, remove the individual legend filter in the group
						self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
							f => f.legendGrpName != legendData.name
						)

						self.config.legendGrpFilter.lst.push(filterNew)
					} else {
						// when the legend group is alcrossed-out and now show it
						self.config.legendGrpFilter.lst.splice(legendGrpFilterIndex, 1)
					}
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: self.config
					})
				})
			menuGrp.showunder(event.target)
			return
		}

		const legendGrpHidden = self.config.legendGrpFilter.lst.find(f => f.legendData.name == targetData.termid) && true
		if (targetData.isLegendItem && legendGrpHidden) {
			// when the legend's group is hidden
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
							v.dt == targetData.dt && (!v.origin || v.origin == targetData.origin) && v.mclasslst[0] == targetData.key
					)
			)
		} else {
			// when its non-geneVariant term
			const legendTerm = self.termOrder.find(to => to.tw.$id == targetData.$id)?.tw?.term
			if (!legendTerm) {
				// legend value filter works for the terms in self.termOrder
				return
			}
			if (legendTerm.type == 'categorical') {
				legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
					l => l.legendGrpName == targetData.termid && l.tvs.values.find(v => v.key == targetData.key)
				)
			} else if (legendTerm.type == 'integer' || legendTerm.type == 'float') {
				legendFilterIndex = self.config.legendValueFilter.lst.findIndex(
					l => l.legendGrpName == targetData.termid && l.tvs.ranges.find(r => r.name == targetData.key)
				)
			}
		}
		const controlLabels = self.settings.matrix.controlLabels
		const menu = new Menu({ padding: '0px' })
		const div = menu.d.append('div')
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(
				targetData.dt
					? legendFilterIndex == -1
						? `Hide ${controlLabels.samples} with ${mclass[targetData.key].label}`
						: `Show ${controlLabels.samples} with ${mclass[targetData.key].label}`
					: legendFilterIndex == -1
					? 'Hide'
					: 'Show'
			)
			.on('click', () => {
				menu.hide()
				if (legendFilterIndex == -1) {
					// when its shown and now hide it
					if (targetData.dt) {
						// for a geneVariant term
						// add a new "hard filter" to filter out samples that have genes' values match with the legend's origin + legend's dt + legend's class
						const filterNew = {
							legendGrpName: targetData.termid,
							type: 'tvs',
							tvs: {
								isnot: true,
								legendFilterType: 'geneVariant_hard', // indicates this matrix legend filter is hard filter
								term: { type: 'geneVariant' },
								values: [{ dt: targetData.dt, origin: targetData.origin, mclasslst: [targetData.key] }]
							}
						}
						self.config.legendValueFilter.lst.push(filterNew)
					} else {
						// for a non-geneVariant term
						const term = self.termOrder.find(t => t.tw.$id == targetData.$id).tw.term
						if (term.type == 'categorical') {
							term.$id = targetData.$id
							const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
								l => l.legendGrpName == targetData.termid
							)
							if (filterGrpIndex == -1) {
								const filterNew = {
									legendGrpName: targetData.termid,
									type: 'tvs',
									tvs: {
										isnot: true,
										term,
										values: [{ key: targetData.key }]
									}
								}
								self.config.legendValueFilter.lst.push(filterNew)
							} else {
								// the filter for the categorical term exist, but the current legend key is not there.
								self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.push({ key: targetData.key })
							}
						} else if (term.type == 'integer' || term.type == 'float') {
							term.$id = targetData.$id
							const filterNew = {
								legendGrpName: targetData.termid,
								type: 'tvs',
								tvs: {
									isnot: true,
									term,
									ranges: [self.data.refs.byTermId[targetData.$id].bins.find(b => targetData.key == b.name)]
								}
							}
							self.config.legendValueFilter.lst.push(filterNew)
						}
					}
				} else {
					// when the legend is crossed-out, either by clicking hide or by clicking another legend and show-only,
					// A filter to filter out the legend's dt + legend's class exist in self.config.legendValueFilter
					// So remove the filter that filters out the legend's dt + legend's class
					if (targetData.dt) self.config.legendValueFilter.lst.splice(legendFilterIndex, 1)
					else {
						const term = self.termOrder.find(t => t.tw.$id == targetData.$id).tw.term
						if (term.type == 'categorical') {
							const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
								l => l.legendGrpName == targetData.termid
							)
							const filterIndex = self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.findIndex(
								v => v.key == targetData.key
							)
							self.config.legendValueFilter.lst[filterGrpIndex].tvs.values.splice(filterIndex, 1)
						} else self.config.legendValueFilter.lst.splice(legendFilterIndex, 1)
					}
				}
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { legendValueFilter: self.config.legendValueFilter }
				})
			})

		if (targetData.isLegendItem) {
			// not for the legend group names
			if (targetData.dt && legendFilterIndex == -1) {
				// only when filtering a not already hidden geneVariant legend, show the soft filter
				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(`Do not show ${mclass[targetData.key].label}`)
					.on('click', () => {
						menu.hide()
						// add a new "soft filter" to filter out the legend's origin + legend's dt + legend's class
						// add a new "soft filter" to filter out samples that only have mutation match with (the legend's origin + legend's dt + legend's class) and no other mutation
						// and then hide the selected mutation on samples that have this selected mutation if the sample was not filtered out by this soft filter.

						const filterNew = {
							legendGrpName: targetData.termid,
							type: 'tvs',
							tvs: {
								isnot: true,
								legendFilterType: 'geneVariant_soft', // indicates this matrix legend filter is soft filter
								term: { type: 'geneVariant' },
								values: [{ dt: targetData.dt, origin: targetData.origin, mclasslst: [targetData.key] }]
							}
						}
						self.config.legendValueFilter.lst.push(filterNew)

						self.app.dispatch({
							type: 'plot_edit',
							id: self.id,
							config: { legendValueFilter: self.config.legendValueFilter }
						})
					})
			}

			if (!targetData.dt) {
				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Show only') // show only option only exist for non-genevariant legend
					.on('click', () => {
						menu.hide()
						const term = self.termOrder.find(t => t.tw.$id == targetData.$id)?.tw?.term
						const legendGrp =
							self.legendData.find(lg => lg.name == targetData.termid) ||
							self.legendData.find(lg => lg.$id == targetData.$id)

						// reset self.config.legendValueFilter.lst to remove all the filters in the lst that's in the same legendGrp
						self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
							l => l.legendGrpName !== targetData.termid
						)

						/*
						if (targetData.dt) {
							// for a geneVariant term
							for (const l of legendGrp.items) {
								if (l.dt == targetData.dt && (l.origin ? l.origin == targetData.origin : true) && l.key == targetData.key)
									continue
								const filterNew = {
									legendGrpName: targetData.termid,
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
							const term = self.termOrder.find(t => t.tw.$id == targetData.$id).tw.term
						*/

						// for a non-geneVariant term
						if (term.type == 'categorical') {
							term.$id = targetData.$id
							for (const l of legendGrp.items) {
								if (l.key == targetData.key) continue
								const filterGrpIndex = self.config.legendValueFilter.lst.findIndex(
									l => l.legendGrpName == targetData.termid
								)
								if (filterGrpIndex == -1) {
									const filterNew = {
										legendGrpName: targetData.termid,
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
						} else if (term.type == 'integer' || term.type == 'float') {
							term.$id = targetData.$id
							for (const l of legendGrp.items) {
								if (l.key == targetData.key) continue
								const filterNew = {
									legendGrpName: targetData.termid,
									type: 'tvs',
									tvs: {
										isnot: true,
										term,
										ranges: [self.data.refs.byTermId[targetData.$id].bins.find(b => l.key == b.name)]
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

			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show all')
				.on('click', () => {
					if (targetData.dt) {
						menu.hide()
						self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
							l => l.legendGrpName !== targetData.termid
						)
					} else {
						menu.hide()
						self.config.legendValueFilter.lst = self.config.legendValueFilter.lst.filter(
							l => l.legendGrpName !== targetData.termid
						)
					}

					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: self.config
					})
				})
			menu.showunder(event.target)
		}
	}
}
