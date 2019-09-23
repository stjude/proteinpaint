import {Store,getInitFxn} from './rx.core'
import {dofetch2} from '../../client'


class TreeappStore extends Store {
	constructor(app) {
		super()
		this.app = app
		this.yesThis()
	}
	/*
	async getDefaultTerms(action) {
		// XXX "this" is undefined
		const data = await dofetch2('termdb?default_rootterms=1&'+this.app.fetchParamStr)
		console.log(data)
	}
	*/
	yesThis(){
		/*
		MUST write arrow functions!
		in async methods, "this" will be undefined!!
		https://stackoverflow.com/questions/34930771/why-is-this-undefined-inside-class-method-when-using-promises/34930859
		*/
		this.getDefaultTerms = async (action)=>{
			//to register/cache results of the query using serverData
			const data = await dofetch2('termdb?default_rootterm=1&'+this.app.fetchParamStr)
			if(data.error) throw data.error
			if(!data.lst || data.lst.length==0) throw 'No root terms'
			action.terms = data.lst
		}
	}
}


export const treestoreInit = getInitFxn(TreeappStore)
