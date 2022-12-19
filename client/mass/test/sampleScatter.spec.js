'use strict'
const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3color = require('d3-color')
const d3s = require('d3-selection')
const d3drag = require('d3-drag')

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		vocab: {
			dslabel: 'PNET',
			genome: 'hg19'
		}
	},
	debug: 1
})

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mass/sampleScatter -***-')
	test.end()
})

tape('Render PNET scatter plot', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						sampleScatter: {
							showAxes: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		const scatterDiv = scatter.Inner.dom.holder
		testPlot()
		testLegendTitle()
		//testAxisDimension(scatter)
		//test.fail('...')
		if (test._ok) scatter.Inner.app.destroy()
		test.end()

		function testPlot() {
			const serieG = scatterDiv.select('.sjpcb-scatter-series')
			const numSymbols = serieG.selectAll('path').size()
			test.true(
				numSymbols == scatter.Inner.currData.samples.length,
				`Should be ${scatter.Inner.currData.samples.length}. Rendered ${numSymbols} symbols.`
			)
		}

		function testLegendTitle() {
			const legendG = scatterDiv.select('.sjpcb-scatter-legend')
			test.true(legendG != null, 'Should have a legend')
			//scatter.Inner.config.colorTW.id = category legend header
			test.equal(
				legendG.select('#legendTitle').text(),
				scatter.Inner.config.colorTW.id,
				`Legend title should be ${scatter.Inner.config.colorTW.id}`
			)
		}

		function testAxisDimension(scatter) {
			//TODO
		}
	}
})

tape('Click behavior of category legend', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		const testCategory = scatter.Inner.colorLegend.get('ETMR')
		const testColor = d3color.rgb(testCategory.color)

		const scatterDiv = scatter.Inner.dom.holder
		const categoryLegendG = scatterDiv
			.selectAll('g')
			.nodes()
			.find(c => c.childNodes[0].style.fill == testColor)

		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(testClickedCategory)
			// .use(clickCategory, {wait: 300})
			// .to(testUnclickedCategory, {wait: 1000})
			.done(test)

		function testClickedCategory() {
			categoryLegendG.dispatchEvent(new Event('click'))
			const findColorDots = scatterDiv
				.selectAll('.sjpcb-scatter-series > path')
				.nodes()
				.some(c => c.style.fill == testColor)
			test.ok(
				findColorDots == false,
				`Should remove all ${testCategory.value.label} colored dots, color = ${testColor}`
			)
		}

		// function clickCategory(){
		// 	categoryLegendG.dispatchEvent(new Event('click'))
		// }

		// function testUnclickedCategory(){
		// 	const findColorDots = scatterDiv.selectAll('.sjpcb-scatter-series > path').nodes().some(c => c.style.fill == testColor)
		// 	test.ok(findColorDots == true, `Should include ${testCategory.value.label} colored dots, color = ${testColor}`)
		// }
	}
})

tape('Edit color from burger menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'hide_search'
			},
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},

		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		// helpers.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// .run(openColorEditMenu, {wait: 100})
		// .done(test)

		await sleep(100)
		triggerEdit(scatter)
		makeGroupsViaUI(scatter)
		await sleep(100)
		testGroups(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerEdit(scatter) {
		scatter.Inner.dom.controls
			.node()
			.querySelector('.ts_pill')
			.click()
		/*
		Problematic! menu tooltip renders outside of scatter.Inner.dom/app and current setup
		does not allow for targeting only the rendered test div. If any test fails, leaving 
		an rendered mass UI, these tests will fail as well
		*/
		d3s
			.selectAll('.sja_sharp_border')
			.filter(d => d.label == 'Edit')
			.node()
			.click()
	}

	function makeGroupsViaUI(scatter) {
		const firstGrpInput = d3s
			.selectAll('.group_edit_div > input')
			.nodes()
			.filter(e => e.value == '1')
		firstGrpInput[0].value = 'Group 1'
		firstGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

		const secondGrpInput = d3s
			.selectAll('.group_edit_div > input')
			.nodes()
			.filter(e => e.value == '2')
		secondGrpInput[0].value = 'Group 2'
		secondGrpInput[0].dispatchEvent(new KeyboardEvent('keyup'))

		const dragDivs = d3s.selectAll('.sjpp-drag-drop-div').nodes()
		const dragItems = d3.selectAll('.sj-drag-item').nodes()
		//First item in list
		dragItems[0].dispatchEvent(new Event('dragstart'))
		//Second drag div
		dragDivs[1].dispatchEvent(new Event('drop'))
		dragItems[0].dispatchEvent(new Event('dragend'))

		const applyBtn = d3.selectAll('.sjpp_apply_btn').node()
		applyBtn.dispatchEvent(new Event('click'))
	}

	function testGroups(scatter) {
		const legendLabels = scatter.Inner.dom.holder.selectAll('.sjpp-scatter-legend-label').nodes()
		let groups = []
		for (const group of legendLabels) {
			const label = group.innerHTML.split(',')
			groups.push({
				label: label[0],
				samples: label[1].match(/[\d\.]+/g)
			})
		}
		test.ok(
			scatter.Inner.colorLegend.size == groups.length + 1,
			`Legend categories (# = ${groups.length + 1}) should equal size of colorLegend (# = ${
				scatter.Inner.colorLegend.size
			}) `
		)
		compareData2DOMLegend(scatter, groups)
	}

	function compareData2DOMLegend(scatter, groups) {
		for (const group of groups) {
			const mapLeg = scatter.Inner.colorLegend.get(group.label)
			test.ok(mapLeg.sampleCount == group.samples[0], `Should show matching n = for ${group.label}`)
		}
	}
})

tape.only('Replace color from burger menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			nav: {
				header_mode: 'hide_search'
			},
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},

		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		scatter.on('postRender.test', null)

		await sleep(100)
		triggerReplace(scatter)

		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function triggerReplace(scatter) {
		scatter.Inner.dom.controls
			.node()
			.querySelector('.ts_pill')
			.click()
		/*
		Problematic! menu tooltip renders outside of scatter.Inner.dom/app and current setup
		does not allow for targeting only the rendered test div. If any test fails, leaving 
		an rendered mass UI, these tests will fail as well
		*/
		d3s
			.selectAll('.sja_sharp_border')
			.filter(d => d.label == 'Replace')
			.node()
			.click()
	}
})

tape.skip('Edit shape from burger menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})

tape.skip('Replace shape from burger menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})

tape('Change symbol and reference size from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	const testSymSize = 300
	const testRefSize = 1

	async function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(changeSymbolInput)
			.run(testSymbolSize, { wait: 100 })
			.use(changeRefInput, { wait: 100 })
			.to(testRefDotSize, { wait: 100 })
			.done(test)
	}
	function changeSymbolInput(scatter) {
		const sizeInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.size)
		sizeInput.value = testSymSize
		sizeInput.dispatchEvent(new Event('change'))
	}
	function testSymbolSize(scatter) {
		//separate function because wait needed before test to run
		test.ok(scatter.Inner.settings.size == testSymSize, `Should change symbol dot size to test value = ${testSymSize}`)
	}
	function changeRefInput(scatter) {
		const refInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.refSize)
		refInput.value = testRefSize
		refInput.dispatchEvent(new Event('change'))
	}
	function testRefDotSize(scatter) {
		test.ok(
			scatter.Inner.settings.refSize == testRefSize,
			`Should change reference dot size to test value = ${testRefSize}`
		)
	}
})

tape('Change chart width and height from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	const testWidth = 50
	const testHeight = 50

	async function runTests(scatter) {
		scatter.on('postRender.test', null)
		// helpers
		// 	.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// 	.run(changeWidth)
		// 	.use(changeHeight)
		// 	.to(testChartSizeChange)
		// 	.done(test)

		changeWidth(scatter)
		changeHeight(scatter)
		await sleep(100)
		testChartSizeChange(scatter)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
	function changeWidth(scatter) {
		const widthInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgw)
		widthInput.value = testWidth
		widthInput.dispatchEvent(new Event('change'))
	}

	function changeHeight(scatter) {
		const heightInput = scatter.Inner.dom.controls
			.selectAll('input')
			.nodes()
			.find(e => e.value == scatter.Inner.settings.svgh)
		heightInput.value = testHeight
		heightInput.dispatchEvent(new Event('change'))
	}

	function testChartSizeChange(scatter) {
		test.ok(
			scatter.Inner.settings.svgw == testWidth,
			`Chart width = ${scatter.Inner.settings.svgw} should be equal to test width = ${testWidth}`
		)
		test.ok(
			scatter.Inner.settings.svgh == testHeight,
			`Chart height = ${scatter.Inner.settings.svgh} should be equal to test height = ${testHeight}`
		)
	}
})

tape('Check/uncheck Show axes from menu', function(test) {
	test.timeoutAfter(4000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		// helpers
		// 	.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
		// 	.run(checkAxesBox)
		// 	.run(testAxes)
		// 	.done(test)

		scatter.on('postRender.test', null)

		checkAxesBox(scatter, false)
		await sleep(100)
		testAxes(scatter, 1)
		checkAxesBox(scatter, true)
		await sleep(100)
		testAxes(scatter, 0)

		if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}

	function checkAxesBox(scatter, bool) {
		const axesCheckbox = scatter.Inner.dom.controls
			.selectAll('input[type="checkbox"]')
			.nodes()
			.find(e => e.checked == bool)
		axesCheckbox.checked = !bool
		axesCheckbox.dispatchEvent(new Event('change'))
	}

	function testAxes(scatter, num) {
		const axesDiv = scatter.Inner.dom.holder.node().querySelector('.sjpcb-scatter-axis')
		const axesStyle = getComputedStyle(axesDiv)
		test.ok(axesStyle.opacity == num, `Should ${num == 1 ? 'show' : 'hide'} axes`)
	}
})

tape.skip('Check/uncheck Show reference from menu', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						controls: {
							isOpen: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(checkShowAxes)
			// .use(changeHeight)
			// .to(testChartSizeChange, {wait: 100})
			.done(test)
	}

	function checkShowAxes(scatter) {
		const axesCheckbox = scatter.Inner.dom.controls.selectAll('input').nodes()
	}
})

tape.skip('Click download button for SVG', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		// if (test._ok) scatter.Inner.app.destroy()
		test.end()
	}
})

tape.skip('Click zoom in, zoom out, and reset buttons', function(test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						sampleScatter: {
							showAxes: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	function runTests(scatter) {
		helpers
			.rideInit({ arg: scatter, bus: scatter, eventType: 'postRender.test' })
			.run(clickZoomIn)
			.run(testZoomIn, { wait: 2000 })
			.use(triggerReset, { wait: 1000 })
			.to(testReset, { wait: 2000 })
			.use(clickZoomOut, { wait: 300 })
			.to(testZoomOut, { wait: 2000 })
			.done(test)
	}

	function clickZoomIn(scatter) {
		scatter.Inner.dom.toolsDiv
			.node()
			.querySelector('.sjpp-zoom-in-btn')
			.click()
	}

	function testZoomIn(scatter) {
		const scatterDiv = scatter.Inner.dom.holder.select('g.sjpcb-scatter-series').node()
		const scale = scatterDiv.attributes.transform.value.match(/[\d\.]+/g)
		test.ok(scale[2] > 1, `Plot should zoom in`)
	}

	function triggerReset(scatter) {
		scatter.Inner.dom.toolsDiv
			.node()
			.querySelector('.sjpp-reset-btn')
			.click()
	}

	function testReset(scatter) {
		const scatterDiv = scatter.Inner.dom.holder.select('g.sjpcb-scatter-series').node()
		const scale = scatterDiv.attributes.transform.value.match(/[\d\.]+/g)
		test.ok(scale[2] == 1, `Plot should reset`)
	}

	function clickZoomOut(scatter) {
		scatter.Inner.dom.toolsDiv
			.node()
			.querySelector('.sjpp-zoom-out-btn')
			.click()
	}

	function testZoomOut(scatter) {
		const scatterDiv = scatter.Inner.dom.holder.select('g.sjpcb-scatter-series').node()
		const scale = scatterDiv.attributes.transform.value.match(/[\d\.]+/g)
		test.ok(scale[2] < 1, `Plot should zoom out`)
	}

	//Add tests for changes in axes
})

tape.skip('Zoom in and zoom out on mousedown', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE',
					settings: {
						sampleScatter: {
							showAxes: true
						}
					}
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
		//Add tests for changes in axes
	}
})

tape.skip('Lasso samples', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
	}
})

tape.skip('Lasso samples, list', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
	}
})

tape.skip('Lasso samples, add group', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
	}
})

tape.skip('Lasso samples, add group and filter', function(test) {
	test.timeoutAfter(3000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'sampleScatter',
					colorTW: {
						id: 'TSNE Category'
					},
					name: 'Methylome TSNE'
				}
			]
		},
		sampleScatter: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(scatter) {
		//TODO
	}
})
