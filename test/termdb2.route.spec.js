/*
  requires a running pp server
*/
const serverconfig = require("../serverconfig")
const request = require("request")
const tape = require("tape")

tape("\n", function(test) {
  test.pass("-***- termdb2 specs -***-")
  test.end()
})

tape("term1", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(5)

  const baseUrl =  "http://localhost:"
    + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
  
  const url0 = baseUrl + "&term0=" + "&term1=sex" + "&term2=" + "&ssid=" + "&mname="
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.charts.length, 1, "should have one chart data")
      test.deepEqual(data.charts[0].serieses.map(d=>d.seriesId), ["Male", "Female"], "should have two serieses")
      test.deepEqual(data.charts[0].serieses.map(d=>d.data.length), [1, 1], "should have one data item per series")
      test.deepEqual(
        JSON.parse(body), 
        {"charts":[{"chartId":"","total":9138,"serieses":[{"total":4981,"seriesId":"Male","data":[{"dataId":"","total":4981}]},{"total":4157,"seriesId":"Female","data":[{"dataId":"","total":4157}]}],"maxSeriesTotal":4981}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9138},"refs":{"cols":["Male","Female"],"colgrps":["-"],"rows":[""],"rowgrps":["-"],"col2name":{"Male":{"name":"Male","grp":"-"},"Female":{"name":"Female","grp":"-"}},"row2name":{"":{"name":"","grp":"-"}}},"maxAcrossCharts":4981},
        "should produce the expected nested data"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url1 = baseUrl + "&term0=" + "&term1=unknown" + "&term2=" + "&ssid=" + "&mname="
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    // the status on error should not be 200, but will do for now
    case 200:
      const data = JSON.parse(body)
      test.deepEqual(data, {error: 'Unknown term1="unknown"'}, "should error on unknown term1")
      break;
    default:
      test.fail("invalid status")
    }
  })
})

tape("term1 + term2", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(5)

  const baseUrl = "http://localhost:"
    + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
  
  const url0 = baseUrl + "&term0=" + "&term1=sex" + "&term2=racegrp" + "&ssid=" + "&mname="
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.charts.length, 1, "should have one chart data")
      test.deepEqual(data.charts[0].serieses.map(d=>d.seriesId), ["Male", "Female"], "should have two serieses")
      test.deepEqual(data.charts[0].serieses.map(d=>d.data.length), [4, 4], "should have the expected number of data items in each series")
      test.deepEqual(
        JSON.parse(body), 
        {"charts":[{"chartId":"","total":9138,"serieses":[{"total":4981,"seriesId":"Male","data":[{"dataId":"White","total":3998},{"dataId":"Black","total":806},{"dataId":"Other","total":167},{"dataId":"Unknown","total":10}]},{"total":4157,"seriesId":"Female","data":[{"dataId":"White","total":3264},{"dataId":"Black","total":740},{"dataId":"Other","total":145},{"dataId":"Unknown","total":8}]}],"maxSeriesTotal":4981}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9138},"refs":{"cols":["Male","Female"],"colgrps":["-"],"rows":["White","Black","Other","Unknown"],"rowgrps":["-"],"col2name":{"Male":{"name":"Male","grp":"-"},"Female":{"name":"Female","grp":"-"}},"row2name":{"White":{"name":"White","grp":"-"},"Black":{"name":"Black","grp":"-"},"Other":{"name":"Other","grp":"-"},"Unknown":{"name":"Unknown","grp":"-"}}},"maxAcrossCharts":4981},
        "should produce the expected nested data"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url1 = baseUrl + "&term0=" + "&term1=sex" + "&term2=missing" + "&ssid=" + "&mname="
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    // the status on error should not be 200, but will do for now
    case 200:
      const data = JSON.parse(body)
      test.deepEqual(data, {error: 'Unknown term2="missing"'}, "should error on unknown term2")
      break;
    default:
      test.fail("invalid status")
    }
  })
})

tape("term0 + term1 + term2", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(5)

  const baseUrl = "http://localhost:"
    + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
  
  const url0 = baseUrl + "&term0=sex" + "&term1=racegrp" + "&term2=agedx" + "&ssid=" + "&mname="
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.charts.length, 2, "should have more than one chart data")
      test.deepEqual(data.charts[0].serieses.map(d=>d.seriesId), [ 'White', 'Black', 'Other', 'Unknown' ], "should have two serieses")
      test.deepEqual(data.charts[0].serieses.map(d=>d.data.length), [ 14, 14, 12, 8 ], "should have the expected number of data items in each series")
      test.deepEqual(
        JSON.parse(body), 
        {"charts":[{"chartId":"Male","total":4980,"serieses":[{"total":3997,"seriesId":"White","data":[{"dataId":13,"total":305},{"dataId":15,"total":323},{"dataId":4,"total":504},{"dataId":3,"total":637},{"dataId":1,"total":625},{"dataId":11,"total":272},{"dataId":12,"total":295},{"dataId":7,"total":320},{"dataId":9,"total":253},{"dataId":10,"total":246},{"dataId":18,"total":153},{"dataId":25,"total":1},{"dataId":28,"total":1},{"dataId":24,"total":1}]},{"total":806,"seriesId":"Black","data":[{"dataId":4,"total":90},{"dataId":7,"total":59},{"dataId":6,"total":64},{"dataId":2,"total":124},{"dataId":10,"total":81},{"dataId":19,"total":18},{"dataId":3,"total":123},{"dataId":9,"total":62},{"dataId":13,"total":72},{"dataId":20,"total":7},{"dataId":18,"total":25},{"dataId":22,"total":2},{"dataId":23,"total":1},{"dataId":24,"total":1}]},{"total":167,"seriesId":"Other","data":[{"dataId":12,"total":15},{"dataId":3,"total":38},{"dataId":0,"total":36},{"dataId":11,"total":9},{"dataId":18,"total":4},{"dataId":14,"total":11},{"dataId":20,"total":2},{"dataId":9,"total":13},{"dataId":15,"total":6},{"dataId":16,"total":3},{"dataId":7,"total":14},{"dataId":21,"total":1}]},{"total":10,"seriesId":"Unknown","data":[{"dataId":14,"total":1},{"dataId":2,"total":2},{"dataId":0,"total":2},{"dataId":20,"total":1},{"dataId":3,"total":1},{"dataId":8,"total":1},{"dataId":4,"total":2},{"dataId":16,"total":1}]}],"maxSeriesTotal":3997},{"chartId":"Female","total":4157,"serieses":[{"total":3264,"seriesId":"White","data":[{"dataId":14,"total":300},{"dataId":0,"total":610},{"dataId":2,"total":704},{"dataId":5,"total":428},{"dataId":8,"total":272},{"dataId":16,"total":269},{"dataId":6,"total":358},{"dataId":17,"total":240},{"dataId":21,"total":19},{"dataId":19,"total":74},{"dataId":20,"total":38},{"dataId":22,"total":7},{"dataId":23,"total":5},{"dataId":27,"total":1}]},{"total":740,"seriesId":"Black","data":[{"dataId":1,"total":134},{"dataId":5,"total":85},{"dataId":14,"total":73},{"dataId":17,"total":54},{"dataId":8,"total":80},{"dataId":0,"total":121},{"dataId":12,"total":77},{"dataId":15,"total":83},{"dataId":16,"total":51},{"dataId":11,"total":58},{"dataId":21,"total":1}]},{"total":145,"seriesId":"Other","data":[{"dataId":2,"total":28},{"dataId":5,"total":27},{"dataId":13,"total":9},{"dataId":4,"total":12},{"dataId":1,"total":32},{"dataId":10,"total":10},{"dataId":6,"total":12},{"dataId":17,"total":11},{"dataId":8,"total":19}]},{"total":8,"seriesId":"Unknown","data":[{"dataId":6,"total":1},{"dataId":10,"total":1},{"dataId":7,"total":2},{"dataId":5,"total":1},{"dataId":18,"total":1},{"dataId":12,"total":1}]}],"maxSeriesTotal":3264}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9137},"refs":{"cols":["White","Black","Other","Unknown"],"colgrps":["-"],"rows":[13,15,4,14,0,1,3,2,5,11,8,12,16,6,7,9,17,10,21,19,18,20,25,22,23,28,24,27],"rowgrps":["-"],"col2name":{"White":{"name":"White","grp":"-"},"Black":{"name":"Black","grp":"-"},"Other":{"name":"Other","grp":"-"},"Unknown":{"name":"Unknown","grp":"-"}},"row2name":{"0":{"name":0,"grp":"-"},"1":{"name":1,"grp":"-"},"2":{"name":2,"grp":"-"},"3":{"name":3,"grp":"-"},"4":{"name":4,"grp":"-"},"5":{"name":5,"grp":"-"},"6":{"name":6,"grp":"-"},"7":{"name":7,"grp":"-"},"8":{"name":8,"grp":"-"},"9":{"name":9,"grp":"-"},"10":{"name":10,"grp":"-"},"11":{"name":11,"grp":"-"},"12":{"name":12,"grp":"-"},"13":{"name":13,"grp":"-"},"14":{"name":14,"grp":"-"},"15":{"name":15,"grp":"-"},"16":{"name":16,"grp":"-"},"17":{"name":17,"grp":"-"},"18":{"name":18,"grp":"-"},"19":{"name":19,"grp":"-"},"20":{"name":20,"grp":"-"},"21":{"name":21,"grp":"-"},"22":{"name":22,"grp":"-"},"23":{"name":23,"grp":"-"},"24":{"name":24,"grp":"-"},"25":{"name":25,"grp":"-"},"27":{"name":27,"grp":"-"},"28":{"name":28,"grp":"-"}}},"maxAcrossCharts":3997},
        "should produce the expected nested data"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url1 = baseUrl + "&term0=unknown" + "&term1=sex" + "&term2=racegrp" + "&ssid=" + "&mname="
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    // the status on error should not be 200, but will do for now
    case 200:
      const data = JSON.parse(body)
      test.deepEqual(data, {error: 'Unknown term0="unknown"'}, "should error on unknown term0")
      break;
    default:
      test.fail("invalid status")
    }
  })
})
