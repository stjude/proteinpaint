// this module has no import, so that a reader of a module in an import cycle with utils.js can use it as it loads

/*
The files that a reader has opened, with their parsed index, which are kept for later reads, until the stamp of a
file changes, such as when its index or data file changes, or it is one of the files that have not been read for
the longest time.
*/
export class OpenFiles<T> {
	/** by the order of last use, the least recently used first */
	private files = new Map<string, { stamp: string; file: T }>()

	constructor(private maxFiles: number, private close: (file: T) => void) {}

	/** returns the open file of a key if it has the stamp; a file of another stamp is closed */
	get(key: string, stamp: string): T | undefined {
		const cached = this.files.get(key)
		if (!cached) return
		// a map keeps the order of insertion, so a file is moved to the end on each use
		this.files.delete(key)
		if (cached.stamp == stamp) {
			this.files.set(key, cached)
			return cached.file
		}
		this.close(cached.file)
	}

	set(key: string, stamp: string, file: T) {
		this.files.set(key, { stamp, file })
		for (const [k, old] of this.files) {
			if (this.files.size <= this.maxFiles) break
			this.files.delete(k)
			this.close(old.file)
		}
	}
}
