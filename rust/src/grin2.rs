/*
GRIN2 statistics: the Genomic Random Interval model (Pounds et al. 2013, Bioinformatics 29:2088) applied
gene by gene. Called by server/src/grin2/main.ts through run_rust('grin2').

Input (stdin, JSON):
    genedb              path to a gene db with a gene2coord(name, chr, start, stop) table
    chromosomelist      {chrom: size}
    lesion              [[sample, chrom, start, end, type], ...]
    lesionTypeMap       {type: label}, e.g. {"mutation": "Mutation", "loss": "Loss"}
    maxGenesToShow      rows in the top-gene table, default 500
    excludeEnabled      default true
    excludeBeds         BED files (plain or bgzip) of regions; a gene mostly inside them is dropped before the test
    excludeOverlapFrac  masked fraction of a gene's span at which it is dropped, default 0.5

Output (stdout, JSON): topGeneTable, totalGenes, showingTop, lesionCounts, maskReport, memory, geneHits.

Steps:
1. A gene is hit by a lesion of the same chromosome when their closed intervals overlap. nsubj is the number
   of distinct samples with a hit, per gene and lesion type.
2. Per lesion type and chromosome, the chance that a sample has a hit in a gene by chance is
   1 - prod(1 - (gene size + lesion size) / chromosome size) over that sample's lesions. When every such term is
   below 0.05 the product is approximated through log(1 - p) ~ -p, so a sample needs only its lesion count and
   total lesion size.
3. The p-value of a gene is P(X >= nsubj), X a sum of independent Bernoulli variables with those chances,
   computed by convolution one gene at a time. Genes without a hit keep p = 1.
4. q = min(1, 2 * mean(p)) * BH(p), per lesion type. With more than one lesion type, the k-th smallest p of a gene
   is also tested against the k-th order statistic of uniforms (the constellation test), with q the same way.

The results match the Python implementation this replaced (python/src/grin2_core.py): the same approximation
threshold, the clip of exact terms to [1e-10, 1 - 1e-10], numpy's rounding to 4 significant digits, and the
stable ordering of ties. Two differences:
- a p- or q-value below ~1e-305 is reported, where numpy's rounding turned it into NaN, which left the value blank
  and ranked the gene by its other lesion types.
- the constellation test uses the beta parameters of GRIN2's R p.order. The Python used Beta(j, k - j + 2) for the
  j-th smallest of k p-values, the distribution for k + 1 lesion types, which made it conservative.
*/

use flate2::read::MultiGzDecoder;
use r_mathlib::beta_cdf;
use rayon::prelude::*;
use rusqlite::Connection;
use serde::ser::{SerializeMap, SerializeSeq};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap};
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Read, Write};

mod sqlite_static;
use sqlite_static::prepare_static;

// below this (max gene + max lesion) / chromosome size, the log(1 - p) ~ -p approximation is used
const APPROX_THRESHOLD: f64 = 0.05;
// constellation columns shown in the top-gene table
const MAX_CONSTELLATION_COLUMNS: usize = 5;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input {
    genedb: String,
    chromosomelist: HashMap<String, i64>,
    lesion: Vec<(String, String, i64, i64, String)>,
    lesion_type_map: BTreeMap<String, String>,
    max_genes_to_show: Option<usize>,
    exclude_enabled: Option<bool>,
    #[serde(default)]
    exclude_beds: Vec<String>,
    exclude_overlap_frac: Option<f64>,
}

struct Gene {
    name: String,
    chrom: String,
    start: i64,
    end: i64,
}

struct Lesion {
    subj: u32, // rank of the sample id in sorted order
    chrom: String,
    start: i64,
    end: i64,
    ty: usize, // index into the sorted lesion types
}

fn main() {
    let result = read_input().and_then(run);
    if let Err(e) = result {
        eprintln!("ERROR: {e}");
        std::process::exit(1);
    }
}

fn read_input() -> Result<Input, String> {
    let mut text = String::new();
    io::stdin()
        .read_to_string(&mut text)
        .map_err(|e| format!("Cannot read input: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("Invalid input: {e}"))
}

fn run(input: Input) -> Result<(), String> {
    if input.lesion_type_map.is_empty() {
        return Err("lesionTypeMap not provided".into());
    }
    if input.lesion.is_empty() {
        return Err("No lesion data provided".into());
    }
    let mut genes = read_genes(&input.genedb)?;
    let (lesions, types, lesion_counts) = parse_lesions(input.lesion);

    let beds: Vec<&str> = input
        .exclude_beds
        .iter()
        .map(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .collect();
    let mut mask_report = Value::Null;
    if input.exclude_enabled.unwrap_or(true) && !beds.is_empty() {
        let frac = input.exclude_overlap_frac.unwrap_or(0.5).clamp(0.0, 1.0);
        let mask = load_exclude_intervals(&beds)?;
        let genome_size: i64 = input.chromosomelist.values().sum();
        let (kept, report) = apply_gene_mask(genes, &mask, frac, genome_size);
        genes = kept;
        mask_report = report;
        if genes.is_empty() {
            return Err("No genes remain after applying the exclude mask".into());
        }
    }

    // genes sorted by chromosome name, start, end; ties keep the gene db order
    genes.sort_by(|a, b| (&a.chrom, a.start, a.end).cmp(&(&b.chrom, b.start, b.end)));

    let nt = types.len();
    let g = genes.len();
    let nsubj = count_subjects(&genes, &lesions, nt);
    let p = gene_pvalues(&genes, &lesions, &nsubj, nt, &input.chromosomelist);
    drop(lesions);
    let q = q_values(&p, g, nt);
    let constellation = (nt > 1).then(|| constellation(&p, g, nt));

    // rounded as the output reports them; sorting uses these rounded values, as the Python did
    let round_all = |v: &[f64]| v.iter().map(|&x| sig_round(x)).collect::<Vec<f64>>();
    let (p, q) = (round_all(&p), round_all(&q));
    let constellation = constellation.map(|(cp, cq)| (round_all(&cp), round_all(&cq)));

    // a type's p column counts only when one of the first 20 genes has a p-value
    let valid_types: Vec<usize> = (0..nt)
        .filter(|&t| (0..g.min(20)).any(|i| !p[i * nt + t].is_nan()))
        .collect();
    if valid_types.is_empty() {
        return Err("No p-value columns with data found".into());
    }
    let min_p = |i: usize| {
        valid_types
            .iter()
            .map(|&t| p[i * nt + t])
            .filter(|x| !x.is_nan())
            .fold(f64::NAN, f64::min)
    };
    let mut order: Vec<usize> = (0..g).collect();
    order.sort_by(|&a, &b| {
        let (x, y) = (min_p(a), min_p(b));
        match (x.is_nan(), y.is_nan()) {
            (true, true) => std::cmp::Ordering::Equal,
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => x.partial_cmp(&y).unwrap(),
        }
    });

    let num_rows = g.min(input.max_genes_to_show.unwrap_or(500));
    let table = top_gene_table(
        &genes,
        &order,
        num_rows,
        &types,
        &input.lesion_type_map,
        &nsubj,
        &p,
        &q,
        &constellation,
    );
    let by_type: BTreeMap<&str, usize> = types.iter().map(|t| t.as_str()).zip(lesion_counts).collect();

    // geneHits reports nsubj and q for each lesion type of lesionTypeMap present in the data
    let hit_types = input
        .lesion_type_map
        .keys()
        .filter_map(|k| {
            types
                .iter()
                .position(|t| t == k)
                .map(|t| (format!("nsubj.{k}"), format!("q.nsubj.{k}"), t))
        })
        .collect();
    let output = Output {
        top_gene_table: table,
        total_genes: g,
        showing_top: num_rows,
        lesion_counts: json!({ "byType": by_type }),
        mask_report,
        memory: json!({ "peak": (peak_rss_mb() * 100.0).round() / 100.0 }),
        gene_hits: GeneHits {
            genes: &genes,
            order: &order,
            hit_types,
            nsubj: &nsubj,
            q: &q,
            nt,
        },
    };
    // streamed: a JSON tree of every gene's row would cost several times the data it holds
    let mut out = BufWriter::new(io::stdout().lock());
    serde_json::to_writer(&mut out, &output).map_err(|e| e.to_string())?;
    writeln!(out).and_then(|_| out.flush()).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Output<'a> {
    top_gene_table: Value,
    total_genes: usize,
    showing_top: usize,
    lesion_counts: Value,
    mask_report: Value,
    memory: Value,
    gene_hits: GeneHits<'a>,
}

/// geneHits rows in result order: gene, chrom, loc.start, loc.end, then nsubj.<type> and q.nsubj.<type>
struct GeneHits<'a> {
    genes: &'a [Gene],
    order: &'a [usize],
    hit_types: Vec<(String, String, usize)>, // nsubj key, q key, type index
    nsubj: &'a [u32],
    q: &'a [f64],
    nt: usize,
}

impl Serialize for GeneHits<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut seq = s.serialize_seq(Some(self.order.len()))?;
        for &i in self.order {
            seq.serialize_element(&GeneHit { hits: self, i })?;
        }
        seq.end()
    }
}

struct GeneHit<'a> {
    hits: &'a GeneHits<'a>,
    i: usize,
}

impl Serialize for GeneHit<'_> {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let (h, i) = (self.hits, self.i);
        let gn = &h.genes[i];
        let mut m = s.serialize_map(Some(4 + 2 * h.hit_types.len()))?;
        m.serialize_entry("gene", &gn.name)?;
        m.serialize_entry("chrom", &gn.chrom)?;
        m.serialize_entry("loc.start", &gn.start)?;
        m.serialize_entry("loc.end", &gn.end)?;
        for (nkey, qkey, t) in &h.hit_types {
            m.serialize_entry(nkey, &h.nsubj[i * h.nt + t])?;
            // serde_json writes a non-finite number as null
            m.serialize_entry(qkey, &h.q[i * h.nt + t])?;
        }
        m.end()
    }
}

// ---------------------------------------------------------------------------------------------------------------
// input

fn with_chr(c: String) -> String {
    if c.starts_with("chr") { c } else { format!("chr{c}") }
}

fn read_genes(path: &str) -> Result<Vec<Gene>, String> {
    let con =
        Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    let mut stmt = prepare_static(&con, "SELECT name, chr, start, stop FROM gene2coord").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            let get = |i: usize| -> rusqlite::Result<String> {
                Ok(match r.get_ref(i)? {
                    rusqlite::types::ValueRef::Text(t) => String::from_utf8_lossy(t).into_owned(),
                    rusqlite::types::ValueRef::Integer(n) => n.to_string(),
                    rusqlite::types::ValueRef::Real(f) => f.to_string(),
                    _ => String::new(),
                })
            };
            Ok((get(0)?, get(1)?, get(2)?, get(3)?))
        })
        .map_err(|e| e.to_string())?;
    let mut genes = Vec::new();
    for row in rows {
        let (name, chr, start, stop) = row.map_err(|e| e.to_string())?;
        // some gene dbs carry their header line as a row
        if name == "name" && chr == "chr" {
            continue;
        }
        let parse = |s: &str| {
            s.trim()
                .parse::<i64>()
                .map_err(|_| format!("Invalid coordinate for gene {name}: {s}"))
        };
        genes.push(Gene {
            start: parse(&start)?,
            end: parse(&stop)?,
            chrom: with_chr(chr),
            name,
        });
    }
    if genes.is_empty() {
        return Err("No data in gene2coord table".into());
    }
    Ok(genes)
}

/// Lesions with sample ranks and type indices, the sorted type names, and the lesion count of each type.
fn parse_lesions(raw: Vec<(String, String, i64, i64, String)>) -> (Vec<Lesion>, Vec<String>, Vec<usize>) {
    let mut ids: Vec<&str> = raw.iter().map(|r| r.0.as_str()).collect();
    ids.sort_unstable();
    ids.dedup();
    let subj: Vec<u32> = raw
        .iter()
        .map(|r| ids.binary_search(&r.0.as_str()).unwrap() as u32)
        .collect();
    let mut types: Vec<String> = raw.iter().map(|r| r.4.clone()).collect();
    types.sort_unstable();
    types.dedup();
    let mut counts = vec![0; types.len()];
    let lesions = raw
        .into_iter()
        .zip(subj)
        .map(|((_, chrom, start, end, ty), subj)| {
            let ty = types.binary_search(&ty).unwrap();
            counts[ty] += 1;
            Lesion {
                subj,
                chrom: with_chr(chrom),
                start,
                end,
                ty,
            }
        })
        .collect();
    (lesions, types, counts)
}

// ---------------------------------------------------------------------------------------------------------------
// exclude mask

/// chrom -> sorted, merged [start, end) intervals from BED files
fn load_exclude_intervals(paths: &[&str]) -> Result<HashMap<String, Vec<(i64, i64)>>, String> {
    let mut raw: HashMap<String, Vec<(i64, i64)>> = HashMap::new();
    for path in paths {
        let file = File::open(path).map_err(|_| format!("exclude BED not found: {path}"))?;
        let reader: Box<dyn BufRead> = if path.ends_with(".gz") {
            Box::new(BufReader::new(MultiGzDecoder::new(file)))
        } else {
            Box::new(BufReader::new(file))
        };
        for line in reader.lines() {
            let line = line.map_err(|e| format!("Cannot read {path}: {e}"))?;
            if line.trim().is_empty()
                || line.starts_with('#')
                || line.starts_with("track")
                || line.starts_with("browser")
            {
                continue;
            }
            let f: Vec<&str> = line.split('\t').collect();
            if f.len() < 3 {
                continue;
            }
            let (Ok(start), Ok(end)) = (f[1].trim().parse::<i64>(), f[2].trim().parse::<i64>()) else {
                continue;
            };
            if end > start {
                raw.entry(with_chr(f[0].to_string())).or_default().push((start, end));
            }
        }
    }
    for iv in raw.values_mut() {
        iv.sort_by_key(|x| x.0);
        let mut merged: Vec<(i64, i64)> = Vec::with_capacity(iv.len());
        for &(s, e) in iv.iter() {
            match merged.last_mut() {
                Some(last) if s <= last.1 => last.1 = last.1.max(e),
                _ => merged.push((s, e)),
            }
        }
        *iv = merged;
    }
    Ok(raw)
}

/// bp of [start, end) inside the sorted, merged intervals
fn masked_overlap_bp(start: i64, end: i64, iv: &[(i64, i64)]) -> i64 {
    let lo = iv.partition_point(|x| x.0 <= start).saturating_sub(1);
    let hi = iv.partition_point(|x| x.0 < end);
    iv[lo..hi.max(lo)]
        .iter()
        .map(|&(s, e)| (end.min(e) - start.max(s)).max(0))
        .sum()
}

/// Drops genes whose span is at least `frac` inside masked regions.
fn apply_gene_mask(
    genes: Vec<Gene>,
    mask: &HashMap<String, Vec<(i64, i64)>>,
    frac: f64,
    genome_size: i64,
) -> (Vec<Gene>, Value) {
    let n_in = genes.len();
    if mask.is_empty() {
        let report = json!({"genes_in": n_in, "genes_dropped": 0, "dropped_examples": [], "genome_fraction_masked": 0.0, "overlap_frac": frac});
        return (genes, report);
    }
    let (kept, dropped): (Vec<Gene>, Vec<Gene>) = genes.into_iter().partition(|gn| {
        let Some(iv) = mask.get(&gn.chrom) else { return true };
        let s = gn.start;
        let e = gn.end.max(s + 1);
        (masked_overlap_bp(s, e, iv) as f64 / (e - s) as f64) < frac
    });
    let mut names: Vec<&str> = dropped.iter().map(|gn| gn.name.as_str()).collect();
    names.sort_unstable();
    let masked_bp: i64 = mask.values().flatten().map(|&(s, e)| e - s).sum();
    let genome = if genome_size > 0 { genome_size as f64 } else { 3.1e9 };
    let report = json!({
        "genes_in": n_in,
        "genes_dropped": dropped.len(),
        "dropped_examples": names.into_iter().take(20).collect::<Vec<_>>(),
        "genome_fraction_masked": format!("{:.4}", masked_bp as f64 / genome).parse::<f64>().unwrap(),
        "overlap_frac": frac,
    });
    (kept, report)
}

// ---------------------------------------------------------------------------------------------------------------
// statistics

/// Gene index ranges per chromosome, from genes sorted by chromosome then start.
fn chrom_ranges(genes: &[Gene]) -> HashMap<&str, (usize, usize)> {
    let mut ranges = HashMap::new();
    let mut a = 0;
    for i in 1..=genes.len() {
        if i == genes.len() || genes[i].chrom != genes[a].chrom {
            ranges.insert(genes[a].chrom.as_str(), (a, i));
            a = i;
        }
    }
    ranges
}

/// Lesion indices ordered by type, chromosome, sample; a sample's lesions keep their input order.
fn lesion_order(lesions: &[Lesion]) -> Vec<usize> {
    let mut order: Vec<usize> = (0..lesions.len()).collect();
    order.sort_by(|&a, &b| {
        let (x, y) = (&lesions[a], &lesions[b]);
        (x.ty, &x.chrom, x.subj).cmp(&(y.ty, &y.chrom, y.subj))
    });
    order
}

/// Calls f(gene index) for every gene whose closed interval overlaps the lesion.
fn for_each_hit(genes: &[Gene], range: (usize, usize), max_len: i64, l: &Lesion, mut f: impl FnMut(usize)) {
    let chr = &genes[range.0..range.1];
    // genes are sorted by start, so only those starting within max_len before the lesion can reach it
    let a = chr.partition_point(|gn| gn.start < l.start - max_len);
    let b = chr.partition_point(|gn| gn.start <= l.end);
    for (i, gn) in chr[a..b.max(a)].iter().enumerate() {
        if gn.end >= l.start {
            f(range.0 + a + i);
        }
    }
}

/// Number of distinct samples with a hit, per gene (row) and lesion type (column).
fn count_subjects(genes: &[Gene], lesions: &[Lesion], nt: usize) -> Vec<u32> {
    let ranges = chrom_ranges(genes);
    let max_len: HashMap<&str, i64> = ranges
        .iter()
        .map(|(c, &(a, b))| (*c, genes[a..b].iter().map(|gn| gn.end - gn.start).max().unwrap_or(0)))
        .collect();
    let mut nsubj = vec![0u32; genes.len() * nt];
    // lesions arrive grouped by type and sample, so a hit from a new sample is one whose sample differs from the last
    let mut last = vec![u32::MAX; genes.len() * nt];
    for i in lesion_order(lesions) {
        let l = &lesions[i];
        let Some(&range) = ranges.get(l.chrom.as_str()) else {
            continue;
        };
        for_each_hit(genes, range, max_len[l.chrom.as_str()], l, |g| {
            let k = g * nt + l.ty;
            if last[k] != l.subj {
                last[k] = l.subj;
                nsubj[k] += 1;
            }
        });
    }
    nsubj
}

/// p-value per gene and lesion type; 1 for a gene without hits of that type or on a chromosome of unknown size.
fn gene_pvalues(
    genes: &[Gene],
    lesions: &[Lesion],
    nsubj: &[u32],
    nt: usize,
    chrom_sizes: &HashMap<String, i64>,
) -> Vec<f64> {
    let ranges = chrom_ranges(genes);
    let order = lesion_order(lesions);
    let mut p = vec![1.0; genes.len() * nt];
    let mut a = 0;
    while a < order.len() {
        // one block: the lesions of one type on one chromosome
        let first = &lesions[order[a]];
        let mut b = a;
        while b < order.len() && lesions[order[b]].ty == first.ty && lesions[order[b]].chrom == first.chrom {
            b += 1;
        }
        let block = &order[a..b];
        a = b;
        let (ty, chrom) = (first.ty, first.chrom.as_str());
        let (Some(&(ga, gb)), Some(&size)) = (ranges.get(chrom), chrom_sizes.get(chrom)) else {
            continue;
        };
        let hit_genes: Vec<usize> = (ga..gb).filter(|&g| nsubj[g * nt + ty] > 0).collect();
        if hit_genes.is_empty() {
            continue;
        }
        let chrom_size = size as f64;

        // the block's samples in sorted order; each lesion's local sample index
        let mut lsn_subj = Vec::with_capacity(block.len());
        let mut n_subj = 0usize;
        for (k, &i) in block.iter().enumerate() {
            if k > 0 && lesions[i].subj != lesions[block[k - 1]].subj {
                n_subj += 1;
            }
            lsn_subj.push(n_subj);
        }
        let n_subj = n_subj + 1;
        let lsn_size: Vec<f64> = block
            .iter()
            .map(|&i| (lesions[i].end - lesions[i].start + 1) as f64)
            .collect();
        let gene_size = |g: usize| (genes[g].end - genes[g].start + 1) as f64;

        let max_gene = hit_genes.iter().map(|&g| gene_size(g)).fold(f64::MIN, f64::max);
        let max_lsn = lsn_size.iter().cloned().fold(f64::MIN, f64::max);
        let approx = (max_gene + max_lsn) / chrom_size < APPROX_THRESHOLD;
        // approximation inputs: lesion count and total lesion size per sample
        let mut count = vec![0.0; n_subj];
        let mut total = vec![0.0; n_subj];
        for (k, &s) in lsn_subj.iter().enumerate() {
            count[s] += 1.0;
            total[s] += lsn_size[k];
        }
        let inv_chrom = 1.0 / chrom_size;
        let max_x = hit_genes.iter().map(|&g| nsubj[g * nt + ty]).max().unwrap() as usize;

        let values: Vec<f64> = hit_genes
            .par_iter()
            .map(|&g| {
                let gs = gene_size(g);
                let pr_subj: Vec<f64> = if approx {
                    (0..n_subj)
                        .map(|s| {
                            let x = -(count[s] * gs + total[s]) * inv_chrom;
                            if x < -700.0 { 1.0 } else { 1.0 - x.exp() }
                        })
                        .collect()
                } else {
                    let mut logsum = vec![0.0; n_subj];
                    for (k, &s) in lsn_subj.iter().enumerate() {
                        let pr = ((gs + lsn_size[k]) / chrom_size).clamp(1e-10, 1.0 - 1e-10);
                        logsum[s] += (1.0 - pr).ln();
                    }
                    logsum.iter().map(|x| 1.0 - x.exp()).collect()
                };
                upper_tail(&pr_subj, nsubj[g * nt + ty] as usize, max_x)
            })
            .collect();
        for (&g, v) in hit_genes.iter().zip(values) {
            p[g * nt + ty] = v;
        }
    }
    p
}

/// P(X >= k) for X a sum of independent Bernoulli(probs). The distribution is tracked up to max_x + 1, the last
/// entry absorbing everything above; k <= max_x + 1.
fn upper_tail(probs: &[f64], k: usize, max_x: usize) -> f64 {
    let mut pr = vec![0.0; max_x + 2];
    pr[0] = 1.0;
    for &p in probs {
        for j in (0..=max_x).rev() {
            pr[j + 1] += pr[j] * p;
            pr[j] *= 1.0 - p;
        }
    }
    pr[k..].iter().sum()
}

/// Benjamini-Hochberg adjusted p-values, as statsmodels fdrcorrection (method "indep") computes them.
fn bh(p: &[f64]) -> Vec<f64> {
    let n = p.len();
    let mut idx: Vec<usize> = (0..n).collect();
    idx.sort_by(|&a, &b| p[a].partial_cmp(&p[b]).unwrap());
    let mut out = vec![0.0; n];
    let mut cummin = f64::INFINITY;
    for r in (0..n).rev() {
        let factor = (r + 1) as f64 / n as f64;
        cummin = cummin.min(p[idx[r]] / factor);
        out[idx[r]] = cummin.min(1.0);
    }
    out
}

/// min(1, 2 * mean(p)) * BH(p) for each column of a genes x columns matrix; a NaN p counts as 1 in BH and is
/// skipped in the mean.
fn q_values(p: &[f64], g: usize, nc: usize) -> Vec<f64> {
    let mut q = vec![0.0; g * nc];
    for c in 0..nc {
        let col: Vec<f64> = (0..g).map(|i| p[i * nc + c]).collect();
        let finite: Vec<f64> = col.iter().cloned().filter(|x| !x.is_nan()).collect();
        let pi_hat = (2.0 * finite.iter().sum::<f64>() / finite.len() as f64).min(1.0);
        let adj = bh(&col
            .iter()
            .map(|&x| if x.is_nan() { 1.0 } else { x })
            .collect::<Vec<_>>());
        for i in 0..g {
            q[i * nc + c] = pi_hat * adj[i];
        }
    }
    q
}

/// Constellation test: per gene, the k-th smallest p across lesion types (k = 0-based column) through the beta cdf
/// with shape (k + 1, nt - k), the distribution of the (k + 1)-th smallest of nt uniforms, as in GRIN2's R p.order
/// (pbeta(p, i, k - i + 1) with 1-based i); returns p and q matrices.
fn constellation(p: &[f64], g: usize, nt: usize) -> (Vec<f64>, Vec<f64>) {
    let mut out = vec![0.0; g * nt];
    for i in 0..g {
        let mut row: Vec<f64> = p[i * nt..(i + 1) * nt].to_vec();
        row.sort_by(|a, b| a.partial_cmp(b).unwrap());
        for k in 0..nt {
            // R's pbeta, accurate far into the lower tail like scipy's; statrs gives 0 below ~1e-16
            out[i * nt + k] = beta_cdf(row[k], (k + 1) as f64, (nt - k) as f64, true, false);
        }
    }
    let q = q_values(&out, g, nt);
    (out, q)
}

// ---------------------------------------------------------------------------------------------------------------
// output

/// 4 significant digits of a probability the way numpy.round does it: scale by 10^d, round half to even, scale
/// back. Below ~1e-305, where 10^d overflows (numpy returns NaN there), it rounds the decimal digits instead.
fn sig_round(x: f64) -> f64 {
    if x == 0.0 || !x.is_finite() {
        return 0.0;
    }
    let d = 3 - x.abs().log10().floor() as i32;
    if d > 308 {
        return format!("{x:.3e}").parse().unwrap();
    }
    let f = 10f64.powf(d as f64);
    (x * f).round_ties_even() / f
}

/// 3 significant digits for the table; null for NaN
fn table_num(x: f64) -> Value {
    if !x.is_finite() {
        Value::Null
    } else if x == 0.0 {
        json!(0)
    } else {
        json!(format!("{x:.2e}").parse::<f64>().unwrap())
    }
}

fn type_label(prefix: &str, ty: &str, lesion_type_map: &BTreeMap<String, String>) -> String {
    let label = match prefix {
        "p.nsubj." => "P-value",
        "q.nsubj." => "Q-value",
        _ => "Subject Count",
    };
    match lesion_type_map.get(ty) {
        Some(name) => format!("{label} ({name})"),
        None => format!("{prefix}{ty}"),
    }
}

#[allow(clippy::too_many_arguments)]
fn top_gene_table(
    genes: &[Gene],
    order: &[usize],
    num_rows: usize,
    types: &[String],
    lesion_type_map: &BTreeMap<String, String>,
    nsubj: &[u32],
    p: &[f64],
    q: &[f64],
    constellation: &Option<(Vec<f64>, Vec<f64>)>,
) -> Value {
    let nt = types.len();
    let top = &order[..num_rows];
    // a type gets columns when one of the first 20 rows has a p-value
    let shown: Vec<usize> = (0..nt)
        .filter(|&t| top.iter().take(20).any(|&i| !p[i * nt + t].is_nan()))
        .collect();
    let n_const = if constellation.is_some() {
        nt.min(MAX_CONSTELLATION_COLUMNS)
    } else {
        0
    };

    let mut columns = vec![
        json!({"label": "Gene", "sortable": true}),
        json!({"label": "Chromosome", "sortable": true}),
    ];
    for &t in &shown {
        for prefix in ["p.nsubj.", "q.nsubj.", "nsubj."] {
            columns.push(json!({"label": type_label(prefix, &types[t], lesion_type_map), "sortable": true}));
        }
    }
    for k in 1..=n_const {
        let s = if k > 1 { "s" } else { "" };
        columns.push(json!({"label": format!("P-value ({k} Lesion Type{s})"), "sortable": true}));
        columns.push(json!({"label": format!("Q-value ({k} Lesion Type{s})"), "sortable": true}));
    }

    let rows: Vec<Value> = top
        .iter()
        .map(|&i| {
            let mut row = vec![json!({"value": genes[i].name}), json!({"value": genes[i].chrom})];
            for &t in &shown {
                let k = i * nt + t;
                row.push(json!({"value": table_num(p[k])}));
                row.push(json!({"value": table_num(q[k])}));
                row.push(json!({"value": table_num(nsubj[k] as f64)}));
            }
            if let Some((cp, cq)) = constellation {
                for k in 0..n_const {
                    row.push(json!({"value": table_num(cp[i * nt + k])}));
                    row.push(json!({"value": table_num(cq[i * nt + k])}));
                }
            }
            Value::Array(row)
        })
        .collect();
    json!({"columns": columns, "rows": rows})
}

fn peak_rss_mb() -> f64 {
    unsafe {
        let mut usage: libc::rusage = std::mem::zeroed();
        libc::getrusage(libc::RUSAGE_SELF, &mut usage);
        // ru_maxrss is bytes on macOS, kilobytes on Linux
        if cfg!(target_os = "macos") {
            usage.ru_maxrss as f64 / 1_048_576.0
        } else {
            usage.ru_maxrss as f64 / 1024.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upper_tail_matches_enumeration() {
        let probs = [0.1, 0.5, 0.25, 0.9];
        // P(X >= k) by summing over all 2^4 outcomes
        let brute = |k: usize| -> f64 {
            (0..16u32)
                .filter(|m| m.count_ones() as usize >= k)
                .map(|m| {
                    (0..4)
                        .map(|j| if m >> j & 1 == 1 { probs[j] } else { 1.0 - probs[j] })
                        .product::<f64>()
                })
                .sum()
        };
        for k in 0..=4 {
            assert!((upper_tail(&probs, k, 4) - brute(k)).abs() < 1e-12, "k={}", k);
        }
        // tracking only up to max_x + 1 keeps the tail exact for k <= max_x + 1
        assert!((upper_tail(&probs, 2, 1) - brute(2)).abs() < 1e-12);
    }

    #[test]
    fn bh_matches_known_values() {
        // statsmodels fdrcorrection([0.01, 0.04, 0.03, 0.5])[1]
        let q = bh(&[0.01, 0.04, 0.03, 0.5]);
        for (a, b) in q.iter().zip([0.04, 0.05333333333333334, 0.05333333333333334, 0.5]) {
            assert!((a - b).abs() < 1e-15);
        }
    }

    #[test]
    fn hits_are_closed_intervals() {
        let gene = |start, end| Gene {
            name: "G".into(),
            chrom: "chr1".into(),
            start,
            end,
        };
        let lesion = |start, end| Lesion {
            subj: 0,
            chrom: "chr1".into(),
            start,
            end,
            ty: 0,
        };
        let genes = [gene(100, 200)];
        let hits = |l: &Lesion| {
            let mut n = 0;
            for_each_hit(&genes, (0, 1), 100, l, |_| n += 1);
            n
        };
        assert_eq!(hits(&lesion(200, 300)), 1); // touches the gene end
        assert_eq!(hits(&lesion(50, 100)), 1); // touches the gene start
        assert_eq!(hits(&lesion(201, 300)), 0);
        assert_eq!(hits(&lesion(10, 99)), 0);
        assert_eq!(hits(&lesion(150, 150)), 1);
    }

    #[test]
    fn constellation_uses_order_statistics_of_uniforms() {
        // two lesion types, both p = 0.1: P(min of 2 uniforms <= 0.1) = 1 - 0.9^2, P(max <= 0.1) = 0.1^2
        let (p, _) = constellation(&[0.1, 0.1], 1, 2);
        assert!((p[0] - 0.19).abs() < 1e-12, "p1 = {}", p[0]);
        assert!((p[1] - 0.01).abs() < 1e-12, "p2 = {}", p[1]);
    }

    #[test]
    fn sig_round_matches_numpy() {
        // numpy: [np.round(x, 3 - int(np.floor(np.log10(abs(x))))) for x in ...]
        assert_eq!(sig_round(0.000123456), 0.0001235);
        assert_eq!(sig_round(0.98765), 0.9876); // 0.98765 is stored just below the half
        assert_eq!(sig_round(1.0), 1.0);
        assert_eq!(sig_round(2.5e-7), 2.5e-7);
        assert_eq!(sig_round(0.0), 0.0);
        assert_eq!(sig_round(1.234567e-307), 1.235e-307); // numpy: nan
    }
}
