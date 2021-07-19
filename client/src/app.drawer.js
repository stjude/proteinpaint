import { event as d3event } from 'd3-selection'

const duration = 500, // for apps drawer animation
	hint_pos = {
		open: { btm: -42, left: 13 },
		closed: { btm: 3, rt: 5 }
	},
	hint_width = { open: '0px', closed: '18px' },
	arrow_size = { open: 42, closed: 20 },
	arrow_color = { open: 'rgb(242,242,242)', closed: 'rgb(85,85,85)' }

export function drawer_init(app, row, features) {
	const apps_drawer_row = app.holder
		.append('div')
		.style('position', 'relative')
		.style('overflow-x', 'visible')
		.style('overflow-y', 'hidden')

	app.holder.apps_sandbox_div = app.holder.append('div').style('margin-top', '15px')

	//Hides app_div and toggles app_btn off
	function apps_off() {
		app_btn_active = false
		if (app_holder !== undefined) {
			slide_drawer()
		}
	}

	let apps_rendered = false

	async function load_app_div() {
		if (apps_rendered) return
		apps_rendered = true
		const _ = await import('./examples')
		//app_holder.style('top', '-6000px').style('display', 'inline-block').style('height', 0)
		//console.log(414, app_holder.style('top'), app_holder.style('height'))
		await _.init_examples({
			holder: app_holder,
			apps_sandbox_div: app.holder.apps_sandbox_div,
			apps_off
		})
		setTimeout(() => {
			//app_holder.style('height', '')
			//console.log(419, app_holder.style('top'), app_holder.node().getBoundingClientRect().height)
			app_holder_full_height = app_holder.node().getBoundingClientRect().height + 5
			//slide_drawer()
		}, duration + 15)
	}

	let app_holder_full_height, apps_drawer_hint, apps_drawer_arrow, apps_drawer_arrow_open
	let app_btn_wrapper, app_btn, app_btn_active, app_holder

	function slide_drawer() {
		app_btn_wrapper
			.transition()
			.duration(500)
			.style('background-color', app_btn_active ? '#b2b2b2' : '#f2f2f2')
			.style('color', app_btn_active ? '#fff' : '#000')

		app_btn
			.transition()
			.duration(500)
			.style('color', app_btn_active ? '#fff' : '#000')

		app_holder
			.style('display', 'inline-block')
			.transition()
			.duration(duration)
			.style('top', app_btn_active ? '0px' : '-' + app_holder_full_height + 'px')

		apps_drawer_row
			.transition()
			.duration(duration)
			.style('height', app_btn_active ? app_holder_full_height + 'px' : '0px')

		apps_drawer_hint
			.transition()
			.duration(duration)
			.style('width', app_btn_active ? hint_width.open : hint_width.closed)

		apps_drawer_arrow
			.transition()
			.duration(duration)
			.style('opacity', app_btn_active ? 0 : 1)

		apps_drawer_arrow_open
			.style('pointer-events', app_btn_active ? 'auto' : 'none')
			.transition()
			.duration(duration)
			.style('opacity', app_btn_active ? 1 : 0)
	}

	return {
		addBtn(headbox, btnLabel, padw_sm) {
			// launchApps()
			if (!features.examples) {
				app_btn = headbox
					.append('div')
					.attr('class', 'sja_menuoption')
					.style('display', 'inline-block')
					.style('padding', padw_sm)
					.style('margin', '0px 5px')
					.style('border-radius', '5px')
					.text(btnLabel)
					.on('click', () => {
						appmenu(app, headbox, jwt)
					})
			} else {
				// show 'apps' div only when url is barbone without any paramerters or example page
				app_btn_active = window.location.pathname == '/' && !window.location.search.length ? true : false

				app_holder = apps_drawer_row
					.append('div')
					.style('position', 'relative')
					.style('margin', '0 20px')
					.style('padding', `0 ${padw_sm}`)
					.style('display', app_btn_active ? 'inline-block' : 'none')
					.style('overflow', 'hidden')
					.style('background-color', '#f5f5f5')
					.style('border-radius', '0px 0px 5px 5px')
					.style('width', '93vw')

				if (app_btn_active) load_app_div()

				app_btn_wrapper = headbox
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
						await load_app_div()
						slide_drawer()
						if (app_btn_active) {
							setTimeout(() => {
								app_holder_full_height = app_holder.node().getBoundingClientRect().height + 5
							}, duration + 5)
						}
					})
					.on('mouseover', () => {
						app_btn_wrapper.style('background-color', app_btn_active ? '#a2a2a2' : '#e6e6e6')
					})
					.on('mouseout', () => {
						app_btn_wrapper.style('background-color', app_btn_active ? '#b2b2b2' : '#f2f2f2')
					})

				app_btn = app_btn_wrapper
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
				apps_drawer_hint = app_btn_wrapper
					.append('div')
					.style('position', 'relative')
					.style('display', 'inline-block') //app_btn_active ? '' : 'inline-block')
					.style('height', arrow_size.closed + 'px')
					.style('width', app_btn_active ? hint_width.open : hint_width.closed)
					.style('background-color', 'transparent')
					.style('text-align', 'center')
					.style('cursor', 'pointer')

				apps_drawer_arrow = app_btn_wrapper
					.append('div')
					.style('position', 'absolute')
					.style('font-size', arrow_size.closed + 'px')
					.style('right', hint_pos.closed.rt + 'px')
					.style('bottom', hint_pos.closed.btm + 'px')
					.style('background-color', 'transparent')
					.style('color', arrow_color.closed)
					.style('opacity', app_btn_active ? 0 : 1)
					.style('cursor', 'pointer')
					.html('&#9660;')

				apps_drawer_arrow_open = app_btn_wrapper
					.append('div')
					.style('position', 'absolute')
					.style('font-size', arrow_size.open + 'px')
					.style('left', hint_pos.open.left + 'px')
					.style('bottom', hint_pos.open.btm + 'px')
					.style('transform', 'rotate(180deg)')
					.style('background-color', 'transparent')
					.style('color', arrow_color.open)
					.style('opacity', app_btn_active ? 1 : 0)
					.style('cursor', 'pointer')
					.style('pointer-events', app_btn_active ? 'auto' : 'none')
					.html('&#9660;')
			}
		},
		apps_off
	}
}
