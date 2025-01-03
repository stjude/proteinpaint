import { rgb } from 'd3-color'
import { createDensityMap, getContourImage } from './singleCellPlot.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import HelvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json'
import * as THREE from 'three'
import { scaleLinear as d3Linear } from 'd3-scale'

export function setRenderersThree(self) {
	self.render2DSerieLarge = async function (chart) {
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')

		self.mainDiv.selectAll('*').remove()

		self.canvas = self.mainDiv.insert('div').style('display', 'inline-block').append('canvas').node()
		self.canvas.width = self.settings.svgw
		self.canvas.height = self.settings.svgh
		chart.chartDiv.style('margin', '20px 20px')
		chart.legendDiv = self.mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		let step = Math.min((20 * 40) / chart.colorLegend.size, 20)
		if (step < 12) step = 12
		const height = (chart.colorLegend.size + 6) * step
		chart.legendG = chart.legendDiv
			.append('svg')
			.attr('width', self.settings.svgw / 2)
			.attr('height', height)
			.append('g')
			.attr('transform', 'translate(20, 0)')
		self.renderLegend(chart, step)

		const fov = self.settings.threeFOV
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
		const { vertices, colors } = getVertices()

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
		const tex = getThreeCircle(128)
		const material = new THREE.PointsMaterial({
			size: self.settings.threeSize,
			sizeAttenuation: true,
			transparent: true,
			opacity: self.settings.opacity,
			map: tex,
			vertexColors: true
		})

		const particles = new THREE.Points(geometry, material)

		scene.add(particles)
		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: self.canvas, preserveDrawingBuffer: true })
		renderer.setSize(self.settings.svgw, self.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)

		const controls = new DragControls.DragControls([particles], camera, renderer.domElement)

		document.addEventListener('mousewheel', event => {
			if (event.ctrlKey) camera.position.z += event.deltaY / 500
		})

		function getVertices() {
			const xAxisScale = chart.xAxisScale.range([-1, 1])
			const yAxisScale = chart.yAxisScale.range([-1, 1])
			const vertices = []
			const colors = []
			for (const sample of chart.data.samples) {
				const opacity = self.getOpacity(sample)
				if (opacity == 0) continue
				let x = xAxisScale(sample.x)
				let y = yAxisScale(sample.y)
				let z = 0
				vertices.push(x, y, z)
				const color = new THREE.Color(rgb(self.getColor(sample, chart)).toString())
				colors.push(color.r, color.g, color.b)
			}
			return { vertices, colors }
		}

		function animate() {
			requestAnimationFrame(animate)
			camera.zoom = self.zoom
			camera.updateProjectionMatrix()
			renderer.render(scene, camera)
		}
		animate()
	}

	self.render3DSerie = async function (chart) {
		const xAxisScale = chart.xAxisScale.range([self.settings.showContour ? -1 : 0, 1])
		const yAxisScale = chart.yAxisScale.range([self.settings.showContour ? -1 : 0, 1])
		const zAxisScale = chart.zAxisScale.range([0, 1])

		const vertices = []
		const colors = []
		let maxZ = 0
		for (const sample of chart.data.samples) {
			const opacity = self.getOpacity(sample)
			if (opacity == 0) continue
			let x = xAxisScale(sample.x)
			let y = yAxisScale(sample.y)
			let z = zAxisScale(sample.z)
			if (z > maxZ) maxZ = z
			if (self.settings.showContour) z = 0
			const color = new THREE.Color(rgb(self.getColor(sample, chart)).toString())
			vertices.push(x, y, z)
			colors.push(color.r, color.g, color.b)
		}

		const OrbitControls = await import('three/addons/controls/OrbitControls.js')
		chart.chartDiv.selectAll('*').remove()
		self.canvas = self.mainDiv.insert('div').style('display', 'inline-block').append('canvas').node()
		self.canvas.width = self.settings.svgw
		self.canvas.height = self.settings.svgh

		chart.chartDiv.style('margin', '20px 20px')
		chart.legendDiv = self.mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		chart.legendG = chart.legendDiv
			.append('svg')
			.attr('width', self.settings.svgw / 2)
			.attr('height', self.settings.svgh)
			.append('g')
			.attr('transform', 'translate(20, 20)')
		self.renderLegend(chart)
		const fov = self.settings.fov
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()

		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor
		const tex = getThreeCircle(256)
		const material = new THREE.PointsMaterial({
			size: self.settings.threeSize * 4,
			sizeAttenuation: true,
			transparent: true,
			opacity: self.settings.opacity,
			map: tex,
			vertexColors: true
		})

		if (self.settings.showContour)
			self.renderContourMap(scene, camera, material, vertices, chart, xAxisScale, yAxisScale, zAxisScale, maxZ)
		else {
			camera.position.set(1, 1, 2)
			camera.lookAt(scene.position)
			camera.updateMatrix()
			const controls = new OrbitControls.OrbitControls(camera, self.canvas)
			controls.enableZoom = false
			controls.update()

			if (self.settings.showAxes) {
				const axesHelper = new THREE.AxesHelper(1)
				scene.add(axesHelper)
				self.addLabels(scene, chart)
			}

			const geometry = new THREE.BufferGeometry()
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
			geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
			const particles = new THREE.Points(geometry, material)
			scene.add(particles)
			document.addEventListener('mousewheel', event => {
				controls.enableZoom = event.ctrlKey
			})
		}
		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: self.canvas, preserveDrawingBuffer: true })
		renderer.setSize(self.settings.svgw, self.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)
		//document.addEventListener( 'pointermove', onPointerMove );

		function animate() {
			requestAnimationFrame(animate)
			// required if controls.enableDamping or controls.autoRotate are set to true

			renderer.render(scene, camera)
		}
		animate()
	}

	self.addLabels = async function (scene) {
		const intensity = 0.7
		let textGeo = getTextGeo(self.config.term.term.name)
		let textMesh = new THREE.Mesh(
			textGeo,
			new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity / 4, intensity / 4) })
		)
		textMesh.position.x = 0.01
		textMesh.position.y = -0.03
		scene.add(textMesh)

		textGeo = getTextGeo(self.config.term2.term.name)
		textGeo.rotateZ(Math.PI / 2)
		textMesh = new THREE.Mesh(
			textGeo,
			new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity / 4, intensity, intensity / 4) })
		)
		textMesh.position.x = -0.03
		textMesh.position.y = 0.01
		scene.add(textMesh)

		textGeo = getTextGeo(self.config.term0.term.name)
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

	self.renderContourMap = async function (
		scene,
		camera,
		material,
		vertices,
		chart,
		xAxisScale,
		yAxisScale,
		zAxisScale,
		maxZ
	) {
		const colorGenerator = d3Linear().domain([0, maxZ]).range(['#aaa', this.settings.defaultColor])
		const colors = chart.data.samples.map(s => colorGenerator(s.z))
		const colors3D = []
		for (const color of colors) {
			const color3D = new THREE.Color(color)
			colors3D.push(color3D.r, color3D.g, color3D.b)
		}
		camera.position.set(0, 0, 2.5)
		camera.lookAt(scene.position)
		const gridSize = this.settings.contourGridSize
		const xyCoords = chart.data.samples.map((s, i) => [xAxisScale(s.x), -yAxisScale(s.y)])
		const zCoords = chart.data.samples.map(s => zAxisScale(s.z))
		const densityMap = createDensityMap(xyCoords, zCoords, gridSize, chart)
		const thresholds = this.settings.contourThresholds
		const width = this.settings.svgw
		const height = this.settings.svgh
		const imageUrl = getContourImage(densityMap, width, height, thresholds, gridSize, gridSize)
		const loader = new THREE.TextureLoader()
		loader.load(imageUrl, texture => {
			// Create a plane geometry
			const geometry = new THREE.PlaneGeometry(2, 2)
			// Create a material using the loaded texture
			const material = new THREE.MeshBasicMaterial({ map: texture })
			// Create a mesh with the geometry and material
			const plane = new THREE.Mesh(geometry, material)
			// Position the plane
			plane.position.z = 0 // Adjust z-position as needed
			// Add the plane to the scene
			scene.add(plane)
			chart.plane = plane
		})

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors3D, 3))
		const particles = new THREE.Points(geometry, material)
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')
		const controls = new DragControls.DragControls([particles], camera, self.canvas)
		scene.add(particles)
		let isDragging = false
		self.canvas.addEventListener('mousedown', () => (isDragging = true))

		self.canvas.addEventListener('mousemove', event => {
			if (!isDragging) return
			chart.plane.position.set(particles.position.x, particles.position.y, particles.position.z)
		})
		self.canvas.addEventListener('mousewheel', event => {
			if (!event.ctrlKey) return
			event.preventDefault()
			particles.position.z -= event.deltaY / 500
			chart.plane.position.z = particles.position.z
		})
	}
}

export function getThreeCircle(size) {
	const c = document.createElement('canvas')
	c.width = size
	c.height = size
	const ctx = c.getContext('2d')
	ctx.clearRect(0, 0, size, size)
	ctx.fillStyle = 'white'
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
	ctx.fill()
	const tex = new THREE.CanvasTexture(c)
	return tex
}
