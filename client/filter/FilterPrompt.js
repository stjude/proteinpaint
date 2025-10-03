import { getInitFxn, Bus } from '#rx'
import { Filter } from './FilterClass'
import { getNormalRoot, getFilterItemByTag, findParent } from './filter.utils'

// use this as a non-rx, stateless component
// BUT where there a filterUiRoot tag is used and would need to be handled
// correctly when refreshing the filter data and UI
class FilterPrompt extends Filter {
	constructor(opts) {
		super(opts)
		this.api = {
			// make sure to bind the 'this' context to the filter instance
			// instead of to the this.api object
			main: this.main.bind(this),
			/*
				WARNING!!!
				When using this filter.api.getNormalRoot(),
				make sure this instance has been updated before the caller,
				otherwise the normalized root will be stale

				or for reliability, import getNormalRoot() directly 
				from the common/filter.js component and supply the 
				caller's known raw filter state
			*/
			getNormalRoot: () => getNormalRoot(this.rawFilter),
			getPromise: name => this.promises[name],
			destroy: () => this.destroy()
		}

		if (opts.debug) this.api.Inner = this
	}

	async main(rawFilter, opts = {}) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const activeCohort = 'activeCohort' in opts ? opts.activeCohort : this.activeCohort
		const filterUiRoot = getFilterItemByTag(rawFilter, 'filterUiRoot')
		// always replace the filterUiRoot with a tvslst object that has an empty lst,
		// so that the prompt will always be displayed
		if (filterUiRoot) delete filterUiRoot.tag
		rawFilter.lst.push({
			tag: 'filterUiRoot',
			type: 'tvslst',
			join: '',
			lst: []
		})
		rawFilter.join = rawFilter.lst.length > 1 ? 'and' : ''
		const rawCopy = JSON.stringify(rawFilter)
		// if the filter data and active cohort has not changed, do not trigger a re-render
		if (this.rawCopy == rawCopy && JSON.stringify(this.activeCohort) == JSON.stringify(activeCohort)) return
		// call the parent's main() method
		await super.main(rawCopy, opts)
	}

	refresh(filterUiRoot) {
		this.dom.controlsTip.hide()
		this.dom.treeTip.hide()
		const rootCopy = JSON.parse(JSON.stringify(this.rawFilter))
		const rawParent = findParent(rootCopy, this.filter.$id)
		if (!rawParent || this.rawFilter.$id === this.filter.$id) {
			this.opts.callback(rootCopy)
		} else {
			const i = rawParent.lst.findIndex(f => f.$id == this.filter.$id)
			rawParent.lst[i] = filterUiRoot
			this.opts.callback(rootCopy)
		}
		// remove the filled-in filterUiRoot from this filter prompt,
		// so that the selected filter data does not get carried over
		// to future selections from this prompt
		const i = rootCopy.lst.findIndex(f => f.$id === filterUiRoot.$id)
		rootCopy.lst.splice(i, 1)
		this.main(rootCopy)
	}
}

export const filterPromptInit = getInitFxn(FilterPrompt)
