import { event as d3event } from 'd3-selection'

const defaults = {
	duration: 500, // for apps drawer animation
	hint_pos: {
		open: { btm: -42, left: 13 },
		closed: { btm: 3, rt: 5 }
	},
	hint_width: { open: '0px', closed: '18px' },
	arrow_size: { open: 42, closed: 20 },
	arrow_color: { open: 'rgb(242,242,242)', closed: 'rgb(85,85,85)' }
}

export function drawer_init(app, features, overrides = {}) {
	const settings = Object.assign({}, defaults, overrides)
	let examples_rendered = false
	let drawer_full_height
	let app_btn_active = false

	const dom = {
		drawer_row: app.holder
			.append('div')
			.style('position', 'relative')
			.style('overflow-x', 'visible')
			.style('overflow-y', 'hidden')
			.style('height', '0px'),

		sandbox_div: app.holder.append('div').style('margin-top', '15px')
	}

	//Hides app_div and toggles dom.btn off
	function apps_off() {
		app_btn_active = false
		if (dom.drawer_div !== undefined) {
			slide_drawer()
		}
	}

	const selectedGenome = app.selectgenome.node().options[app.selectgenome.property('selectedIndex')].value

	async function load_examples() {
		// prevent reloading
		if (examples_rendered) return
		examples_rendered = true
		const _ = await import('./app.drawer.cards')
		await _.init_appDrawer({
			holder: dom.drawer_div,
			apps_sandbox_div: dom.sandbox_div,
			apps_off,
			genomes: app.genomes
		})
		drawer_full_height = dom.drawer_div.node().getBoundingClientRect().height + 5
		slide_drawer()
	}

	function slide_drawer() {
		dom.btn_wrapper
			.transition()
			.duration(settings.duration)
			.style('background-color', app_btn_active ? '#b2b2b2' : '#f2f2f2')
			.style('color', app_btn_active ? '#fff' : '#000')

		dom.btn
			.transition()
			.duration(settings.duration)
			.style('color', app_btn_active ? '#fff' : '#000')

		dom.drawer_div
			.style('display', 'inline-block')
			.transition()
			.duration(settings.duration)
			.style('top', app_btn_active ? '0px' : '-' + drawer_full_height + 'px')

		dom.drawer_row
			.transition()
			.duration(settings.duration)
			.style('height', app_btn_active ? drawer_full_height + 'px' : '0px')

		dom.drawer_hint
			.transition()
			.duration(settings.duration)
			.style('width', app_btn_active ? settings.hint_width.open : settings.hint_width.closed)

		dom.drawer_arrow
			.transition()
			.duration(settings.duration)
			.style('opacity', app_btn_active ? 0 : 1)

		dom.drawer_arrow_open
			.style('pointer-events', app_btn_active ? 'auto' : 'none')
			.transition()
			.duration(settings.duration)
			.style('opacity', app_btn_active ? 1 : 0)
	}

	return {
		apps_sandbox_div: dom.sandbox_div,
		apps_off,
		addBtn(headbox, btnLabel, padw_sm, jwt) {
			// NOTE: set app_btn_active to false initially to
			// make the drawer animation consistent on load,
			// regardless of whether an app is to be opened right away
			dom.drawer_div = dom.drawer_row
				.append('div')
				.style('position', 'relative')
				.style('margin', '0 20px')
				.style('padding', `0 ${padw_sm}`)
				.style('top', `-${window.screen.height}px`)
				.style('display', 'inline-block')
				.style('overflow', 'hidden')
				.style('background-color', '#f5f5f5')
				.style('border-radius', '0px 0px 5px 5px')
				.style('width', '93vw')

			dom.btn_wrapper = headbox
				.append('div')
				.style('position', 'relative')
				.style('display', 'inline-block')
				.style('margin-left', '5px')
				.style('margin-right', '5px')
				.style('border-radius', '5px')
				.style('background-color', app_btn_active ? '#b2b2b2' : '#f2f2f2')
				.style('color', app_btn_active ? '#fff' : '#000')
				.on('click', async () => {
					d3event.stopPropagation()
					// toggle button color and hide/show apps div
					app_btn_active = !app_btn_active
					await load_examples()
					slide_drawer()
					if (app_btn_active) {
						setTimeout(() => {
							drawer_full_height = dom.drawer_div.node().getBoundingClientRect().height + 5
						}, settings.duration + 5)
					}
				})
				.on('mouseover', () => {
					dom.btn_wrapper.style('background-color', app_btn_active ? '#a2a2a2' : '#e6e6e6')
				})
				.on('mouseout', () => {
					dom.btn_wrapper.style('background-color', app_btn_active ? '#b2b2b2' : '#f2f2f2')
				})

			dom.btn = dom.btn_wrapper
				.append('div')
				.attr('class', 'sja_menuoption')
				.style('display', 'inline-block')
				.style('background-color', 'transparent')
				.style('color', app_btn_active ? '#fff' : '#000')
				.style('padding', padw_sm)
				.style('margin', '0px 5px')
				.style('cursor', 'pointer')
				.text(btnLabel)

			// an empty spacer div, needed since the arrows are absolutely positioned
			dom.drawer_hint = dom.btn_wrapper
				.append('div')
				.style('position', 'relative')
				.style('display', 'inline-block') //app_btn_active ? '' : 'inline-block')
				.style('height', settings.arrow_size.closed + 'px')
				.style('width', app_btn_active ? settings.hint_width.open : settings.hint_width.closed)
				.style('background-color', 'transparent')
				.style('text-align', 'center')
				.style('cursor', 'pointer')

			dom.drawer_arrow = dom.btn_wrapper
				.append('div')
				.style('position', 'absolute')
				.style('font-size', settings.arrow_size.closed + 'px')
				.style('right', settings.hint_pos.closed.rt + 'px')
				.style('bottom', settings.hint_pos.closed.btm + 'px')
				.style('background-color', 'transparent')
				.style('color', settings.arrow_color.closed)
				.style('opacity', app_btn_active ? 0 : 1)
				.style('cursor', 'pointer')
				.html('&#9660;')

			dom.drawer_arrow_open = dom.btn_wrapper
				.append('div')
				.style('position', 'absolute')
				.style('font-size', settings.arrow_size.open + 'px')
				.style('left', settings.hint_pos.open.left + 'px')
				.style('bottom', settings.hint_pos.open.btm + 'px')
				.style('transform', 'rotate(180deg)')
				.style('background-color', 'transparent')
				.style('color', settings.arrow_color.open)
				.style('opacity', app_btn_active ? 1 : 0)
				.style('cursor', 'pointer')
				.style('pointer-events', app_btn_active ? 'auto' : 'none')
				.html('&#9660;')

			// detect whether to show examples right away, which is when the url is barebone without any route paths or search parameters
			app_btn_active = window.location.pathname == '/' && !window.location.search.length
			// if an app is loaded when the page opens, delay the loading
			// of examples in order to not affect that loading,
			// otherwise load trigger the loading of examples right away
			// setTimeout(load_examples, app_btn_active ? 0 : 5000)

			//Fix for examplesjson loading before Apps btn is clicked
			if (app_btn_active) {
				load_examples()
			}
		}
	}
}
