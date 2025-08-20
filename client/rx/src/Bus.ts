/*
	A Bus instance will be its own api,
	since it does not have a getApi() method.
	Instead, the mutable Bus instance will be hidden via the
	component.api.on() method.
*/

export class Bus {
	name: string
	/** 
	 	eventTypes[] 
			- the events that this component wants to emit
			- e.g. ['postInit', 'postRender', 'postClick']
			- must not be namespaced
			- later, api.on() can use namespaced eventTypes
	*/
	eventTypes: string[]

	events: {
		postInit?: (api: any) => void
		firstRender?: (api: any) => void
		postRender?: (api: any) => void
		//[eventName: string]?: (api: any) => void
	}

	defaultArg: any

	constructor(api, eventTypes, callbacks) {
		/*
			api{} 
			- the immutable api of the app or component
			
			

			callbacks{}
			- any event listeners to set-up for this component 
			- key: eventType, value: callback

		*/
		this.name = api.type + (api.id === undefined || api.id === null ? '' : '#' + api.id)
		this.eventTypes = eventTypes
		this.events = {}
		this.defaultArg = api
		if (callbacks) {
			for (const [eventType, callback] of Object.entries(callbacks)) {
				this.on(eventType, callback)
			}
		}
	}

	on(eventType, callback, opts: { wait?: number; [optsName: string]: any } = {}) {
		/*
		assign or delete a callback for an event

		eventType
		- must match one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"
		- any previous event-attached callbacks will be REPLACED in this bus 
		  when the same eventType is used as an argument again -- same behavior
		  as a DOM event listener namespacing and replacement

		callback
		- function. if missing will delete the eventType from bus

		opts{}
		- optional callback configuration, such as
		.wait // to delay callback  
		*/
		const type = eventType.split('.').shift()
		if (!this.eventTypes.includes(type)) {
			throw `Unknown bus event '${type}' for component ${this.name}`
		} else if (!callback) {
			delete this.events[eventType]
		} else if (typeof callback == 'function') {
			if (eventType in this.events && !eventType.includes('.')) {
				console.log(`Warning: replacing ${this.name} ${eventType} callback - use event.name?`)
			}
			this.events[eventType] = opts.wait ? arg => setTimeout(() => callback(arg), opts.wait) : callback
		} else {
			throw `invalid callback for ${this.name} eventType=${eventType}`
		}
		return this
	}

	emit(eventType, arg = null, wait = 0, error = null) {
		/*
		eventType
		- must be one of the eventTypes supplied to the Bus constructor
		- maybe be namespaced or not, example: "postRender.test" or "postRender"

		arg
		- optional: the argument to supply to the callback
		  if null or undefined, will use constructor() opts.defaultArg instead

		wait
		- optional delay in calling the callback
	*/
		setTimeout(() => {
			for (const type of Object.keys(this.events)) {
				if (eventType == 'postRender' && type.startsWith('firstRender')) {
					this.events[type](arg || this.defaultArg, error)
					delete this.events[type]
				}

				if (type == eventType || type.startsWith(eventType + '.')) {
					this.events[type](arg || this.defaultArg, error)
					if (eventType == 'postInit') delete this.events[type]
				}
			}
		}, wait)
		return this
	}

	destroy() {
		for (const key in this.events) {
			delete this.events[key]
		}
	}
}
