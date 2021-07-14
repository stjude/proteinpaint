// Survival curves and and p-value calculation matched to:
// https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1065034/
// and https://www.ncbi.nlm.nih.gov/pmc/articles/PMC403858/

/*
	Create plottable Kaplan-Meier survival curve data serieses
	
	Arguments
	serieses = {
		$seriesId: [
			series = [
				exiter = {
					x: time-to-event (number),
					id: identifier for current object,
					event: "terminal" | "censored"
				},...
			]
		]
	}

	opts: {
		pValCutoff: maximum to bother showing p-value
		pValMinPop: minimum starting population to bother with calculation
	}

	Returns {
		data: seriesData,
		xVals: [ x-value ],
		pValues (optional): computed from log-rank test 
	}
*/
export function processSerieses(serieses, opts = null) {
	const data = {}
	const xVals = []
	let xMax = 0
	for (const seriesId in serieses) {
		data[seriesId] = seriesData(seriesId, serieses[seriesId])
		xVals.push(...data[seriesId].xVals)
		if (data[seriesId].xMax > xMax) {
			xMax = data[seriesId].xMax
		}
	}

	if (!opts) return { data, xVals }
	const pValues = logRank(serieses, opts)
	return { data, xVals, pValues }
}

/*
	Create data for a stepped survival curve 
	
	Arguments
	seriesId: string, identifies a group of data points
	series: see argument to processSerieses above
	
	returns {
		seriesId,
		data: [ currPoint ] ,
		xVals: [ x-value ],
		xMax,
		censored: {
			$exiterId: currPoint
		},
	}
*/
export function seriesData(seriesId, series) {
	const survived = series.sort(sortBySurvivalTime).slice()
	const data = []
	const censored = {}
	let currPoint = getCurrPoint(seriesId, { x: 0, fill: survived[0].fill }, survived.length)
	data.push(currPoint)

	while (survived.length) {
		const count = survived.length
		const exiter = survived.pop()
		// create a new data point when the x-value changes for
		// - a stepped-line segment that drops to a terminal exiter,
		// - a flat line segment that extends to the very last exiter if it is censored
		if (currPoint.x != exiter.x && (exiter.event != 'censored' || !survived.length)) {
			currPoint = getCurrPoint(seriesId, exiter, count)
			data.push(currPoint)
		}
		currPoint[exiter.event].push(exiter.id)

		if (exiter.event == 'censored') {
			censored[exiter.id] = getCurrPoint(seriesId, exiter, currPoint.count)
		}
	}

	const tracker = data.reduce(computeSurvProb, { sprob: 1, censored, xVals: [] })

	return {
		seriesId,
		data,
		xVals: tracker.xVals,
		xMax: tracker.xVals[data.length - 1],
		censored: Object.values(censored)
	}
}

/*
	order array data ascending by x-value
*/
function sortBySurvivalTime(a, b) {
	return a.x == b.x ? 0 : a.x > b.x ? -1 : 1
}

/*
	Argument
	seriesId: string, identifies a group of data points
	exiter: see the argument for processSerieses
	count: integer, the number of remaining survivors

	Returns
	see below
*/
function getCurrPoint(seriesId, exiter, count) {
	const currPoint = {
		seriesId,
		x: exiter.x,
		id: exiter.id,
		fill: exiter.fill,
		metadataVals: exiter.metadataVals,
		count,
		censored: [],
		terminal: []
	}

	return currPoint
}

/*
	Compute survival probability for each
	data point in a survival curve series;
	Used as a reducer function

	Argument
	{
		sprob: startig probability of surviving, 1
		censored: {
			$exiterId: currPoint
		},
		xVals: [] empty array to track x-values
	} 
*/
function computeSurvProb(tracker, d) {
	d.atrisk = d.count
	d.survived = d.atrisk - d.terminal.length
	d.sprob = d.survived / d.atrisk
	tracker.sprob = tracker.sprob * d.sprob
	d.y = tracker.sprob
	d.censored.forEach(id => {
		const c = tracker.censored[id]
		c.atrisk = d.atrisk
		c.survived = d.survived
		c.sprob = d.sprob
		c.y = d.y
	})
	tracker.xVals.push(d.x)
	return tracker
}

/*
	Computes the logrank test score
	per https://www.ncbi.nlm.nih.gov/pmc/articles/PMC403858/

	Argument: 
	serieses = see input to processSerieses
	
	Returns 
	array of pairwise p-values information
	[
		{
			ids: [
				series0_id, 
				series1_id
			],
			colors: [
				series0_color, 
				series1_color
			],
			pvalue
		},
		...
	]
*/

export function logRank(serieses, opts) {
	const tracker = getLogRankTracker(serieses)
	const pValues = []

	// loop through seriesId's for pairwise p-value calculation
	while (tracker.ids.length > 1) {
		const s0 = tracker.ids.pop()
		if (tracker.totals[s0].remaining < opts.pValMinPop) continue

		tracker.ids.forEach(s1 => {
			if (tracker.totals[s1].remaining < opts.pValMinPop) return
			// original copy cannot be reused for tracking totals
			const ts0 = Object.assign({}, tracker.totals[s0])
			const ts1 = Object.assign({}, tracker.totals[s1])

			tracker.xVals.forEach(x => {
				const xs0 = tracker.byTime[x][s0]
				const xs1 = tracker.byTime[x][s1]
				const affected = xs0.terminal.length + xs1.terminal.length
				const remaining = ts0.remaining + ts1.remaining
				const expectedRate = affected / remaining

				ts0.expected += ts0.remaining > 0 ? expectedRate * ts0.remaining : 0
				ts0.remaining += -xs0.terminal.length - xs0.censored.length
				ts0.observed += xs0.terminal.length

				ts1.expected += ts1.remaining > 0 ? expectedRate * ts1.remaining : 0
				ts1.remaining += -xs1.terminal.length - xs1.censored.length
				ts1.observed += xs1.terminal.length
				//console.log(x, remaining, affected, expectedRate, [...xs0.terminal, ...xs1.terminal], [...xs0.censored, ...xs1.censored])
			})

			const sum0 = Math.pow(ts0.observed - ts0.expected, 2) / ts0.expected
			const sum1 = Math.pow(ts1.observed - ts1.expected, 2) / ts1.expected
			const sum = sum0 + sum1

			for (const r of chi2table) {
				if (r[1] > opts.pValCutoff) break
				if (sum > r[0]) {
					pValues.push({
						ids: [s0, s1],
						colors: tracker.colors,
						pvalue: '&lt;' + r[1]
					})
					break
				}
			}
		})
	}

	return pValues
}

/*
	Creates a tracking object per chart for 
	calculating log-rank test score

	Argument: 
	serieses = see input to processSerieses

	Returns 
	{
		xVals: [ xValue ]
		byTime: {
			$xValue: {
				$seriesId: {
					censored: [ exiter.id ],
					terminal: [ exiter.id ]
				}	
			}
		}, 
		ids: [ seriesId ], 
		totals: {
			// seeds running totals for tracking
			$seriesId: {
				remaining: 0,
				affected: 0,
				observed: 0,
				expected: 0
			}
		}, 
		colors
	}
*/

function getLogRankTracker(serieses) {
	const byTime = {}
	const totals = {}
	const ids = Object.keys(serieses)
	const xVals = []
	const colors = {}
	for (const seriesId in serieses) {
		colors[seriesId] = serieses[seriesId][0].fill
		totals[seriesId] = {
			remaining: 0,
			affected: 0,
			observed: 0,
			expected: 0
		}
		for (const exiter of serieses[seriesId]) {
			totals[seriesId].remaining++
			if (!byTime[exiter.x]) {
				xVals.push(+exiter.x)
				byTime[exiter.x] = {}
				ids.forEach(id => {
					byTime[exiter.x][id] = {
						terminal: [],
						censored: []
					}
				})
			}
			byTime[exiter.x][seriesId][exiter.event].push(exiter.id)
		}
	}
	xVals.sort((a, b) => a - b)
	return { xVals, byTime, ids, totals, colors }
}

/*
	chi^2 from 
	https://en.wikibooks.org/wiki/Engineering_Tables/Chi-Squared_Distibution
	or https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm
	assumes 1 degree of freedom, 2 groups being compared minus 1
*/
const chi2table = [
	// chi^2, p-val upper bound
	[10.828, 0.001],
	[9.55, 0.002],
	[7.879, 0.005],
	[6.635, 0.01],
	[5.024, 0.025],
	[3.841, 0.05],
	[2.706, 0.1],
	[1.642, 0.2],
	[1.323, 0.25],
	[0.455, 0.5],
	[0.102, 0.75],
	[0.0157, 0.9],
	[0.00393, 0.95],
	[0.000982, 0.975],
	[0.0000393, 0.995],
	[0, 1]
]
