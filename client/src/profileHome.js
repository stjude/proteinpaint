import { select } from 'd3-selection'
import { Menu } from '#dom/menu'
import { appInit } from '#termdb/app'

/*
logic for rendering the PrOFILE dashboard ui
this is project-specific logic and is not part of mass ui or charts, 
but an external layer on top of mass ui to provide project-specific customizations
it will selectively launch mass apps based on dashboard logic

purposes:

1. at start, shows two buttons for two datasets ("abbreviated", "full").
   this is due to that PrOFILE has two mds3 datasets, where a runpp({mass}) call cannot launch two ds.
   clicking a button will allow to launch one ds via client/mass/app.js

2. once a dataset is selected, display chart buttons available to that ds (the two ds has different sets of charts)
   on clicking a chart button, it launches the chart via abridged mass ui

3. manages any other dashboard interactivities that are out of scope of mass ui



!! chart type names written in this scripts are crucial !!

chart type names must correspond to keys in chartConfigByType{} of the dataset
such charts are not declared in mass/charts.js so mass ui won't show them in charts tray
mass store will simply import from ./plots/<chartType>.js,
inside the js script it accesses its own configurations from termdbConfig.chartConfigByType[<chartType>] and render


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

	addButtons(headerHolder, app, dslabel, logged, site)
	launchPlot(app, 'profilePolar', 'Polar Graph', logged, site)
}

function addButtons(headerHolder, app, dslabel, logged, site) {
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
		.on('click', e => launchPlot(app, 'profilePolar', 'Polar Graph', logged, site))
	div
		.append('button')
		.text('Bar Graph')
		.on('click', e => launchPlot(app, 'profileBarchart', 'Bar Graph', logged, site))
	if (logged)
		div
			.append('button')
			.text('Radar Graph 1')
			.on('click', e => launchRadarPlot(app, 'profileRadarFacility', 'Radar Graph 1', 'plot1', logged, site))
	if (logged)
		div
			.append('button')
			.text('Radar Graph 2')
			.on('click', e => launchRadarPlot(app, 'profileRadar', 'Radar Graph 2', 'plot1', logged, site))
	if (dslabel == 'ProfileFull' && logged)
		div
			.append('button')
			.text('Radar Graph 3')
			.on('click', e => launchRadarPlot(app, 'profileRadar', 'Radar Graph 3', 'plot2', logged, site))
	if (logged)
		div
			.append('button')
			.text('Summary')
			.on('click', e => launchSummaryPlot(e.target, app, logged, site))

	const deleteBt = div
		.append('button')
		.on('click', e => deletePlots(app))
		.text('Delete All')
}

async function launchPlot(app, chartType, header, logged, site) {
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType,
			header,
			logged,
			site
		}
	})
}

async function launchRadarPlot(app, chartType, header, plot, logged, site) {
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType,
			plot,
			header,
			logged,
			site
		}
	})
}

async function launchSummaryPlot(button, app, logged, site) {
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
				app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'profileSummary',
						logged,
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
