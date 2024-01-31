import { rgb } from 'd3-color'
import roundValue from '#shared/roundValue'

export function setRenderersThree(self) {
	self.render2DSerieLarge = async function (chart) {
		const THREE = await import('three')
		const DragControls = await import('three/examples/jsm/controls/DragControls.js')

		chart.chartDiv.selectAll('*').remove()

		self.canvas = chart.chartDiv.append('div').style('display', 'inline-block').append('canvas').node()
		self.canvas.width = self.settings.svgw * 1.5
		self.canvas.height = self.settings.svgh * 1.5
		chart.chartDiv.style('margin', '20px 20px')
		chart.legendDiv = chart.chartDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		chart.legendG = chart.legendDiv
			.append('svg')
			.attr('width', self.settings.svgw / 2)
			.attr('height', self.settings.svgh * 1.5)
			.append('g')
			.attr('transform', 'translate(20, 20)')
		self.renderLegend(chart)

		const fov = 50
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
			size: 0.001,
			sizeAttenuation: true,
			transparent: true,
			opacity: self.settings.opacity,
			map: tex,
			vertexColors: true
		})

		const particles = new THREE.Points(geometry, material)

		scene.add(particles)
		const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: self.canvas, preserveDrawingBuffer: true })
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
				vertices.push(x - 0.5, y + 0.5, z)
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
		const THREE = await import('three')
		const OrbitControls = await import('three/addons/controls/OrbitControls.js')
		chart.chartDiv.selectAll('*').remove()
		self.canvas = chart.chartDiv.append('div').style('display', 'inline-block').append('canvas').node()
		self.canvas.width = self.settings.svgw
		self.canvas.height = self.settings.svgh
		chart.chartDiv.style('margin', '20px 20px')
		chart.legendDiv = chart.chartDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		chart.legendG = chart.legendDiv
			.append('svg')
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
		controls.update()
		camera.position.set(0.1, 0.1, 2)
		camera.lookAt(scene.position)

		if (self.settings.showAxes) {
			const axesHelper = new THREE.AxesHelper(1)
			scene.add(axesHelper)
			const grid = new THREE.GridHelper(1)
			grid.position.x = 0.5
			grid.position.z = 0.5
			scene.add(grid)
		}
		camera.updateMatrix()
		const whiteColor = new THREE.Color('rgb(255,255,255)')
		scene.background = whiteColor

		const light = new THREE.DirectionalLight(whiteColor, 2)
		light.position.set(1, 1, 1)
		scene.add(light)
		const geometry = new THREE.SphereGeometry(0.005, 32)
		for (const sample of chart.data.samples) {
			const opacity = self.getOpacity(sample)
			if (opacity == 0) continue
			let x = chart.xMax == chart.xMin ? 0 : Math.abs((sample.x - chart.xMin) / (chart.xMax - chart.xMin))
			let y = chart.yMax == chart.yMin ? 0 : Math.abs((sample.y - chart.yMin) / (chart.yMax - chart.yMin))
			let z = chart.zMax == chart.zMin ? 0 : Math.abs((sample.z - chart.zMin) / (chart.zMax - chart.zMin))
			console.log(roundValue(y, 2))
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

		function animate() {
			requestAnimationFrame(animate)
			// required if controls.enableDamping or controls.autoRotate are set to true
			controls.update()

			renderer.render(scene, camera)
		}
		animate()
	}
}

function onPointerMove(event) {
	const x = (event.clientX / window.innerWidth) * 2 - 1
	const y = -(event.clientY / window.innerHeight) * 2 + 1
	console.log(roundValue(x, 1), roundValue(y, 1))
}
