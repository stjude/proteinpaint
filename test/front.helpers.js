exports.serverData = {}

exports.ride = function(bus, eventType, arg, wait = 0) {
	/*
	bus         an event bus returned by client.get_event_bus()
	eventType   a valid eventType for the bus argument
	arg         the argument to supply to the to() callback
	wait        optional wait time before callback on bus.event
*/
	bus.on(eventType, null)
	let resolved = Promise.resolve()

	const ride = {
		do(callback, after, owait = 0) {
			/*
			callback	function to be supplied with (arg)
			after     integer timeout OR a callback function for bus eventType
		*/
			if (typeof after == "number") {
				resolved = resolved.then(() => {
					bus.on(eventType, null)
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							//console.log('---- timeout --- ', after, after.name, callback.name)
							callback(arg)
							resolve()
						}, after)
					})
				})
			} else if (typeof after == "function") {
				if (owait || wait) {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								setTimeout(() => {
									//console.log('---- on emit --- ', wait, after.name, callback.name)
									bus.on(eventType, null)
									callback(arg)
									resolve()
								}, owait || wait)
							})
							after(arg)
						})
					})
				} else {
					resolved = resolved.then(() => {
						return new Promise((resolve, reject) => {
							bus.on(eventType, () => {
								//console.log('----- on emit --- ', after.name, callback.name)
								bus.on(eventType, null)
								callback(arg)
								resolve()
							})
							after(arg)
						})
					})
				}
			} else {
				resolved = resolved.then(() => {
					bus.on(eventType, null)
					callback(arg)
				})
			}
			return ride
		},
		off(callback) {
			resolved
				.then(() => {
					bus.on(eventType, null)
					if (callback) callback()
				})
				.catch(e => console.log(e))
		}
	}

	return ride
}

function frozenInstanceGetter(privates, classPublic, classPrivate = null) {
	return opts => {
		const self = new classPublic(opts)
		if (classPrivate) {
			privates.set(self, new classPrivate(self))
			// if (debug) self.privates = privates.get(self)
		}
		Object.freeze(self)
		return self
	}
}

{
	// tracker for a public instance's corresponding
	// private properties and methds
	const my = new WeakMap()

	/*
		Frozen ride with publicly accessible props and methods
		opts {}        
		.bus         an event bus returned by client.get_event_bus()
		.eventType   a valid eventType for the bus argument
		.arg         the argument to supply to the to() callback
		.wait        optional wait time before callback on bus.event
	*/
	class RidePublic {
		constructor(opts) {
			try {
				if (opts.bus) {
					if (typeof opts.eventType !== "string") throw "invalid default.eventType"
					opts.bus.on(opts.eventType, null)
				}
				this.opts = Object.freeze(opts)
			} catch {
				console.log(e)
			}
		}

		// ride on the default event bus
		to(callback, after, wait = 0) {
			my.get(this).addToThen(callback, after, Object.assign({}, this.opts, { wait }))
			return this
		}

		// ride on a substitute event bus, eventType, and/or argument
		sub(callback, after, opts) {
			my.get(this).addToThen(callback, after, Object.assign({}, this.opts, opts))
			return this
		}

		// run callback without using bus, with or without timeout
		run(callback, after = 0) {
			my.get(this).addRunThen(callback, after, this.opts)
			return this
		}

		// close the event bus
		done(callback = null) {
			my.get(this).resolved.then(() => this.opts.bus.on(this.opts.eventType, null))
			if (callback) my.get(this).resolved.then(callback)
			my.get(this).resolved.catch(console.log)
			return this
		}
	}

	// mutable but private access props and methods
	class RidePrivate {
		constructor(frozen) {
			this.frozen = frozen
			this.resolved = Promise.resolve()
		}

		addToThen(callback, after, opts = {}) {
			if (opts.wait) {
				this.resolved = this.resolved.then(() => {
					return new Promise((resolve, reject) => {
						opts.bus.on(opts.eventType, () => {
							setTimeout(() => {
								//console.log('---- on emit --- ', wait, after.name, callback.name)
								opts.bus.on(opts.eventType, null)
								callback(opts.arg)
								resolve()
							}, opts.wait)
						})
						after(opts.arg)
					})
				})
			} else {
				this.resolved = this.resolved.then(() => {
					return new Promise((resolve, reject) => {
						opts.bus.on(opts.eventType, () => {
							//console.log('----- on emit --- ', after.name, callback.name)
							opts.bus.on(opts.eventType, null)
							callback(opts.arg)
							resolve()
						})
						after(opts.arg)
					})
				})
			}
		}

		addRunThen(callback, after, opts) {
			if (typeof after == "number") {
				this.resolved = this.resolved.then(() => {
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							//console.log('---- timeout --- ', after, after.name, callback.name)
							callback(opts.arg)
							resolve()
						}, after)
					})
				})
			} else {
				this.resolved = this.resolved.then(() => {
					callback(opts.arg)
				})
			}
		}
	}

	exports.getRide = frozenInstanceGetter(my, RidePublic, RidePrivate)
}
