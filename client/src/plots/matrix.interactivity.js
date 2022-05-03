import { select } from 'd3-selection'
import { fillTermWrapper, termsettingInit } from '../common/termsetting'
import { icons } from '../dom/control.icons'

let inputIndex = 0

export function setInteractivity(self) {
	self.showCellInfo = function() {
		if (self.activeTerm) return
		const d = event.target.__data__
		if (!d || !d.term || !d.sample) return
		if (event.target.tagName == 'rect') {
			const rows = [
				`<tr><td style='text-align: center'>Sample: ${d.sample}</td></tr>`,
				`<tr><td style='text-align: center'>${d.term.name}</td></tr>`,
				`<tr><td style='text-align: center; color: ${d.fill}'>${d.label}</td></tr>`
			]

			if (d.term.type == 'geneVariant') {
				if (d.value.label) rows.push(`<tr><td style='text-align: center'>${d.value.label}</td></tr>`)
				if (d.value.alt)
					rows.push(`<tr><td style='text-align: center'>ref=${d.value.ref}, alt=${d.value.alt}</td></tr>`)
				if (d.value.isoform) rows.push(`<tr><td style='text-align: center'>Isoform: ${d.value.isoform}</td></tr>`)
				if (d.value.mname) rows.push(`<tr><td style='text-align: center'>${d.value.mname}</td></tr>`)
				if (d.value.chr) rows.push(`<tr><td style='text-align: center'>${d.value.chr}:${d.value.pos}</td></tr>`)
			}

			self.dom.menutop.selectAll('*').remove()
			self.dom.menubody.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
			self.dom.tip.show(event.clientX, event.clientY)
		}
	}

	self.mouseout = function() {
		if (!self.activeTerm && !self.activeSampleGroup && !self.activeLabel) self.dom.tip.hide()
	}

	self.legendClick = function() {}
	setTermActions(self)
	setTermGroupActions(self)
	setSampleGroupActions(self)
}

function setTermActions(self) {
	self.setPill = function(appState) {
		// will reuse a pill instance to show term edit menu
		self.pill = termsettingInit({
			tip: self.customTipApi,
			menuOptions: 'edit',
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
				const t = self.activeTerm || self.lastActiveTerm
				if (tw) {
					if (t && t.tw) tw.$id = t.tw.$id
					self.pill.main(tw)
					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.index],
								value: tw
							}
						]
					})
				} else {
					throw 'no tw'
				}
				self.dom.tip.hide()
			}
		})
	}

	self.showTermMenu = async function() {
		const t = event.target.__data__
		if (!t || !t.tw) return
		self.activeTerm = t
		self.activeLabel = t
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		const labelEditDiv = self.dom.menutop.append('div')

		self.dom.twLabelInput = labelEditDiv
			.append('input')
			.attr('type', 'text')
			.attr('size', t.tw.term.name.length)
			.style('padding', '1px 5px')
			.style('text-align', 'center')
			.property('value', t.tw.term.name)
			.on('input', () => {
				const value = self.dom.twLabelInput.property('value')
				self.dom.twLabelInput.attr('size', value.length)
				self.dom.twLabelEditBtn.property('disabled', value === t.tw.label)
			})
			.on('change', self.updateTermLabel)

		self.dom.twLabelEditBtn = labelEditDiv
			.append('button')
			.property('disabled', true)
			.style('margin-left', '5px')
			.html('edit')
			.on('click', self.updateTermLabel)

		self.showShortcuts(t, self.dom.menutop)

		self.dom.menutop
			.append('div')
			.selectAll(':scope>.sja_menuoption')
			.data([
				{ label: 'Edit', callback: self.showTermEditMenu },
				//{ label: 'Move', callback: self.showMoveMenu },
				{ label: 'Insert', callback: self.showTermInsertMenu },
				{ label: 'Sort', callback: self.showSortMenu },
				{ label: 'Delete', callback: self.showRemoveMenu }
			])
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			.html(d => d.label)
			.on('click', d => {
				event.stopPropagation()
				d.callback(d)
			})

		self.dom.tip.showunder(event.target)
	}

	self.updateTermLabel = () => {
		const value = self.dom.twLabelInput.property('value')
		const t = self.activeTerm
		if (t.tw.label === value) return
		t.tw.label = value
		t.grp.lst[t.index] = t.tw
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
		div.append('span').html('Shortcuts: ')

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
					},

					{
						icon: 'x',
						title: 'Delete gene row',
						handler: self.removeTerm
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

	self.sortSamplesAgainstCornerTerm = () => {
		event.stopPropagation()
		const t = self.activeTerm
		const activeIndex = t.index
		const termgroups = JSON.parse(JSON.stringify(self.termGroups))
		const grp = termgroups[t.grpIndex]
		const [tcopy, sorterTerms] = self.getSorterTerms(t)
		const removed = grp.lst.splice(t.index, 1)
		grp.lst.unshift(tcopy)
		grp.sortTermsBy = 'asListed'

		for (const g of termgroups) {
			if (g == grp) {
				for (const [priority, tw] of g.lst.entries()) {
					tw.sortSamples = { priority, by: 'values' }
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

	self.sortSamplesAgainstTerm = () => {
		event.stopPropagation()
		const t = self.activeTerm
		const [tcopy] = self.getSorterTerms(t)
		const termgroups = self.termGroups
		termgroups[t.grpIndex].lst[t.index] = tcopy
		termgroups[t.grpIndex].sortTermsBy = 'asListed'
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

	self.moveTermUp = () => {
		event.stopPropagation()
		const t = self.activeTerm
		const grp = self.termGroups[t.grpIndex]
		grp.lst.splice(t.index, 1)
		grp.lst.splice(t.index - 1, 0, t.tw)
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

	self.moveTermDown = () => {
		event.stopPropagation()
		const t = self.activeTerm
		const grp = self.termGroups[t.grpIndex]
		grp.lst.splice(t.index, 1)
		grp.lst.splice(t.index + 1, 0, t.tw)
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
		await self.pill.main(self.activeTerm.tw)
		self.dom.menubody.selectAll('*').remove()
		self.pill.showMenu()
	}

	self.showMoveMenu = async () => {
		self.dom.menubody.selectAll('*').remove()
		self.termBeingMoved = self.activeTerm
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
				.property('value', value == 'current' ? self.activeTerm.grp.name : newGrpName)
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
			.property('value', self.activeTerm.grp.name)
			.on('change', () => {
				const name = self.dom.grpNameTextInput.property('value')
				if (name == self.activeTerm.grp.name) {
				} else {
					newGrpName = self.dom.grpNameTextInput.property('value')
				}
			})

		self.makeInsertPosRadios(self.dom.editbtns)

		const termSrcDiv = self.dom.editbtns.append('div')
		termSrcDiv.append('span').html('Source&nbsp;')

		self.dom.dictTermBtn = termSrcDiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			//.style('font-size', '0.8em')
			.html('Dictionary term')
			.on('click', self.showDictTermSelection)

		self.dom.textTermBtn = termSrcDiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			//.style('font-size', '0.8em')
			.html('Text input')
			.on('click', self.showTermTextInput)

		self.dom.dictTermBtn.on('click')()
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
		self.dom.dictTermBtn.style('text-decoration', 'underline')
		self.dom.textTermBtn.style('text-decoration', '')

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
				submit_lst: async termlst => {
					const newterms = await Promise.all(
						termlst.map(async term => {
							const tw = { id: term.id, term }
							await fillTermWrapper(tw)
							return tw
						})
					)
					const pos = select(`input[name='${self.insertRadioId}']:checked`).property('value')
					const t = self.activeTerm
					const termgroups = self.termGroups
					if (self.dom.grpNameSelect.property('value') == 'current') {
						const grp = termgroups[t.grpIndex]
						const i = pos == 'above' ? t.index : t.index + 1
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
			}
		})
	}

	self.showTermTextInput = opt => {
		self.dom.dictTermBtn.style('text-decoration', '')
		self.dom.textTermBtn.style('text-decoration', 'underline')
		self.dom.editbody.selectAll('*').remove()
		self.dom.editbody
			.append('button')
			.style('margin', '0 5px')
			.html('Submit')
			.on('click', async () => {
				event.stopPropagation()
				const text = ta.property('value')
				const lines = text.split('\n').map(line => line.trim())
				const ids = lines.filter(id => !!id)
				const terms = await self.app.vocabApi.getTermTypes(ids)
				const termgroups = self.termGroups
				const name = self.dom.grpNameTextInput.property('value')
				let grp = termgroups.find(g => g.name === name)
				if (!grp) {
					grp = { name, lst: [] }
					termgroups.push(grp)
				}
				for (const id of lines) {
					if (!(id in terms)) continue
					const tw = { term: terms[id] }
					await fillTermWrapper(tw)
					grp.lst.push(tw)
				}

				self.app.dispatch({
					type: 'plot_edit',
					id: self.opts.id,
					config: { termgroups }
				})
				self.dom.tip.hide()
			})

		const ta = self.dom.editbody
			.append('div')
			.style('text-align', 'left')
			.append('textarea')
			.attr('placeholder', 'term')
			.style('width', '300px')
			.style('height', '300px')
			.style('margin', '5px')
			.style('padding', '5px')
			.on('keydown', () => {
				const keyCode = event.keyCode || event.which
				// handle tab key press, otherwise it will cause the focus to move to another input
				if (keyCode == 9) {
					event.preventDefault()
					const t = event.target
					const s = t.selectionStart
					t.value = t.value.substring(0, t.selectionStart) + '\t' + t.value.substring(t.selectionEnd)
					t.selectionEnd = s + 1
				}
			})
	}

	self.showSortMenu = () => {
		//console.log(self.termOrder)
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

		const t = self.activeTerm
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
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.index],
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
		if (i == -1) {
			tcopy.sortSamples = { by: 'values' } // { by: t.tw.term.type == 'geneVariant' ? 'hits' : 'values' }
			sorterTerms.unshift(tcopy)
		} else {
			tcopy.sortSamples.by = 'values'
		}

		return [tcopy, sorterTerms]
	}

	self.showRemoveMenu = () => {
		const t = self.activeTerm
		self.dom.menubody.selectAll('*').remove()
		const subdiv = self.dom.menubody.append('div').style('margin-top', '10px')
		subdiv
			.append('div')
			.style('text-align', 'center')
			.html('Click to remove')
		subdiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('Term: ' + t.tw.term.name)
			.on('click', self.removeTerm)
		subdiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.html('Group: ' + t.grp.name)
			.on('click', self.removeTermGroup)
	}

	self.removeTerm = () => {
		const t = self.activeTerm
		const termgroups = self.termGroups
		const grp = termgroups[t.grpIndex]
		// remove this element
		grp.lst.splice(t.index, 1)
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
		const t = self.activeTerm
		const termgroups = self.termGroups
		termgroups.splice(t.grpIndex, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: { termgroups }
		})
		self.dom.tip.hide()
	}
}

function setSampleGroupActions(self) {
	self.showSampleGroupMenu = function() {
		const d = event.target.__data__
		if (!d) return
		self.activeSampleGroup = d
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
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			.html(d => d.label)
			.on('click', d => {
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
						[termNum]: JSON.parse(JSON.stringify(self.config.divideBy))
					}

					if (menuOpt.config) {
						Object.assign(config, menuOpt.config)
					}
					self.app.dispatch({ type: 'plot_create', config, insertBefore: self.id })
				}
			}
		})
	}

	self.removeSampleGroup = () => {
		const divideBy = JSON.parse(JSON.stringify(self.config.divideBy))
		if (!divideBy.exclude) divideBy.exclude = []
		divideBy.exclude.push(self.activeSampleGroup.grp.id)
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
	self.showTermGroupMenu = function() {
		const d = event.target.__data__
		if (!d) return
		self.activeLabel = d
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		const menuOptions = [{ label: 'Delete', callback: self.removeTermGroup }]

		self.dom.menutop
			.append('div')
			.selectAll(':scope>.sja_menuoption')
			.data(menuOptions)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			.html(d => d.label)
			.on('click', d => {
				event.stopPropagation()
				d.callback(d)
			})

		self.dom.tip.showunder(event.target)
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
}
