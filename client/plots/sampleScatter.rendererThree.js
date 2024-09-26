import { rgb } from 'd3-color'
import { roundValue } from '#shared/roundValue.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import HelvetikerFont from 'three/examples/fonts/helvetiker_regular.typeface.json'
import * as THREE from 'three'

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
		camera.position.set(0, 0, 1)
		camera.lookAt(scene.position)
		camera.updateMatrix()
		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor

		const geometry = new THREE.BufferGeometry()
		const pointer = new THREE.Vector2()
		const { vertices, colors } = getVertices()

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
		const tex = getCircle(128)
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
		renderer.setPixelRatio(window.devicePixelRatio)

		const controls = new DragControls.DragControls([particles], camera, renderer.domElement)

		document.addEventListener('mousewheel', event => {
			if (event.ctrlKey) camera.position.z += event.deltaY / 500
		})

		function getVertices() {
			const vertices = []
			const colors = []
			for (const sample of chart.data.samples) {
				const opacity = self.getOpacity(sample)
				if (opacity == 0) continue
				let x = (chart.xAxisScale(sample.x) - chart.xScaleMin) / self.canvas.width
				let y = (chart.yAxisScale(sample.y) - chart.yScaleMax) / -self.canvas.height
				let z = (chart.zAxisScale(sample.z) - chart.zScaleMin) / self.settings.svgd
				vertices.push(x - 0.5, y + 0.7, z)
				const color = new THREE.Color(rgb(self.getColor(sample, chart)).toString())
				colors.push(color.r, color.g, color.b)
			}
			return { vertices, colors }
		}

		function getCircle(size) {
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

		function animate() {
			requestAnimationFrame(animate)
			camera.zoom = self.zoom
			camera.updateProjectionMatrix()
			renderer.render(scene, camera)
		}
		animate()
	}

	self.render3DSerie = async function (chart) {
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
			.attr('width', self.settings.svgw)
			.attr('height', self.settings.svgh)
			.append('g')
			.attr('transform', 'translate(20, 20)')
		self.renderLegend(chart)
		const fov = self.settings.fov
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()
		const controls = new OrbitControls.OrbitControls(camera, self.canvas)
		controls.enableZoom = false
		controls.update()
		camera.position.set(1.5, 0.5, 2)
		camera.lookAt(scene.position)

		if (self.settings.showAxes) {
			const axesHelper = new THREE.AxesHelper(1)
			scene.add(axesHelper)
			self.addLabels(scene, chart)

			// const grid = new THREE.GridHelper(1)
			// grid.position.x = 0.5
			// grid.position.z = 0.5
			// scene.add(grid)
		}
		camera.updateMatrix()
		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor

		const light = new THREE.DirectionalLight(whiteColor, 2)
		light.position.set(0.1, 0.1, 2)
		scene.add(light)
		const geometry = new THREE.SphereGeometry(0.005, 32)
		for (const sample of chart.data.samples) {
			const opacity = self.getOpacity(sample)
			if (opacity == 0) continue
			let x = chart.xMax == chart.xMin ? 0 : Math.abs((sample.x - chart.xMin) / (chart.xMax - chart.xMin))
			let y = chart.yMax == chart.yMin ? 0 : Math.abs((sample.y - chart.yMin) / (chart.yMax - chart.yMin))
			let z = chart.zMax == chart.zMin ? 0 : Math.abs((sample.z - chart.zMin) / (chart.zMax - chart.zMin))
			const color = new THREE.Color(rgb(self.getColor(sample, chart)).toString())
			const material = new THREE.MeshLambertMaterial({ color })
			const circle = new THREE.Mesh(geometry, material)
			scene.add(circle)
			circle.position.set(x, y, z)
			scene.add(circle)
		}

		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: self.canvas, preserveDrawingBuffer: true })
		renderer.setPixelRatio(window.devicePixelRatio)
		//document.addEventListener( 'pointermove', onPointerMove );
		document.addEventListener('mousewheel', event => {
			controls.enableZoom = event.ctrlKey
		})
		function animate() {
			requestAnimationFrame(animate)
			// required if controls.enableDamping or controls.autoRotate are set to true
			controls.update()

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
				height: 0.005,
				curveSegments: 8,
				bevelEnabled: false
			})

			return textGeo
		}
	}
}

function onPointerMove(event) {
	const x = (event.clientX / window.innerWidth) * 2 - 1
	const y = -(event.clientY / window.innerHeight) * 2 + 1
	console.log(roundValue(x, 1), roundValue(y, 1))
}
