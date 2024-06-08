// barchart renderer settings
export default JSON.stringify({
	orientation: 'horizontal', // vertical | horizontal
	h: {},
	relayTiles: false,
	svgw: 600,
	svgh: 400,
	unit: 'abs', // abs | pct
	scale: 'byChart', // byGroup | byChart
	currAge: 20,

	rowkey: 'dataId',
	rowgrpkey: 'rowgrp',
	colkey: 'seriesId',
	colgrpkey: 'colgrp',

	rowh: 22,
	colw: 36,

	rowspace: 1,
	colspace: 1,

	rowtick: 8,
	coltick: 5,
	rowlabtickspace: 0,
	collabtickspace: 0,

	collabelh: 100,
	rowlabelw: 100,
	rowheadleft: true,
	colheadtop: false,

	legendontop: false,
	legendh: 0,
	legendpadleft: 170,
	hidelegend: false,

	showgrid: true,
	gridstroke: '#fff',
	showEmptyCells: false,

	cellbg: '#eeeeee',

	fontsizeratio: 0.9,
	rowlabelfontsizemax: 16,
	collabelfontsizemax: 12,
	crudefill: true,
	duration: 1000,
	delay: 0,

	cellfontsize: 11,

	colgspace: 4,
	rowgspace: 4,
	rowglabspace: 5,

	colglabspace: 5,
	colgrplabelh: 25,
	rowgrplabelw: 25,

	rowglabfontsize: 15,
	rowglabfontsizemax: 25,
	colglabfontsize: 15,
	colglabfontsizemax: 25,
	borderwidth: 2,

	svgPadding: {
		top: 10,
		left: 30,
		right: 10,
		bottom: 30
	},

	exclude: {
		rows: [],
		cols: [],
		colgrps: [], // used when expanding a column group
		rowgrps: []
	},
	axisTitleFontSize: 16
})
