const serverconfig = require("../../serverconfig")
const baseUrlPath =  "http://localhost:"
  + serverconfig.port
  + "/termsql?genome=hg38"
  + "&dslabel=SJLife"

function getURL(example) {
  const params = []
  for(const key in example.params) {
    params.push(key + "=" + encodeURIComponent(example.params[key]))
  }
  return baseUrlPath + '&' + params.join('&')
}

const data = {
  conditions: [
    {
      title: "Same condition, overlay=children",
      description: "organ system as parent",
      params: {
        term1: 'Cardiovascular System',
        term2: 'Cardiovascular System',
        unit1: 'max_grade_perperson',
        unit2: 'max_grade_by_subcondition'
      },
      expected: {"result":[{"bar":1,"overlay":"Arrhythmias","total":955},{"bar":1,"overlay":"Cardiovascular dysfunction","total":6},{"bar":1,"overlay":"Dyslipidemia","total":1268},{"bar":1,"overlay":"Essential hypertension","total":1291},{"bar":1,"overlay":"Structural heart defects","total":1144},{"bar":2,"overlay":"Arrhythmias","total":140},{"bar":2,"overlay":"Cardiovascular dysfunction","total":263},{"bar":2,"overlay":"Dyslipidemia","total":492},{"bar":2,"overlay":"Essential hypertension","total":729},{"bar":2,"overlay":"Myocardial infarction","total":4},{"bar":2,"overlay":"Structural heart defects","total":205},{"bar":3,"overlay":"Arrhythmias","total":46},{"bar":3,"overlay":"Cardiovascular dysfunction","total":146},{"bar":3,"overlay":"Dyslipidemia","total":91},{"bar":3,"overlay":"Essential hypertension","total":252},{"bar":3,"overlay":"Myocardial infarction","total":105},{"bar":3,"overlay":"Structural heart defects","total":28},{"bar":4,"overlay":"Arrhythmias","total":10},{"bar":4,"overlay":"Cardiovascular dysfunction","total":22},{"bar":4,"overlay":"Dyslipidemia","total":15},{"bar":4,"overlay":"Myocardial infarction","total":51},{"bar":4,"overlay":"Structural heart defects","total":66}]}
    },
    {
      title: "Same condition, overlay=grade",
      description: "subcondition as parent",
      params: {
        term1: 'Arrhythmias',
        term2: 'Arrhythmias',
        unit1: 'by_children',
        unit2: 'max_grade_by_subcondition'
      },
      expected: {"result":[{"bar":"Atrioventricular heart block","overlay":1,"total":33},{"bar":"Cardiac dysrhythmia","overlay":1,"total":34},{"bar":"Conduction abnormalities","overlay":1,"total":774},{"bar":"Prolonged QT interval","overlay":1,"total":133},{"bar":"Sinus bradycardia","overlay":1,"total":75},{"bar":"Sinus tachycardia","overlay":1,"total":124},{"bar":"Atrioventricular heart block","overlay":2,"total":12},{"bar":"Cardiac dysrhythmia","overlay":2,"total":40},{"bar":"Conduction abnormalities","overlay":2,"total":35},{"bar":"Prolonged QT interval","overlay":2,"total":77},{"bar":"Sinus tachycardia","overlay":2,"total":11},{"bar":"Atrioventricular heart block","overlay":3,"total":9},{"bar":"Cardiac dysrhythmia","overlay":3,"total":27},{"bar":"Conduction abnormalities","overlay":3,"total":7},{"bar":"Prolonged QT interval","overlay":3,"total":10},{"bar":"Cardiac dysrhythmia","overlay":4,"total":10}]}
    }
  ],
  oneTerm: [
    {
      title: "Group by one term, not filtered",
      description: "by diaggrp",
      params: {
        term1: 'diaggrp'
      },
      expected: {"result":[{"value":"Acute lymphoblastic leukemia","count":2441},{"value":"Acute myeloid leukemia","count":388},{"value":"Blood disorder","count":2},{"value":"Central nervous system (CNS)","count":1657},{"value":"Chronic myeloid leukemia","count":66},{"value":"Colon carcinoma","count":14},{"value":"Ewing sarcoma family of tumors","count":246},{"value":"Germ cell tumor","count":188},{"value":"Histiocytosis","count":89},{"value":"Hodgkin lymphoma","count":864},{"value":"Liver malignancies","count":66},{"value":"MDS/Acute myeloid leukemia","count":10},{"value":"Melanoma","count":81},{"value":"Myelodysplastic syndrome","count":24},{"value":"Nasopharyngeal carcinoma","count":59},{"value":"Nephroblastomatosis","count":1},{"value":"Neuroblastoma","count":429},{"value":"Non-Hodgkin lymphoma","count":555},{"value":"Non-malignancy","count":38},{"value":"Osteosarcoma","count":287},{"value":"Other carcinoma","count":74},{"value":"Other leukemia","count":16},{"value":"Other malignancy","count":55},{"value":"Retinoblastoma","count":453},{"value":"Rhabdomyosarcoma","count":285},{"value":"Soft tissue sarcoma","count":252},{"value":"Wilms tumor","count":498}]}
    },
    {
      title: "Group by one term, filtered",
      description: "by diaggrp, wgs_sequenced=1",
      params: {
        term1: 'diaggrp',
        filters: JSON.stringify([{
          term: {id: "wgs_sequenced"},
          values: [{key: 1}]
        }])
      },
      expected: {"result":[{"value":"Acute lymphoblastic leukemia","count":1260},{"value":"Acute myeloid leukemia","count":139},{"value":"Central nervous system (CNS)","count":648},{"value":"Chronic myeloid leukemia","count":2},{"value":"Colon carcinoma","count":6},{"value":"Ewing sarcoma family of tumors","count":118},{"value":"Germ cell tumor","count":96},{"value":"Histiocytosis","count":32},{"value":"Hodgkin lymphoma","count":467},{"value":"Liver malignancies","count":26},{"value":"MDS/Acute myeloid leukemia","count":1},{"value":"Melanoma","count":41},{"value":"Nasopharyngeal carcinoma","count":29},{"value":"Neuroblastoma","count":218},{"value":"Non-Hodgkin lymphoma","count":279},{"value":"Non-malignancy","count":14},{"value":"Osteosarcoma","count":157},{"value":"Other carcinoma","count":26},{"value":"Other leukemia","count":5},{"value":"Other malignancy","count":28},{"value":"Retinoblastoma","count":259},{"value":"Rhabdomyosarcoma","count":149},{"value":"Soft tissue sarcoma","count":125},{"value":"Wilms tumor","count":277}]}
    }
  ]
}

module.exports = {
  data,
  getURL
}