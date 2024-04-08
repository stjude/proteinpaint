import { deepEqual, copyMerge } from '#rx'
import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'
import { mclass } from '#shared/common'
import { select } from 'd3-selection'
import { getConfigForShowAll } from './matrix.interactivity'

/*
	controls: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(opts) {
	const { controls, holder } = opts
	const parent = controls.parent
	const s = parent.config.settings.matrix
	const l = s.controlLabels

	let input,
		theads = [],
		sectionData,
		dragged = {}

	const self = {
		opts,
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		expanded: opts.expanded || false,
		expandedSection: '',
		init(overrides = {}) {
			//console.log(32, 'self.init')
			const s = copyMerge(`{}`, parent.config.settings.matrix, overrides)
			self.activeOption = structuredClone(s.sortOptions[s.sortSamplesBy])

			sectionData = [
				{
					label: 'For each selected row, sort cases by matching data',
					notDraggable: true,
					handler(div) {
						//div.append('button').html('Select a row')
					},
					tiebreakers: []
				},
				...self.activeOption.sortPriority,
				{
					label: 'Sort cases by name, alphabetically',
					notDraggable: true,
					tiebreakers: []
				}
			]

			opts.holder.selectAll('*').remove()
			const topDiv = opts.holder.append('div')
			topDiv.append('button').html('Apply').on('click', apply)
			topDiv.append('button').html('Reset')

			const table = opts.holder.append('table')

			const tr = table.append('thead')
			tr.append('th').html('Priority').style('text-align', 'left').style('max-width', '0px')
			tr.append('th').html('Data used of sorting')
			tr.append('th')
				.style('text-align', 'center')
				.style('cursor', 'pointer')
				.html(self.expandedSection == 'all' ? '&lt;&lt;' : '...')
				.on('click', toggleSection)
			tr.append('th')
				.attr('colspan', 3)
				.style('display', self.expandedSection ? '' : 'none')
				.html('Data not used for sorting')

			// to track sort priority number
			let i = 0

			for (const sd of sectionData) {
				const thead = table
					.append('thead')
					.datum(sd)
					.attr('draggable', !sd.notDraggable)
					.attr('droppable', !sd.notDraggable)
					.on('dragstart', trackDraggedSection)
					.on('dragover', highlightSection)
					.on('dragleave', unhighlightSection)
					.on('drop', adjustSortPriority)

				theads.push(select(thead))

				const tr = thead.append('tr').style('background-color', '#eee')

				const td12 = tr
					.append('th')
					.attr('colspan', 2)
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'left')
					.on('click', toggleSection)
				td12.append('span').style('margin-right', '12px').style('font-weight', 400).html(sd.label)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'center')
					.style('font-weight', 400)
					.style('cursor', 'pointer')
					.html(self.expandedSection == 'all' || self.expandedSection == sd.label ? '&lt;&lt;' : '...')
					.on('click', toggleSection)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Visible')
					.on('click', toggleSection)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Hidden')

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Case Filter')

				const tbody = table
					.append('tbody')
					.datum(sd)
					.style('display', self.expandedSection == 'all' || self.expandedSection == sd.label ? '' : 'none')

				for (const tb of sd.tiebreakers) {
					// TODO: should handle dictionary variables
					if (!sd.types?.includes('geneVariant')) continue
					const tr = tbody
						.append('tr')
						.style('opacity', tb.disabled ? 0.5 : 1)
						.datum(tb)

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
						.attr('draggable', true)
						.attr('droppable', true)
						.on('dragstart', trackDraggedTieBreaker)
						.on('dragover', highlightTieBreaker)
						.on('dragleave', unhighlightTieBreaker)
						.on('drop', adjustTieBreakers)
					td1.style('padding', '5px').style('vertical-align', 'top').style('text-align', 'center')
					td1.append('span').html(!tb.disabled ? i + '<br>' : '') // TODO: show pr
					//td1.append('br')
					const disabled = td1
						.append('input')
						.attr('type', 'checkbox')
						.property('checked', !tb.disabled)
						.on('change', () => {
							tb.disabled = !disabled.property('checked')
							tr.style('opacity', tb.disabled ? 0.5 : 1)
						})

					const td2 = tr.append('td').style('padding', '5px').style('vertical-align', 'top').style('max-width', '500px')
					td2.append('span').html(tb.label || '')

					const label = td2.append('label')
					label.append('span').html(' (in listed order ')
					if (!tb.isOrdered) tb.isOrdered = false
					const checkbox = label
						.append('input')
						.attr('type', 'checkbox')
						.property('checked', tb.isOrdered)
						.style('vertical-align', 'bottom') //.html('(in listed order ')
						.on('change', () => {
							tb.isOrdered = checkbox.property('checked')
						})

					label.append('span').html(')')
					td2
						.append('div')
						.attr('class', 'sjpp-matrix-sorter-ui-value')
						.selectAll('div')
						.data(tb.order)
						.enter()
						.append('div')
						.style('display', 'inline-block')
						.each(function (key) {
							const div = select(this)
								.attr('draggable', true)
								.attr('droppable', true)
								.style('margin-right', '10px')
								.style('opacity', tb.disabled ? 0.5 : 1)
								.on('dragstart', trackDraggedValue)
								.on('dragover', highlightValue)
								.on('dragleave', unhighlightValue)
								.on('drop', adjustValueOrder)

							const cls = mclass[key]
							div
								.append('div')
								.style('display', 'inline-block')
								.style('width', '12px')
								.style('height', '12px')
								.style('margin-right', '3px')
								.style('background-color', cls.color)
							div.append('span').html(cls.label)
						})

					tr.append('td').style('text-align', 'center').html('&nbsp;') //.on('click', toggleSection)
					tr.append('td') //.style('display', 'none')
					tr.append('td') //.style('display', 'none')
					tr.append('td') //.style('display', 'none')
				}

				const lastTr = tbody.append('tr').attr('draggable', true)
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').style('text-align', 'left').append('button').html('Add a tiebreaker')
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').html('&nbsp;')
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

	function trackDraggedValue(event, d) {
		dragged.type = 'value'
		dragged.data = d
		dragged.sectionData = event.target.closest('tbody').__data__
		dragged.priorityIndex = self.activeOption.sortPriority.indexOf(dragged.sectionData)
		dragged.tiebreaker = event.target.closest('tr').__data__
		dragged.tbIndex = dragged.sectionData.tiebreakers.indexOf(dragged.priorityIndex)
		dragged.order = dragged.tiebreaker.order
		dragged.index = dragged.order.indexOf(d)
	}

	function highlightValue(event, d) {
		if (dragged.type != 'value' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.order.indexOf(d)
		const borderSide = i < dragged.index ? 'border-right' : i > dragged.index ? 'border-left' : ''
		if (!borderSide) return
		select(this).style(borderSide, '2px solid blue')
	}

	function unhighlightValue(event, d) {
		if (dragged.type != 'value') return
		event.preventDefault()
		select(this).style('border', 'none')
	}

	function adjustValueOrder(event, d) {
		if (dragged.type != 'value' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.order.indexOf(d)
		const s = parent.config.settings.matrix
		dragged.order.splice(dragged.index, 1)
		dragged.order.splice(i, 0, dragged.data)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
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
