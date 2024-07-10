import { select } from 'd3-selection'

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
	const queryString = window.location.search
	const urlParams = new URLSearchParams(queryString)
	const isLoggedIn = urlParams.get('isLoggedIn')
	const site = urlParams.get('site')

	addButtons(headerHolder, app, dslabel, isLoggedIn, site)
	launchPlot(app, 'profilePolar', 'Polar Graph', false, isLoggedIn, site)
}

function addButtons(headerHolder, app, dslabel, isLoggedIn, site) {
	const div = headerHolder.append('div').style('display', 'inline-flex').style('gap', '5px')

	div
		.append('button')
		.text(dslabel == 'ProfileFull' ? 'Abbreviated PrOFILE' : 'Full PrOFILE')
		.on('click', e =>
			dslabel == 'ProfileFull' ? loadDataset(headerHolder, 'ProfileAbbrev') : loadDataset(headerHolder, 'ProfileFull')
		)
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

async function deletePlots(app) {
	for (const plot of app.getState().plots) {
		await app.dispatch({
			type: 'plot_delete',
			id: plot.id
		})
	}
}
