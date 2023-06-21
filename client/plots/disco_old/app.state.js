import { copyMerge } from '#rx'

/*
	State tracking to enable undo-redo button
	tracking is limited to types that can be
	JSON-stringify'd
*/

export default class AppState {
	getState() {
		for (const key in this.settings) {
			if (key.includes('.')) {
				delete this.settings[key]
			}
		}
		return this.settings
	}

	/*
		State changes without triggering instance main()
		Useful when multiple state key-values
		are changed, especially when one state
		key-value could affect another, prior 
		to calling dispatch
	*/
	setState(obj) {
		const s = this.settings
		for (const key in obj) {
			s[key] = obj[key]
		}
	}

	/*
		Track state, then trigger app
	*/
	dispatch(s = {}, type = '') {
		const obj = this.settings
		if (type == 'data') {
			obj.exampleName = s.dataName
			examples[s.dataName] = copyMerge({}, this.data, s)
		} else {
			for (const k in s) {
				switch (type) {
					case '+':
						obj[k] += s[k]
						break
					case '-':
						obj[k] += -s[k]
						break
					case '!':
						obj[k] = !obj[k]
						break
					default:
						obj[k] = this.isNumeric(obj[k]) ? +s[k] : s[k]
				}
			}
		}

		this.trackHistory()
		if (this.beforeMain) {
			this.beforeMain(obj)
		} else {
			this.main(obj)
		}
		this.settings.updateddata = false
	}

	trackHistory() {
		const h = this.history
		const i = this.historyIndex
		if (i < h.length - 1) {
			h.splice(i + 1)
		}

		for (const key in this.settings) {
			if (key.includes('.')) {
				delete this.settings[key]
			}
		}

		h.push(JSON.stringify(this.settings))
		if (h.length >= 30) {
			//buffer up to this # of steps back
			h.unshift()
		}
		this.historyIndex = h.length - 1
	}

	goToHistory(j = -1) {
		this.historyIndex += j
		const h = this.history
		let i = this.historyIndex

		if (i <= -1) {
			i = 0
		} else if (i > h.length - 1) {
			i = h.length - 1
		}

		if (!h[i]) return
		const repl = JSON.parse(h[i])
		// manually replace array values instead of deep extending
		for (const p in repl) {
			replaceArray(this.settings, repl, p)
		}
		copyMerge(this.settings, repl)
		if ('updateddata' in this.settings) {
			this.settings.updateddata = false
		}
		this.historyIndex = i
		if (this.beforeMain) {
			this.beforeMain(this.settings)
		} else {
			this.main()
		}
	}

	isNumeric(d) {
		return !isNaN(parseFloat(d)) && isFinite(d) && d !== ''
	}

	trackInArray(obj, keyArr, item) {
		let i = 0
		let leaf = obj
		for (const key of keyArr) {
			if (!leaf[key]) {
				leaf[key] = i == keyArr.length - 1 ? [] : {}
			}
			leaf = leaf[key]
			i++
			let a = 1
		}
		if (!leaf.includes(item)) {
			leaf.push(item)
		}
	}

	warn(opts) {
		/*
		opts={
			button: d3-wrapped button to display if there are warnings,
			menu: client Menu instance to display the list of warnings,
			listKey: data property to use for naming a warning item or row
		}
		*/

		let warnings
		let divOpen = false

		opts.button
			.style('display', 'none')
			.style('color', '#f00')
			.html('Warning/Errors')
			.on('click', () => {
				if (warnings.size == 0) {
					opts.button.style('display', 'none')
					return
				} else if (divOpen) {
					opts.button.style('color', '')
					opts.menu.d.style('display', 'none')
					divOpen = false
					return
				}

				opts.menu.showunder(opts.button.node())

				let html = '<h5>Warning/Errors in ' + opts.heading + ' data</h5>'
				warnings.forEach((val, id) => {
					html += '<li>' + id + ': ' + val.join(',') + '</li>'
				})

				opts.menu.d.html(html)
				opts.menu.d.style('display', '')
				divOpen = true
			})

		opts.menu.d.on('click', () => {
			opts.button.style('color', '')
			opts.menu.d.style('display', 'none')
			divOpen = false
		})

		return {
			clear() {
				warnings = new Map()
				opts.button.style('display', 'none')
			},
			detect(d) {
				opts.required.forEach(key => {
					if (d[key]) return
					const id = d[opts.listKey]
					if (!warnings.has(id)) warnings.set(id, [])
					const w = warnings.get(id)
					if (!w.includes(key)) w.push(key)
				})
			},
			push(id, mssg) {
				if (!warnings.has(id)) warnings.set(id, [])
				const w = warnings.get(id)
				if (!w.includes(mssg)) w.push(mssg)
			},
			display() {
				opts.button.style('display', warnings.size == 0 ? 'none' : '')
			}
		}
	}
}

function replaceArray(orig, repl, key) {
	if (Array.isArray(orig[key])) {
		orig[key] = repl[key]
	} else if (typeof repl[key] == 'object') {
		for (const p in repl[key]) {
			replaceArray(orig[key], repl[key], p)
		}
	}
}
