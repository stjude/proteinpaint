import { select } from 'd3-selection'
import { deepEqual, copyMerge } from '#rx'
import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'
import { Menu } from '#dom/menu'
import { mclass } from '#shared/common'
import { getConfigForShowAll } from './matrix.interactivity'
import { setComputedConfig } from './matrix.config'

const alphabet = `ABCDEFGHIJKLMNOPQRSTUVWXYZ`.split('')

/*
	controls: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(opts) {
	const { controls, holder } = opts
	const parent = controls.parent
	const s = structuredClone(parent.config.settings.matrix)
	const l = s.controlLabels
	const tip = new Menu({ padding: '', parent_menu: parent.app.tip?.d.node() })

	let input,
		theads = [],
		sectionData,
		dragged = {}

	const self = {
		dom: { tip },
		opts,
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		expanded: opts.expanded || false,
		expandedSection: opts.expandedSection || '',
		init(overrides = {}, _opts = {}) {
			tip.clear().hide()
			if (parent.config.settings.matrix != s) copyMerge(s, parent.config.settings.matrix)
			if (s !== overrides) copyMerge(s, overrides)
			self.settings = s
			self.activeOption = structuredClone(s.sortOptions[s.sortSamplesBy])

			sectionData = [
				{
					label: 'For each selected row, sort cases by matching data',
					notDraggable: true,
					tiebreakers: [],
					handler: handleSelectedTerms
				},
				...self.activeOption.sortPriority,
				{
					label: 'Sort cases by name, alphabetically',
					notDraggable: true,
					tiebreakers: []
				}
			]
			Object.assign(opts, _opts) // on update, new opts, such as a new holder dom element, may be provided
			opts.holder.selectAll('*').remove()
			const topDiv = opts.holder.append('div').style('text-align', 'right')
			topDiv.append('button').html('Apply').on('click', apply)
			topDiv
				.append('button')
				.html('Reset')
				.on('click', (event, d) => self.init())

			const table = opts.holder.append('table')

			const tr = table.append('thead')
			tr.append('th').html('Priority').style('text-align', 'left').style('max-width', '0px')
			tr.append('th').html('Description')
			tr.append('th').html('Action')

			// to track sort priority number
			let i = 0,
				j = 0

			for (const sd of sectionData) {
				const hasTbOrder = sd.tiebreakers?.[0]?.order || sd.handler

				const thead = table
					.append('thead')
					.datum(sd)
					.property('draggable', !sd.notDraggable)
					.attr('droppable', true) //!sd.notDraggable)
					.on('dragstart', trackDraggedSection)
					.on('dragover', highlightSection)
					.on('dragleave', unhighlightSection)
					.on('drop', adjustSortPriority)

				theads.push(select(thead))

				const tr = thead.append('tr').style('background-color', '#eee').on('mouseover', undoMouseoverHighlights)
				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.html(alphabet[j++])
					.on('click', hasTbOrder ? toggleSection : null)
				const td2 = tr
					.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'left')
					.style('cursor', hasTbOrder ? 'pointer' : '')
					.on('click', hasTbOrder ? toggleSection : null)
				td2.append('span').style('margin-right', '12px').style('font-weight', 400).html(sd.label)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'center')
					.style('font-weight', 400)
					.style('cursor', hasTbOrder ? 'pointer' : '')
					.append('span')
					.html(hasTbOrder ? 'Details' : '&nbsp;')
					.on('click', hasTbOrder ? toggleSection : null)

				const tbody = table
					.append('tbody')
					.datum(sd)
					.style('display', self.expandedSection == 'all' || self.expandedSection == sd.label ? '' : 'none')

				for (const tb of sd.tiebreakers) {
					if (tb.skip) continue
					if (!sd.types?.includes('geneVariant')) {
						// TODO: display inputs to customize sorting of dictionary variable values,
						// currently the value order is arbitrary
						continue
					}

					const tr = tbody
						.append('tr')
						.on('mouseover', undoMouseoverHighlights)
						.datum(tb)
						.attr('draggable', !tb.disabled && sd.types?.length !== 0)
						.attr('droppable', !tb.disabled && sd.types?.length !== 0)
						.on('dragstart', trackDraggedTieBreaker)
						.on('dragover', highlightTieBreaker)
						.on('dragleave', unhighlightTieBreaker)
						.on('drop', adjustTieBreakers)

					if (!tb.disabled) i++
					const td1 = tr
						.append('td')
						.attr(
							'title',
							tb.disabled
								? `This tiebreaker is currently not being used to sort ${l.cases}. Check the box to use.`
								: `The number indicates the order in which this tiebreaker is used. Unched the box to skip.`
						)
						.datum(tb)
					td1.style('padding', '5px').style('vertical-align', 'top').style('text-align', 'center')
					td1.append('span').html(!tb.disabled ? i : '') // TODO: show priority
					//td1.append('br')

					const td2 = tr
						.append('td')
						.style('opacity', tb.disabled ? 0.5 : 1)
						.style('padding', '5px')
						.style('vertical-align', 'top')
						.style('max-width', '500px')
					td2.append('span').html(tb.label || '')

					if (!tb.disabled) {
						const label = td2.append('label')
						label.append('span').html('<br>(use data list order ')
						if (!tb.isOrdered) tb.isOrdered = false
						const checkbox = label
							.append('input')
							.datum(tb)
							.attr('type', 'checkbox')
							.property('checked', tb.isOrdered)
							.style('vertical-align', 'bottom') //.html('(in listed order ')
							.on('change', toggleTieBreakerIsOrdered)

						label.append('span').html(')')

						const order = tb.order //.filter(cls => !s.hiddenVariants.includes(cls))
						td2
							.append('div')
							.attr('class', 'sjpp-matrix-sorter-ui-value')
							.selectAll('div')
							.data(
								order.map((key, index) => ({
									lstName: 'order',
									key,
									cls: mclass[key],
									tb,
									dragstart: trackDraggedValue,
									dragover: highlightValue,
									dragleave: unhighlightValue,
									drop: adjustValueOrder,
									filterByClass: s.filterByClass,
									index
								}))
							)
							.enter()
							.append('div')
							.style('display', tb.isOrdered ? 'block' : 'inline-block')
							.each(setValueDiv)

						if (tb.notUsed?.length) {
							const notUsed = td2.append('div')

							notUsed //.append('td')
								.append('div')
								.attr('data-testid', 'sjpp-matrix-sorter-ui-hidden-add')
								.style('display', 'inline-block')
								.style('padding', '5x')
								.style('vertical-align', 'top')
								.style('padding', '3px 5px')
								.style('cursor', 'pointer')
								.html(`+Add`)
								.on('click', showNotUsedValues)
						}
					}

					const td3 = tr.append('td').style('text-align', 'center').style('vertical-align', 'top')

					if (tb.mayToggle) {
						td3
							.append('button')
							.datum(tb)
							.html(tb.disabled ? 'Enable' : 'Disable')
							.on('click', toggleTieBreakerDisabled)
					}
				}

				const lastTr = tbody.append('tr').attr('draggable', true).on('mouseover', undoMouseoverHighlights)
				lastTr.append('td').html('&nbsp;')
				const tdNew = lastTr
					.append('td')
					.style('text-align', 'left') //.append('button').html('Add')
					.html(sd.details && !sd.order?.length ? sd.details : '&nbsp;')
				if (sd.handler) sd.handler(tdNew, lastTr, tbody)
				lastTr.append('td').html('&nbsp;')
			}
		},
		toggleSection,
		trackDraggedSection,
		highlightSection,
		unhighlightSection,
		adjustSortPriority,

		trackDraggedTieBreaker,
		highlightTieBreaker,
		unhighlightTieBreaker,
		adjustTieBreakers,

		trackDraggedValue,
		highlightValue,
		unhighlightValue,
		adjustValueOrder,

		apply
	}

	function toggleSection(event, d = { label: 'all' }) {
		self.expandedSection = self.expandedSection === d.label ? '' : d.label
		self.expanded = !!self.expandedSection
		self.init()
	}

	function trackDraggedSection(event, d) {
		dragged.type = 'sortPriority'
		dragged.data = d
		dragged.index = self.activeOption.sortPriority.indexOf(d)
	}

	function highlightSection(event, d) {
		if (dragged.type != 'sortPriority' || d == dragged.data) return
		event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const borderSide = i < dragged.index ? 'border-top' : i > dragged.index ? 'border-bottom' : ''
		if (!borderSide) return
		select(this).selectAll('th').style(borderSide, '2px solid blue')
	}

	function unhighlightSection(event, d) {
		if (dragged.type != 'sortPriority') return
		event.preventDefault()
		select(this).selectAll('th').style('border', 'none')
	}

	function adjustSortPriority(event, d) {
		if (d == dragged.data) return
		//event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const s = parent.config.settings.matrix
		self.activeOption.sortPriority.splice(dragged.index, 1)
		self.activeOption.sortPriority.splice(i, 0, dragged.data)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function trackDraggedTieBreaker(event, d) {
		dragged.type = 'tiebreaker'
		dragged.data = d
		dragged.sectionData = event.target.closest('tbody').__data__
		dragged.priorityIndex = self.activeOption.sortPriority.indexOf(dragged.sectionData)
		dragged.index = dragged.sectionData.tiebreakers.indexOf(d)
	}

	function highlightTieBreaker(event, d) {
		if (dragged.type != 'tiebreaker' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.sectionData.tiebreakers.indexOf(d)
		const borderSide = i < dragged.index ? 'border-top' : i > dragged.index ? 'border-bottom' : ''
		if (!borderSide) return
		select(this).selectAll('td:nth-child(2)').style(borderSide, '2px solid blue')
	}

	function unhighlightTieBreaker(event, d) {
		if (dragged.type != 'tiebreaker') return
		event.preventDefault()
		select(this).selectAll('td:nth-child(2)').style('border', 'none')
	}

	function toggleTieBreakerIsOrdered(event, tb) {
		event.stopPropagation()
		tb.isOrdered = !tb.isOrdered
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function toggleTieBreakerDisabled(event, tb) {
		event.stopPropagation()
		tb.disabled = !tb.disabled
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function adjustTieBreakers(event, d) {
		if (dragged.type != 'tiebreaker' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.sectionData.tiebreakers.indexOf(d)
		const s = parent.config.settings.matrix
		dragged.sectionData.tiebreakers.splice(dragged.index, 1)
		dragged.sectionData.tiebreakers.splice(i, 0, dragged.data)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function setValueDiv(d) {
		const title = []
		if (d.tb.notUsed?.includes(d.key)) title.push(`- Click on this label to include in used data values.`)
		if (d.filterByClass[d.key])
			title.unshift('- Click on the corresponding entry in the matrix legend or Mutation/CNV menus to unhide')
		if (title.length) title.unshift(`To use this data value for sorting ${l.samples}:`)
		// else {
		// 	if (d.filterByClass[d.key] == 'value') title.push('Hidden value')
		// 	if (d.filterByClass[d.key] == 'case') title.push('Case filter')
		// 	if (title.length) title.unshift(`This data value was not used to sort ${l.cases}, since ${reason}: to use `)
		// }

		const skipped = d.tb.notUsed?.includes(d.key)
		const opacity = d.filterByClass[d.key] == 'value' ? 0.5 : 1
		const div = select(this)
			.attr('title', title.length ? title.join('\n') : `Click to not use this data value to sort ${l.samples}`)
			.attr('draggable', d.tb.isOrdered ? true : false)
			.attr('droppable', d.tb.isOrdered ? true : false)
			.style('width', 'fit-content')
			.style('margin-right', '10px')
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.style('opacity', opacity)
			.style('cursor', 'pointer')
			.on('dragstart', d.dragstart)
			.on('dragover', d.dragover)
			.on('dragleave', d.dragleave)
			.on('drop', d.drop)
			.on('mouseenter', () => toggle.style('opacity', 1))
			.on('mouseleave', () => toggle.style('opacity', 0))
			//.on('mouseover', () => )
			.on('click', () => {
				if (title.length) {
					const cls = 'sjpp-matrix-sorter-value-note'
					div.selectAll(`.${cls}`).remove()
					const note = div.append('div').attr('class', cls).style('max-width', '200px').style('padding', '5px')
					note.html(title.join('<br>'))
					if (d.filterByClass[d.key]) return
				}

				// if () title.push('Hidden value')
				// if (d.filterByClass[d.key] == 'case') title.push('Case filter')

				const targetLstName = d.lstName == 'order' ? 'notUsed' : 'order'
				if (!d.tb[targetLstName]) d.tb[targetLstName] = []
				const targetLst = d.tb[targetLstName]
				d.tb[d.lstName].splice(d.index, 1)
				if (d.lstName == 'order') targetLst.unshift(d.key)
				else targetLst.push(d.key)
				self.init({
					sortOptions: {
						[s.sortSamplesBy]: self.activeOption
					}
				})
			})
		//.on('click', showValueMenu)
		// .on('mouseenter', () => {
		// 	div.style(wh, '')//.style('opacity', '')
		// })
		// .on('mouseleave', (event, d) => {
		// 	div.style(wh, d.tb.skipped?.includes(d.key) ? '12px' : '')//.style('opacity', 0.5)
		// })

		div
			.append('div')
			.style('display', 'inline-block')
			.style('cursor', 'pointer')
			.style('width', '12px')
			.style('height', '12px')
			.style('margin-right', '3px')
			.style('background-color', d.cls.color)
		div
			.append('span')
			.style('cursor', 'pointer')
			.style('text-decoration', d.filterByClass[d.key] == 'case' ? 'line-through' : '')
			.html(d.cls.label + (d.filterByClass[d.key] ? ' (<i>not used since this value is hidden</i>)' : ''))

		const toggle = div
			.append('div')
			.style('display', 'inline-block')
			.style('width', '12px')
			.style('cursor', 'pointer')
			.style('opacity', 0)
			.style('color', d.lstName == 'order' ? 'red' : 'green')
			.html(d.lstName == 'order' ? '&cross;' : '&check;')
	}

	function trackDraggedValue(event, d) {
		event.stopPropagation?.()
		dragged.type = 'value'
		dragged.data = d
		dragged.sectionData = event.target.closest('tbody').__data__
		dragged.priorityIndex = self.activeOption.sortPriority.indexOf(dragged.sectionData)
		dragged.tiebreaker = event.target.closest('tr').__data__
		dragged.tbIndex = dragged.sectionData.tiebreakers.indexOf(dragged.priorityIndex)
		dragged.order = dragged.tiebreaker.order
	}

	function highlightValue(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value' || d == dragged.data) return
		if (d.tb != dragged.data.tb) return
		event.preventDefault()
		const i = dragged.order.indexOf(d)
		select(this).style('border', '2px solid blue')
	}

	function unhighlightValue(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value') return
		event.preventDefault()
		select(this).style('border', 'none')
	}

	function adjustValueOrder(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value' || d == dragged.data) return
		event.preventDefault()

		const s = self.settings
		dragged.data.tb[dragged.data.lstName].splice(dragged.data.index, 1)
		d.tb[d.lstName].splice(d.index, 0, dragged.data.key)
		// if (dragged.data.lstName == d.lstName) {
		// 	const i = dragged.order.indexOf(d.key)
		// 	dragged.order.splice(i, 0, dragged.data.key)
		// } else { console.log(44, d, d.tb[d.lstName])
		// 	d.tb[d.lstName].push(dragged.data.key)
		// }

		const j = s.hiddenVariants.indexOf(dragged.data.key)
		const hiddenVariants = structuredClone(s.hiddenVariants)
		const filterByClass = structuredClone(s.filterByClass)
		if (j != -1) {
			hiddenVariants.splice(j, 1)
			filterByClass[dragged.data.key] = false
		}
		self.init({
			hiddenVariants,
			filterByClass,
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function showNotUsedValues(event, tb) {
		event?.stopPropagation()
		const availDiv = tip
			.clear()
			.d.append('div')
			.attr('data-testid', 'sjpp-matrix-sorter-ui-hidden-vals')
			.style('margin-top', '3px')
			.style('vertical-align', 'top')
			.style('padding-left', '12px')

		availDiv
			.selectAll('div')
			.data(
				tb.notUsed.map((key, index) => ({
					lstName: 'notUsed',
					key,
					cls: mclass[key],
					tb,
					dragstart: trackDraggedValue,
					dragover: highlightValue,
					dragleave: unhighlightValue,
					drop: adjustValueOrder,
					filterByClass: s.filterByClass,
					index
				}))
			)
			.enter()
			.append('div')
			.style('display', 'block')
			.each(setValueDiv)

		tip.showunder(event.target)
	}

	function apply() {
		parent.app.tip?.hide()
		parent.app.dispatch({
			type: 'plot_edit',
			id: parent.id,
			config: {
				settings: {
					matrix: {
						sortOptions: {
							[s.sortSamplesBy]: self.activeOption
						}
					}
				}
			}
		})
	}

	function undoMouseoverHighlights() {
		// this.style.backgroundColor = '#fff'
		// this.style.textShadow = 'none'
	}

	function handleSelectedTerms(td, tr) {
		if (!parent.selectedTermsToSortAgainst?.length) {
			td.html(`Click on a matrix row label and the left triangle to add an entry here`)
			return
		}
		const selectedTerms = parent.selectedTermsToSortAgainst.map(t => {
			return {
				t,
				label: t.tw.term.name + (t.tw.term.type == 'geneVariant' ? ' alterations' : ' values')
			}
		})
		const tbody = select(tr.node().parentNode)
		tbody.selectAll('tr').remove()
		tbody
			.selectAll('tr')
			.data(selectedTerms)
			.enter()
			.append('tr')
			.selectAll('td')
			.data((d, i) => [
				{ label: i + 1, textAlign: 'center', cursor: '', t: d.t },
				{ label: d.label, textAlign: 'left', cursor: '' },
				{
					label: 'Delete',
					textAlign: 'center',
					cursor: 'pointer',
					click: parent.unsortSamplesAgainstTerm,
					data: d
				}
			])
			.enter()
			.append('td')
			.style('text-align', d => d.textAlign)
			.style('cursor', d => d.cursor)
			.html(d => d.label)
			.on('click', (event, d) => d.click?.(event, d))
	}

	self.init()

	self.api = {
		main: self.init,
		destroy: () => {
			opts.holder.selectAll('*').remove()
		}
	}

	if (opts.debug) self.api.Inner = self
	return self.api
}
