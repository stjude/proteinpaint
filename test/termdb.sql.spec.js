/*
  requires a running pp server
*/
const serverconfig = require("../serverconfig")
const request = require("request")
const tape = require("tape")
const baseUrl =  "http://localhost:"
    + serverconfig.port
    + "/termdb?genome=hg38"
    + "&dslabel=SJLife"
    + "&testplot=1"

tape("\n", function(test) {
  test.pass("-***- termdb.sql specs -***-")
  test.end()
})

tape("single, categorical", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(4)
  const url0 = baseUrl + '&term1_id=diaggrp'
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 27, "should have the expected number of UNFILTERED lst items")
      test.deepEqual(
        JSON.parse(body), 
        {"lst":[{"key":"Acute lymphoblastic leukemia","samplecount":2441,"label":"Acute lymphoblastic leukemia"},{"key":"Acute myeloid leukemia","samplecount":388,"label":"Acute myeloid leukemia"},{"key":"Blood disorder","samplecount":2,"label":"Blood disorder"},{"key":"Central nervous system (CNS)","samplecount":1657,"label":"Central nervous system (CNS)"},{"key":"Chronic myeloid leukemia","samplecount":66,"label":"Chronic myeloid leukemia"},{"key":"Colon carcinoma","samplecount":14,"label":"Colon carcinoma"},{"key":"Ewing sarcoma family of tumors","samplecount":246,"label":"Ewing sarcoma family of tumors"},{"key":"Germ cell tumor","samplecount":188,"label":"Germ cell tumor"},{"key":"Histiocytosis","samplecount":89,"label":"Histiocytosis"},{"key":"Hodgkin lymphoma","samplecount":864,"label":"Hodgkin lymphoma"},{"key":"Liver malignancies","samplecount":66,"label":"Liver malignancies"},{"key":"MDS/Acute myeloid leukemia","samplecount":10,"label":"MDS/Acute myeloid leukemia"},{"key":"Melanoma","samplecount":81,"label":"Melanoma"},{"key":"Myelodysplastic syndrome","samplecount":24,"label":"Myelodysplastic syndrome"},{"key":"Nasopharyngeal carcinoma","samplecount":59,"label":"Nasopharyngeal carcinoma"},{"key":"Nephroblastomatosis","samplecount":1,"label":"Nephroblastomatosis"},{"key":"Neuroblastoma","samplecount":429,"label":"Neuroblastoma"},{"key":"Non-Hodgkin lymphoma","samplecount":555,"label":"Non-Hodgkin lymphoma"},{"key":"Non-malignancy","samplecount":38,"label":"Non-malignancy"},{"key":"Osteosarcoma","samplecount":287,"label":"Osteosarcoma"},{"key":"Other carcinoma","samplecount":74,"label":"Other carcinoma"},{"key":"Other leukemia","samplecount":16,"label":"Other leukemia"},{"key":"Other malignancy","samplecount":55,"label":"Other malignancy"},{"key":"Retinoblastoma","samplecount":453,"label":"Retinoblastoma"},{"key":"Rhabdomyosarcoma","samplecount":285,"label":"Rhabdomyosarcoma"},{"key":"Soft tissue sarcoma","samplecount":252,"label":"Soft tissue sarcoma"},{"key":"Wilms tumor","samplecount":498,"label":"Wilms tumor"}]},
        "should produce the expected UNFILTERED sample counts by diagnosis groups"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })

  const url1 = baseUrl
    + '&term1_id=diaggrp'
    + '&tvslst='+encodeURIComponent(JSON.stringify([{
      term:{id:'aaclassic_5',isfloat:true},
      range:{is_unannotated:true,value:0,label:'Not treated'}
    }]))
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 24, "should have the expected number of FILTERED lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: 'Acute lymphoblastic leukemia', samplecount: 502, label: 'Acute lymphoblastic leukemia' }, { key: 'Acute myeloid leukemia', samplecount: 146, label: 'Acute myeloid leukemia' }, { key: 'Central nervous system (CNS)', samplecount: 664, label: 'Central nervous system (CNS)' }, { key: 'Chronic myeloid leukemia', samplecount: 3, label: 'Chronic myeloid leukemia' }, { key: 'Colon carcinoma', samplecount: 10, label: 'Colon carcinoma' }, { key: 'Germ cell tumor', samplecount: 98, label: 'Germ cell tumor' }, { key: 'Histiocytosis', samplecount: 50, label: 'Histiocytosis' }, { key: 'Hodgkin lymphoma', samplecount: 192, label: 'Hodgkin lymphoma' }, { key: 'Liver malignancies', samplecount: 47, label: 'Liver malignancies' }, { key: 'MDS/Acute myeloid leukemia', samplecount: 4, label: 'MDS/Acute myeloid leukemia' }, { key: 'Melanoma', samplecount: 54, label: 'Melanoma' }, { key: 'Myelodysplastic syndrome', samplecount: 2, label: 'Myelodysplastic syndrome' }, { key: 'Nasopharyngeal carcinoma', samplecount: 38, label: 'Nasopharyngeal carcinoma' }, { key: 'Neuroblastoma', samplecount: 79, label: 'Neuroblastoma' }, { key: 'Non-Hodgkin lymphoma', samplecount: 32, label: 'Non-Hodgkin lymphoma' }, { key: 'Non-malignancy', samplecount: 22, label: 'Non-malignancy' }, { key: 'Osteosarcoma', samplecount: 31, label: 'Osteosarcoma' }, { key: 'Other carcinoma', samplecount: 45, label: 'Other carcinoma' }, { key: 'Other leukemia', samplecount: 1, label: 'Other leukemia' }, { key: 'Other malignancy', samplecount: 18, label: 'Other malignancy' }, { key: 'Retinoblastoma', samplecount: 282, label: 'Retinoblastoma' }, { key: 'Rhabdomyosarcoma', samplecount: 35, label: 'Rhabdomyosarcoma' }, { key: 'Soft tissue sarcoma', samplecount: 114, label: 'Soft tissue sarcoma' }, { key: 'Wilms tumor', samplecount: 329, label: 'Wilms tumor' } ] },
        "should produce the expected FILTERED sample counts by diagnosis groups"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})


tape("single, numerical", function (test) {
  test.plan(4)
  const url0 = baseUrl + '&term1_id=agedx'
  request(url0,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 10, "should have the expected number of UNFILTERED lst items")
      test.deepEqual(
        JSON.parse(body), 
        { lst: [ { key: '0 <= x < 3', samplecount: 2418, label: '0 <= x < 3', range: { start: 0, stop: 3, startinclusive: true, name: '0 <= x < 3' } }, { key: '3 <= x < 6', samplecount: 1948, label: '3 <= x < 6', range: { start: 3, stop: 6, startinclusive: true, name: '3 <= x < 6' } }, { key: '6 <= x < 9', samplecount: 1202, label: '6 <= x < 9', range: { start: 6, stop: 9, startinclusive: true, name: '6 <= x < 9' } }, { key: '9 <= x < 12', samplecount: 1005, label: '9 <= x < 12', range: { start: 9, stop: 12, startinclusive: true, name: '9 <= x < 12' } }, { key: '12 <= x < 15', samplecount: 1159, label: '12 <= x < 15', range: { start: 12, stop: 15, startinclusive: true, name: '12 <= x < 15' } }, { key: '15 <= x < 18', samplecount: 1041, label: '15 <= x < 18', range: { start: 15, stop: 18, startinclusive: true, name: '15 <= x < 18' } }, { key: '18 <= x < 21', samplecount: 323, label: '18 <= x < 21', range: { start: 18, stop: 21, startinclusive: true, name: '18 <= x < 21' } }, { key: '21 <= x < 24', samplecount: 36, label: '21 <= x < 24', range: { start: 21, stop: 24, startinclusive: true, name: '21 <= x < 24' } }, { key: '24 <= x < 27', samplecount: 3, label: '24 <= x < 27', range: { start: 24, stop: 27, startinclusive: true, name: '24 <= x < 27' } }, { key: '27 <= x < 28.59', samplecount: 1, label: '27 <= x < 28.59', range: { start: 27, stop: 28.59, startinclusive: true, name: '27 <= x < 28.59' } } ] },
        "should produce the expected UNFILTERED sample counts by age of diagnosis"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
  
  const url1 = baseUrl
    + '&term1_id=agedx'
    + '&tvslst='+encodeURIComponent(JSON.stringify([{
      term: {id:'sex', name:'sex', iscategorical:true},
      values: [{key: 'Male', label: 'Male'}]
    }]))
  request(url1,(error,response,body)=>{
    if(error) {
      test.fail(error)
    }
    switch(response.statusCode) {
    case 200:
      const data = JSON.parse(body)
      test.equal(data.lst && data.lst.length, 9, "should have the expected number of FILTERED lst items")
      test.deepEqual(
        JSON.parse(body), 
         { lst: [ { key: '0 <= x < 3', samplecount: 1269, label: '0 <= x < 3', range: { start: 0, stop: 3, startinclusive: true, name: '0 <= x < 3' } }, { key: '3 <= x < 6', samplecount: 1052, label: '3 <= x < 6', range: { start: 3, stop: 6, startinclusive: true, name: '3 <= x < 6' } }, { key: '6 <= x < 9', samplecount: 687, label: '6 <= x < 9', range: { start: 6, stop: 9, startinclusive: true, name: '6 <= x < 9' } }, { key: '9 <= x < 12', samplecount: 559, label: '9 <= x < 12', range: { start: 9, stop: 12, startinclusive: true, name: '9 <= x < 12' } }, { key: '12 <= x < 15', samplecount: 612, label: '12 <= x < 15', range: { start: 12, stop: 15, startinclusive: true, name: '12 <= x < 15' } }, { key: '15 <= x < 18', samplecount: 597, label: '15 <= x < 18', range: { start: 15, stop: 18, startinclusive: true, name: '15 <= x < 18' } }, { key: '18 <= x < 21', samplecount: 181, label: '18 <= x < 21', range: { start: 18, stop: 21, startinclusive: true, name: '18 <= x < 21' } }, { key: '21 <= x < 24', samplecount: 19, label: '21 <= x < 24', range: { start: 21, stop: 24, startinclusive: true, name: '21 <= x < 24' } }, { key: '24 <= x < 27', samplecount: 3, label: '24 <= x < 27', range: { start: 24, stop: 27, startinclusive: true, name: '24 <= x < 27' } } ] },
         "should produce the expected FILTERED sample counts by age of diagnosis"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})

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

tape("overlay, same condition", function (test) {
  test.plan(2)

  const url0 = baseUrl 
    + '&term1_id=Arrhythmias'
    + '&term1_q='+encodeURIComponent('{"bar_by_children":1,"value_by_max_grade":1,"grade_child_overlay":1}'); console.log(url0)
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
        "should have the expected results for Arrhythmias, by subcondition, most recent grade"
      )
      break;
    default:
      test.fail("invalid status")
    }
  })
})
