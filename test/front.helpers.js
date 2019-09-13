exports.serverData = {}

/*
	The exported getRide() test helper function tries to 
	reliably sequence UI tests primarily via postRender
	callbacks as emitted by an event bus. 

	The idea is to minimize the dependency on less reliable,
	timeout-based triggers of when to test UI elements, whereas
	a postRender event would only be called when the
	component of interest has been reached. If it is not
	called, then the issue is either due a missing event
	emitter or an upstream component not getting to the point
	of triggering the re-render of the current component.
*/

exports.getRide = function(opts) {
	"use strict"

	const priv = new RidePrivate(opts)

	const ride = {
		opts: Object.freeze(opts),

		// ride on the default event bus
		to(callback, after, wait = 0) {
			priv.addToThen(callback, after, Object.assign({}, ride.opts, { wait }))
			return ride
		},

		// ride on a substitute event bus, eventType, and/or argument
		sub(callback, after, opts) {
			priv.addToThen(callback, after, Object.assign({}, ride.opts, opts))
			return ride
		},

		// run callback without using bus, with or without timeout
		run(callback, after = 0) {
			priv.addRunThen(callback, after, ride.opts)
			return ride
		},

		// close the event bus
		done(callback = null) {
			priv.resolved.then(() => ride.opts.bus.on(ride.opts.eventType, null))
			if (callback) priv.resolved.then(callback)
			priv.resolved.catch(console.log)
			return ride
		}
	}

	return Object.freeze(ride)
}

// mutable but private access props and methods
class RidePrivate {
	constructor(opts) {
		this.validateOpts(opts)
		this.resolved = Promise.resolve()
	}

	validateOpts(opts) {
		try {
			if (opts.bus) {
				if (typeof opts.eventType !== "string") throw "invalid default.eventType"
				opts.bus.on(opts.eventType, null)
			}
		} catch {
			console.log(e)
		}
	}

	addToThen(callback, after, opts = {}) {
		if (opts.wait) {
			this.resolved = this.resolved.then(() => {
				return new Promise((resolve, reject) => {
					opts.bus.on(opts.eventType, () => {
						setTimeout(() => {
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

/*
	Bracket-scoped version of getRide(), where
	all methods are reused across public instances,
	which is negligibly better for performance, at
	the expense of readability. 

	*** To be deleted ***
	keeping this here for now, 
	for comparison/reference
*/

{
	exports.getRide_0 = function(opts) {
		"use strict"
		const ride = new RidePublic(opts)
		my.set(ride, new RidePrivate(ride))
		// if (debug) self.privates = privates.get(self)
		Object.freeze(ride)
		return ride
	}

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
}
