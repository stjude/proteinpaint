/*
  requires a running pp server
*/
const serverconfig = require("../serverconfig")
const Partjson = require('../modules/partjson')
const request = require("request")
const tape = require("tape")

/* helper functions are found below after the tests */

tape("\n", function(test) {
  test.pass("-***- termdb.sql specs -***-")
  test.end()
})

tape("single, categorical", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(2)
  
  compareResponseData(
    test, 
    getSqlUrl('diaggrp'), 
    getBarUrl('diaggrp'), 
    "should produce the expected UNFILTERED sample counts by diagnosis groups"
  )

  const filter = [{
    "values":[{"key":"Male","label":"Male"}],
    "term":{"id":"sex","name":"Sex","iscategorical":true}
  }]
  compareResponseData(
    test,
    getSqlUrl('diaggrp', '', filter), 
    getBarUrl('diaggrp', '', filter), 
    "should produce the expected FILTERED sample counts by diagnosis groups"
  )
})


tape("single, numerical", function (test) {
  test.plan(2)
  compareResponseData(
    test, 
    getSqlUrl('agedx'), 
    getBarUrl('agedx'), 
    "should produce the expected UNFILTERED sample counts by age of diagnosis"
  )
  
  const filter = [{
    term: {id:'sex', name:'sex', iscategorical:true},
    values: [{key: 'Male', label: 'Female'}]
  }]
  compareResponseData(
    test,
    getSqlUrl('agedx', '', filter), 
    getBarUrl('agedx', '', filter), 
    "should produce the expected FILTERED sample counts by age of diagnosis"
  )
})

/* 
    TO-DO: convert the remaining tests to use compareResponseData()

tape("single, condition isleaf", function (test) {
  test.plan(6)
  const url0 = baseUrl + '&term1_id=Asthma&term1_q='+encodeURIComponent('{"value_by_max_grade":1}')
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 3, "should have the expected number of UNFILTERED ISLEAF max grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        {"lst":[{"key":1,"samplecount":141,"label":"1: Mild"},{"key":2,"samplecount":123,"label":"2: Moderate"},{"key":3,"samplecount":78,"label":"3: Severe"}]},
        "should produce the expected UNFILTERED ISLEAF sample by max grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url1 = baseUrl
    + '&term1_id=Asthma'
    + '&term1_q='+encodeURIComponent('{"value_by_max_grade":1}')
    + '&tvslst='+encodeURIComponent(JSON.stringify([{
      term: {id:'sex', name:'sex', iscategorical:true},
      values: [{key: 'Male', label: 'Male'}]
    }]));
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 3, "should have the expected number of FILTERED ISLEAF max grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 1, samplecount: 69, label: '1: Mild' }, { key: 2, samplecount: 49, label: '2: Moderate' }, { key: 3, samplecount: 33, label: '3: Severe' } ] },
        "should produce the expected FILTERED ISLEAF sample by max grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url2 = baseUrl + '&term1_id=Asthma&term1_q='+encodeURIComponent('{"value_by_most_recent":1}')
  request(url2,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 3, "should have the expected number of unfiltered most recent grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 1, samplecount: 159, label: '1: Mild' }, { key: 2, samplecount: 122, label: '2: Moderate' }, { key: 3, samplecount: 61, label: '3: Severe' } ] },
        "should produce the expected unfiltered sample by most recent grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})

tape("single, condition non-leaf", function (test) {
  test.plan(10)
  const url0 = baseUrl + '&term1_id=Cardiovascular+System&term1_q='+encodeURIComponent('{"value_by_max_grade":1,"bar_by_grade":1}')
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 4, "should have the expected number of UNFILTERED NON-LEAF max grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 1, samplecount: 1556, label: '1: Mild' }, { key: 2, samplecount: 1013, label: '2: Moderate' }, { key: 3, samplecount: 461, label: '3: Severe' }, { key: 4, samplecount: 140, label: '4: Life-threatening' } ] },
        "should produce the expected UNFILTERED NON-LEAF sample by max grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url1 = baseUrl
    + '&term1_id=Cardiovascular+System'
    + '&term1_q='+encodeURIComponent('{"value_by_max_grade":1,"bar_by_grade":1}')
    + '&tvslst='+encodeURIComponent(JSON.stringify([{
      term: {id:'sex', name:'sex', iscategorical:true},
      values: [{key: 'Male', label: 'Male'}]
    }]));
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 4, "should have the expected number of FILTERED NON-LEAF max grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 1, samplecount: 841, label: '1: Mild' }, { key: 2, samplecount: 556, label: '2: Moderate' }, { key: 3, samplecount: 262, label: '3: Severe' }, { key: 4, samplecount: 91, label: '4: Life-threatening' } ] },
        "should produce the expected FILTERED NON-LEAF sample by max grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url2 = baseUrl 
    + '&term1_id=Cardiovascular+System'
    + '&term1_q='+encodeURIComponent('{"value_by_max_grade":1,"bar_by_grade":1}')
  request(url2,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 4, "should have the expected number of unfiltered NON-LEAF most recent grade lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 1, samplecount: 1556, label: '1: Mild' }, { key: 2, samplecount: 1013, label: '2: Moderate' }, { key: 3, samplecount: 461, label: '3: Severe' }, { key: 4, samplecount: 140, label: '4: Life-threatening' } ] },
        "should produce the expected unfiltered NON-LEAF sample by most recent grade counts by Asthma"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })


  const url3 = baseUrl 
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_max_grade":1}')
  request(url3,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 6, "should have the expected UNFILTERED results for Arrhythmias, by subcondition, max grade")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 'Atrioventricular heart block', samplecount: 43, label: 'Atrioventricular heart block' }, { key: 'Cardiac dysrhythmia', samplecount: 105, label: 'Cardiac dysrhythmia' }, { key: 'Conduction abnormalities', samplecount: 744, label: 'Conduction abnormalities' }, { key: 'Prolonged QT interval', samplecount: 140, label: 'Prolonged QT interval' }, { key: 'Sinus bradycardia', samplecount: 42, label: 'Sinus bradycardia' }, { key: 'Sinus tachycardia', samplecount: 77, label: 'Sinus tachycardia' } ] },
        "should produce the expected UNFILTERED results for Arrhythmias, by subcondition, max grade"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url4 = baseUrl
    + '&term1_id=Arrhythmias'
    + '&term1_q=' + encodeURIComponent('{"bar_by_children":1,"value_by_most_recent":1}')
    + '&tvslst='+encodeURIComponent(JSON.stringify([{
      term: {id:'sex', name:'sex', iscategorical:true},
      values: [{key: 'Male', label: 'Male'}]
    }]));
  request(url4,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 6, "should have the expected number of FILTERED results for Arrhythmias, by subcondition, most recent")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 'Atrioventricular heart block', samplecount: 31, label: 'Atrioventricular heart block' }, { key: 'Cardiac dysrhythmia', samplecount: 42, label: 'Cardiac dysrhythmia' }, { key: 'Conduction abnormalities', samplecount: 491, label: 'Conduction abnormalities' }, { key: 'Prolonged QT interval', samplecount: 60, label: 'Prolonged QT interval' }, { key: 'Sinus bradycardia', samplecount: 37, label: 'Sinus bradycardia' }, { key: 'Sinus tachycardia', samplecount: 31, label: 'Sinus tachycardia' } ] },
        "should produce the expected FILTERED results for Arrhythmias, by subcondition, most recent grade"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})

tape("condition child-grade overlay", function (test) {
  test.plan(4)

  const url0 = baseUrl
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_max_grade":1,"grade_child_overlay":1}')
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 16, "should have the number of list items for Arrhythmias, by subcondition, max grade")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key1: 'Atrioventricular heart block', key2: 1, samplecount: 33, label1: 'Atrioventricular heart block', label2: 1 }, { key1: 'Cardiac dysrhythmia', key2: 1, samplecount: 34, label1: 'Cardiac dysrhythmia', label2: 1 }, { key1: 'Conduction abnormalities', key2: 1, samplecount: 774, label1: 'Conduction abnormalities', label2: 1 }, { key1: 'Prolonged QT interval', key2: 1, samplecount: 133, label1: 'Prolonged QT interval', label2: 1 }, { key1: 'Sinus bradycardia', key2: 1, samplecount: 75, label1: 'Sinus bradycardia', label2: 1 }, { key1: 'Sinus tachycardia', key2: 1, samplecount: 124, label1: 'Sinus tachycardia', label2: 1 }, { key1: 'Atrioventricular heart block', key2: 2, samplecount: 12, label1: 'Atrioventricular heart block', label2: 2 }, { key1: 'Cardiac dysrhythmia', key2: 2, samplecount: 40, label1: 'Cardiac dysrhythmia', label2: 2 }, { key1: 'Conduction abnormalities', key2: 2, samplecount: 35, label1: 'Conduction abnormalities', label2: 2 }, { key1: 'Prolonged QT interval', key2: 2, samplecount: 77, label1: 'Prolonged QT interval', label2: 2 }, { key1: 'Sinus tachycardia', key2: 2, samplecount: 11, label1: 'Sinus tachycardia', label2: 2 }, { key1: 'Atrioventricular heart block', key2: 3, samplecount: 9, label1: 'Atrioventricular heart block', label2: 3 }, { key1: 'Cardiac dysrhythmia', key2: 3, samplecount: 27, label1: 'Cardiac dysrhythmia', label2: 3 }, { key1: 'Conduction abnormalities', key2: 3, samplecount: 7, label1: 'Conduction abnormalities', label2: 3 }, { key1: 'Prolonged QT interval', key2: 3, samplecount: 10, label1: 'Prolonged QT interval', label2: 3 }, { key1: 'Cardiac dysrhythmia', key2: 4, samplecount: 10, label1: 'Cardiac dysrhythmia', label2: 4 } ] },
        "should have the expected results for Arrhythmias, by subcondition, max grade"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url1 = baseUrl 
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_most_recent":1,"grade_child_overlay":1}')
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 16, "should have the number of list items for Arrhythmias, by subcondition, most recent grade")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key1: 'Atrioventricular heart block', key2: 1, samplecount: 33, label1: 'Atrioventricular heart block', label2: 1 }, { key1: 'Cardiac dysrhythmia', key2: 1, samplecount: 36, label1: 'Cardiac dysrhythmia', label2: 1 }, { key1: 'Conduction abnormalities', key2: 1, samplecount: 783, label1: 'Conduction abnormalities', label2: 1 }, { key1: 'Prolonged QT interval', key2: 1, samplecount: 141, label1: 'Prolonged QT interval', label2: 1 }, { key1: 'Sinus bradycardia', key2: 1, samplecount: 75, label1: 'Sinus bradycardia', label2: 1 }, { key1: 'Sinus tachycardia', key2: 1, samplecount: 128, label1: 'Sinus tachycardia', label2: 1 }, { key1: 'Atrioventricular heart block', key2: 2, samplecount: 12, label1: 'Atrioventricular heart block', label2: 2 }, { key1: 'Cardiac dysrhythmia', key2: 2, samplecount: 41, label1: 'Cardiac dysrhythmia', label2: 2 }, { key1: 'Conduction abnormalities', key2: 2, samplecount: 26, label1: 'Conduction abnormalities', label2: 2 }, { key1: 'Prolonged QT interval', key2: 2, samplecount: 71, label1: 'Prolonged QT interval', label2: 2 }, { key1: 'Sinus tachycardia', key2: 2, samplecount: 7, label1: 'Sinus tachycardia', label2: 2 }, { key1: 'Atrioventricular heart block', key2: 3, samplecount: 9, label1: 'Atrioventricular heart block', label2: 3 }, { key1: 'Cardiac dysrhythmia', key2: 3, samplecount: 24, label1: 'Cardiac dysrhythmia', label2: 3 }, { key1: 'Conduction abnormalities', key2: 3, samplecount: 7, label1: 'Conduction abnormalities', label2: 3 }, { key1: 'Prolonged QT interval', key2: 3, samplecount: 8, label1: 'Prolonged QT interval', label2: 3 }, { key1: 'Cardiac dysrhythmia', key2: 4, samplecount: 10, label1: 'Cardiac dysrhythmia', label2: 4 } ] },
        "should have the expected results for Arrhythmias, by subcondition, most recent grade"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})

tape.only("non-leaf condition with overlay", function (test) {
  test.plan(6)

  const expected0 = {"lst":[{"key1":"Atrioventricular heart block","key2":"Black","samplecount":8,"label1":"Atrioventricular heart block","label2":"Black"},{"key1":"Atrioventricular heart block","key2":"Other","samplecount":1,"label1":"Atrioventricular heart block","label2":"Other"},{"key1":"Atrioventricular heart block","key2":"White","samplecount":45,"label1":"Atrioventricular heart block","label2":"White"},{"key1":"Cardiac dysrhythmia","key2":"Black","samplecount":8,"label1":"Cardiac dysrhythmia","label2":"Black"},{"key1":"Cardiac dysrhythmia","key2":"White","samplecount":103,"label1":"Cardiac dysrhythmia","label2":"White"},{"key1":"Conduction abnormalities","key2":"Black","samplecount":64,"label1":"Conduction abnormalities","label2":"Black"},{"key1":"Conduction abnormalities","key2":"Other","samplecount":11,"label1":"Conduction abnormalities","label2":"Other"},{"key1":"Conduction abnormalities","key2":"Unknown","samplecount":1,"label1":"Conduction abnormalities","label2":"Unknown"},{"key1":"Conduction abnormalities","key2":"White","samplecount":740,"label1":"Conduction abnormalities","label2":"White"},{"key1":"Prolonged QT interval","key2":"Black","samplecount":29,"label1":"Prolonged QT interval","label2":"Black"},{"key1":"Prolonged QT interval","key2":"Other","samplecount":1,"label1":"Prolonged QT interval","label2":"Other"},{"key1":"Prolonged QT interval","key2":"White","samplecount":190,"label1":"Prolonged QT interval","label2":"White"},{"key1":"Sinus bradycardia","key2":"Black","samplecount":9,"label1":"Sinus bradycardia","label2":"Black"},{"key1":"Sinus bradycardia","key2":"Other","samplecount":1,"label1":"Sinus bradycardia","label2":"Other"},{"key1":"Sinus bradycardia","key2":"White","samplecount":65,"label1":"Sinus bradycardia","label2":"White"},{"key1":"Sinus tachycardia","key2":"Black","samplecount":14,"label1":"Sinus tachycardia","label2":"Black"},{"key1":"Sinus tachycardia","key2":"White","samplecount":121,"label1":"Sinus tachycardia","label2":"White"}]}

  const url0 = baseUrl
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_max_grade":1}')
    + '&term2_id=racegrp'

  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 17, "should have the number of list items for Arrhythmias, by subcondition with CATEGORICAL (racegrp) overlay")
      test.deepEqual(
        JSON.parse(body),
        expected0,
        "should have the expected results for Arrhythmias, by subcondition with CATEGORICAL (racegrp) overlay"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  // when overlaying on top of bars by children, the configuration max grade or most recent grade should not matter
  // the same result should be produced with either configuration or no grade at all
  const url0a = baseUrl
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_most_recent":1}')
    + '&term2_id=racegrp'; console.log(url0a, url0)
    
  request(url0a,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 17, "should have the same number of list items for Arrhythmias most recent as max-grade, by subcondition with CATEGORICAL (racegrp) overlay")
      test.deepEqual(
        JSON.parse(body),
        expected0,
        "should have the expected results for Arrhythmias most recent as max-grade, by subcondition with CATEGORICAL (racegrp) overlay"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url2 = baseUrl
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_max_grade":1}')
    + '&term2_id=agedx'

  request(url2,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 18, "should have the number of list items for Arrhythmias, by subcondition with NUMERICAL (agedx) overlay")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key1: 'Atrioventricular heart block', key2: '0 <= x < 5', samplecount: 9, label1: 'Atrioventricular heart block', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Atrioventricular heart block', key2: '10 <= x < 15', samplecount: 23, label1: 'Atrioventricular heart block', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Atrioventricular heart block', key2: '5 <= x < 10', samplecount: 8, label1: 'Atrioventricular heart block', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } }, { key1: 'Cardiac dysrhythmia', key2: '0 <= x < 5', samplecount: 31, label1: 'Cardiac dysrhythmia', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Cardiac dysrhythmia', key2: '10 <= x < 15', samplecount: 25, label1: 'Cardiac dysrhythmia', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Cardiac dysrhythmia', key2: '5 <= x < 10', samplecount: 30, label1: 'Cardiac dysrhythmia', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } }, { key1: 'Conduction abnormalities', key2: '0 <= x < 5', samplecount: 294, label1: 'Conduction abnormalities', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Conduction abnormalities', key2: '10 <= x < 15', samplecount: 190, label1: 'Conduction abnormalities', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Conduction abnormalities', key2: '5 <= x < 10', samplecount: 184, label1: 'Conduction abnormalities', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } }, { key1: 'Prolonged QT interval', key2: '0 <= x < 5', samplecount: 52, label1: 'Prolonged QT interval', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Prolonged QT interval', key2: '10 <= x < 15', samplecount: 61, label1: 'Prolonged QT interval', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Prolonged QT interval', key2: '5 <= x < 10', samplecount: 43, label1: 'Prolonged QT interval', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } }, { key1: 'Sinus bradycardia', key2: '0 <= x < 5', samplecount: 32, label1: 'Sinus bradycardia', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Sinus bradycardia', key2: '10 <= x < 15', samplecount: 16, label1: 'Sinus bradycardia', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Sinus bradycardia', key2: '5 <= x < 10', samplecount: 13, label1: 'Sinus bradycardia', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } }, { key1: 'Sinus tachycardia', key2: '0 <= x < 5', samplecount: 55, label1: 'Sinus tachycardia', label2: '0 <= x < 5', range2: { start: 0, stop: 5, startinclusive: 1, label: '0-4 Years', name: '0 <= x < 5' } }, { key1: 'Sinus tachycardia', key2: '10 <= x < 15', samplecount: 30, label1: 'Sinus tachycardia', label2: '10 <= x < 15', range2: { start: 10, stop: 15, startinclusive: 1, label: '10-14 Years', name: '10 <= x < 15' } }, { key1: 'Sinus tachycardia', key2: '5 <= x < 10', samplecount: 23, label1: 'Sinus tachycardia', label2: '5 <= x < 10', range2: { start: 5, stop: 10, startinclusive: 1, label: '5-9 Years', name: '5 <= x < 10' } } ] },
        "should have the expected results for Arrhythmias, by subcondition with NUMERICAL (agedx) overlay"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})
*/

function getSqlUrl(term1, term2, filter = null) {
  return "http://localhost:" + serverconfig.port
    + "/termdb?genome=hg38"
    + "&dslabel=SJLife"
    + "&testplot=1"
    + '&term1_id=' + term1
    + (term2 ? '&term2_id=' + term2 : '')
    + (filter ? '&tvslst='+encodeURIComponent(JSON.stringify(filter)) : '')
}

function getBarUrl(term1, term2='', filter=[], customBins={}) {
  return "http://localhost:" + serverconfig.port
    + "/termdb-barchart?genome=hg38"
    + "&dslabel=SJLife"
    + "&term1=" + term1
    + "&term2=" + term2
    + "&filter=" + encodeURIComponent(JSON.stringify(filter))
    + "&custom_bins=" + encodeURIComponent(JSON.stringify(customBins))
}

const template = JSON.stringify({
  "@errmode": ["","","",""],
  results: {
    "@join()": {
      chart: "=chart()"
    },
    charts: [{
      "@join()": {
        series: "=series()"
      },
      chartId: "@key",
      total: "+&chart.value",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        "@join()": {
          data: "=data()"
        },
        total: "+&series.value",
        seriesId: "@key",
        data: [{
          dataId: "@key",
          total: "&data.value",
        }, "&data.id"],
      }, "&series.id"]
    }, "&chart.id"],
    "__:boxplot": "=boxplot1()",
    "_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    }
  }
})

const externals = {
  chart(row) {
    return {
      id: "",
      value: row.samplecount
    } 
  },
  series(row) {
    return {
      id: 'key1' in row ? row.key1 : row.key,
      value: row.samplecount
    } 
  },
  data(row) {
    return {
      id: 'key2' in row ? row.key2 : '',
      value: row.samplecount
    } 
  },
  maxSeriesTotal(row, context) {
    let maxSeriesTotal = 0
    for(const grp of context.self.serieses) {
      if (grp && grp.total > maxSeriesTotal) {
        maxSeriesTotal = grp.total
      }
    }
    return maxSeriesTotal
  }
}

function chartSorter(a,b) {
  return a.chartId < b.chartId ? -1 : 1
}

function seriesSorter(a,b) {
  return a.seriesId < b.seriesId ? -1 : 1
}

function dataSorter(a,b) {
  return a.dataId < b.dataId ? -1 : 1
}

function sortResults(charts) {
  charts.sort(chartSorter)
  for(const chart of charts) {
    chart.serieses.sort(seriesSorter)
    for(const series of chart.serieses) {
      series.data.sort(dataSorter)
    }
  }
}

function compareResponseData(test, url0, url1, mssg) {
  request(url0, (error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
      case 200:
        const data = JSON.parse(body);
        const pj = new Partjson({
          data: data.lst,
          seed: `{"values": []}`, // result seed 
          template,
          "=": externals
        })
        sortResults(pj.tree.results.charts)
        request(url1, (error,response,body1)=>{
          const data1 = JSON.parse(body1)
          sortResults(data1.charts)
          //console.log(JSON.stringify(data1.charts[0]));
          //console.log('----')
          //console.log(JSON.stringify(pj.tree.results.charts[0]));

          if(error) {
            test.fail(error)
          }
          switch(response.statusCode) {
          case 200:
            test.deepEqual(
              pj.tree.results.charts,
              data1.charts,
              mssg
            )
          break;
          default:
            test.fail("invalid status")
          }
        })
        break;
      default:
        test.fail("invalid status")
      }
    })
}

