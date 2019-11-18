import * as rx from '../common/rx.core'
import { termsettingInit } from '../common/termsetting'

/*
blue pill UI for configuring term1
* groupsetting for categorical/condition
* bin scheme

execution flow:
constructor builds and returns this.api{}
no state available for constructor so cannot do term-type specific things
upon getting state from plot.controls.config.js, call api.main() with latest state
then call this.render() to:
1) if plot.term cannot be configured, quit
2) initiate this.pill if missing
3) call this.pill.main() to send {term,q} to pill

*/

class Term1ui {
	constructor(opts) {
		this.opts = opts
		this.validateOpts()
		//setInteractivity(this)
		setRenderers(this)
		this.initUI()
		this.api = {
			usestate: true,
			main: state => {
				this.state = state
				this.render()
			}
		}
	}
	validateOpts() {
		if (!('id' in this.opts)) throw 'opts.id missing'
		if (!this.opts.holder) throw 'opts.holder missing'
		if (typeof this.opts.dispatch != 'function') throw 'opts.dispath() is not a function'
		this.dom = { tr: this.opts.holder }
	}
	setPill() {
		// can only call after getting this.state
		this.pill = termsettingInit({
			disable_ReplaceRemove: true, // to disable Replace/Remove buttons
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			holder: this.dom.td2,
			callback: data => {
				// data is object with only one needed attribute: q, never is null
				if (!data.q) throw 'data.q{} missing from pill callback'
				this.opts.dispatch({
					type: 'plot_edit',
					id: this.opts.id,
					config: { term: { q: data.q } }
				})
			}
		})
	}
}

exports.term1uiInit = rx.getInitFxn(Term1ui)

function setRenderers(self) {
	self.initUI = function() {
		// label to be updated later after getting plot state via api.main()
		// <td> left
		self.dom.td1 = self.dom.tr.append('td').attr('class', 'sja-termdb-config-row-label')
		// <td> right
		self.dom.td2 = self.dom.tr.append('td')
	}
	self.render = function() {
		/* state and plot are frozen from app.state
		 */
		const plot = this.state.config
		if (!plot.term) throw 'plot.term{} is missing'
		if (!plot.term.q) throw 'plot.term.q{} is missing'

		if (plot.term.q.groupsetting && plot.term.q.groupsetting.disabled) {
			///////////////////////////////////
			//
			// the term is not configurable. as plot term1 cannot be replaced, just quit
			//
			///////////////////////////////////
			this.dom.tr.style('display', 'none')
			return
		}

		if (plot.term.term.iscategorical) {
			self.dom.td1.text('Group categories')
			// may replace generic "categories" with term-specifics, e.g. cancer diagnosis
		} else if (plot.term.term.iscondition) {
			self.dom.td1.text('Group ' + (plot.term.q.bar_by_grade ? 'grades' : 'sub-conditions'))
		} else if (plot.term.term.isinteger || plot.term.term.isfloat) {
			self.dom.td1.text('Customize bins')
		} else {
			throw 'unknown term type'
		}
		if (!self.pill) self.setPill()
		self.pill.main({
			term: plot.term.term,
			q: plot.term.q,
			termfilter: this.state.termfilter
			// no need for disable_terms as won't show tree
		})
	}
}
function setInteractivity(self) {}
