import { select } from 'd3-selection'
import { fillTermWrapper, termsettingInit } from '../common/termsetting'

export function setInteractivity(self) {
	self.setPill = function(appState, tip) {
		const customTipApi = tip.getCustomApi({
			d: self.dom.menubody,
			clear: () => {
				self.dom.menubody.selectAll('*').remove()
				return customTipApi
			},
			show: () => {
				self.dom.menubody.style('display', 'block')
			},
			hide: () => {
				//this.dom.menubody.style('display', 'none')
			}
		})

		// will reuse a pill instance to show term edit menu
		self.pill = termsettingInit({
			tip: customTipApi,
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
				rows.push()
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
		if (!self.activeTerm) self.dom.tip.hide()
	}

	self.showTermMenu = async function() {
		const d = event.target.__data__
		if (!d || !d.tw) return
		self.activeTerm = d
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		//self.dom.tip.d.on('click.sjpp_matrix_menuclick', () => event.stopPropagation())

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
					const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
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
				const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
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
			.style('text-align', 'center')
			.html(t.tw.term.name)

		let moveInput
		if (t.grp.lst.length > 1) {
			const moveDiv = self.dom.menubody.append('div').style('margin-top', '10px')

			const moveLabel = moveDiv.append('label')
			moveInput = moveLabel
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
				if (moveInput.property('checked')) {
				}

				if (sortColInput.property('checked')) {
					delete tcopy.div
					delete tcopy.up
					delete tcopy.down
					delete tcopy.delete

					self.app.dispatch({
						type: 'plot_nestedEdits',
						id: self.opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.index],
								value: tcopy
							}
						]
					})
				}

				self.dom.tip.hide()
			})
	}

	self.showSorterTerms = (sortColDiv, t) => {
		const sorterTerms = [
			...self.termOrder
				.filter(t => t.tw.sortSamples)
				.map(t => JSON.parse(JSON.stringify(t.tw)))
				.sort((a, b) => a.sortSamples.priority - b.sortSamples.priority),
			...self.config.settings.matrix.sortSamplesBy.map(st => JSON.parse(JSON.stringify(st)))
		]
		const i = sorterTerms.findIndex(st => st.$id === t.tw.$id)
		const tcopy = JSON.parse(JSON.stringify(t.tw))
		if (i == -1) {
			tcopy.sortSamples = { by: t.tw.term.type == 'geneVariant' ? 'hits' : 'values' }
			sorterTerms.unshift(tcopy)
		}

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
		const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
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
		const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
		termgroups.splice(t.grpIndex, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.opts.id,
			config: { termgroups }
		})
		self.dom.tip.hide()
	}

	self.legendClick = function() {}
}
