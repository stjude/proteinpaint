/*
  Requires a running pp server, `npm runs server`

  See the header comments in test/termdb.barchart.server.js 
  for help in troubleshooting a failing test as
  encountered below.
*/

const tape = require("tape")
const fs = require('fs')
const path = require('path')
const compareResponseData = require('./termdb.sql.helpers').compareResponseData
const serverconfig = require("../serverconfig")

const ssid = 'genotype-test.txt'
const src = path.join('./test/testdata', ssid)
const dest = path.join(serverconfig.cachedir,'ssid',ssid)
fs.copyFileSync(src, dest, (err) => {
  if (err) throw err;
});

tape("\n", function(test) {
  test.pass("-***- termdb.sql specs -***-")
  test.end()
})

tape("filters", function (test) {
  // plan will track the number of expected tests,
  // which helps with the async tests
  test.plan(8)

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Male"}]
      }]
    }, 
    "categorically filtered results"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:5}]
      }]
    }, 
    "numerically filtered results"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:3, label: "3"}],
        value_by_max_grade: true
      }]
    }, 
    "leaf condition filtered results, by maximum grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_most_recent: true
      }]
    }, 
    "leaf condition filtered results, by most recent grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_max_grade: true
      }],
    }, 
    "non-leaf condition filtered results, by maximum grade"
  )
 
  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_grade: true,
        values: [{key:2, label: "2"}],
        value_by_most_recent: true
      }],
    }, 
    "non-leaf condition filtered results, by most recent grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"Arrhythmias", name:"Arrhythmias", iscondition:true},
        bar_by_children: true,
        values: [{key:'Cardiac dysrhythmia', label: "Cardiac dysrhythmia"}]
      }],
    }, 
    "non-leaf condition filtered results by child"
  )
 
  compareResponseData(
    test, 
    {
      term1: 'diaggrp',
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:8}]
      },{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:3, label: "3"}],
        value_by_max_grade: true
      }]
    }, 
    "combined filtered results"
  )
})

tape("categorical term1", function (test) {
  test.plan(7)

  compareResponseData(
    test, 
    {term1: 'diaggrp'}, 
    "sample counts by diagnosis groups, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'sex'
    },
    "sample counts by diagnosis groups, categorical overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'agedx'
    },
    "sample counts by diagnosis groups, numerical overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      conditionUnits: ["","","max_grade_perperson"],
      term2_q: {value_by_max_grade:1, bar_by_grade: 1},
    },
    "sample counts by diagnosis groups, leaf condition overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      term2_q: {value_by_most_recent:1, bar_by_grade: 1},
    },
    "sample counts by diagnosis groups, leaf condition overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2: 'Asthma',
      term2_q: {value_by_most_recent:1, bar_by_grade: 1},
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"aaclassic_5", name:"alkaline dosage", isfloat:true},
        ranges: [{start:1000,stop:5000}]
      }]
    },
    "filtered sample counts by diagnosis groups, leaf condition overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'diaggrp',
      term2_is_genotype: 1,
      ssid,
      mname: 'T>C',
      chr: 'chr17',
      pos: 7666870,
    },
    "sample counts by diagnosis group, genotype overlay"
  )
})


tape("numerical term1", function (test) {
  test.plan(9)

  compareResponseData(
    test, 
    {term1: 'agedx'},
    "sample counts by age of diagnosis, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'agedx', 
      tvslst: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Female', label: 'Female'}]
      }]
    },
    "filtered sample counts by age of diagnosis, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'diaggrp'
    },
    "sample counts by age of diagnosis, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'aaclassic_5'
    },
    "sample counts by age of diagnosis, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      term2_q: {value_by_max_grade:1, bar_by_grade: 1},
    },
    "sample counts by age of diagnosis, condition overlay by max grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      term2_q: {value_by_most_recent:1, bar_by_grade: 1},
    },
    "sample counts by age of diagnosis, condition overlay by most recent grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term2: 'Asthma',
      term2_q: {value_by_most_recent:1, bar_by_grade: 1},
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"aaclassic_5", name:"alkaline dosage", isfloat:true},
        ranges: [{start:1000,stop:5000}]
      }]
    },
    "sample counts by age of diagnosis, condition overlay by most recent grade"
  )

  compareResponseData(
    test,
    {
      term1: 'agedx',
      term2_is_genotype: 1,
      ssid,
      mname: 'T>C',
      chr: 'chr17',
      pos: 7666870,
    },
    "sample counts by age of diagnosis, genotype overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'agedx',
      term1_q: {
        binconfig: {
          bin_size: 5,
          first_bin: {
            start: 0,
            stop_percentile: 20
          },
          last_bin: {
            start_percentile: 80,
            stopunbounded: 1
          }
        }
      }
    },
    "sample counts by age of diagnosis, custom bins, no overlay"
  )
})

tape("leaf condition term1", function (test) {
  test.plan(11) 
  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Asthma condition max-grade, no overlay"
  )

  compareResponseData(
    test,
    { 
      term1: 'Asthma',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      tvslst: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Asthma condition max-grade, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_most_recent:1, bar_by_grade:1}
    },
    "sample counts by Asthma condition most recent grade, no overlay"
  )
 
  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'sex'
    },
    "sample counts by Asthma condition max grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'diaggrp'
    },
    "sample counts by Asthma condition most recent grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'agedx'
    },
    "sample counts by Asthma condition max grade, numerical overlay" 
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'aaclassic_5'
    },
    "sample counts by Asthma condition most recent grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Asthma condition max grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma', 
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Asthma condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1},
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:8}]
      }]
    },
    "filtered sample counts by Asthma condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Asthma',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2_is_genotype: 1,
      ssid,
      mname: 'T>C',
      chr: 'chr17',
      pos: 7666870,
    },
    "sample counts by Asthma condition most recent grade, genotype overlay"
  )
})

tape("non-leaf condition term1", function (test) {
  test.plan(13) 

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System',
      term1_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Cardiovascular System condition max-grade, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      tvslst: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Cardiovascular System condition max-grade, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Cardiovascular System',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
    },
    "sample counts by Cardiovascular System condition most recent grade, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_max_grade:1, bar_by_children:1},
    },
    "sample counts by Arrhythmias condition by children, no overlay"
  )

  compareResponseData(
    test,
    {
      term1: 'Arrhythmias', 
      term1_q: {value_by_computable_grade:1, bar_by_children:1},
      tvslst: [{
        term: {id:'sex', name:'sex', iscategorical:true},
        values: [{key: 'Male', label: 'Male'}]
      }]
    },
    "filtered sample counts by Arrhythmias condition by children, no overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'sex'
    },
    "sample counts by Arrhythmias condition max grade, categorical overlay",
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'diaggrp'
    },
    "sample counts by Arrhythmias condition most recent grade, categorical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias', 
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'agedx'
    },
    "sample counts by Arrhythmias condition max grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'aaclassic_5'
    },
    "sample counts by Arrhythmias condition most recent grade, numerical overlay"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Arrhythmias condition max grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1}
    },
    "sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_most_recent:1, bar_by_grade:1},
      term2: 'Hearing loss',
      term2_q: {value_by_max_grade:1, bar_by_grade:1},
      tvslst: [{
        term: {id:"sex", name:"Sex", iscategorical:true},
        values: [{"key":"Male","label":"Female"}]
      },{
        term: {id:"agedx", name:"Age at diagnosis", isfloat:true},
        ranges: [{start:0,stop:8}]
      },{
        term: {id:"Asthma", name:"Asthma", iscondition:true},
        bar_by_grade: true,
        values: [{key:3, label: "3"}],
        value_by_max_grade: true
      }]
    },
    "filtered sample counts by Arrhythmias condition most recent grade, condition overlay by max-grade"
  )

  compareResponseData(
    test, 
    {
      term1: 'Arrhythmias',
      term1_q: {value_by_max_grade:1, bar_by_grade:1},
      term2_is_genotype: 1,
      ssid,
      mname: 'T>C',
      chr: 'chr17',
      pos: 7666870,
    },
    "sample counts by Arrhythmias condition most recent grade, genotype overlay"
  )
})

tape("term0 charts", function (test) {
  test.plan(4)

  compareResponseData(
    test, 
    {
      term0: 'sex',
      term1: 'diaggrp'
    }, 
    "categorical charts by sex, categorical bars by diagnosis group"
  )

  compareResponseData(
    test,
    {
      term0: 'agedx',
      term1: 'sex'
    },
    "numerical charts by agedx, categorical bars by sex"
  )

  compareResponseData(
    test,
    {
      term0: 'Arrhythmias',
      term0_q: {value_by_most_recent:1, bar_by_children:1},
      term1: 'sex'
    },
    "condition charts by Arrhythmias subcondition, categorical bars by sex"
  )

  compareResponseData(
    test,
    {
      term0_is_genotype: 1,
      term0: 'genotype',
      term1: 'diaggrp',
      ssid,
      mname: 'T>C',
      chr: 'chr17',
      pos: 7666870,
    },
    "genotype charts, categorical bars by diagnosis"
  )
})
