import {Component,getInitFxn} from './rx.core'
import {dofetch2} from '../../client'

class TreeComponent extends Component {
	constructor(app,holder) {
		super()
		this.app = app
		this.dom = {
			holder
		}
	}
	main(action) {
		action.terms.forEach(term=>{
			const row = this.dom.holder.append('div')
			row.append('div').text(term.name)
		})
	}
	reactsTo(name) {
		if (name.split('_')[0]=='getDefaultTerms') return true
		return false
	}
}


export const treeInit = getInitFxn(TreeComponent)
