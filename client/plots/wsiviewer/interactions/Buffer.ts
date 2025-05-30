type Listener<T> = (newValue: T) => void

export class Buffer<T> {
	value: T
	private listeners = new Set<Listener<T>>()

	constructor(initialValue: T) {
		this.value = initialValue
	}

	set(newValue: T): void {
		if (newValue === this.value) return
		this.value = newValue
		this.listeners.forEach(listener => listener(newValue))
	}

	get(): T {
		return this.value
	}

	addListener(fn: Listener<T>): void {
		this.listeners.add(fn)
	}

	removeListener(fn: Listener<T>): void {
		this.listeners.delete(fn)
	}
}
