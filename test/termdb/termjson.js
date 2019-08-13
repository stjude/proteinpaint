exports.termjson = {
  diaggrp: {
    "id":"diaggrp",
    "name":"Diagnosis Group",
    "iscategorical":true,
    "isleaf":true,
    "graph":{
      "barchart":{
        "categorical":{}
      }
    }
  },
  agedx: {
    "id":"agedx", 
    "name":"Age at Cancer Diagnosis",
    "unit":"Years",
    "isfloat":true,
    "isleaf":true,
    "graph":{
      "barchart":{
        "numeric_bin":{
          "bins":{
            "bin_size":3,
            "stopinclusive":true,
            "first_bin":{
              "start":-1,
              "stop":2,
              "stopinclusive":true
            }
          },
          "bins_less":{
            "bin_size":5,
            "stopinclusive":true,
            "first_bin":{
              "start":-1,
              "stop":5,
              "stopinclusive":true
            },
            "last_bin":{
              "start":15,
              "stopunbounded":true
            }
          }
        }
      }
    },
  },
  "Arrhythmias": {
    "id": "Arrhythmias",
    "name":"Arrhythmias",
    "iscondition":true,
    "graph":{
      "barchart":{
        "bar_choices":[{
          "by_grade":true,
          "label":"Grades",
          "allow_to_stackby_children":true
        },{
          "by_children":true,
          "label":"Sub-conditions",
          "allow_to_stackby_grade":true
        }],
        "value_choices":[{
          "max_grade_perperson":true,
          "label":"Max grade per patient"
        },{
          "most_recent_grade":true,
          "label":"Most recent grade per patient"
        },{
          "total_measured":true,
          "label":"Total number of patients"
        }]
      }
    }
  }
}
