import { select } from 'd3-selection'
import { TVSInit } from './tvs'
import { findItem } from './filter.utils'

// will assign an incremented index to each filter UI instance
// to help namespace the body.on('click') event handler;
// other click handlers are specific to the rendered
// elements within instance.dom.holder, so no need for this index
let filterIndex = 0

export function setRenderers(self) {
	self.initUI = async function () {
		if (self.opts.newBtn) {
			self.opts.newBtn.on('click.filter', self.displayTreeNew)
		} else {
			self.dom.newBtn = self.dom.holder
				.append('div')
				.attr('class', 'sja_new_filter_btn sja_menuoption')
				.html(self.opts.emptyLabel)
				.style('display', 'inline-block')
				.on('click', self.displayTreeNew)
		}

		self.dom.filterContainer = self.dom.holder.append('div').attr('class', 'sja_filter_container')

		self.dom.holder
			.selectAll('.sja_filter_add_transformer')
			.data(self.opts.joinWith)
			.enter()
			.append('div')
			.attr('class', 'sja_filter_add_transformer')
			.style('display', d => (self.filter && self.filter.join != d ? 'inline-block' : 'none'))
			.style('margin-left', '10px')
			.style('padding', '5px')
			.style('border-radius', '5px')
			//.style('background-color', '#ececec')
			.style('cursor', 'pointer')
			.html(d => '+' + d.toUpperCase())
			.on('click', self.displayTreeNew)

		self.dom.table = self.dom.controlsTip.clear().d.append('table').style('border-collapse', 'collapse')

		const menuOptions = [
			{ action: 'edit', html: ['', 'Edit', '&rsaquo;'], handler: self.editTerm },
			{ action: 'join', html: ['&#10010;', '', '&rsaquo;'], handler: self.displayTreeMenu },
			{ action: 'switch', html: ['', 'Switch to', ''], handler: self.switchJoin },
			{ action: 'negate', html: ['', 'Negate', ''], handler: self.negateClause },
			{ action: 'remove', html: ['&#10006;', 'Remove', ''], handler: self.removeTransform }
		]

		// option to add a Replace option in the second row
		if (self.opts.vocab) {
			menuOptions.splice(1, 0, {
				action: 'replace',
				html: ['', 'Replace', '&rsaquo;'],
				handler: self.displayTreeMenu
			})
		}

		self.dom.table
			.selectAll('tr')
			.data(menuOptions)
			.enter()
			.append('tr')
			.attr('class', 'sja_menuoption')
			.on('click', self.handleMenuOptionClick)
			.selectAll('td')
			.data(d => d.html)
			.enter()
			.append('td')
			.style('padding', '5px')
			.style('border-top', 'solid 1px white')
			.style('color', (d, i) => (d == '&#10006;' ? '#a00' : i === 0 ? '#0a0' : '#111'))
			.style('opacity', (d, i) => (i === 0 ? 0.8 : 1))
			.html(d => d)

		self.dom.treeHead = self.dom.treeTip.d.append('div').attr('class', 'sja_tree_tip_head').style('padding', '3px')
		self.dom.termSrcDiv = self.dom.treeTip.d.append('div').attr('class', 'sja_term_src_body')

		self.dom.treeHeadTitle = self.dom.treeHead.append('div')

		select('body').on('mousedown.sja_filter_' + filterIndex++, event => {
			if (
				[
					'sja_filter_join_label',
					'sja_filter_clause_negate',
					'sja_filter_paren_open',
					'sja_filter_paren_close'
				].includes(event.target.className)
			)
				return
			self.dom.filterContainer?.selectAll('.sja_filter_grp').style('background-color', 'transparent')
			self.removeBlankPill()
			this.dom.holder?.selectAll('.sja_filter_add_transformer').style('display', this.getAddTransformerBtnDisplay)
		})
	}

	self.updateUI = async function (container, filter) {
		container.datum(filter).style('display', !filter.lst || !filter.lst.length ? 'none' : 'inline-block')
		const pills = container
			.selectAll(':scope > .sja_filter_grp')
			.style('background-color', 'transparent')
			.data([filter], self.getId)

		pills.exit().each(self.removeGrp)
		pills.each(self.updateGrp)
		pills.enter().append('div').attr('class', 'sja_filter_grp').style('margin', '5px').each(self.addGrp)

		self.updatePromise(0)
	}

	self.addGrp = function (item, i) {
		const filter = this.parentNode.__data__

		select(this).style('display', 'inline-block')

		select(this)
			.append('div')
			.attr('class', 'sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline-block')
			.style('color', 'rgb(102,0,0)')
			.style('font-weight', 500)
			.style('cursor', 'pointer')
			.html('NOT')
			.on('click', self.displayControlsMenu)

		select(this)
			.append('div')
			.attr('class', 'sja_filter_paren_open')
			.html('(')
			.style('display', 'none')
			.style('padding', '0 5px')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)

		const data = item.type == 'tvslst' ? item.lst : [item]
		const pills = select(this).selectAll(':scope > .sja_filter_item').data(data, self.getId)
		pills.enter().append('div').attr('class', 'sja_filter_item').each(self.addItem)

		if (self.opts.joinWith.length == 1) {
			self.dom.last_join_div = select(this)
				.append('div')
				.attr('class', 'sja_filter_last_join')
				.style('display', 'inline')
			self.dom.last_join_label = self.dom.last_join_div
				.append('div')
				.datum({ action: 'join', html: ['&#10010;', '', '&rsaquo;'], handler: self.displayTreeMenu })
				.attr('class', 'sja_filter_last_join_label')
				.style('padding', '0 5px')
				.style('display', filter.lst.length ? 'inline' : 'none')
				.style('font-weight', 500)
				.style('cursor', 'pointer')
				.html('+' + self.opts.joinWith[0].toUpperCase())
				.on('click', self.showLastJoinBlank)

			select('body').on('mousedown.sja_filter_last_join', () => {
				self.dom.last_join_label.style('display', 'inline')
			})
		}
		select(this)
			.append('div')
			.attr('class', 'sja_filter_paren_close')
			.style('padding', '0 5px')
			.html(')')
			.style('display', 'none')
			.style('font-weight', 500)
			.style('font-size', '24px')
			.style('cursor', 'pointer')
			.on('click', self.displayControlsMenu)

		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style(
				'display',
				self.opts.joinWith.length < 2 || data.length < 2
					? 'none'
					: !filter.in || (data.length > 1 && filter.tag != 'filterUiRoot')
					? 'inline-block'
					: 'none'
			)
	}

	self.updateGrp = function (item, i) {
		const filter = this.parentNode.__data__

		select(this)
			.select(':scope > .sja_filter_clause_negate')
			.style('display', filter.in ? 'none' : 'inline-block')

		const data = item.type == 'tvslst' ? item.lst : [item]

		select(this)
			.selectAll(':scope > .sja_filter_paren_open, :scope > .sja_filter_paren_close')
			.style(
				'display',
				self.opts.joinWith.length < 2 || data.length < 2
					? 'none'
					: !filter.in || (data.length > 1 && filter.tag != 'filterUiRoot')
					? 'inline-block'
					: 'none'
			)

		const pills = select(this).selectAll(':scope > .sja_filter_item').data(data, self.getId)

		pills.exit().each(self.removeItem)
		pills.each(self.updateItem)
		pills.enter().insert('div', ':scope > .sja_filter_paren_close').attr('class', 'sja_filter_item').each(self.addItem)

		select(this)
			.selectAll(':scope > .sja_filter_item')
			.sort((a, b) => data.indexOf(a) - data.indexOf(b))

		if (self.dom.last_join_label) {
			self.dom.last_join_div.datum(filter)
			this.insertBefore(self.dom.last_join_div.node(), select(this).select(':scope > .sja_filter_paren_close').node())
			self.dom.last_join_label.style('display', 'inline')
		}
	}

	self.removeGrp = function (item) {
		self.numExpectedItems += 1
		if (item.type == 'tvslst') {
			for (const subitem of item.lst) {
				if (subitem.lst) self.removeGrp(subitem)
				else {
					delete self.pills[subitem.$id]
				}
			}
		} else {
			delete self.pills[item.$id]
		}
		if (this instanceof Node) {
			select(this).selectAll('*').on('click', null)
			select(this).on('click', null).remove()
		}
		self.updatePromise()
	}

	self.addItem = async function (item, i) {
		const filter = this.parentNode.__data__

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
			self.addJoinLabel(this, filter, item)
			return
		}

		self.numExpectedItems += 1

		// holder for blue pill
		const holder = select(this)
			.style('display', 'inline-block')
			.style('position', 'relative')
			.style('white-space', 'nowrap')
			.append('div')
			.attr('class', 'sja_pill_wrapper')
			.style('display', 'inline-block')
			.style('margin', self.opts.joinWith.length > 1 ? '' : '2px')
			.on('click', item.renderAs === 'htmlSelect' ? null : self.displayControlsMenu)

		self.addJoinLabel(this, filter, item)
		if (item.renderAs == 'htmlSelect') {
			const values = getValuesForHtmlSelect(self, item)
			const selectElem = holder.append('select').on('change', function () {
				const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
				const filterCopy = findItem(filterUiRoot, filter.$id)
				const i = filter.lst.indexOf(item)
				if (i == -1) return
				const index = +this.value
				const itemCopy = JSON.parse(JSON.stringify(item))
				const keys = 'keys' in values[index] ? values[index].keys : [values[index].key]
				itemCopy.tvs.values = keys.map(key => {
					return { key, label: key } //may be missing list if term type is samplelst
				})
				filterCopy.lst[i] = itemCopy
				self.refresh(filterUiRoot)
			})

			const defaultVal = getDefaultValueForHtmlSelect(self, item)
			selectElem
				.selectAll('option')
				.data(values)
				.enter()
				.append('option')
				.property('value', (d, i) => i)
				.property('selected', (d, i) => i == defaultVal)
				.html(d => (d.shortLabel ? d.shortLabel : d.label ? d.label : d.key))
		} else {
			const pill = await TVSInit({
				vocabApi: self.vocabApi,
				holder,
				debug: self.opts.debug,
				getCategoriesArguments: self.opts.getCategoriesArguments,
				callback: tvs => {
					const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
					const filterCopy = findItem(filterUiRoot, filter.$id)
					const i = filter.lst.indexOf(item)
					if (i == -1) return
					// if tvs already present in the filterCopy just replace it rather than adding new one
					const item_i = filterCopy.lst.findIndex(t => t.$id == item.$id)
					if (item_i == -1) filterCopy.lst[i] = { $id: item.$id, type: 'tvs', tvs }
					else filterCopy.lst[item_i].tvs = tvs
					self.refresh(filterUiRoot)
				}
			})
			self.pills[item.$id] = pill
			await pill.main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
		}
		self.updatePromise()
	}

	self.updateItem = async function (item, i) {
		const filter = this.parentNode.__data__
		select(this)
			.select(':scope > .sja_filter_join_label')
			.style(
				'display',
				self.opts.joinWith.length > 1 && filter.lst.indexOf(item) < filter.lst.length - 1 ? 'inline-block' : 'none'
			)
			.style('margin', self.opts.joinWith.length > 1 ? '' : '2px')
			.html(filter.join == 'and' ? 'AND' : 'OR')

		if (item.type == 'tvslst') {
			self.updateUI(select(this), item)
		} else if (item.renderAs === 'htmlSelect') {
			self.numExpectedItems += 1
			select(this)
				.select('select')
				.property('value', '' + getDefaultValueForHtmlSelect(self, item))
		} else {
			if (!self.pills[item.$id]) return
			self.numExpectedItems += 1
			await self.pills[item.$id].main({ tvs: item.tvs, filter: self.getFilterExcludingPill(item.$id) })
		}
		self.updatePromise()
	}

	self.removeItem = function (item) {
		delete self.pills[item.$id]
		select(this).on('click', null).remove()
	}

	self.addJoinLabel = function (elem, filter, item) {
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(elem)
			.append('div')
			.attr('class', 'sja_filter_join_label')
			.style(
				'display',
				self.opts.joinWith.length > 1 && filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1
					? 'inline-block'
					: 'none'
			)
			.style('width', '50px')
			.style('padding', '5px')
			.style('border', 'none')
			.style('border-radius', '5px')
			.style('text-align', 'center')
			.style('cursor', 'pointer')
			.html(filter.lst.length < 2 ? '' : filter.join == 'and' ? 'AND' : 'OR')
			.on('click', self.displayControlsMenu)
	}

	self.updateJoinLabel = function (item) {
		const filter = this.parentNode.parentNode.parentNode.__data__
		const i = filter.lst.findIndex(d => d.$id === item.$id)
		select(this).style(
			'display',
			self.opts.joinWith.length > 1 && filter.lst.length > 1 && item && i != -1 && i < filter.lst.length - 1
				? 'inline-block'
				: 'none'
		)
	}

	self.getAddTransformerBtnDisplay = function (d) {
		if (self.opts.joinWith.length < 2) {
			return 'none'
		} else if (self.filter && self.filter.lst.find(f => f.tag === 'cohortFilter')) {
			// assume that a cohortFilter is always joined via intersection with other filters
			return self.filter.lst.length == 1 && d == 'and' ? 'inline-block' : 'none'
		} else {
			return self.filter && self.filter.lst.length > 0 && (self.filter.join !== d || !self.filter.in)
				? 'inline-block'
				: 'none'
		}
	}
}

function getValuesForHtmlSelect(self, item) {
	return item.selectOptionsFrom == 'selectCohort'
		? self.opts.termdbConfig.selectCohort.values
		: Array.isArray(item.tvs.term.values)
		? item.tvs.term.values
		: Object.values(item.tvs.term.values)
}

function getDefaultValueForHtmlSelect(self, item) {
	const values = getValuesForHtmlSelect(self, item)
	const defaultKey = JSON.stringify(item.tvs.values.map(o => o.key).sort())
	const i = values.findIndex(d => (d.keys ? defaultKey === JSON.stringify(d.keys.sort()) : d.key === defaultKey))
	return i
}
