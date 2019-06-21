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
      expected: {"totalTime":0,"result":[{"bar":1,"overlay":"Arrhythmias","total":955},{"bar":1,"overlay":"Cardiovascular dysfunction","total":6},{"bar":1,"overlay":"Dyslipidemia","total":1268},{"bar":1,"overlay":"Essential hypertension","total":1291},{"bar":1,"overlay":"Structural heart defects","total":1144},{"bar":2,"overlay":"Arrhythmias","total":140},{"bar":2,"overlay":"Cardiovascular dysfunction","total":263},{"bar":2,"overlay":"Dyslipidemia","total":492},{"bar":2,"overlay":"Essential hypertension","total":729},{"bar":2,"overlay":"Myocardial infarction","total":4},{"bar":2,"overlay":"Structural heart defects","total":205},{"bar":3,"overlay":"Arrhythmias","total":46},{"bar":3,"overlay":"Cardiovascular dysfunction","total":146},{"bar":3,"overlay":"Dyslipidemia","total":91},{"bar":3,"overlay":"Essential hypertension","total":252},{"bar":3,"overlay":"Myocardial infarction","total":105},{"bar":3,"overlay":"Structural heart defects","total":28},{"bar":4,"overlay":"Arrhythmias","total":10},{"bar":4,"overlay":"Cardiovascular dysfunction","total":22},{"bar":4,"overlay":"Dyslipidemia","total":15},{"bar":4,"overlay":"Myocardial infarction","total":51},{"bar":4,"overlay":"Structural heart defects","total":66}]}
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
      expected: {"totalTime":0,"result":[{"bar":"Atrioventricular heart block","overlay":1,"total":33},{"bar":"Cardiac dysrhythmia","overlay":1,"total":34},{"bar":"Conduction abnormalities","overlay":1,"total":774},{"bar":"Prolonged QT interval","overlay":1,"total":133},{"bar":"Sinus bradycardia","overlay":1,"total":75},{"bar":"Sinus tachycardia","overlay":1,"total":124},{"bar":"Atrioventricular heart block","overlay":2,"total":12},{"bar":"Cardiac dysrhythmia","overlay":2,"total":40},{"bar":"Conduction abnormalities","overlay":2,"total":35},{"bar":"Prolonged QT interval","overlay":2,"total":77},{"bar":"Sinus tachycardia","overlay":2,"total":11},{"bar":"Atrioventricular heart block","overlay":3,"total":9},{"bar":"Cardiac dysrhythmia","overlay":3,"total":27},{"bar":"Conduction abnormalities","overlay":3,"total":7},{"bar":"Prolonged QT interval","overlay":3,"total":10},{"bar":"Cardiac dysrhythmia","overlay":4,"total":10}]}
    }
  ]
}

module.exports = {
  data,
  getURL
}