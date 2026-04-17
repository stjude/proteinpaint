import { zoom, icons, svgScroll } from '#dom'
import type { MatrixControls } from './matrix.controls'

export function setZoomInput(self: MatrixControls) {
	const holder = self.opts.holder.append('div').style('display', 'inline-block').style('margin-left', '50px')
	const s = self.parent.settings.matrix || self.parent.config.settings.matrix
	self.zoomApi = zoom({
		holder,
		title:
			'Zoom factor relative to the ideal column width, as computed for the number of columns versus available screen width',
		unit: '',
		width: '80px',
		settings: {
			min: 0.1, // will be determined once the auto-computed width is determined
			max: 1, // will be determined once the auto-computed width is determined
			value: 1,
			increment: s.zoomIncrement,
			step: s.zoomStep || 5
		},
		callback: (zoomLevel: any) => {
			const p = self.parent
			const c = p.getVisibleCenterCell(0)
			p.app.dispatch({
				type: 'plot_edit',
				id: p.id,
				config: {
					settings: {
						matrix: {
							zoomLevel,
							zoomCenterPct: 0.5,
							zoomIndex: c.totalIndex,
							zoomGrpIndex: c.grpIndex
						}
					}
				}
			})
		},
		reset: () => {
			self.parent.app.dispatch({
				type: 'plot_edit',
				id: self.parent.id,
				config: {
					settings: {
						matrix: {
							zoomLevel: 1,
							zoomCenterPct: 0
						}
					}
				}
			})
		}
	})
}

export function setDragToggle(self: MatrixControls, opts: any = {}) {
	const defaults = {
		mouseMode: 'select',
		activeBgColor: 'rgb(255, 255, 255)'
	}

	// hardcode to always be in select mode on first render
	opts.target.style('cursor', 'default')

	const instance: any = {
		opts: Object.assign({}, defaults, opts),
		dom: {
			selectBtn: opts.holder
				.append('button')
				.attr('aria-label', 'Click the matrix to select data')
				.style('display', 'inline-block')
				.style('width', '25px')
				.style('height', '24.5px')
				.style('background-color', defaults.activeBgColor)
				.on('click', () => setMode('select')),

			grabBtn: opts.holder
				.append('button')
				.attr('aria-label', 'Click the matrix to drag and move')
				.style('display', 'inline-block')
				.style('width', '25px')
				.style('height', '24.5px')
				.on('click', () => setMode('pan'))
		}
	}

	icons.arrowPointer(instance.dom.selectBtn, { width: 14, height: 14, transform: 'translate(50,50)' })
	icons.grab(instance.dom.grabBtn, { width: 14, height: 14, transform: 'translate(30,50)' })

	function setMode(m: string) {
		instance.opts.mouseMode = m
		self.parent.settings.matrix.mouseMode = m
		opts.target.style('cursor', m == 'select' ? 'default' : 'grab')
		instance.dom.selectBtn.style('background-color', m == 'select' ? instance.opts.activeBgColor : '')
		instance.dom.grabBtn.style('background-color', m == 'pan' ? instance.opts.activeBgColor : '')
	}

	// NOTE:
	self.dragToggleApi = {
		update(s: any = {}) {
			Object.assign(instance.opts, s)
			setMode(instance.opts.mouseMode)
		},
		getSettings() {
			return {
				mouseMode: instance.opts.mouseMode
			}
		}
	}
}

export function setSvgScroll(self: MatrixControls, state: any) {
	self.svgScrollApi = svgScroll({
		holder: self.parent.dom.scroll,
		height: state.config.settings.matrix.scrollHeight,
		callback: (dx: number, eventType: string) => {
			const p = self.parent
			const s = p.settings.matrix
			const d = p.dimensions
			if (eventType == 'move') {
				p.dom.seriesesG.attr('transform', `translate(${d.xOffset + d.seriesXoffset - dx},${d.yOffset})`)
				p.clusterRenderer.translateElems(-dx, s, d)
				p.layout.top.attr.adjustBoxTransform(-dx)
				p.layout.btm.attr.adjustBoxTransform(-dx)
				if (p.dom.topDendrogram) {
					p.dom.topDendrogram.attr('transform', `translate(${p.topDendroX - dx},0)`)
				}
			} else if (eventType == 'up') {
				const c = p.getVisibleCenterCell(-dx)
				p.app.dispatch({
					type: 'plot_edit',
					id: p.id,
					config: {
						settings: {
							matrix: {
								zoomCenterPct: 0.5,
								zoomIndex: c.totalIndex,
								zoomGrpIndex: c.grpIndex
							}
						}
					}
				})
			}
		}
	})
}
