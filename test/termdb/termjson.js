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
  },
  "aaclassic_5": {
    "id": "aaclassic_5",
    "name":"Cumulative Alkylating Agent (Cyclophosphamide Equivalent Dose)",
    "unit":"mg/m²",
    "isfloat":true,
    "graph":{
      "barchart":{
        "numeric_bin":{
          "fixed_bins":[{
            "start":0,"stop":2000,"label":"<2000"},
            {"start":2000,"stop":3000,"startinclusive":1,"label":"2000-3000"},
            {"start":3000,"stop":4000,"startinclusive":1,"label":"3000-4000"},
            {"start":4000,"stop":5000,"startinclusive":1,"label":"4000-5000"},
            {"start":5000,"stop":6000,"startinclusive":1,"label":"5000-6000"},
            {"start":6000,"stop":7000,"startinclusive":1,"label":"6000-7000"},
            {"start":7000,"stop":8000,"startinclusive":1,"label":"7000-8000"},
            {"start":8000,"stop":9000,"startinclusive":1,"label":"8000-9000"},
            {"start":9000,"stop":10000,"startinclusive":1,"label":"9000-10000"},
            {"start":10000,"stop":11000,"startinclusive":1,"label":"10000-11000"},
            {"start":11000,"stop":12000,"startinclusive":1,"label":"11000-12000"},
            {"start":12000,"stop":13000,"startinclusive":1,"label":"12000-13000"},
            {"start":13000,"stop":14000,"startinclusive":1,"label":"13000-14000"},
            {"start":14000,"stop":15000,"startinclusive":1,"label":"14000-15000"},
            {"start":15000,"stop":16000,"startinclusive":1,"label":"15000-16000"},
            {"start":16000,"stopunbounded":1,"startinclusive":1,"label":">16000"}
          ],
          "bins":{
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
          },
          "unannotated":{
            "value":0,
            "label":"Not exposed",
            "value_positive":-8888,
            "label_positive":"Exposed but dose unknown",
            "value_negative":-9999,
            "label_negative":"Unknown treatment record",
            "label_annotated":"Exposed"
          }
        }
      }
    },
    "isleaf":true
  }
}
