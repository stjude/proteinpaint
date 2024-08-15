import { select } from 'd3-selection'
import { findItem, findParent, getWrappedTvslst } from './filter.utils'

const MENU_OPTION_HIGHLIGHT_COLOR = '#fff'

export function setInteractivity(self) {
	self.displayControlsMenu = function (event) {
		event.stopPropagation() // in mass/group ui, to prevent pill-clicking to check/uncheck table rows

		if (!self.activeData) return
		const item = this.parentNode.__data__
		const filter = findParent(self.filter, item.$id)
		self.activeData = { item, filter, elem: this }
		self.removeBlankPill()
		self.resetGrpHighlights(this, filter)

		// disabled for now as it breaks CI
		if (item.noEdit)
			self.dom.table
				.selectAll('tr')
				.filter(d => d.action == 'edit')
				.style('display', 'none')

		self.dom.controlsTip.showunder(this)
	}

	self.resetGrpHighlights = function (elem, filter) {
		const cls = elem.className
		const grpAction = cls.includes('join') || cls.includes('negate') || cls.includes('paren')
		const menuRows = self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		menuRows.filter(d => d.action == 'edit' || d.action == 'replace').style('display', grpAction ? 'none' : 'table-row')
		menuRows
			.filter(d => /*d.action == 'negate' ||*/ d.action == 'remove')
			.style('display', cls.includes('_join_') && filter.lst.find(d => d.tag == 'cohortFilter') ? 'none' : 'table-row')

		menuRows
			.filter(d => d.action == 'join')
			.style(
				'display',
				self.opts.joinWith.length < 2 ||
					(filter.$id == self.filter.$id && filter.lst.length == 1) ||
					cls.includes('negate') ||
					cls.includes('paren')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(grpAction ? filter.join.toUpperCase() : filter.join == 'and' ? 'OR' : 'AND')

		menuRows
			.filter(d => d.action == 'switch')
			.style(
				'display',
				self.opts.joinWith.length < 2 ||
					(filter.$id == self.filter.$id && filter.lst.length == 1) ||
					!cls.includes('_join_')
					? 'none'
					: 'table-row'
			)
			.select('td:nth-child(2)')
			.html(d => (filter.join == 'and' ? 'Switch to OR' : 'Switch to AND'))

		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (grpAction) {
			if (cls.includes('join')) elem.parentNode.parentNode.style.backgroundColor = '#ee5'
			else elem.parentNode.style.backgroundColor = '#ee5'
		}
	}

	self.handleMenuOptionClick = async function (event, d) {
		event.stopPropagation()
		if (d == self.activeData.menuOpt) return
		self.activeData.menuOpt = d
		if (self.activeData.elem.className.includes('join') && d.action !== 'join' && d.action != 'switch') {
			self.activeData.item = self.activeData.filter
			self.activeData.filter = findParent(self.filter, self.activeData.item)
		}
		self.resetBlankPill(d.action)
		self.dom.controlsTip.d.selectAll('tr').style('background-color', '')
		await d.handler(this, d)
	}

	self.resetBlankPill = function (action) {
		// clear any currently highlighted blank pill/parenthesis
		self.removeBlankPill()
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (action != 'join') return
		const elem = self.dom.last_join_div
			? self.dom.last_join_div.node()
			: self.activeData.elem.className.includes('join_label')
			? self.activeData.elem.parentNode.parentNode
			: self.activeData.item.type == 'tvs' || self.activeData.filter === self.filter
			? self.activeData.elem
			: self.activeData.elem.parentNode.parentNode
		const joiner =
			self.opts.joinWith.length === 1
				? self.opts.joinWith[0].toUpperCase()
				: self.activeData.elem.className.includes('join_label')
				? self.activeData.filter.join.toUpperCase()
				: self.activeData.btn && typeof self.activeData.btn.__data__ === 'string'
				? self.activeData.btn.__data__.toUpperCase()
				: self.activeData.item.type == 'tvslst'
				? self.activeData.filter.join.toUpperCase()
				: self.activeData.filter.join == 'or'
				? 'AND'
				: 'OR'

		if (
			self.activeData.item.type == 'tvs' &&
			//&& self.activeData.filter != self.filter
			!self.activeData.elem.className.includes('join_label')
		) {
			select(elem)
				.insert('div', 'div')
				.attr('class', 'sja_filter_paren_open')
				.style('display', self.opts.joinWith.length > 1 ? 'inline-block' : 'none')
				.style('padding', '0 5px')
				.style('font-weight', 500)
				.style('font-size', '24px')
				.style('cursor', 'pointer')
				.html('(')
		}

		const blank = select(elem)
			.insert('div', ':scope > .sja_filter_paren_close')
			.attr('class', 'sja_filter_blank_pill')
			.style('display', 'inline-block')
			//.style('width', '120px')
			.style('height', '20px')
			//.style('margin-right', '20px')
			.style('overflow', 'visible')

		blank
			.append('div')
			.style('display', 'inline-block')
			.style('width', '50px')
			.style('text-align', 'center')
			.html(joiner)

		blank
			.append('div')
			.style('position', 'relative')
			.style('top', '-7px')
			.style('display', 'inline-block')
			.style('width', '80px')
			.style('height', '22px')
			.style('margin-right', '5px')
			.style('border', '3px dashed #b8d3ea')
			.style('vertical-align', 'top')
			.style('background-color', '#ee5')

		if (
			self.activeData.item.type == 'tvs' &&
			//&& self.activeData.filter != self.filter
			!self.activeData.elem.className.includes('join_label')
		) {
			select(elem)
				.append('div')
				.attr('class', 'sja_filter_paren_close')
				.style('display', self.opts.joinWith.length > 1 ? 'inline-block' : 'none')
				.style('padding', '0 5px')
				.style('font-weight', 500)
				.style('font-size', '24px')
				.style('cursor', 'pointer')
				.html(')')
		}

		if (elem == self.dom.filterContainer.node()) {
			self.dom.filterContainer
				.selectAll(
					':scope > .sja_filter_grp > .sja_filter_paren_open, :scope > .sja_filter_grp > .sja_filter_paren_close'
				)
				.style('display', self.opts.joinWith.length > 1 && self.filter.lst.length > 1 ? 'inline-block' : 'none')
		}
	}

	self.removeBlankPill = function () {
		self.dom.holder
			?.selectAll(
				'.sja_filter_blank_pill, .sja_pill_wrapper > .sja_filter_paren_open, .sja_pill_wrapper > .sja_filter_paren_close'
			)
			.remove()

		// in case of potentially root filter subnesting, may have to
		// revert the visibility of root filter group parentheses
		// that subnest existing pill + blank pill
		if (self.filter.in && self.filter.lst.filter(f => f.type === 'tvslst').length < 1) {
			self.dom.filterContainer
				?.selectAll(
					':scope > .sja_filter_grp > .sja_filter_paren_open, :scope > .sja_filter_grp > .sja_filter_paren_close'
				)
				.style('display', 'none')
		}
	}

	// menu to add a new term
	self.displayTreeNew = async function (event, d) {
		event.stopPropagation() // in mass/group ui, to prevent pill-clicking to check/uncheck table rows

		if (self.opts.newBtn && this.className !== 'sja_filter_add_transformer' && self.filter.lst.length) return
		self.dom.filterContainer.selectAll('.sja_filter_grp').style('background-color', 'transparent')
		if (self.filter.lst.length > 0) {
			self.activeData = {
				item: self.filter,
				filter: self.filter,
				elem: self.dom.filterContainer.node(), //.select(':scope > .sja_filter_grp').node()
				btn: this
			}
		}
		if (self.filter.lst.length) self.resetBlankPill('join')
		const blankPill = self.dom.filterContainer.select('.sja_filter_blank_pill').node()
		if (blankPill) {
			self.dom.holder.selectAll('.sja_filter_add_transformer').style('display', 'none')
			self.dom.treeTip.clear().showunder(blankPill)
		} else {
			self.dom.treeTip.clear().showunder(this)
		}

		const rootFilterCopy = self.activeData
			? self.getAdjustedRoot(self.activeData.filter.$id, d)
			: JSON.parse(self.rawCopy)

		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: self.vocabApi,
			holder: self.dom.termSrcDiv,
			getCategoriesArguments: self.opts.getCategoriesArguments,
			state: {
				activeCohort: self.activeCohort,
				termfilter: { filter: rootFilterCopy },
				tree: {
					usecase: {
						target: 'filter',
						// pass ds label to perform ds-specific control. for gdc, need to exclude survival term from filter. using "detail" property for termdb.usecase.js to carry out this logic without introducing any new property
						detail: self.vocabApi.vocab.dslabel
					}
				}
			},
			tree: {
				disable_terms:
					self.activeData && self.activeData.filter && self.activeData.filter.lst && d == 'and'
						? self.activeData.filter.lst
								.filter(d => d.type === 'tvs' && d.tvs.term.type !== 'condition')
								.map(d => d.tvs.term.id)
						: [],

				click_term2select_tvs(tvs) {
					self.editFilterRoot(d, [{ type: 'tvs', tvs }])
				}
			}
		})
	}

	/*
		Arguments: 
		d: the data bound to a button element like +New, AND, OR
		tvslst
	*/
	self.editFilterRoot = (d, tvslst) => {
		// NOTE: default to 'tvs' argument once bar_click_override is unsupported
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))

		if (!filterUiRoot.lst.length) {
			if (tvslst.length > 1) filterUiRoot.join = 'and'
			filterUiRoot.lst.push(...tvslst)
			self.refresh(filterUiRoot)
		} else if (d != 'or' && d != 'and') {
			throw 'unhandled new term(s): invalid appender join value'
		} else {
			if (!filterUiRoot.join) filterUiRoot.join = d // 'and' || 'or'

			if (filterUiRoot.join == d && filterUiRoot.in) {
				if (tvslst.length < 2 || filterUiRoot.join == 'and') {
					filterUiRoot.lst.push(...tvslst)
				} else {
					filterUiRoot.push({
						type: 'tvslst',
						in: true,
						join: 'and',
						lst: tvslst
					})
				}
				self.refresh(filterUiRoot)
			} else if (d == 'and' || tvslst.length < 2) {
				delete filterUiRoot.tag
				self.refresh({
					tag: 'filterUiRoot',
					type: 'tvslst',
					in: true,
					join: d,
					lst: [filterUiRoot, ...tvslst]
				})
			} else {
				delete filterUiRoot.tag
				self.refresh({
					tag: 'filterUiRoot',
					type: 'tvslst',
					in: true,
					join: 'or',
					lst: [
						filterUiRoot,
						{
							type: 'tvslst',
							in: true,
							join: 'and',
							lst: tvslst
						}
					]
				})
			}
		}
	}

	// menu to replace a term or add a subnested filter
	// elem: the clicked menu row option
	// d: elem.__data__
	self.displayTreeMenu = async function (elem, d) {
		select(elem).style('background-color', MENU_OPTION_HIGHLIGHT_COLOR)
		self.dom.holder.selectAll('.sja_filter_add_transformer').style('display', 'none')
		const blankPill = self.dom.filterContainer.select('.sja_filter_blank_pill').node()
		if (blankPill) {
			self.dom.controlsTip.hide()
			self.dom.treeTip.clear().showunder(blankPill)
		} else if (elem.lastChild instanceof HTMLElement) {
			self.dom.treeTip.clear().showunderoffset(elem.lastChild)
		} else {
			self.dom.treeTip.clear().showunder(elem)
		}
		const filter = self.activeData.filter

		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: self.vocabApi,
			holder: self.dom.termSrcDiv,
			getCategoriesArguments: self.opts.getCategoriesArguments,
			state: {
				activeCohort: self.activeCohort,
				header_mode: 'search_only',
				termfilter: { filter: self.getAdjustedRoot(filter.$id, filter.join) },
				tree: { usecase: { target: 'filter' } }
			},
			tree: {
				disable_terms:
					filter && filter.lst && filter.join == 'and'
						? filter.lst.filter(d => d.type === 'tvs' && d.tvs.term.type !== 'condition').map(d => d.tvs.term.id)
						: !self.activeData.item
						? []
						: self.activeData.item.type == 'tvs'
						? [self.activeData.item.tvs.term.id]
						: self.activeData.item.lst
						? self.activeData.item.lst.filter(f => f.type == 'tvs').map(f => f.tvs.term.id)
						: [],

				click_term2select_tvs:
					d.action == 'replace'
						? self.replaceTerm
						: !filter.join ||
						  !filter.lst.length ||
						  (self.activeData.elem && self.activeData.elem.className.includes('join'))
						? self.appendTerm
						: self.subnestFilter
			}
		})
	}

	self.editTerm = function (elem) {
		select(elem.parentNode).selectAll('tr').style('background-color', self.highlightEditRow)
		const holder = self.dom.termSrcDiv
		const item = self.activeData.item
		self.dom.treeTip.clear()
		self.pills[item.$id].showMenu(holder)
		self.dom.treeTip.showunderoffset(elem.lastChild)
	}

	self.highlightEditRow = function (d) {
		return d.action == 'edit' ? MENU_OPTION_HIGHLIGHT_COLOR : ''
	}

	self.handleNotLabelClick = function (event, d) {
		self.activeData = {
			item: this.__data__
		}
		self.negateClause()
	}

	self.negateClause = function () {
		//const filter = self.activeData.filter
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const item = findItem(filterUiRoot, self.activeData.item.$id)
		if (item.type == 'tvslst') item.in = !item.in
		else if (item.type == 'tvs' && item.tvs?.term?.type == 'geneVariant') {
			const modifiedGrp = item.tvs.values.filter(v => v.mclassExcludeLst.length > 0)[0]
			const tmp = modifiedGrp.mclassLst
			modifiedGrp.mclassLst = modifiedGrp.mclassExcludeLst
			modifiedGrp.mclassExcludeLst = tmp
			item.tvs.isnot = !item.tvs.isnot
		} else item.tvs.isnot = !item.tvs.isnot
		self.refresh(filterUiRoot)
	}

	self.replaceTerm = _tvs_ => {
		// NOTE: default to type: 'tvs' argument once bar_click_override is unsupported
		const tvslst = Array.isArray(_tvs_) ? _tvs_ : [{ type: 'tvs', tvs: _tvs_ }]
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === self.activeData.item.$id)
		// FIXME: will replace with just one tvs, once bar_click_override is unsupported
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.splice(i, 1, ...tvslst)
		} else {
			filterCopy.lst[i] = {
				// transform from tvs to tvslst
				in: !_tvs_.isnot,
				type: 'tvslst',
				join: 'and',
				lst: tvslst
			}
		}
		self.refresh(filterUiRoot)
	}

	self.appendTerm = _tvs_ => {
		// FIXME: default to type: 'tvs' argument once bar_click_override is unsupported
		const tvslst = Array.isArray(_tvs_) ? _tvs_ : [{ type: 'tvs', tvs: _tvs_ }]
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		// FIXME: will just push one tvs, once bar_click_override is unsupported
		if (tvslst.length < 2 || filterCopy.join == 'and') {
			filterCopy.lst.push(...tvslst)
			if (filterCopy.join == '' && self.opts.joinWith.length === 1) filterCopy.join = self.opts.joinWith[0]
		} else {
			filterCopy.lst.push({
				// transform from tvs to tvslst
				in: true,
				type: 'tvslst',
				join: 'and',
				lst: tvslst
			})
		}
		self.refresh(filterUiRoot)
	}

	self.subnestFilter = t => {
		let tvslst
		if (Array.isArray(t)) {
			tvslst = t
		} else {
			tvslst = [{ type: 'tvs', tvs: t }]
		}

		const item = self.activeData.item
		const filter = self.activeData.filter
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, filter.$id)
		const i = filterCopy.lst.findIndex(t => t.$id === item.$id)
		// transform from tvs to tvslst
		filterCopy.lst[i] = {
			in: true,
			type: 'tvslst',
			join: filter.join == 'or' ? 'and' : 'or',
			lst: [item, ...tvslst]
		}
		self.refresh(filterUiRoot)
	}

	self.removeTransform = function (elem, t) {
		const item = t.action || typeof t !== 'object' ? self.activeData.item : findItem(self.filter, t.$id)
		const filter = findParent(self.filter, item.$id) //self.activeData.filter
		if (item == filter) {
			self.refresh(getWrappedTvslst([], '', item.$id))
			return
		}
		const i = filter.lst.findIndex(t => t.$id === item.$id)
		if (i == -1) return
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, filter.$id)
		filterCopy.lst.splice(i, 1)
		if (filterCopy.lst.length === 1) {
			const parent = findParent(filterUiRoot, filterCopy.$id)
			if (filterCopy.lst[0].type == 'tvslst') {
				if (parent == filterUiRoot) {
					filterCopy.lst[0].tag = 'filterUiRoot'
					self.refresh(filterCopy.lst[0])
				} else {
					const j = parent.lst.findIndex(t => t.$id == filterCopy.$id)
					if (filterCopy.lst[0].join == parent.join) {
						parent.lst.splice(j, 1, ...filterCopy.lst[0].lst)
						self.refresh(filterUiRoot)
					} else {
						parent.lst[j] = filterCopy.lst[0]
						self.refresh(filterUiRoot)
					}
				}
			} else {
				filterCopy.join = ''
				const j = parent.lst.findIndex(t => t.$id === filterCopy.$id)
				parent.lst[j] = filterCopy.lst[0]
				if (!filterCopy.in) {
					parent.lst[j].tvs.isnot = !parent.lst[j].tvs.isnot
					if (parent == filterUiRoot) parent.in = true
				}
				self.refresh(filterUiRoot)
			}
		} else {
			self.refresh(filterUiRoot)
		}
	}

	self.showLastJoinBlank = function (event, d) {
		event.stopPropagation()
		const elem = self.dom.last_join_div.node()
		self.dom.last_join_label.style('display', 'none')
		const filter = this.parentNode.__data__
		self.activeData = { item: filter, filter, elem }
		self.resetBlankPill(d.action)
		self.displayTreeMenu(elem, d)
	}

	self.switchJoin = function (event, d) {
		const filterUiRoot = JSON.parse(JSON.stringify(self.filter))
		const filterCopy = findItem(filterUiRoot, self.activeData.filter.$id)
		if (filterCopy.join < 2) return
		filterCopy.join = filterCopy.join == 'and' ? 'or' : 'and'
		self.refresh(filterUiRoot)
	}
}
