import { rgb } from 'd3-color'
import * as THREE from 'three'
import { ScatterViewModel } from './scatterViewModel.js'

export class ScatterViewModel2DLarge extends ScatterViewModel {
	private rafId: number | null = null
	private renderer: THREE.WebGLRenderer | null = null
	private mousewheelHandler: ((event: any) => void) | null = null

	constructor(scatter) {
		super(scatter)
	}

	async renderSerie(chart) {
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')

		this.view.dom.mainDiv.selectAll('*').remove()

		this.canvas = this.view.dom.mainDiv.insert('div').style('display', 'inline-block').append('canvas').node()
		this.canvas.width = this.scatter.settings.svgw
		this.canvas.height = this.scatter.settings.svgh
		chart.chartDiv.style('margin', '20px 20px')

		const fov = this.scatter.settings.threeFOV
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()
		camera.position.set(0, 0, 1.5)
		camera.lookAt(scene.position)
		camera.updateMatrix()
		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor

		const geometry = new THREE.BufferGeometry()
		const { vertices, colors } = this.getVertices(chart)

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
		const tex = getThreeCircle(128)
		const material = new THREE.PointsMaterial({
			size: this.scatter.settings.threeSize,
			sizeAttenuation: true,
			transparent: true,
			opacity: this.scatter.settings.opacity,
			map: tex,
			vertexColors: true
		})

		const particles = new THREE.Points(geometry, material)

		scene.add(particles)
		this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas, preserveDrawingBuffer: true })
		this.renderer.setSize(this.scatter.settings.svgw, this.scatter.settings.svgh)
		this.renderer.setPixelRatio(window.devicePixelRatio)

		new DragControls.DragControls([particles], camera, this.renderer.domElement)

		this.mousewheelHandler = (event: any) => {
			if (event.ctrlKey) camera.position.z += event.deltaY / 500
		}
		document.addEventListener('mousewheel', this.mousewheelHandler)

		this.addLegendSVG(chart)
		this.animate(camera, scene, this.renderer)
	}

	animate(camera, scene, renderer) {
		this.rafId = requestAnimationFrame(() => this.animate(camera, scene, renderer))
		camera.zoom = this.scatter.vm.scatterZoom.zoom
		camera.updateProjectionMatrix()
		renderer.render(scene, camera)
	}

	dispose() {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId)
			this.rafId = null
		}
		if (this.mousewheelHandler) {
			document.removeEventListener('mousewheel', this.mousewheelHandler)
			this.mousewheelHandler = null
		}
		if (this.renderer) {
			this.renderer.dispose()
			this.renderer = null
		}
	}

	getVertices(chart) {
		const xAxisScale = chart.xAxisScale.range([-1, 1])
		const yAxisScale = chart.yAxisScale.range([-1, 1])
		const vertices: any = []
		const colors: any = []
		for (const sample of chart.data.samples) {
			const opacity = this.model.getOpacity(sample)
			if (opacity == 0) continue
			const x = xAxisScale(sample.x)
			const y = yAxisScale(sample.y)
			const z = 0
			vertices.push(x, y, z)
			const color = new THREE.Color(rgb(this.model.getColor(sample, chart)).toString())
			colors.push(color.r, color.g, color.b)
		}
		return { vertices, colors }
	}
}

export function getThreeCircle(size) {
	const c = document.createElement('canvas')
	c.width = size
	c.height = size
	const ctx: any = c.getContext('2d')
	ctx.clearRect(0, 0, size, size)
	ctx.fillStyle = 'white'
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
	ctx.fill()
	const tex = new THREE.CanvasTexture(c)
	return tex
}
