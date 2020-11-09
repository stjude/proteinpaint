import { dofetch3 } from '../client'

export function getVocab(app, opts) {
	const state = opts.state ? opts.state : {}
	if (state.dslabel) {
		return new DefaultVocab(app)
	} else if (opts.vocab) {
		return new CustomVocab(app)
	} /*else {
		throw 'unable to set a vocabulary source'
	}*/
}

class DefaultVocab {
	constructor(app) {
		this.app = app
		this.state = {
			genome: this.app.opts.state.genome,
			dslabel: this.app.opts.state.dslabel
		}
	}

	main() {
		this.state = this.app.getState()
	}

	// migrated from termdb/store
	async getTermdbConfig() {
		const data = await dofetch3(
			'termdb?genome=' + this.state.genome + '&dslabel=' + this.state.dslabel + '&gettermdbconfig=1'
		)
		// note: in case of error such as missing dataset, supply empty object
		return data.termdbConfig || {}
	}

	// migrated from termdb/tree
	async getTermChildren(term, cohortValuelst) {
		const lst = [
			'genome=' + this.state.genome,
			'&dslabel=' + this.state.dslabel,
			term.__tree_isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id
		]
		if (cohortValuelst) {
			lst.push(
				'cohortValues=' +
					cohortValuelst
						.slice()
						.sort()
						.join(',')
			)
		}
		const data = await dofetch3('/termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/plot
	async getPlotData(plotId, dataName) {
		const config = this.state.tree.plots[plotId]
		const route = config.settings.currViews.includes('scatter') ? '/termdb' : '/termdb-barsql'
		const url = route + dataName
		const data = await dofetch3(route + dataName, {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/search
	async findTerm(str, cohortStr) {
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'findterm=' + encodeURIComponent(str),
			'cohortStr=' + cohortStr
		]
		const data = await dofetch3('termdb?' + lst.join('&'))
		if (data.error) throw data.error
		return data
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		const args = ['genome=' + this.state.genome + '&dslabel=' + this.state.dslabel + '&getterminfo=1&tid=' + id]
		const data = await dofetch3('/termdb?' + args.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/nav
	async getCohortSampleCount(cohortName) {
		if (!cohortName) return
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getcohortsamplecount=' + cohortName,
			'cohortValues=' + cohortName
		]
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			return data[0].samplecount
		}
	}

	async getFilteredSampleCount(cohortName, filterJSON) {
		if (!cohortName) return
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getsamplecount=' + cohortName,
			'filter=' + encodeURIComponent(filterJSON)
		]
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			return data[0].samplecount
		}
	}
}

class CustomVocab {
	constructor(app) {
		this.app = app
		this.vocab = app.opts.vocab
	}

	main(vocab) {
		if (vocab) Object.assign(this.vocab, vocab)
	}

	getTermdbConfig() {
		return { termdbConfig: { selectCohort: this.vocab.selectCohort } }
	}

	getTermChildren(term, cohortValuelst) {
		const cohortValuestr = (cohortValuelst || [])
			.slice()
			.sort()
			.join(',')
		const parent_id = term.__tree_isroot ? null : term.id
		return {
			lst: this.vocab.terms.filter(
				t =>
					t.parent_id === parent_id &&
					(!cohortValuestr.length || cohortValuestr === t.cohortValues.slice().sort.join(','))
			)
		}
	}

	// from termdb/plot
	async getPlotData(plotId, dataName) {
		return { charts: [], refs: {} }
	}

	// from termdb/search
	async findTerm(str, cohortStr) {
		const cohortValuestr = cohortValuelst
			.slice()
			.sort()
			.join(',')
		return {
			lst: this.vocab.terms.filter(
				t =>
					t.name.includes(str) && (!cohortValuestr.length || cohortValuestr === t.cohortValues.slice().sort.join(','))
			)
		}
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		const term = this.vocab.find(t => t.id === id)
		if (!term) return undefined
		return { terminfo: t.info }
	}

	// from termdb/nav
	async getCohortSampleCount(cohortName) {
		if (!cohortName) return
		const term = this.vocab.find(t => t.id === id)
		if (!term || !term.cohortValues.includes(cohortName)) return
		if (!term.samplecount) term.samplecount = {}
		if (!(cohortName in term.samplecount)) {
			term.samplecount[cohortName] = Object.keys(this.vocab.sampleannotation).length
		}
		return { samplecount: term.samplecount[cohortName] }
	}

	/*** To-Do ***/
	async getFilteredSampleCount(cohortName, filterJSON) {
		if (!cohortName) return
		const term = this.vocab.find(t => t.id === id)
		if (!term || !term.cohortValues.includes(cohortName)) return
		if (!term.samplecount) term.samplecount = {}
		if (!(cohortName in term.samplecount)) {
			term.samplecount[cohortName] = Object.keys(this.vocab.sampleannotation).length
		}
		return { samplecount: 'TBD' }
	}
}
