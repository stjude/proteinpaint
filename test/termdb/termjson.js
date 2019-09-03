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
    "id": "agedx",
    "name":"Age at Cancer Diagnosis",
    "unit":"Years",
    "isfloat":true,
    "bins":{
      "default":{
        "bin_size":3,
        "stopinclusive":true,
        "first_bin":{
          "startunbounded":true,
          "stop":2,
          "stopinclusive":true
        }
      },
      "less":{
        "bin_size":5,
        "stopinclusive":true,
        "first_bin":{
          "startunbounded":true,
          "stop":5,
          "stopinclusive":true
        },
        "last_bin":{
          "start":15,
          "stopunbounded":true
        }
      }
    },
    "isleaf":true
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
    },
    "values":{
      "0":{"label":"0: No condition"},
      "1":{"label":"1: Mild"},
      "2":{"label":"2: Moderate"},
      "3":{"label":"3: Severe"},
      "4":{"label":"4: Life-threatening"},
      "5":{"label":"5: Death"},
      "9":{"label":"Unknown status","uncomputable":true}
    }
  },
  "aaclassic_5": {
    "id": "aaclassic_5",
    "name":"Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)",
    "unit":"mg/m²",
    "isfloat":true,
    "bins":{
      "default":{
        "bin_size":1000,
        "stopinclusive":true,
        "first_bin":{
          "startunbounded":true,
          "stop":2000,
          "stopinclusive":true
        },
        "last_bin":{
          "stopunbounded":true,
          "start":16000
        }
      }
    },
    "values":{
      "0":{"label":"Not exposed","uncomputable":true},
      "-8888":{"label":"Exposed but dose unknown","uncomputable":true},
      "-9999":{"label":"Unknown treatment record","uncomputable":true}
    },
    "isleaf":true
  }
}
