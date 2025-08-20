export function deepEqual(x, y) {
	if (x === y) {
		return true
	} else if (typeof x == 'object' && x != null && typeof y == 'object' && y != null) {
		if (Object.keys(x).length != Object.keys(y).length) {
			return false
		}
		const xKeys = Object.keys(x)
		const yKeys = Object.keys(y)
		for (const prop of xKeys) {
			if (yKeys.includes(prop)) {
				if (!deepEqual(x[prop], y[prop])) return false
			} else {
				return false
			}
		}
		return true
	} else return false
}

export function deepFreeze(obj) {
	Object.freeze(obj)
	for (const key in obj) {
		if (typeof obj == 'object') deepFreeze(obj[key])
	}
}

export async function notifyComponents(components, current) {
	if (!components) return // allow component-less app
	const called = []

	for (const name of Object.keys(components)) {
		// when components is array, name will be index
		const component = components[name]
		if (Array.isArray(component)) {
			for (const c of component) called.push(c.update(current))
		} else if (Object.keys(component).includes('update')) {
			called.push(component.update(current))
		} else if (component && typeof component == 'object' && !component.main) {
			for (const subname of Object.keys(component)) {
				if (typeof component[subname].update == 'function') {
					called.push(component[subname].update(current))
				}
			}
		}
	}
	return Promise.all(called)
}
