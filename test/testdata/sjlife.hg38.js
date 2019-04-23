module.exports = {
  hg38: {
    datasets: {
      SJLife: {
        cohort: {
          termdb: {
            termjson: {
              map: new Map([
                ["sex", {
                  "name":"Sex",
                  "iscategorical":true,
                  "graph":{
                    "barchart":{
                      "categorical":{ }
                    }
                  }
                }],
                ["racegrp", {
                  "name":"Race",
                  "iscategorical":true,
                  "graph":{
                    "barchart":{ }
                  }
                }],
                ["diaggrp", {
                  "name":"Diagnosis Group",
                  "iscategorical":true,
                  "graph":{
                    "barchart":{
                      "categorical":{
                      }
                    }
                  }
                }],
                ["agedx", {
                  "name":"Age at Cancer Diagnosis",
                  "isfloat":true,
                  "graph":{
                    "barchart":{
                      "numeric_bin":{
                        "crosstab_fixed_bins":[
                          {"start":0,"stop":5,"startinclusive":1,"label":"0-4 years"},
                          {"start":5,"stop":10,"startinclusive":1,"label":"5-9 years"},
                          {"start":10,"stop":15,"startinclusive":1,"label":"10-14 years"},
                          {"start":15,"stopunbound":1,"startinclusive":1,"label":">15 years"}
                        ],
                        "auto_bins":{
                          "start_value":0,
                          "bin_size":1
                        }
                      }
                    }
                  }
                }]
              ])
            }
          },
          'parsed-files/hg38/sjlife/clinical/matrix': [{
            sample: "sj01",
            sex: "male",
            racegrp: "white",
            agedx: 1,
            diaggrp: "TALL"
          },{
            sample: "sj02",
            sex: "male",
            racegrp: "white",
            agedx: 3,
            diaggrp: "TALL"
          },{
            sample: "sj03",
            sex: "female",
            racegrp: "white",
            agedx: 3,
            diaggrp: "AML"
          },{
            sample: "sj04",
            sex: "female",
            racegrp: "black",
            agedx: 3,
            diaggrp: "BALL"
          },{
            sample: "sj05",
            sex: "male",
            racegrp: "black",
            agedx: 9,
            diaggrp: "BALL"
          },{
            sample: "sj06",
            sex: "male",
            racegrp: "white",
            agedx: 8,
            diaggrp: "AML"
          }]
        }
      }
    }
  }
}