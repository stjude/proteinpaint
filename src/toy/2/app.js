import {App,getInitFxn,Bus} from './rx.core'
import {Menu,sayerror,dofetch2} from '../../client'
import {treeInit} from './tree'
import {treestoreInit} from './store'

// name of the app class can be arbitrary, as it is private
class TheApp extends App {
	constructor(opts, holder) {
		super()
		this.opts = this.validateParseOpts(opts)
		this.dom = {
			holder,
			tip: new Menu(),
		}
		this.app = this.getApi()
		this.store = treestoreInit(this.app)
		this.components = {
			tree: treeInit( this.app, holder.append('div').style('margin','10px') )
		}

		// init bus
		// async loading default data
		this.init(opts)
	}

	async init(opts) {
		// only run once, upon creating instance
		// parse options, initialize default state
		try {
			if (opts.defaultTerms) {
				const action = { type:'getDefaultTerms'}
				// add modifiers from opts
				await this.app.dispatch(action)
			}
			this.bus.emit('postInit',this.app)
		} catch(e) {
			if(e.stack) console.log(e.stack)
			sayerror( this.dom.holder, 'Error: '+(e.message||e))
		}
	}

	validateParseOpts(opts) {
		const o = Object.assign({},opts)
		if (!o.genome) throw 'genome missing'
		if (!o.dslabel) throw 'dslabel missing'
		if (!o.callbacks) throw '.callbacks{} missing' // is this really required?
		// if postInit and postNotify are hardcoded, then need to validate opts.callbacks
		this.bus = new Bus('app', ['postInit', 'postNotify'], opts.callbacks, this)
		return o
	}

	async main(action) {
		await this.notifyComponents(action)
	}
}

export const appInit = getInitFxn(TheApp)
