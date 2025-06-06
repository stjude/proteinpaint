// For capturing output from a test, run: cd .. && cargo test -- --nocapture
#[allow(dead_code)]
fn main() {}

#[cfg(test)]
mod tests {
    use crate::stats_functions::cerno;
    use flate2::read::GzDecoder;
    use json::JsonValue;
    use std::cmp::Ordering;
    use std::collections::HashSet;
    use std::fs::File;
    use std::io::{BufReader, Read};

    const P_VALUE_CUTOFF: f32 = 0.01; // Threshold difference between calculated and expected p-value for the test to pass
    const AUC_CUTOFF: f32 = 0.001; // Threshold difference between calculated and expected AUC for the test to pass
    const ES_CUTOFF: f32 = 0.01; // Threshold difference between calculated and expected ES for the test to pass
    const CERNO_CUTOFF: f32 = 1.0; // Threshold difference between calculated and expected CERNO value for the test to pass
    #[test]
    fn cerno_test() {
        // Specify the path to the json file
        let file_path = "test/cerno_test.json.gz";
        // Open the file
        let file = File::open(file_path).unwrap();
        // Create a buffered reader
        let buf_reader = BufReader::new(file);

        // Create a GzDecoder to read the Gzip data
        let mut gz_decoder = GzDecoder::new(buf_reader);

        // Create a String to hold the first line
        let mut first_line = String::new();

        // Read the decompressed data into the String
        gz_decoder.read_to_string(&mut first_line).unwrap();

        // Read the first line
        //buf_reader.read_line(&mut first_line).unwrap();
        let input_json = json::parse(&first_line);
        match input_json {
            Ok(json_string) => {
                let sample_genes_input: &JsonValue = &json_string["input_genes"];
                let mut sample_genes = Vec::<&str>::new();
                for iter in 0..sample_genes_input.len() {
                    let item = sample_genes_input[iter].as_str().unwrap();
                    sample_genes.push(item);
                }
                let fold_change_input: &JsonValue = &json_string["input_fold_change"];
                let mut fold_change_f32 = Vec::<f32>::new();
                for iter in 0..fold_change_input.len() {
                    let item = fold_change_input[iter].as_f32().unwrap();
                    fold_change_f32.push(item);
                }

                let mut sample_coding_genes: Vec<crate::stats_functions::gene_order> =
                    Vec::with_capacity(sample_genes.len());
                for i in 0..sample_genes.len() {
                    let item: crate::stats_functions::gene_order = crate::stats_functions::gene_order {
                        gene_name: sample_genes[i].to_string(),
                        fold_change: fold_change_f32[i],
                        rank: None, // Will be calculated later
                    };
                    sample_coding_genes.push(item)
                }

                // Sort sample_coding_gene in descending order
                sample_coding_genes
                    .as_mut_slice()
                    .sort_by(|a, b| (b.fold_change).partial_cmp(&a.fold_change).unwrap_or(Ordering::Equal));
                let mut genes_descending = sample_coding_genes.clone();
                // Sort sample_coding_gene in ascending order
                sample_coding_genes
                    .as_mut_slice()
                    .sort_by(|a, b| (a.fold_change).partial_cmp(&b.fold_change).unwrap_or(Ordering::Equal));
                let mut genes_ascending = sample_coding_genes.clone();

                drop(sample_coding_genes); // sample_coding_genes no longer deleted, so the variable is deleted

                // Assign ranks to each gene
                for i in 0..genes_descending.len() {
                    genes_descending[i].rank = Some(i);
                    genes_ascending[i].rank = Some(i);
                }

                let modules_2_genes: &JsonValue = &json_string["MODULES2GENES"];
                let expected_p_values_json: &JsonValue = &json_string["expected_p_values"]; // The expected p-value comes from the original tmod package in R
                let expected_auc_json: &JsonValue = &json_string["expected_auc"]; // The expected auc comes from the original tmod package in R
                let expected_es_json: &JsonValue = &json_string["expected_es"]; // The expected es comes from the original tmod package in R
                let expected_cerno_json: &JsonValue = &json_string["expected_cerno"]; // The expected cerno comes from the original tmod package in R

                let mut expected_p_values = Vec::<f32>::new();
                let mut expected_auc = Vec::<f32>::new();
                let mut expected_es = Vec::<f32>::new();
                let mut expected_cerno = Vec::<f32>::new();

                for j in 0..expected_p_values_json.len() {
                    expected_p_values.push(expected_p_values_json[j].as_f32().unwrap());
                    expected_auc.push(expected_auc_json[j].as_f32().unwrap());
                    expected_es.push(expected_es_json[j].as_f32().unwrap());
                    expected_cerno.push(expected_cerno_json[j].as_f32().unwrap());
                }

                let mut iter = 0;
                for item in modules_2_genes.entries() {
                    let (key, value) = item;
                    let mut geneset = HashSet::<String>::new();
                    for item2 in value.members() {
                        geneset.insert(item2.to_string());
                    }
                    let (p_value, auc, es, _matches, _gene_set_hits, cerno_output) =
                        cerno(&genes_descending, &genes_ascending, geneset.clone());
                    println!("Geneset name:{}", key.to_string());
                    println!("p_value:{}", p_value);
                    println!("auc:{}", auc);
                    println!("es:{}", es);
                    println!("cerno:{}", cerno_output);
                    //println!("matches:{}", _matches1);
                    //println!("gene_set_hits:{}", _gene_set_hits1);

                    assert_eq!((p_value - expected_p_values[iter]).abs() < P_VALUE_CUTOFF, true); // The expected p-value comes from the original tmod package in R
                    assert_eq!((auc - expected_auc[iter]).abs() < AUC_CUTOFF, true); // The expected auc comes from the original tmod package in R
                    assert_eq!((es - expected_es[iter]).abs() < ES_CUTOFF, true); // The expected es comes from the original tmod package in R
                    assert_eq!((cerno_output - expected_cerno[iter]).abs() < CERNO_CUTOFF, true);
                    // The expected es comes from the original tmod package in R
                    iter += 1;
                }
            }
            Err(error) => println!("Incorrect json:{}", error),
        }
    }
}
