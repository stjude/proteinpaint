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
        {"charts":[{"chartId":"","total":9138,"serieses":[{"total":4981,"seriesId":"Male","data":[{"dataId":"","total":4981}]},{"total":4157,"seriesId":"Female","data":[{"dataId":"","total":4157}]}],"maxSeriesTotal":4981}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9138},"refs":{"cols":["Male","Female"],"colgrps":["-"],"rows":[""],"rowgrps":["-"],"col2name":{"Male":{"name":"Male","grp":"-"},"Female":{"name":"Female","grp":"-"}},"row2name":{"":{"name":"","grp":"-"}},"useColOrder":false,"unannotatedLabels":{"term1":"","term2":""}},"maxAcrossCharts":4981},
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
        {"charts":[{"chartId":"","total":9138,"serieses":[{"total":4981,"seriesId":"Male","data":[{"dataId":"White","total":3998},{"dataId":"Black","total":806},{"dataId":"Other","total":167},{"dataId":"Unknown","total":10}]},{"total":4157,"seriesId":"Female","data":[{"dataId":"White","total":3264},{"dataId":"Black","total":740},{"dataId":"Other","total":145},{"dataId":"Unknown","total":8}]}],"maxSeriesTotal":4981}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9138},"refs":{"cols":["Male","Female"],"colgrps":["-"],"rows":["White","Black","Other","Unknown"],"rowgrps":["-"],"col2name":{"Male":{"name":"Male","grp":"-"},"Female":{"name":"Female","grp":"-"}},"row2name":{"White":{"name":"White","grp":"-"},"Black":{"name":"Black","grp":"-"},"Other":{"name":"Other","grp":"-"},"Unknown":{"name":"Unknown","grp":"-"}},"useColOrder":false,"unannotatedLabels":{"term1":"","term2":""}},"maxAcrossCharts":4981},
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
      test.deepEqual(data.charts[0].serieses.map(d=>d.data.length), [ 4, 4, 4, 4 ], "should have the expected number of data items in each series")
      test.deepEqual(
        JSON.parse(body), 
        {"charts":[{"chartId":"Male","total":4980,"serieses":[{"total":3997,"seriesId":"White","data":[{"dataId":"10-14 years","total":769},{"dataId":">15 years","total":654},{"dataId":"0-4 years","total":1652},{"dataId":"5-9 years","total":922}]},{"total":806,"seriesId":"Black","data":[{"dataId":"0-4 years","total":294},{"dataId":"5-9 years","total":199},{"dataId":"10-14 years","total":186},{"dataId":">15 years","total":127}]},{"total":167,"seriesId":"Other","data":[{"dataId":"10-14 years","total":28},{"dataId":"0-4 years","total":76},{"dataId":">15 years","total":18},{"dataId":"5-9 years","total":45}]},{"total":10,"seriesId":"Unknown","data":[{"dataId":"10-14 years","total":1},{"dataId":"0-4 years","total":6},{"dataId":">15 years","total":2},{"dataId":"5-9 years","total":1}]}],"maxSeriesTotal":3997},{"chartId":"Female","total":4157,"serieses":[{"total":3264,"seriesId":"White","data":[{"dataId":"10-14 years","total":649},{"dataId":"0-4 years","total":1428},{"dataId":"5-9 years","total":709},{"dataId":">15 years","total":478}]},{"total":740,"seriesId":"Black","data":[{"dataId":"0-4 years","total":298},{"dataId":"5-9 years","total":151},{"dataId":"10-14 years","total":175},{"dataId":">15 years","total":116}]},{"total":145,"seriesId":"Other","data":[{"dataId":"0-4 years","total":70},{"dataId":"5-9 years","total":40},{"dataId":"10-14 years","total":26},{"dataId":">15 years","total":9}]},{"total":8,"seriesId":"Unknown","data":[{"dataId":"5-9 years","total":4},{"dataId":"10-14 years","total":2},{"dataId":">15 years","total":1},{"dataId":"0-4 years","total":1}]}],"maxSeriesTotal":3264}],"unannotated":{"label":"","label_unannotated":"","value":0,"value_annotated":9137},"refs":{"cols":["White","Black","Other","Unknown"],"colgrps":["-"],"rows":["10-14 years",">15 years","0-4 years","5-9 years"],"rowgrps":["-"],"col2name":{"White":{"name":"White","grp":"-"},"Black":{"name":"Black","grp":"-"},"Other":{"name":"Other","grp":"-"},"Unknown":{"name":"Unknown","grp":"-"}},"row2name":{"10-14 years":{"name":"10-14 years","grp":"-"},">15 years":{"name":">15 years","grp":"-"},"0-4 years":{"name":"0-4 years","grp":"-"},"5-9 years":{"name":"5-9 years","grp":"-"}},"useColOrder":false,"unannotatedLabels":{"term1":"","term2":""}},"maxAcrossCharts":3997},
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
