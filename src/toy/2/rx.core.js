export function getInitFxn(__class) {
	return (opts, holder)=> {
		const instance = new __class(opts, holder)
		let api
		if (instance.store) {
			api = instance.app
		} else if(instance.getApi) {
			api = instance.getApi()
		} else {
			throw 'do not know how to generate api'
		}
		return Object.freeze(api)
	}
}



export class Core {
/*
	deepFreeze(obj) {
		Object.freeze(obj)
		for (const k in obj) {
			if (typeof obj[k] == 'object') {
				this.deepFreeze(obj[k])
			}
		}
	}
	*/
	async notifyComponents(action) {
		if(!this.components) {
			// app always has components
			// a component may not have subcomponents
			console.log('notifyComponents but "components" is missing')
			return
		}
		for (const key in this.components) {
			const component = this.components[key]
			if (Array.isArray(component)) {
				for (const comp of component) {
					await comp.main(action)
				}
			} else {
				// component api
				await component.main(action)
			}
		}
	}
}




export class App extends Core {
	/*
	components{} to be initiated in actual app class
	*/
	getApi() {
		const self = this
		const api = {
			fetchParamStr: 'genome='+self.opts.genome+'&dslabel='+self.opts.dslabel,
			async dispatch(action) {
				await self.store.main(action)
				// result attached to action
				await self.main(action)
			},
		}
		return Object.freeze(api)
	}
}


export class Component extends App {
	getApi() {
		const self = this
		const api = {
			async main(action) {
				if (self.reactsTo) {
					if (!self.reactsTo(action.type)) return
				}
				await self.main(action)
			}
		}
		return Object.freeze(api)
	}
}


export class Store extends Core {
	getApi() {
		const self = this
		const api = {
			async main(action) {
				const f = self[action.type]
				if (typeof f != 'function') throw 'illegal action: '+action.type
				await f(action)
			}
		}
		return Object.freeze(api)
	}
}



/*
copied over from src/rx.core.js
*/
export class Bus {
	constructor(name, eventTypes, callbacks, defaultArg) {
		this.name = name
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = defaultArg
		for (const eventType in callbacks[name]) {
			this.on(eventType, callbacks[name][eventType])
		}
	}

	on(eventType, callback, opts = {}) {
		const [type, name] = eventType.split(".")
		if (!this.eventTypes.includes(type)) {
			throw `Unknown bus event '${type}' for component ${this.name}`
		} else if (!callback) {
			delete this.events[eventType]
		} else if (typeof callback == "function") {
			if (eventType in this.events) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			this.events[eventType] = opts.timeout 
				? arg => setTimeout(() => callback(arg), opts.timeout) 
				: callback
		} else if (Array.isArray(callback)) {
			if (eventType in this.events) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			const wrapperFxn = arg => {
				for (const fxn of callback) fxn(arg)
			}
			this.events[eventType] = opts.timeout 
				? arg => setTimeout(() => wrapperFxn(arg), opts.timeout) 
				: wrapperFxn
		} else {
			throw `invalid callback for ${this.name} eventType=${eventType}`
		}
		return this
	}

	emit(eventType, arg = null) {
		setTimeout(() => {
			for (const type in this.events) {
				if (type == eventType || type.startsWith(eventType + ".")) {
					this.events[type](arg ? arg : this.defaultArg)
				}
			}
		}, 0)
		return this
	}
}
