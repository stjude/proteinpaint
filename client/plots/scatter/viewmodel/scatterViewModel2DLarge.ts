import { rgb } from 'd3-color'
import { select } from 'd3-selection'
import { zoomIdentity } from 'd3-zoom'
import * as THREE from 'three'
import { ScatterViewModel } from './scatterViewModel'
import type { Scatter } from '../scatter'

export class ScatterViewModel2DLarge extends ScatterViewModel {
	isSingleCell: boolean = false

	constructor(scatter: Scatter) {
		super(scatter)
		this.isSingleCell = scatter.config?.singleCellPlot
	}

	async renderSerie(chart) {
		if (this.isSingleCell && chart.src) {
			this.renderLargeSingleCell(chart)
			return
		}
		const s = this.scatter.settings
		const offsetX = this.model.axisOffset.x
		const offsetY = this.model.axisOffset.y

		// fillSvgSubElems() has already drawn the x/y axes, axis titles and legend into chart.svg;
		// keep that svg and overlay the WebGL canvas on the plot area (offset by the axis margins)
		// so the axes remain visible around the point cloud, instead of wiping the whole mainDiv.
		const div = select(chart.svg.node().parentNode)
		div.style('position', 'relative')
		div.selectAll('canvas').remove()
		// When a chart crosses from the SVG path to this WebGL path, chart.svg is reused. Clear its data
		// layers — the dots/contour in chart.serie and the regression curve in chart.regressionG — so
		// stale SVG points don't show through the transparent canvas. Axes, labels and legend are kept.
		chart.serie?.selectAll('*').remove()
		chart.regressionG?.selectAll('*').remove()
		this.canvas = div
			.append('canvas')
			.style('position', 'absolute')
			.style('left', `${offsetX}px`)
			.style('top', `${offsetY}px`)
			.node()
		this.canvas.width = s.svgw
		this.canvas.height = s.svgh

		const fov = s.threeFOV
		const near = 0.1
		const far = 1000
		const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
		const scene = new THREE.Scene()
		// Place the camera so the data range (mapped to world [-1, 1] by getVertices) exactly fills
		// the canvas: with a vertical fov, the visible half-height at the data plane is
		// distance * tan(fov/2), so distance = 1 / tan(fov/2) makes that half-height equal 1. This
		// keeps the point cloud aligned with the SVG axes, which map the same data range to the same
		// plot-area pixels.
		camera.position.set(0, 0, 1 / Math.tan((fov * Math.PI) / 180 / 2))
		camera.lookAt(scene.position)
		camera.updateMatrix()
		// leave the scene background unset so the canvas is transparent and the underlying svg
		// (its plot-area background and the x/y axis spines) shows through around the points

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
		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			canvas: this.canvas,
			preserveDrawingBuffer: true,
			alpha: true
		})
		renderer.setClearColor(0x000000, 0) // fully transparent clear so the svg shows through
		renderer.setSize(this.scatter.settings.svgw, this.scatter.settings.svgh)
		renderer.setPixelRatio(window.devicePixelRatio)

		// Note: no DragControls here. Dragging the point cloud would translate the particles directly
		// while the SVG axes stay fixed, so the points would no longer line up with their axis values.
		// Zoom (below and via the zoom buttons) is the only navigation, and it keeps the axes in sync.

		// drive zoom through the shared scatterZoom so the WebGL camera and the SVG axes stay in sync
		this.canvas.addEventListener('wheel', (event: any) => {
			if (!event.ctrlKey) return
			event.preventDefault()
			const zoomState = this.scatter.vm.scatterZoom
			const factor = event.deltaY < 0 ? 1.1 : 0.9
			zoomState.zoom = Math.max(0.1, Math.min(10, zoomState.zoom * factor))
		})

		this.renderAxes(chart)
		this.animate(chart, camera, scene, renderer)
	}

	/** Redraw the given chart's x/y axes to match the current WebGL zoom. camera.zoom scales the point
	 * cloud by k about the plot center, so express that as a d3 zoom transform and rescale the axes the
	 * way ScatterZoom.handleZoom() does for the small plots. Rescaling keeps each axis RANGE pinned to
	 * the plot edges (only the visible data window is relabeled), so the two axes stay joined at the
	 * corner and neither the ticks nor the spine spill past the canvas when zoomed in. Ticks that fall
	 * outside the data range (e.g. when zoomed out past the data) are dropped.
	 *
	 * The zoom is tracked per chart (chart.currentAxisZoom), not on the view model, because a
	 * categorical term0 renders multiple charts — each with its own canvas and animation loop — that
	 * all share one zoom level; per-chart tracking keeps every chart's axes in sync, not just the last. */
	renderAxes(chart) {
		if (!chart?.axisBottom || !chart?.axisLeft || !chart.xAxis || !chart.yAxis) return
		const s = this.scatter.settings
		const k = this.scatter.vm.scatterZoom.zoom || 1
		const offsetX = this.model.axisOffset.x
		const offsetY = this.model.axisOffset.y
		const cx = offsetX + s.svgw / 2
		const cy = offsetY + s.svgh / 2
		// a scale by k about (cx, cy): applyX(p) = p*k + cx*(1-k), applyY(p) = p*k + cy*(1-k)
		const transform = zoomIdentity.translate(cx * (1 - k), cy * (1 - k)).scale(k)
		// initAxes() binds the axis generators to time scales for date terms (xAxisScaleTime/
		// yAxisScaleTime); rescale those when present so date ticks and formatting survive the zoom,
		// and fall back to the numeric coordinate scale otherwise. Both share the same pixel range, so
		// the same transform applies. The WebGL points always use the numeric chart.xAxisScale/
		// yAxisScale (see getVertices), which is left untouched.
		const xBase = chart.xAxisScaleTime || chart.xAxisScale
		const yBase = chart.yAxisScaleTime || chart.yAxisScale
		const xScale = transform.rescaleX(xBase)
		const yScale = transform.rescaleY(yBase)
		chart.xAxis.call(chart.axisBottom.scale(xScale).tickValues(this.ticksWithinData(xScale, xBase)))
		chart.yAxis.call(chart.axisLeft.scale(yScale).tickValues(this.ticksWithinData(yScale, yBase)))
		chart.currentAxisZoom = k
	}

	/** Ticks of the zoomed scale that still fall within the base (data) domain, so zooming out past
	 * the data does not render tick marks for values below the minimum or above the maximum. */
	ticksWithinData(zoomedScale: any, baseScale: any) {
		const [d0, d1] = baseScale.domain()
		const lo = Math.min(d0, d1)
		const hi = Math.max(d0, d1)
		return zoomedScale.ticks().filter((t: number) => t >= lo && t <= hi)
	}

	animate(chart, camera, scene, renderer) {
		// a re-render replaces scatter.vm with a fresh view model; stop this now-stale loop and release
		// its canvas + WebGL context. Otherwise, if the plot switched back to the SVG path (which does
		// not remove this absolute canvas), the stale overlay would cover the new SVG plot, and the
		// renderer's GPU resources would be retained until garbage collection.
		if (this.scatter.vm !== this) {
			renderer.domElement.remove()
			renderer.dispose()
			return
		}
		requestAnimationFrame(() => this.animate(chart, camera, scene, renderer))
		const k = this.scatter.vm.scatterZoom.zoom
		camera.zoom = k
		camera.updateProjectionMatrix()
		if (k !== chart.currentAxisZoom) this.renderAxes(chart)
		renderer.render(scene, camera)
	}

	getVertices(chart) {
		// Map data coordinates into WebGL clip space [-1, 1]. Copy the shared axis scales instead of
		// mutating their range in place, since fillSvgSubElems (axis), scatterZoom and the hover
		// quadtree all read chart.xAxisScale/yAxisScale expecting their SVG pixel ranges.
		// WebGL's y points up while the SVG-oriented chart.yAxisScale uses a flipped domain
		// ([yMax, yMin]) for SVG's downward y; map y to [1, -1] so larger values render at the top,
		// matching the SVG y-axis. x needs no flip ([-1, 1]) since both spaces grow left-to-right.
		const xAxisScale = chart.xAxisScale.copy().range([-1, 1])
		const yAxisScale = chart.yAxisScale.copy().range([1, -1])
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

	/** Renders the server generated image for a single cell */
	renderLargeSingleCell(chart) {
		/** No need to remove elements or call the legend in this fn.
		 * Unlike the renderSerie above, this fn finishes in renderChart -> renderSVG
		 * before legendvm.renderLegend is called. renderChart handles dom additions
		 * and removal. A new legend is rendered each time. Simply add the image. */
		chart.svg.selectAll('.sjpp-scatter-img-g').remove()
		const imgG = chart.svg.append('g').attr('class', 'sjpp-scatter-img-g')
		const img = imgG.append('image').attr('xlink:href', chart.src)
		if (chart.canvasWidth) img.attr('width', chart.canvasWidth)
		if (chart.canvasHeight) img.attr('height', chart.canvasHeight)
		this.canvas = img
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
