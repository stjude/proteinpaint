import { select, pointer } from 'd3-selection'
import { fillTermWrapper, termsettingInit } from '../termsetting/termsetting'
import { icons } from '../dom/control.icons'

let inputIndex = 0

export function setInteractivity(self) {
	self.showCellInfo = function(event) {
		if (self.activeLabel || self.zoomArea) return
		if (!(event.target.tagName == 'rect' || event.target.tagName == 'image')) return
		const d = event.target.tagName == 'rect' ? event.target.__data__ : self.getImgCell(event)
		if (!d || !d.term || !d.sample) {
			self.dom.tip.hide()
			return
		}
		const rows = []
		if (d.term.type != 'geneVariant') {
			rows.push(`<tr><td>Sample:</td><td>${d._SAMPLENAME_ || d.sample}</td></tr>`)
			rows.push(
				`<tr><td>${d.term.name}:</td><td style='color: ${d.fill == '#fff' ? '' : d.fill}'> ${d.label}</td></tr>`
			)
		} else if (d.term.type == 'geneVariant' && d.value) {
			rows.push(
				`<tr><td colspan='2' style='text-align: center'>Sample: ${d._SAMPLENAME_ ||
					d.value._SAMPLENAME_ ||
					d.value.sample}</td></tr>`
			)
			rows.push(`<tr><td colspan='2' style='text-align: center'>${d.term.name}</td></tr>`)
			for (const c of d.siblingCells) {
				if (c.$id != d.$id) continue
				const v = c.value
				const label = v.mname ? `${v.mname} ${c.label}` : c.label
				const info = []
				if (v.label && v.label !== c.label) info.push(v.label)
				if (v.chr) info.push(`${v.chr}:${v.pos}`)
				if (v.alt) info.push(`${v.ref}>${v.alt}`)

				const tds = !info.length
					? `<td colspan='2' style='text-align: center'>${label}</td>`
					: `<td style='text-align: right'>${label}</td><td>${info.map(i => `<span>${i}</span>`).join(' ')}</td>`

				const color = c.fill == v.color || v.class == 'Blank' ? '' : c.fill
				rows.push(`<tr style='color: ${color}'>${tds}</tr>`)
			}
		}

		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
		self.dom.tip.show(event.clientX, event.clientY)
	}

	self.getImgCell = function(event) {
		const d = event.target.__data__
		const rect = event.target.getBoundingClientRect()
		const x2 = event.clientX - rect.x
		for (const cell of d.cells) {
			const min = cell.x
			const max = cell.x + self.dimensions.dx
			if (min < x2 && x2 <= max) return cell
		}
		return null
	}

	self.mouseout = function() {
		if (!self.activeLabel && !self.activeLabel && !self.activeLabel) self.dom.tip.hide()
	}

	self.legendClick = function() {}

	self.svgMousemove = function(event) {
		if (!self.dragged) return
		const s = self.config.settings.matrix
		const d = self.dragged
		const x2 = !s.transpose ? d.x : d.x - d.clientX + event.clientX
		const y2 = !s.transpose ? d.y - d.clientY + event.clientY : d.y
		d.clone.attr('transform', `translate(${x2},${y2})`)
	}

	self.svgMouseup = function(event) {
		if (!self.dragged) return
		self.dragged.clone.remove()
		delete self.dragged
		delete self.clicked
	}

	self.getVisibleCenterCell = function(dx) {
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

/*
// TODO: may add drag events for sample labels
function setSampleActions(self) {
	self.sampleLabelMousedown = (event, d) => {
		self.clicked = { event, d }
	}

	self.sampleLabelMouseover = (event, t) => {
		select(event.target).style('fill', 'blue')
		if (!self.dragged) return
		// TODO: why is the element-bound __data__ (t) not provided as a second argument by d3??
		self.hovered = event.target.__data__
	}

	self.sampleLabelMouseout = event => {
		select(event.target).style('fill', '')
		//if (!this.dragged) return
	}

	self.sampleLabelMousemove = () => {
		const s = self.config.settings.matrix
		if (self.clicked && !self.dragged) {
			self.dom.sampleLabelG
				.selectAll('text')
				.style('-webkit-user-select', 'none')
				.style('-moz-user-select', 'none')
				.style('-ms-user-select', 'none')
				.style('user-select', 'none')

			const label = self.clicked.event.target.closest('.sjpp-matrix-label')
			// TODO: use a native or D3 transform accessor
			const [x, y] = select(label)
				.attr('transform')
				.split('translate(')[1]
				.split(')')[0]
				.split(',')
				.map(Number)
			const node = label.cloneNode(true)
			self.dom.sampleLabelG.node().prepend(node)
			self.dragged = {
				orig: label,
				clone: select(node)
					.style('cursor', 'move')
					.style('pointer-events', 'none'),
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
		const x2 = s.transpose ? d.x : d.x - d.clientX + event.clientX
		const y2 = s.transpose ? d.y - d.clientY + event.clientY : d.y
		self.dragged.clone.attr('transform', `translate(${x2},${y2})`)
	}

	self.sampleLabelMouseup = event => {
		delete self.clicked
		const s = self.config.settings.matrix
		if (self.dragged) {
			self.dragged.clone.remove()
			if (self.hovered) {
				// reposition the dragged row/column
				const d = self.dragged
				const t = d.orig.__data__
				const h = self.hovered
				// NOTE: currently, the rendered order does not have to match the termgroup.lst order
				// ??? actually resort termgroup.lst to reflect the current term order ???
				for (const grp of self.sampleGroups) {
					grp.lst.sort((a, b) => {
						const a1 = self.sampleOrder.find(t => t.sample === a.sample)
						const b1 = self.sampleOrder.find(t => t.sample === b.sample)
						if (!a1 && !b1) return 0
						if (!a1) return 1
						if (!b1) return -1
						return a1.totalIndex - b1.totalIndex
					})
				}

				const sample = self.sampleGroups[t.grpIndex].lst.splice(t.index, 1)[0]
				self.config.termgroups[h.grpIndex].lst.splice(h.index, 0, sample)

				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						samplegroups: self.config.samplegroups,
						settings: {
							matrix: {
								sortSamplesBy: 'asListed'
							}
						}
					}
				})
			}

			self.dom.sampleLabelG
				.selectAll('text')
				.style('fill', '')
				.style('-webkit-user-select', '')
				.style('-moz-user-select', '')
				.style('-ms-user-select', '')
				.style('user-select', '')

			delete self.dragged
		} else {
			self.showTermMenu(event)
		}
	}
}
*/
function setTermActions(self) {
	setLabelDragEvents(self, 'term')

	self.setPill = function(appState) {
		// will reuse a pill instance to show term edit menu
		self.pill = termsettingInit({
			tip: self.customTipApi,
			menuOptions: 'all',
			menuLayout: 'horizontal',
			vocabApi: self.app.vocabApi,
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			numericEditMenuVersion: ['discrete', 'continuous'],
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

	self.showTermMenu = async function(event) {
		const t = event.target.__data__
		if (!t || !t.tw) return
		self.activeLabel = t
		self.dom.menutop
			.style('display', '')
			.selectAll('*')
			.remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		self.dom.shortcutDiv = self.dom.menutop.append('div')
		self.showShortcuts(t, self.dom.shortcutDiv)

		self.dom.twMenuDiv = self.dom.menutop.append('div')
		const labelEditDiv = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		labelEditDiv.append('span').text('Term ')

		const twlabel = t.tw.label || t.tw.term.name
		self.dom.twLabelInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', twlabel.length + 3)
			.attr('title', 'Type to edit the term label')
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

		if (self.config.settings.matrix.maxSample) {
			self.dom.twMenuDiv
				.append('div')
				.style('text-align', 'center')
				.style('margin', '5px')
				.text(`#samples: ${t.counts.samples} rendered, ${t.allCounts.samples - t.counts.samples} not rendered`)
		}

		self.dom.twMenuBar = self.dom.twMenuDiv.append('div').style('text-align', 'center')
		//menuBtnsDiv.on('click', () => menuBtnsDiv.style('display', 'none'))
		// must remember event target since it's cleared after async-await
		const clickedElem = event.target
		await self.pill.main(t.tw ? t.tw : { term: null, q: null })
		self.pill.showMenu(event, clickedElem, self.dom.twMenuBar)

		self.dom.grpMenuDiv = self.dom.menutop.append('div').style('margin-top', '10px')
		//self.showTermGroupInputs(self.dom.grpMenuDiv)
		self.dom.tip.showunder(clickedElem)
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
		div.style('text-align', 'center')
		//div.append('span').html('Shortcuts: ')

		// sorting icons
		div
			.append('span')
			.selectAll('div')
			.data(
				[
					{
						icon: 'corner',
						title: `Sort samples against this gene positioned at the top left corner`,
						disabled: t.grp.lst.length < 1 || (t.index === 0 && t.tw.sortSamples?.priority === 0),
						handler: self.sortSamplesAgainstCornerTerm
					},
					{
						icon: 'left',
						title: `Sort samples against this gene`,
						disabled: t.tw.sortSamples?.priority === 0,
						handler: self.sortSamplesAgainstTerm
					},
					{
						html: '&nbsp;|&nbsp;'
					},
					{
						icon: 'up',
						title: `Move this term up`,
						disabled: t.index === 0,
						handler: self.moveTermUp
					},

					{
						icon: 'down',
						title: `Move this term down`,
						disabled: t.index === t.grp.lst.length - 1,
						handler: self.moveTermDown
					}
				],
				d => d.icon
			)
			.enter()
			.append('div')
			.style('display', 'inline-block')
			.each(function(d) {
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
						sortTermsBy: 'asListed',
						sortSamplesBy: 'selectedTerms'
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
				termgroups,
				settings: {
					matrix: {
						sortSamplesBy: 'selectedTerms'
					}
				}
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

		if (t.tw.term.type == 'geneVariant') {
			const div = self.dom.menubody.append('div')
			const label = div.append('label')
			label.append('span').html('Minimum #sample to be visible')

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
		grpNameDiv.append('label').html('Insert terms in ')
		self.dom.grpNameSelect = grpNameDiv.append('select').on('change', () => {
			const value = self.dom.grpNameSelect.property('value')
			self.dom.grpNameTextInput
				.property('disabled', value == 'current')
				.property('value', value == 'current' ? self.activeLabel.grp.name : newGrpName)
		})
		self.dom.grpNameSelect
			.selectAll('option')
			.data([{ label: 'current', value: 'current', selected: true }, { label: 'new', value: 'new' }])
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

	self.makeInsertPosRadios = function(div) {
		const insertPosInput = div.append('div') /*.style('display', 'inline-block')*/.style('margin', '10px 5px')
		insertPosInput
			.append('div')
			.style('display', 'inline-block')
			.style('padding-right', '10px')
			.html('Insert&nbsp')

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
		belowLabel
			.append('input')
			.attr('type', 'radio')
			.attr('value', 'below')
			.attr('name', self.insertRadioId)
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

		self.dom.menubody
			.append('div')
			.style('margin-top', '10px')
			.style('text-align', 'center')
			.html(t.tw.term.name)

		self.moveInput = undefined
		//if (t.grp.lst.length > 1) self.showTermMoveOptions(t)
		self.showSortOptions(t)
	}

	self.showTermMoveOptions = t => {
		const moveDiv = self.dom.menubody.append('div').style('margin-top', '10px')

		const moveLabel = moveDiv.append('label')
		self.moveInput = moveLabel
			.append('input')
			.attr('type', 'checkbox')
			.style('text-align', 'center')

		moveLabel.append('span').html('&nbsp;move this term&nbsp;')

		const movePos = moveDiv.append('select')
		movePos
			.selectAll('option')
			.data([{ label: 'before', value: 0 }, { label: 'after', value: 1 }])
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

		sortColLabel.append('span').html(`&nbsp;sort samples against (in order of priority):`)

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
							},
							{
								nestedKeys: ['settings', 'matrix', 'sortSamplesBy'],
								value: 'selectedTerms'
							}
						]
					})
				}

				self.dom.tip.hide()
			})
	}

	self.showSorterTerms = (sortColDiv, t) => {
		const [tcopy, sorterTerms] = self.getSorterTerms(t)
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
			.each(function(st, i) {
				st.sortSamples.priority = i
				st.div = select(this)
				const label = st.$id == 'sample' ? 'Sample name' : st.term.name
				st.div
					.append('span')
					.style('margin-right', '10px')
					.html(label)
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
		const i = sorterTerms.findIndex(st => st.$id === t.tw.$id)
		const tcopy = JSON.parse(JSON.stringify(t.tw))

		const sortSamples =
			t.tw.term.type == 'geneVariant'
				? {
						by: 'class',
						// TODO: may use ds-defined default order instead of hardcoding here
						order: [
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

		if (i == -1) {
			tcopy.sortSamples = sortSamples
			sorterTerms.unshift(tcopy)
		} else {
			tcopy.sortSamples.by = sortSamples.by
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
	self.showSampleGroupMenu = function() {
		const d = event.target.__data__
		if (!d) return
		self.activeLabel = d
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

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
		label2
			.append('input')
			.attr('type', 'radio')
			.attr('name', radioName)
			.attr('value', 'term0')
		label2.append('span').html(' divide')

		self.dom.menubody
			.append('div')
			.style('padding-bottom', '10px')
			.html(`the selected survival term below:`)

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
}

function setTermGroupActions(self) {
	setLabelDragEvents(self, 'termGrp')

	self.showTermGroupMenu = function(event) {
		const d = event.target.__data__
		if (!d) return
		self.activeLabel = d
		self.dom.menutop
			.style('display', '')
			.selectAll('*')
			.remove()
		self.showTermGroupInputs(self.dom.menutop.append('div'))
		self.dom.tip.showunder(event.target)
	}

	self.showTermGroupInputs = function(div) {
		const holder = div
		const labelEditDiv = holder.append('div').style('text-align', 'center')
		labelEditDiv.append('span').text('Group ')

		self.dom.grpNameInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', self.activeLabel.grp.name.length + 5)
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

		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		const menuOptions = [
			{ label: 'Edit', callback: self.showTermGroupEditMenu },
			{ label: 'Add Terms', callback: self.showTermInsertMenu },
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
		menu
			.append('div')
			.style('width', '100%')
			.style('font-weight', 600)
			.html('Group options')

		const label = menu.append('div').append('label')
		label
			.append('span')
			.html('Minimum #samples for visible terms*')
			.attr('title', 'May be overridden by a term-specific minNumSamples')
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
		if (event.target.tagName === 'text') select(event.target).style('fill', 'blue')
		if (!self.dragged) return
		// TODO: why is the element-bound __data__ (t) not provided as a second argument by d3??
		self.hovered = event.target.__data__
	}

	self[`${prefix}LabelMouseout`] = event => {
		select(event.target).style('fill', '')
		//if (!this.dragged) return
	}

	self[`${prefix}LabelMousemove`] = () => {
		const s = self.config.settings.matrix
		if (self.clicked && !self.dragged) {
			self.dom[`${prefix}LabelG`]
				.selectAll('text')
				.style('-webkit-user-select', 'none')
				.style('-moz-user-select', 'none')
				.style('-ms-user-select', 'none')
				.style('user-select', 'none')

			const label = self.clicked.event.target.closest('.sjpp-matrix-label')
			// TODO: use a native or D3 transform accessor
			const [x, y] = select(label)
				.attr('transform')
				.split('translate(')[1]
				.split(')')[0]
				.split(',')
				.map(Number)
			const node = label.cloneNode(true)
			self.dom[`${prefix}LabelG`].node().prepend(node)
			self.dragged = {
				orig: label,
				clone: select(node)
					.style('cursor', 'move')
					.style('pointer-events', 'none'),
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
	self.seriesesGMousedown = function(event) {
		event.stopPropagation()
		const startCell = self.getCellByPos(event)
		if (!startCell) return
		self.clickedSeriesCell = { event, startCell }
		if (self.settings.matrix.mouseMode == 'pan') {
			self.seriesesGdragInit()
		} else {
			self.zoomPointer = pointer(event, self.dom.seriesesG.node())
			self.dom.seriesesG.on('mousemove', self.seriesesGoutlineZoom).on('mouseup', self.seriesesGtriggerZoom)
		}
		self.dom.mainG
			.selectAll('text')
			.style('-webkit-user-select', 'none')
			.style('-moz-user-select', 'none')
			.style('-ms-user-select', 'none')
			.style('user-select', 'none')
	}

	self.getCellByPos = function(event) {
		const s = self.settings.matrix
		const d = self.dimensions
		if (event.target.tagName == 'rect') {
			if (event.target.__data__?.sample) return event.target.__data__
			if (event.target.__data__?.xg) {
				const visibleWidth = event.clientX - event.target.getBoundingClientRect().x + d.seriesXoffset
				const i = Math.floor(visibleWidth / d.dx)
				return self.sampleOrder[i]
			}
		}
		if (event.target.tagName == 'image' && s.useCanvas) {
			const visibleWidth = event.clientX - event.target.getBoundingClientRect().x + d.seriesXoffset
			const i = Math.floor(visibleWidth / d.dx)
			return self.sampleOrder[i]
		}
	}

	self.seriesesGdragInit = function() {
		//self.dom.seriesesG.on('mousemove', self.seriesesGdrag).on('mouseup', self.seriesesGcancelDrag)
		select('body')
			.on('mousemove.sjppMatrixDrag', self.seriesesGdrag)
			.on('mouseup.sjppMatrixDrag', self.seriesesGcancelDrag)
		const s = self.settings.matrix
		const d = self.dimensions
		const c = self.clickedSeriesCell
		c.dxPad = 20 // to show edge that limits draf, and to "bounce back" on mouseup
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

	self.seriesesGdrag = function(event) {
		const s = self.settings.matrix
		const c = self.clickedSeriesCell
		const d = self.dimensions
		const dx = event.clientX - c.event.clientX
		if (Math.abs(dx) < 1) return
		if (dx < c.dxMinPad || dx > c.dxMaxPad) return
		self.clickedSeriesCell.dx = dx
		self.translateElems(dx, d, s, c)
	}

	self.translateElems = function(dx, d, s, c) {
		self.dom.seriesesG.attr('transform', `translate(${d.xOffset + d.seriesXoffset + dx},${d.yOffset})`)
		self.dom.clipRect.attr(
			'x',
			s.zoomLevel == 1 && d.mainw >= d.zoomedMainW ? 0 : Math.abs(d.seriesXoffset + dx) / d.zoomedMainW
		)
		self.layout.top.attr.adjustBoxTransform(dx)
		self.layout.btm.attr.adjustBoxTransform(dx)
		const computedCenter = s.zoomCenterPct * d.mainw - d.seriesXoffset - dx
		self.controlsRenderer.svgScrollApi.update({ zoomCenter: computedCenter })
	}

	self.seriesesGcancelDrag = function(event) {
		select('body')
			.on('mousemove.sjppMatrixDrag', null)
			.on('mouseup.sjppMatrixDrag', null)
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

	self.seriesesGoutlineZoom = function(event) {
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
			.style('width', self.zoomWidth)
			.style('height', self.dimensions.mainh)

		self.clickedSeriesCell.endCell = self.getCellByPos(event)
	}

	self.seriesesGtriggerZoom = function(event) {
		event.stopPropagation()
		self.dom.seriesesG.on('mousemove', null).on('mouseup', null)
		//const d = event.target.__data__
		if (self.zoomArea) {
			self.zoomArea.remove()
			delete self.zoomArea
			//self.dom.seriesesG.on('mouseup.zoom', null)
			select('body').on('mouseup.matrixZoom', null)
		}

		self.dom.mainG
			.selectAll('text')
			.style('-webkit-user-select', '')
			.style('-moz-user-select', '')
			.style('-ms-user-select', '')
			.style('user-select', '')

		const c = self.clickedSeriesCell
		if (!c.startCell || !c.endCell) {
			delete self.clickedSeriesCell
			return
		}

		const s = self.settings.matrix
		const d = self.dimensions
		const start = c.startCell.totalIndex < c.endCell.totalIndex ? c.startCell : c.endCell
		const zoomIndex = Math.floor(start.totalIndex + Math.abs(c.endCell.totalIndex - c.startCell.totalIndex) / 2)
		const centerCell = self.sampleOrder[zoomIndex] || self.getImgCell(event)
		const zoomLevel = d.mainw / self.zoomWidth
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

		delete self.clickedSeriesCell
	}
}
