import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { appInit } from '#termdb/app'

/*
holder: html dom
getDatasetAccessToken()
*/
export function init(arg) {
	const headerHolder = select(arg.holder)
	headerHolder
		.append('img')
		.attr('src', 'images/Button_Full_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(headerHolder, 'ProfileFull'))
	headerHolder
		.append('img')
		.attr('src', 'images/Button_Abbreviated_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(headerHolder, 'ProfileAbbrev'))
}

async function loadDataset(headerHolder, dslabel) {
	const profileIntroHolder = document.getElementById('profileIntro')
	profileIntroHolder.innerHTML = ''
	headerHolder.selectAll('*').remove()
	const appHolder = select(document.getElementById('aaa'))
	appHolder.selectAll('*').remove()
	const opts = {
		holder: appHolder,
		state: {
			nav: {
				header_mode: 'hidden'
			},
			vocab: {
				dslabel,
				genome: 'hg38'
			}
		}
	}
	const _ = await import('../mass/app')
	const app = await _.appInit(opts)

	addButtons(headerHolder, app, dslabel, isLoggedIn, site)
	launchPlot(app, 'profilePolar', 'Polar Graph', false, isLoggedIn, site)
}

function addButtons(headerHolder, app, dslabel, isLoggedIn, site) {
	const div = headerHolder
		.append('div')
		.style('display', 'inline-flex')
		.style('gap', '5px')
		.style('padding-left', '10px')
	div
		.append('button')
		.text('Full PrOFILE')
		.style('background-color', dslabel == 'ProfileFull' ? 'orange' : '')
		.on('click', e => {
			loadDataset(headerHolder, 'ProfileFull')
		})

	div
		.append('button')
		.text('Abbreviated PrOFILE')
		.style('background-color', dslabel == 'ProfileAbbrev' ? 'orange' : '')
		.on('click', e => loadDataset(headerHolder, 'ProfileAbbrev'))
	div
		.append('button')
		.text('Polar Graph')
		.on('click', e => launchPlot(app, 'profilePolar', 'Polar Graph', preserveCheckbox.node().checked, isLoggedIn, site))
	div
		.append('button')
		.text('Bar Graph')
		.on('click', e =>
			launchPlot(app, 'profileBarchart', 'Bar Graph', preserveCheckbox.node().checked, isLoggedIn, site)
		)
	if (isLoggedIn)
		div
			.append('button')
			.text('Radar Graph 1')
			.on('click', e =>
				launchRadarPlot(
					app,
					'profileRadarFacility',
					'Radar Graph 1',
					'plot1',
					preserveCheckbox.node().checked,
					isLoggedIn,
					site
				)
			)
	if (isLoggedIn)
		div
			.append('button')
			.text('Radar Graph 2')
			.on('click', e =>
				launchRadarPlot(
					app,
					'profileRadar',
					'Radar Graph 2',
					'plot1',
					preserveCheckbox.node().checked,
					isLoggedIn,
					site
				)
			)
	if (dslabel == 'ProfileFull' && isLoggedIn)
		div
			.append('button')
			.text('Radar Graph 3')
			.on('click', e =>
				launchRadarPlot(
					app,
					'profileRadar',
					'Radar Graph 3',
					'plot2',
					preserveCheckbox.node().checked,
					isLoggedIn,
					site
				)
			)
	if (isLoggedIn)
		div
			.append('button')
			.text('Summary')
			.on('click', e => launchSummaryPlot(e.target, app, preserveCheckbox.node().checked, isLoggedIn, site))

	div.append('label').attr('for', 'preservePlots').text('Preserve Plots')
	const preserveCheckbox = div.append('input').attr('id', 'preservePlots').attr('type', 'checkbox')
}

async function launchPlot(app, chartType, header, preserve, isLoggedIn, site) {
	if (!preserve) await deletePlots(app)
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType,
			header,
			isLoggedIn,
			site
		}
	})
}

async function launchRadarPlot(app, chartType, header, plot, preserve, isLoggedIn, site) {
	if (!preserve) await deletePlots(app)
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType,
			plot,
			header,
			isLoggedIn,
			site
		}
	})
}

async function launchSummaryPlot(button, app, preserve, isLoggedIn, site) {
	/*
		holder: the holder in the tooltip
		chartsInstance: MassCharts instance
			termdbConfig is accessible at chartsInstance.state.termdbConfig{}
			mass option is accessible at chartsInstance.app.opts{}
		*/
	const tip = new Menu()
	const holder = tip.d
	appInit({
		holder,
		vocabApi: app.vocabApi,
		state: { tree: { usecase: { target: 'profile' } } },
		tree: {
			click_term: term => {
				console.log('click_term', term)
				app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'profileSummary',
						isLoggedIn,
						site
					}
				})
			}
		}
	})
	tip.showunder(button)
}

async function deletePlots(app) {
	for (const plot of app.getState().plots) {
		await app.dispatch({
			type: 'plot_delete',
			id: plot.id
		})
	}
}
