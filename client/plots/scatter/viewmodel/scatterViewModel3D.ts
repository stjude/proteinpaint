import { rgb } from 'd3-color'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import HelvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json'
import * as THREE from 'three'
import { scaleLinear as d3Linear } from 'd3-scale'
import { getContourImage } from '../../singleCellPlot.js'
import { ScatterViewModel } from './scatterViewModel.js'
import { getThreeCircle } from './scatterViewModel2DLarge.js'

export class ScatterViewModel3D extends ScatterViewModel {
	constructor(scatter) {
		super(scatter)
	}

	async renderSerie(chart) {
		const xAxisScale = d3Linear()
			.domain([this.model.range.xMin, this.model.range.xMax])
			.range([this.scatter.settings.showContour ? -1 : 0, 1])
		const yAxisScale = d3Linear()
			.domain([this.model.range.yMin, this.model.range.yMax])
			.range([this.scatter.settings.showContour ? -1 : 0, 1])
		const zAxisScale = chart.zAxisScale.range([0, 1])

		const vertices = []
		const colors = []

		for (const sample of chart.data.samples) {
			const opacity = this.model.getOpacity(sample)
			if (opacity == 0) continue
			const x = xAxisScale(sample.x)
			const y = yAxisScale(sample.y)
			const z = zAxisScale(sample.z)
			if (this.scatter.settings.showContour) z = 0
			const color = new THREE.Color(rgb(this.scatter.model.getColor(sample, chart)).toString())
			vertices.push(x, y, z)
			colors.push(color.r, color.g, color.b)
		}

		const OrbitControls = await import('three/addons/controls/OrbitControls.js')
		chart.chartDiv.selectAll('*').remove()
		this.canvas = this.view.dom.mainDiv.insert('div').style('display', 'inline-block').append('canvas').node()
		this.canvas.width = this.scatter.settings.svgw
		this.canvas.height = this.scatter.settings.svgh

		const fov = this.scatter.settings.fov
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()

		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor
		const tex = getThreeCircle(256)
		const material = new THREE.PointsMaterial({
			size: this.scatter.settings.threeSize * 8,
			sizeAttenuation: true,
			transparent: true,
			opacity: this.scatter.settings.opacity,
			map: tex,
			vertexColors: true
		})
		const controls = new OrbitControls.OrbitControls(camera, this.canvas)
		if (this.scatter.settings.showContour) this.renderContourMap(scene, camera, material, vertices, zAxisScale, chart)
		else {
			camera.position.set(1.5, 1.2, 1.8)
			camera.lookAt(scene.position)
			camera.updateMatrix()
			controls.update()
			const axesHelper = new THREE.AxesHelper(1)
			scene.add(axesHelper)
			if (this.scatter.settings.showAxes) {
				this.addLabels(scene, chart)
			}

			document.addEventListener(
				'wheel',
				event => {
					if (event.ctrlKey) event.preventDefault()
					controls.enableZoom = event.ctrlKey
				},
				{ passive: false }
			)

			const geometry = new THREE.BufferGeometry()
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
			geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
			const particles = new THREE.Points(geometry, material)
			scene.add(particles)
		}

		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.canvas, preserveDrawingBuffer: true })
		renderer.setSize(this.scatter.settings.svgw, this.scatter.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace

		//document.addEventListener( 'pointermove', onPointerMove );

		function animate() {
			requestAnimationFrame(animate)
			// required if controls.enableDamping or controls.autoRotate are set to true

			renderer.render(scene, camera)
		}
		animate()
		this.addLegendSVG(chart)
	}

	async renderContourMap(scene, camera, material, vertices, zAxisScale, chart) {
		const xAxisScale = d3Linear().domain([chart.xMin, chart.xMax]).range([0, this.scatter.settings.svgw])
		const yAxisScale = d3Linear().domain([chart.yMax, chart.yMin]).range([0, this.scatter.settings.svgh])
		const zCoords = chart.data.samples.map(s => zAxisScale(s.z))
		const colorGenerator = zAxisScale.copy().range(['#aaa', this.scatter.settings.defaultColor])
		const colors = this.scatter.config.colorTW
			? chart.data.samples.map(s => this.model.getColor(s, chart))
			: zCoords.map(z => colorGenerator(z))
		const colors3D = []
		for (const color of colors) {
			const color3D = new THREE.Color(color)
			colors3D.push(color3D.r, color3D.g, color3D.b)
		}
		camera.position.set(0, 0, 2.5) // Sets the position of the camera on the z axis, 2.5 units away from the scene/particles
		camera.lookAt(scene.position)

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors3D, 3))
		const particles = new THREE.Points(geometry, material)
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')
		const controls = new DragControls.DragControls([particles], camera, this.canvas)
		scene.add(particles)
		this.canvas.addEventListener('mousewheel', event => {
			if (!event.ctrlKey) return
			event.preventDefault()
			particles.position.z -= event.deltaY / 500
		})

		const data = chart.data.samples.map((s, i) => ({ x: xAxisScale(s.x), y: yAxisScale(s.y), z: zAxisScale(s.z) }))
		const width = this.scatter.settings.svgw
		const height = this.scatter.settings.svgh
		const imageUrl = getContourImage(
			data,
			width,
			height,
			this.scatter.settings.colorContours,
			this.scatter.settings.contourBandwidth,
			this.scatter.settings.contourThresholds
		)
		const loader = new THREE.TextureLoader()
		loader.load(imageUrl, texture => {
			// Create a plane geometry
			const geometry = new THREE.PlaneGeometry(2, 2)
			// Create a material using the loaded texture
			const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, color: 0x141414 })
			// Create a mesh with the geometry and material
			const plane = new THREE.Mesh(geometry, material)
			// Position the plane
			plane.position.z = 0 // Adjust z-position as needed
			// Add the plane to the scene
			scene.add(plane)
			chart.plane = plane
			particles.add(plane)
		})
	}

	async addLabels(scene) {
		const intensity = 0.7
		let textGeo = getTextGeo(this.scatter.config.term?.term?.name || 'X')
		let textMesh = new THREE.Mesh(
			textGeo,
			new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity / 4, intensity / 4) })
		)
		textMesh.position.x = 0.01
		textMesh.position.y = -0.03
		scene.add(textMesh)
		const ytext = this.scatter.config.term2?.term?.name || 'Y'
		textGeo = getTextGeo(ytext)
		textGeo.rotateZ(Math.PI / 2)
		textMesh = new THREE.Mesh(
			textGeo,
			new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity / 4, intensity, intensity / 4) })
		)
		textMesh.position.x = -0.03
		textMesh.position.y = 0.01
		scene.add(textMesh)
		const ztext = this.scatter.config.term0?.term?.name
		textGeo = getTextGeo(ztext)
		textGeo.rotateY(Math.PI / 2)
		textMesh = new THREE.Mesh(
			textGeo,
			new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity / 4, intensity / 4, intensity) })
		)
		textMesh.position.z = 0.98
		textMesh.position.y = -0.03
		scene.add(textMesh)
		function getTextGeo(text) {
			const loader = new FontLoader()
			const font = loader.parse(HelvetikerFont)

			const textGeo = new TextGeometry(text, {
				font,
				size: 0.02,
				height: 0.002,
				curveSegments: 8,
				bevelEnabled: false
			})

			return textGeo
		}
	}
}
