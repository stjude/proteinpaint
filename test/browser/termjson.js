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
}
