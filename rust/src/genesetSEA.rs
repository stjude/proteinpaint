// Syntax: cd .. && cargo build --release && cat ~/sjpp/test.txt | target/release/genesetORA
#![allow(non_snake_case)]
use json::JsonValue;
use r_mathlib;
use rand::rngs::SmallRng;
use rand::seq::SliceRandom;
use rand::Rng;
use rand::SeedableRng;
use rayon::prelude::*;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use serde_json;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::collections::HashSet;
use std::env;
use std::hash::Hash;
use std::io;
use std::simd::f64x1;
use std::time::Instant;

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
struct GO_pathway {
    GO_id: String,
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
//#[allow(dead_code)]
struct pathway_p_value {
    pathway_name: String,
    p_value_original: f64,
    p_value_adjusted: Option<f64>,
    gene_set_hits: String,
    gene_set_size: usize,
}

fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let run_time = Instant::now();
                    let msigdb_input: &JsonValue = &json_string["msigdb"];
                    let msigdb;
                    match msigdb_input.as_str() {
                        Some(db_string) => msigdb = db_string.to_string(),
                        None => panic!("msigdb file path is missing"),
                    }
                    let genesetgroup;
                    let genesetgroup_input: &JsonValue = &json_string["gene_set_group"];
                    match genesetgroup_input.as_str() {
                        Some(genesetgroup_string) => genesetgroup = genesetgroup_string.to_string(),
                        None => panic!("genesetgroup is missing"),
                    }
                    let sample_genes_input: &JsonValue = &json_string["genes"];
                    let sample_genes: Vec<&str> =
                        sample_genes_input.as_str().unwrap().split(",").collect();
                    let fold_change_input: &JsonValue = &json_string["fold_change"];
                    let fold_change: Vec<f64> =
                        fold_change_input.as_str().unwrap().split(",").collect();
                    let mut pathway_p_values: Vec<pathway_p_value> = Vec::with_capacity(10000);

                    let genedb_input: &JsonValue = &json_string["genedb"];
                    let genedb;
                    match genedb_input.as_str() {
                        Some(gene_db_string) => genedb = gene_db_string.to_string(),
                        None => panic!("genedb file path is missing"),
                    }

                    let filter_non_coding_genes_input: &JsonValue =
                        &json_string["filter_non_coding_genes"];
                    let filter_non_coding_genes: bool =
                        filter_non_coding_genes_input.as_bool().unwrap();

                    let genedbconn = Connection::open(genedb)?;
                    let genedb_result = genedbconn.prepare(&("select * from codingGenes"));
                    let mut num_coding_genes: usize = 0;
                    let mut sample_coding_genes: HashSet<String> = HashSet::with_capacity(24000);
                    match genedb_result {
                        Ok(mut x) => {
                            let mut genes = x.query([])?;
                            while let Some(coding_gene) = genes.next()? {
                                num_coding_genes += 1;
                                //println!("coding_gene:{:?}", coding_gene);
                                for sample_gene in &sample_genes {
                                    let code_gene: String = coding_gene.get(0).unwrap();
                                    if filter_non_coding_genes == true && code_gene == *sample_gene
                                    {
                                        sample_coding_genes.insert(code_gene);
                                    } else if filter_non_coding_genes == false {
                                        sample_coding_genes.insert(code_gene);
                                    }
                                }
                            }
                        }
                        Err(_) => {}
                    }

                    if sample_coding_genes.len() == 0 {
                        panic!("All query genes are non-coding");
                    }

                    let background_genes_input: &JsonValue = &json_string["background_genes"];
                    let num_background_genes;
                    match background_genes_input.as_str() {
                        Some(x) => {
                            let background_genes_str: Vec<&str> = x.split(",").collect(); // Background genes is defined for e.g in case of DE analysis
                            num_background_genes = background_genes_str.len();
                        }
                        None => {
                            // Background genes not present for e.g. in hierarchial clustering
                            // Get background genes from the gene database
                            num_background_genes = num_coding_genes;
                        }
                    }
                    //println!("sample_genes:{:?}", sample_genes);
                    //println!("background_genes:{:?}", background_genes);

                    if sample_genes.len() == 0 {
                        panic!("No sample genes provided");
                    } else if num_background_genes == 0 {
                        panic!("No background genes provided");
                    }
                    let num_items_output = 100; // Number of top pathways to be specified in the output

                    let msigdbconn = Connection::open(msigdb)?;
                    let stmt_result = msigdbconn.prepare(
                        &("select id from terms where parent_id='".to_owned()
                            + &genesetgroup
                            + "'"),
                    );
                    match stmt_result {
                        Ok(mut stmt) => {
                            #[allow(non_snake_case)]
                            let GO_iter =
                                stmt.query_map([], |row| Ok(GO_pathway { GO_id: row.get(0)? }))?;
                            #[allow(non_snake_case)]
                            for GO_term in GO_iter {
                                match GO_term {
                                    Ok(n) => {
                                        //println!("GO term {:?}", n);
                                        let sql_statement =
                                            "select genes from term2genes where id='".to_owned()
                                                + &n.GO_id
                                                + &"'";
                                        //println!("sql_statement:{}", sql_statement);
                                        let mut gene_stmt = msigdbconn.prepare(&(sql_statement))?;
                                        //println!("gene_stmt:{:?}", gene_stmt);

                                        let mut rows = gene_stmt.query([])?;
                                        let mut names = Vec::<String>::new();
                                        while let Some(row) = rows.next()? {
                                            let a: String = row.get(0)?;
                                            let input_gene_json = json::parse(&a);
                                            match input_gene_json {
                                                Ok(json_genes) => {
                                                    for json_iter in 0..json_genes.len() {
                                                        names.push(
                                                            json_genes[json_iter]["symbol"]
                                                                .to_string(),
                                                        );
                                                    }
                                                }
                                                Err(_) => {
                                                    panic!(
                                                "Symbol, ensg, enstCanonical structure is missing!"
                                            )
                                                }
                                            }
                                        }
                                        let mut map: HashMap<&str, Vec<String>> = HashMap::new();
                                        map.insert(&n.GO_id, names);
                                        let nperm = 1000; // Will be later defined in client side
                                        let min_size = 15; // Will be later defined in client side
                                        let max_size = 100; // Will be later defined in client side
                                        let seed = 1; // Will be later defined in client side
                                        let sample_coding_genes_vec: Vec<String> =
                                            sample_coding_genes.into_iter().collect();
                                        let fold_change_vec: Vec<String> =
                                            fold_change.into_iter().collect();
                                        prerank(
                                            1.0,
                                            &sample_coding_genes_vec,
                                            &fold_change_vec,
                                            map,
                                            nperm,
                                            min_size,
                                            max_size,
                                            seed,
                                        );
                                    }
                                    Err(_) => {
                                        println!("GO term not found!")
                                    }
                                }
                            }
                        }
                        Err(_) => panic!("sqlite database file not found"),
                    }
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}

fn prerank(
    weight: f64,
    genes: &[String],
    metric: &[f64],
    gmt: &HashMap<&str, &[String]>,
    nperm: usize,
    min_size: usize,
    max_size: usize,
    seed: u64,
) {
    // NOTE: input must not contain duplcated genes

    let weighted_metric: Vec<f64> = metric.iter().map(|x| x.abs().powf(weight)).collect();
    // start to calculate
    let mut es = EnrichmentScore::new(genes, nperm, seed, false, false);
    // let end1 = Instant::now();
    let gperm = es.gene_permutation(); // gene permutation, only record gene idx here
    let mut summ = Vec::<GSEASummary>::new();

    for (&term, &gset) in gmt.iter() {
        // convert gene String --> Int
        let gtag = es.gene.isin(gset);
        let gidx = es.hit_index(&gtag);
        if gidx.len() > max_size || gidx.len() < min_size {
            continue;
        }
        let tag_indicators: Vec<Vec<f64>> = gperm.par_iter().map(|de| de.isin(&gidx)).collect();
        let (ess, run_es) = es.enrichment_score_gene(&weighted_metric, &tag_indicators);
        let esnull: Vec<f64> = if ess.len() > 1 {
            ess[1..].to_vec()
        } else {
            Vec::new()
        };
        let gss = GSEASummary {
            term: term.to_string(),
            es: ess[0],
            run_es: run_es,
            hits: gidx,
            esnull: esnull,
            ..Default::default()
        };
        summ.push(gss);
    }
    // let end3 = Instant::now();
    // println!("Calculation time: {:.2?}", end3.duration_since(end2));
    //if nperm > 0 {
    //    stat(&mut summ);
    //}
    //self.summaries = summ;
    //self.indices.push((0..genes.len()).collect_vec());
    //self.rankings.push(metric.to_owned());

    // let end4 = Instant::now();
    // println!("Statistical time: {:.2?}", end4.duration_since(end3));
}

pub trait EnrichmentScoreTrait {
    /// get run es only
    fn running_enrichment_score(&self, metric: &[f64], tag_indicator: &[f64]) -> Vec<f64>;
    /// fast GSEA only ES value return
    fn fast_random_walk(&self, metric: &[f64], tag_indicator: &[f64]) -> f64;
    // calucalte metric, not sorted
    //fn calculate_metric(&self, data: &[Vec<f64>], group: &[bool], method: Metric) -> Vec<f64>;
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GSEASummary {
    term: String,
    es: f64,
    nes: f64,
    pval: f64,  // Nominal Pvalue
    fwerp: f64, // FWER Pvalue
    fdr: f64,   // FDR q value. adjusted FDR
    run_es: Vec<f64>,
    hits: Vec<usize>, // indices of genes that matches
    esnull: Vec<f64>,
    index: Option<usize>, // sample index
}

impl GSEASummary {
    pub fn new(
        &mut self,
        term: &str,
        es: f64,
        nes: f64,
        pval: f64,
        fwerpval: f64,
        fdr: f64,
        run_es: &[f64],
        hits: &[usize],
        esnull: &[f64],
        index: usize,
    ) -> Self {
        GSEASummary {
            term: term.to_string(),
            es: es,
            nes: nes,
            pval: pval,
            fwerp: fwerpval,
            fdr: fdr,
            run_es: run_es.to_vec(),
            hits: hits.to_vec(),
            esnull: esnull.to_vec(),
            index: Some(index),
        }
    }

    /// for default values, you can then init the struct with
    /// let g = GSEASummary { es: 0.5, ..Default::default() };
    /// need trait bound #[derive(Default)]
    #[allow(dead_code)]
    fn default() -> GSEASummary {
        GSEASummary {
            term: "".to_string(),
            es: 0.0,
            nes: 0.0,
            pval: 1.0,
            fwerp: 1.0,
            fdr: 1.0,
            run_es: Vec::<f64>::new(),
            hits: Vec::<usize>::new(),
            esnull: Vec::<f64>::new(),
            index: None,
        }
    }
}

struct EnrichmentScore {
    // ranking metric
    // metric: Vec<f64>,
    //metric2d: Vec<Vec<f64>>,
    pub gene: DynamicEnum<String>, //  Vec<String>, // gene names
    nperm: usize,                  // number of permutations
    single: bool,                  // single sample GSEA
    scale: bool,                   // whether to scale ES value
    rng: SmallRng,
}

impl EnrichmentScoreTrait for EnrichmentScore {
    fn running_enrichment_score(&self, metric: &[f64], tag_indicator: &[f64]) -> Vec<f64> {
        let n: f64 = tag_indicator.len() as f64;
        let n_hint: f64 = tag_indicator.iter().sum();
        let n_miss: f64 = n - n_hint;
        let norm_notag: f64 = 1.0 / n_miss;
        let no_tag_indicator: Vec<f64> = tag_indicator.iter().map(|&b| 1.0 - b).collect();
        let sum_correl_tag: Vec<f64> = tag_indicator
            .iter()
            .zip(metric.iter())
            .map(|(&b, &v)| b * v)
            .collect();
        let norm_tag: f64 = 1.0 / sum_correl_tag.iter().sum::<f64>();
        // cumsum()
        let run_es: Vec<f64> = sum_correl_tag
            .iter()
            .zip(no_tag_indicator.iter())
            .map(|(&b, &v)| b * norm_tag - v * norm_notag)
            .scan(0.0, |acc, x| {
                *acc += x;
                Some(*acc)
            })
            .collect();
        return run_es;
    }

    /// see here: https://github.com/ctlab/fgsea/blob/master/src/esCalculation.cpp
    fn fast_random_walk(&self, metric: &[f64], tag_indicator: &[f64]) -> f64 {
        // tag_indicator and metric must be sorted
        let ns: f64 = tag_indicator
            .iter()
            .zip(metric.iter())
            .map(|(&b, &v)| b * v)
            .sum::<f64>();
        let n: f64 = metric.len() as f64;
        let k: f64 = tag_indicator.iter().sum::<f64>() as f64;
        let mut res: f64 = 0.0; // running_es
        let mut cur: f64 = 0.0;
        let q1: f64 = 1.0 / (n - k);
        let q2: f64 = 1.0 / ns;
        let mut last: f64 = -1.0;
        let p: Vec<f64> = tag_indicator
            .iter()
            .enumerate()
            .filter_map(|(i, &t)| if t > 0.0 { Some(i as f64) } else { None })
            .collect();

        for pos in p {
            cur -= q1 * (pos - last - 1.0);
            if cur.abs() > res.abs() {
                res = cur;
            }
            cur += q2 * metric.get(pos as usize).unwrap();
            if cur.abs() > res.abs() {
                res = cur;
            }
            last = pos;
        }

        // for pos in p {
        //     cur += q2 * metric.get(pos as usize).unwrap() - q1 * (pos - last - 1);
        //     res = max(res, cur);
        //     last = pos;
        // }
        return res;
    }
}

/// Dynamic Enum
#[derive(Debug, Clone)]
pub struct DynamicEnum<T> {
    _elt_to_idx: HashMap<T, usize>, // element to index
    _idx_to_elt: Vec<T>,            // index to element
    _num_indices: usize,            // size
}

impl<T> DynamicEnum<T>
where
    T: Eq + Hash + Clone,
{
    /// an empty object
    pub fn new() -> Self {
        DynamicEnum {
            _num_indices: 0,
            _idx_to_elt: Vec::<T>::new(),
            _elt_to_idx: HashMap::<T, usize>::new(),
        }
    }
    /// construct from vec
    pub fn from(vec: &[T]) -> Self {
        //let temp = vec.to_vec();
        let v2m: HashMap<T, usize> = vec
            .iter()
            .enumerate()
            .map(|(i, v)| (v.clone(), i))
            .collect();
        DynamicEnum {
            _num_indices: v2m.len(),
            _elt_to_idx: v2m,
            _idx_to_elt: vec.to_vec(),
        }
    }
    /// add element if new
    /// return indices whether new or not
    pub fn add_if_new(&mut self, element: T) -> usize {
        if self._elt_to_idx.contains_key(&element) {
            return *self._elt_to_idx.get(&element).unwrap();
        }
        let key = element.clone();
        let idx = self._num_indices;
        self._idx_to_elt.push(element);
        self._elt_to_idx.insert(key, idx);
        self._num_indices += 1;
        return idx;
    }
    /// get index of element
    pub fn index_of(&self, element: &T) -> Option<&usize> {
        self._elt_to_idx.get(element)
    }
    pub fn index_of_any(&self, elements: &[T]) -> Vec<&usize> {
        elements.iter().filter_map(|e| self.index_of(e)).collect()
    }
    #[allow(dead_code)]
    pub fn contain_elt(&self, element: &T) -> bool {
        self._elt_to_idx.contains_key(element)
    }
    /// get element at position of index
    pub fn elt_of(&self, idx: usize) -> Option<&T> {
        self._idx_to_elt.get(idx)
    }
    /// return indicator whether the self.elements in given elements (0: absent, 1: present)
    pub fn isin(&self, elements: &[T]) -> Vec<f64> {
        let mut _tag_indicator: Vec<f64> = vec![0.0; self._idx_to_elt.len()];
        elements.iter().for_each(|e| {
            if let Some(idx) = self.index_of(e) {
                _tag_indicator[*idx] = 1.0;
            }
        });
        return _tag_indicator;
    }
    pub fn size(&self) -> usize {
        return self._num_indices;
    }
    pub fn get_vec(&self) -> &Vec<T> {
        return &self._idx_to_elt;
    }

    /// inplace shuffle
    pub fn shuffle<R>(&mut self, rng: &mut R)
    where
        R: Rng + ?Sized,
    {
        self._idx_to_elt.shuffle(rng);
        self.clone()
            ._idx_to_elt
            .iter()
            .enumerate()
            .for_each(|(i, e)| {
                self._elt_to_idx.insert(e.clone(), i);
            });
    }
}

impl EnrichmentScore {
    pub fn new(gene: &[String], nperm: usize, seed: u64, single: bool, scale: bool) -> Self {
        // let rng = ThreadRng::default();
        let rng = SmallRng::seed_from_u64(seed);
        //let rng = thread_rng();
        EnrichmentScore {
            // metric: gene_metric,
            gene: DynamicEnum::from(gene),
            nperm: nperm + 1, // add 1 to kept track of original record
            single: single,
            scale: scale,
            rng: rng,
        }
    }

    pub fn hit_index(&self, tag_indicator: &[f64]) -> Vec<usize> {
        tag_indicator
            .iter()
            .enumerate()
            .filter_map(|(i, &t)| if t > 0.0 { Some(i) } else { None })
            .collect()
        // let mut hit_ind: Vec<usize> = Vec::new();
        // for (i, b) in tag_indicator.iter().enumerate() {
        //     if b > &0.0 {
        //         hit_ind.push(i);
        //     }
        // }
        // return hit_ind;
    }

    pub fn enrichment_score_gene(
        &mut self,
        metric: &[f64],
        tag_indicators: &[Vec<f64>],
    ) -> (Vec<f64>, Vec<f64>) {
        // pararell computing
        // let run_es: Vec<Vec<f64>> = tag_indicators
        //     .par_iter()
        //     .map(|tag| {
        //         // implement the function in trait enable you to call self.methods in struct member closure!!!
        //         self.running_enrichment_score(metric, tag)
        //     })
        //     .collect();
        // let es: Vec<f64> = run_es.par_iter().map(|r| self.select_es(r)).collect();

        let es: Vec<f64> = tag_indicators
            .par_iter()
            .map(|tag| self.fast_random_walk(metric, tag))
            .collect();
        let run_es = self.running_enrichment_score(metric, &tag_indicators[0]);

        return (es, run_es);
    }

    pub fn gene_permutation(&mut self) -> Vec<DynamicEnum<usize>> {
        let vec: Vec<usize> = (0..self.gene.size()).collect();
        let mut orig: DynamicEnum<usize> = DynamicEnum::from(&vec);
        let mut gperm: Vec<DynamicEnum<usize>> = Vec::new();
        // // now = Instant::now();
        gperm.push(orig.clone());
        for _ in 1..self.nperm {
            // inplace shuffle
            //fastrand::shuffle(&mut tags[i]); // fastrand is a little bit faster
            orig.shuffle(&mut self.rng);
            gperm.push(orig.clone());
        }
        return gperm;
    }
}
