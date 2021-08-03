import * as rx from '../../common/rx.core'
import { debounce } from 'debounce'
import { select, selectAll, event } from 'd3-selection'
import { dofetch, getOneGenome } from '../../common/dofetch'
import { graphable } from '../../common/termutils'
import { sayerror } from '../../dom/error'
//import { plotInit } from './plot'
//import { getNormalRoot } from '../common/filter'

const childterm_indent = '25px'
export const root_ID = 'root'

// class names TODO they should be shared between test/tree.spec.js
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termview = 'termview',
	cls_termlabel = 'termlabel',
	cls_termgraphdiv = 'termgraphdiv',
	cls_termloading = 'termloading'

/*
a standalone component, much simplified from previous version:
- displayed on demand, e.g. for replacing a tvs in filter; not a persistent component in mass
- does not store internal state
- does not respond to external state update, no main() method
the structure of /front/mass/tree/ assumes that the tree app will only function within the mass container per its purpuse

data source:
- termdb via dslabel
- text files for annotation matrix and dictionary (optional)




******************** constructor opts{}
.holder
.datatype:STR
	required
	only working value is "dslabel"
.cohortValues: STR
	optional, comma joined cohort keys
.disable_terms[]
	optitonal
.select_term()
.select_tvs()
	either one must be provided



******************** Plot
separate functions are designed to handle different things so that logic won't mix
- clickViewButton( term )
  called by clicking button, will toggle graph div visibility
  setup measures to prevent multi-clicking
- newPlot(term)

******************** exit/update/enter
termsById{} is bound to the DOM tree, to provide:
- term label
- list of children terms for a parent term


******************* special flags
root term does not exist in the termdb, but is synthesized upon initializing instance, has the "__tree_isroot" flag




*/

class Tree {
	constructor(opts) {
		this.opts = validateOpts(opts)
		this.dom = {
			errordiv: opts.holder.append('div'),
			searchdiv: opts.holder.append('div'),
			treediv: opts.holder.append('div')
		}
		mayGetGenome(this)
			.then(() => {
				this.initSearch()
				this.initTree()
			})
			.catch(e => {
				this.error(e)
			})
	}
	error(e) {
		sayerror(e.message || e)
	}
}

export const treeInit = rx.getInitFxn(Tree)

///////////////////////// tree
Tree.prototype.getChildren = async function(id) {
	// to get root terms, id is undefined
	if (this.opts.datatype == 'dslabel') return await this.getChildren_dslabel(id)
	if (this.opts.datatype == 'textfile') return this.getChildren_textfile(id)
	throw 'unknown datatype'
}
Tree.prototype.getChildren_textfile = function(id) {
	throw 'todo'
}
Tree.prototype.getChildren_dslabel = async function(id) {
	const lst = ['getchildren=1', 'genome=' + this.opts.genome.name, 'dslabel=' + this.opts.dslabel]
	if (id) lst.push('termid=' + id)
	if (this.opts.cohortValues) lst.push('cohortValues=' + this.opts.cohortValues)
	const data = await dofetch('termdb?' + lst.join('&'))
	if (data.error) throw data.error
	return data.lst
}
Tree.prototype.initTree = async function() {
	const lst = await this.getChildren()
}

////////////////// search
Tree.prototype.initSearch = function() {
	this.dom.searchinput = this.dom.searchdiv
		.append('input')
		.attr('type', 'search')
		.attr('class', 'tree_search')
		.attr('placeholder', 'Search')
		.style('width', '180px')
		.style('display', 'block')
		.style('font-size', '24px')
		.on('input', debounce(this.onInput, 300))

	this.dom.searchresult = this.dom.searchdiv
		.append('div')
		.style('border-left', 'solid 1px rgb(133,182,225)')
		.style('margin', '0px 0px 10px 10px')
		.style('padding-left', '5px')
}
Tree.prototype.onInput = async function() {
	const str = this.dom.searchinput.property('value')
	// do not trim space from input so that 'age ' will not match with 'agent'
	try {
		await this.doSearch(str)
	} catch (e) {
		this.clear()
		sayerror(self.dom.resultDiv, 'Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}
Tree.prototype.doSearch = async function(str) {
	if (!str) {
		this.clearSearch()
		return
	}
	if (this.opts.datatype == 'dslabel') return await this.doSearch_dslabel(str)
	throw 'unknown datatype'
}
Tree.prototype.doSearch_dslabel = async function(str) {
	const lst = ['genome=' + this.opts.genome.name, 'dslabel=' + this.opts.dslabel, 'findterm=' + encodeURIComponent(str)]
	if (this.opts.cohortValues) lst.push('cohortValues=' + this.opts.cohortValues)
	const data = await dofetch('termdb?' + lst.join('&'), {}, this.opts.fetchOpts)
	if (data.error) throw data.error
	if (!data.lst || data.lst.length == 0) {
		this.noResult()
	} else {
		// found terms
		this.showTerms(data)
	}
}

/////////////////////////// helpers

function validateOpts(opts) {
	if (!opts.holder) throw '.holder missing'
	if (!opts.genome) throw '.genome missing'
	if (typeof opts.genome == 'object') {
		// may validate genome object
	} else if (typeof opts.genome == 'string') {
		// to request object later
	} else {
		throw '.genome{} is not string or object'
	}
	if (!opts.datatype) throw '.datatype missing'
	if (opts.datatype == 'dslabel') {
		if (!opts.dslabel) throw '.dslabel missing as required by datatype'
	} else {
		throw 'invalid value for .datatype'
	}
	if (opts.select_term) {
		if (typeof opts.select_term != 'function') throw '.select_term() is not function'
	} else if (opts.select_tvs) {
		if (typeof opts.select_tvs != 'function') throw '.select_tvs() is not function'
	} else {
		throw 'must provide at least one callback: select_term() or select_tvs()'
	}
	if (opts.cohortValues) {
		if (typeof opts.cohortValues != 'string') throw '.cohortValues is not string'
	}
	return opts
}

async function mayGetGenome(self) {
	if (typeof self.opts.genome == 'string') {
		self.opts.genome = await getOneGenome(self.opts.genome)
	}
}
