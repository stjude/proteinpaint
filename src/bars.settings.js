export default JSON.stringify({
    relayTiles: false,
    svgw: 400,
    svgh: 400,
    unit: "abs", // abs | pct
    scale: "byChart", // byGroup | byChart
    currAge: 20,

    rowkey: "chc",
    colkey: "age",
    colgrpkey: "colgrp",
    rowgrpkey: "rowgrp",

    rowh: 22,
    colw: 36,

    rowspace: 1,
    colspace: 1,

    rowtick: 8,
    coltick: 5,
    rowlabtickspace: 4,
    collabtickspace: 4,

    collabelh: 100,
    rowlabelw: 50,
    rowheadleft: true,
    colheadtop: false,
    legendontop: false,
    legendpadleft: 30,

    showgrid: true,
    gridstroke: "#fff",
    showEmptyCells: false,

    cellbg: "#eeeeee",

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
    axisTitleFontSize: 16,

    legendh: 0
})