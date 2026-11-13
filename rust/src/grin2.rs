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
stable ordering of ties. Lesion fields are read as the Python's astype read them: a sample, chromosome or type may be
a number, and a coordinate a float (truncated) or a numeric string. Four differences:
- a p- or q-value below ~1e-305 is reported, where numpy's rounding turned it into NaN, which left the value blank
  and ranked the gene by its other lesion types.
- the constellation test uses the beta parameters of GRIN2's R p.order. The Python used Beta(j, k - j + 2) for the
  j-th smallest of k p-values, the distribution for k + 1 lesion types, which made it conservative.
- every lesion type and chromosome is its own block. The Python split blocks by chromosome only, so when one lesion
  type's last chromosome with a hit was the next type's first, the genes of the second type there kept p = 1.
- genes that share a name are separate rows. The Python joined hits to genes by name, which added up their counts.
*/

use flate2::read::MultiGzDecoder;
use r_mathlib::beta_cdf;
use rayon::prelude::*;
use rusqlite::Connection;
use serde::de::{self, Deserializer, SeqAccess, Visitor};
use serde::ser::{SerializeMap, SerializeSeq};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashMap};
use std::convert::TryFrom;
use std::fmt;
use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};

mod peak_rss;
mod sqlite_static;
mod stats_functions;
use peak_rss::peak_rss_mb;
use sqlite_static::prepare_static;
use stats_functions::bh_adjust;

// below this (max gene + max lesion) / chromosome size, the log(1 - p) ~ -p approximation is used
const APPROX_THRESHOLD: f64 = 0.05;
// constellation columns shown in the top-gene table
const MAX_CONSTELLATION_COLUMNS: usize = 5;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input {
    genedb: String,
    chromosomelist: HashMap<String, i64>,
    lesion: Lesions,
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
    subj: u32,  // rank of the sample id in sorted order
    chrom: u32, // index into Lesions.chroms
    start: i64,
    end: i64,
    ty: usize, // index into Lesions.types
}

/// The lesions, with their sample, chromosome and type as ranks of the sorted names
struct Lesions {
    list: Vec<Lesion>,
    chroms: Vec<String>, // sorted, with the chr prefix
    types: Vec<String>,  // sorted
    counts: Vec<usize>,  // lesions of each type
}

fn main() {
    let result = read_input().and_then(run);
    if let Err(e) = result {
        eprintln!("ERROR: {e}");
        std::process::exit(1);
    }
}

fn read_input() -> Result<Input, String> {
    // parsed as it is read, so the input text is never held whole next to the lesions
    serde_json::from_reader(BufReader::new(io::stdin().lock())).map_err(|e| format!("Invalid input: {e}"))
}

fn run(input: Input) -> Result<(), String> {
    if input.lesion_type_map.is_empty() {
        return Err("lesionTypeMap not provided".into());
    }
    if input.lesion.list.is_empty() {
        return Err("No lesion data provided".into());
    }
    let mut genes = read_genes(&input.genedb)?;

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

    let (nsubj, p) = gene_stats(&genes, &input.lesion, &input.chromosomelist);
    let Lesions { types, counts, .. } = input.lesion;
    let nt = types.len();
    let g = genes.len();
    let q = q_values(&p, g, nt);
    let constellation = (nt > 1).then(|| constellation(&p, g, nt));

    // rounded as the output reports them; sorting uses these rounded values, as the Python did
    let round_all = |v: &[f64]| v.iter().map(|&x| sig_round(x)).collect::<Vec<f64>>();
    let (p, q) = (round_all(&p), round_all(&q));
    let constellation = constellation.map(|(cp, cq)| (round_all(&cp), round_all(&cq)));

    // genes by their smallest p across lesion types; a stable sort, so ties keep the gene order
    let min_p = |i: usize| p[i * nt..(i + 1) * nt].iter().cloned().fold(f64::INFINITY, f64::min);
    let mut order: Vec<usize> = (0..g).collect();
    order.sort_by(|&a, &b| min_p(a).total_cmp(&min_p(b)));

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
    let by_type: BTreeMap<&str, usize> = types.iter().map(|t| t.as_str()).zip(counts).collect();

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

impl<'de> Deserialize<'de> for Lesions {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        d.deserialize_seq(LesionsVisitor)
    }
}

struct LesionsVisitor;

impl<'de> Visitor<'de> for LesionsVisitor {
    type Value = Lesions;

    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("an array of [sample, chrom, start, end, type]")
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Lesions, A::Error> {
        // the names are numbered as they arrive, so a lesion holds numbers instead of its own copy of each name
        let (mut samples, mut chroms, mut types) = (Names::default(), Names::default(), Names::default());
        let mut list = Vec::with_capacity(seq.size_hint().unwrap_or(0));
        while let Some((Text(s), Text(c), Coord(start), Coord(end), Text(t))) = seq.next_element()? {
            list.push(Lesion {
                subj: samples.id(s),
                chrom: chroms.id(with_chr(c)),
                start,
                end,
                ty: types.id(t) as usize,
            });
        }
        // then renumbered by sorted name, the order in which the statistics group and visit them
        let (_, subj) = samples.sorted();
        let (chroms, chrom) = chroms.sorted();
        let (types, ty) = types.sorted();
        let mut counts = vec![0; types.len()];
        for l in &mut list {
            l.subj = subj[l.subj as usize];
            l.chrom = chrom[l.chrom as usize];
            l.ty = ty[l.ty] as usize;
            counts[l.ty] += 1;
        }
        Ok(Lesions {
            list,
            chroms,
            types,
            counts,
        })
    }
}

/// Numbers names in the order they are first seen
#[derive(Default)]
struct Names(HashMap<String, u32>);

impl Names {
    fn id(&mut self, name: String) -> u32 {
        let next = self.0.len() as u32;
        *self.0.entry(name).or_insert(next)
    }

    /// the names in sorted order, and the sorted rank of each number
    fn sorted(self) -> (Vec<String>, Vec<u32>) {
        let mut names: Vec<(String, u32)> = self.0.into_iter().collect();
        names.sort_unstable();
        let mut rank = vec![0; names.len()];
        for (r, (_, id)) in names.iter().enumerate() {
            rank[*id as usize] = r as u32;
        }
        (names.into_iter().map(|(name, _)| name).collect(), rank)
    }
}

/// A name given as a string or a number; null reads as "None", as Python's str(None) did
struct Text(String);

impl<'de> Deserialize<'de> for Text {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Text;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a string or a number")
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<Text, E> {
                Ok(Text(v.to_owned()))
            }
            fn visit_string<E: de::Error>(self, v: String) -> Result<Text, E> {
                Ok(Text(v))
            }
            fn visit_i64<E: de::Error>(self, v: i64) -> Result<Text, E> {
                Ok(Text(v.to_string()))
            }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<Text, E> {
                Ok(Text(v.to_string()))
            }
            fn visit_f64<E: de::Error>(self, v: f64) -> Result<Text, E> {
                Ok(Text(v.to_string()))
            }
            fn visit_unit<E: de::Error>(self) -> Result<Text, E> {
                Ok(Text("None".into()))
            }
        }
        d.deserialize_any(V)
    }
}

/// A coordinate given as an integer, a float (truncated, as numpy's astype("int64") does) or an integer string
struct Coord(i64);

impl<'de> Deserialize<'de> for Coord {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Coord;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a coordinate")
            }
            fn visit_i64<E: de::Error>(self, v: i64) -> Result<Coord, E> {
                Ok(Coord(v))
            }
            fn visit_u64<E: de::Error>(self, v: u64) -> Result<Coord, E> {
                i64::try_from(v)
                    .map(Coord)
                    .map_err(|_| E::custom(format!("coordinate out of range: {v}")))
            }
            fn visit_f64<E: de::Error>(self, v: f64) -> Result<Coord, E> {
                if v.is_finite() && v.abs() < 9.2e18 {
                    Ok(Coord(v as i64))
                } else {
                    Err(E::custom(format!("invalid coordinate: {v}")))
                }
            }
            fn visit_str<E: de::Error>(self, v: &str) -> Result<Coord, E> {
                v.trim()
                    .parse()
                    .map(Coord)
                    .map_err(|_| E::custom(format!("invalid coordinate: {v:?}")))
            }
        }
        d.deserialize_any(V)
    }
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

/// Subject count and p-value per gene (row) and lesion type (column).
fn gene_stats(genes: &[Gene], lesions: &Lesions, chrom_sizes: &HashMap<String, i64>) -> (Vec<u32>, Vec<f64>) {
    let nt = lesions.types.len();
    let ranges = chrom_ranges(genes);
    // per lesion chromosome: its genes' index range and longest gene, when it has genes
    let gene_range: Vec<Option<(usize, usize, i64)>> = lesions
        .chroms
        .iter()
        .map(|c| {
            let &(a, b) = ranges.get(c.as_str())?;
            Some((a, b, genes[a..b].iter().map(|gn| gn.end - gn.start).max().unwrap()))
        })
        .collect();
    let sizes: Vec<Option<f64>> = lesions
        .chroms
        .iter()
        .map(|c| chrom_sizes.get(c).map(|&s| s as f64))
        .collect();
    // lesions ordered by type, chromosome, sample; a stable sort, so a sample's lesions keep their input order
    let mut order: Vec<usize> = (0..lesions.list.len()).collect();
    order.sort_by_key(|&i| {
        let l = &lesions.list[i];
        (l.ty, l.chrom, l.subj)
    });
    let nsubj = count_subjects(genes, &lesions.list, &order, &gene_range, nt);
    let p = gene_pvalues(genes, &lesions.list, &order, &gene_range, &sizes, &nsubj, nt);
    (nsubj, p)
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
fn count_subjects(
    genes: &[Gene],
    lesions: &[Lesion],
    order: &[usize],
    gene_range: &[Option<(usize, usize, i64)>],
    nt: usize,
) -> Vec<u32> {
    let mut nsubj = vec![0u32; genes.len() * nt];
    // lesions arrive grouped by type and sample, so a hit from a new sample is one whose sample differs from the last
    let mut last = vec![u32::MAX; genes.len() * nt];
    for &i in order {
        let l = &lesions[i];
        let Some((a, b, max_len)) = gene_range[l.chrom as usize] else {
            continue;
        };
        for_each_hit(genes, (a, b), max_len, l, |g| {
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
    order: &[usize],
    gene_range: &[Option<(usize, usize, i64)>],
    chrom_sizes: &[Option<f64>],
    nsubj: &[u32],
    nt: usize,
) -> Vec<f64> {
    let mut p = vec![1.0; genes.len() * nt];
    // one block: the lesions of one type on one chromosome
    for block in order.chunk_by(|&x, &y| (lesions[x].ty, lesions[x].chrom) == (lesions[y].ty, lesions[y].chrom)) {
        let first = &lesions[block[0]];
        let ty = first.ty;
        let (Some((ga, gb, _)), Some(chrom_size)) =
            (gene_range[first.chrom as usize], chrom_sizes[first.chrom as usize])
        else {
            continue;
        };
        let hit_genes: Vec<usize> = (ga..gb).filter(|&g| nsubj[g * nt + ty] > 0).collect();
        if hit_genes.is_empty() {
            continue;
        }

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
                // the distribution is needed only up to the gene's own count, the last entry absorbing the rest
                let k = nsubj[g * nt + ty] as usize;
                upper_tail(&pr_subj, k, k - 1)
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

/// min(1, 2 * mean(p)) * BH(p) for each column of a genes x columns matrix
fn q_values(p: &[f64], g: usize, nc: usize) -> Vec<f64> {
    let mut q = vec![0.0; g * nc];
    for c in 0..nc {
        let col: Vec<f64> = (0..g).map(|i| p[i * nc + c]).collect();
        let pi_hat = (2.0 * col.iter().sum::<f64>() / g as f64).min(1.0);
        let adj = bh_adjust(&col);
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
        row.sort_by(f64::total_cmp);
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
    if x == 0.0 {
        return 0.0;
    }
    let d = 3 - x.abs().log10().floor() as i32;
    if d > 308 {
        return format!("{x:.3e}").parse().unwrap();
    }
    let f = 10f64.powf(d as f64);
    (x * f).round_ties_even() / f
}

/// 3 significant digits for the table
fn table_num(x: f64) -> Value {
    if x == 0.0 {
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
    let n_const = if constellation.is_some() {
        nt.min(MAX_CONSTELLATION_COLUMNS)
    } else {
        0
    };

    let mut columns = vec![
        json!({"label": "Gene", "sortable": true}),
        json!({"label": "Chromosome", "sortable": true}),
    ];
    for t in 0..nt {
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
            for t in 0..nt {
                let k = i * nt + t;
                row.push(json!({"value": table_num(p[k])}));
                row.push(json!({"value": table_num(q[k])}));
                row.push(json!({"value": nsubj[k]}));
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
        let q = bh_adjust(&[0.01, 0.04, 0.03, 0.5]);
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
            chrom: 0,
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
    fn lesions_read_as_python_read_them() {
        // a numeric sample or chromosome, a float or string coordinate, and a null chromosome, as astype() took them
        let l: Lesions = serde_json::from_str(
            r#"[[7, 1, 10.9, "20", "loss"], ["s2", "chr2", 5, 6, "gain"], ["s2", null, 1, 2, "loss"]]"#,
        )
        .unwrap();
        assert_eq!(l.chroms, ["chr1", "chr2", "chrNone"]);
        assert_eq!(l.types, ["gain", "loss"]);
        assert_eq!(l.counts, [1, 2]);
        let first = &l.list[0];
        assert_eq!(
            (first.subj, first.chrom, first.start, first.end, first.ty),
            (0, 0, 10, 20, 1)
        );
        assert_eq!(l.list[1].subj, 1); // "7" sorts before "s2"
        assert!(serde_json::from_str::<Lesions>(r#"[["s", "chr1", null, 2, "loss"]]"#).is_err());
        assert!(serde_json::from_str::<Lesions>(r#"[["s", "chr1", "1.5", 2, "loss"]]"#).is_err());
    }

    #[test]
    fn subject_counts_and_pvalues_per_block() {
        let gene = |chrom: &str, start, end| Gene {
            name: String::new(),
            chrom: chrom.into(),
            start,
            end,
        };
        // chrA is small, so a gain block there takes the exact path; the approximation runs for the mutation block on
        // chrA, whose gene and lesion are small, and on the large chrB
        let genes = [
            gene("chrA", 100, 149),   // 50 bp
            gene("chrA", 500, 509),   // 10 bp
            gene("chrB", 1000, 1099), // 100 bp
        ];
        let lesions: Lesions = serde_json::from_str(
            r#"[
                ["a", "A", 120, 130, "gain"],
                ["a", "chrA", 140, 145.7, "gain"],
                [7, "chrA", 505, "505", "gain"],
                ["c", "chrA", 300, 310, "gain"],
                ["c", "chrA", 507, 507, "mutation"],
                ["a", "chrB", 1050, 1050, "mutation"],
                ["a", "chrB", 1090, 1200, "mutation"],
                [7, "chrB", 5000, 5009, "mutation"]
            ]"#,
        )
        .unwrap();
        // gain: sample a hits gene 0 twice (11 and 6 bp), 7 hits gene 1 (1 bp), c hits nothing (11 bp).
        // mutation: on chrA, c hits gene 1 (1 bp), in a block of its own although gain's last chromosome is also chrA;
        // on chrB, a hits gene 2 twice (1 and 111 bp), 7 hits nothing (10 bp)
        let sizes = HashMap::from([("chrA".to_string(), 1000), ("chrB".to_string(), 1_000_000)]);
        let (nsubj, p) = gene_stats(&genes, &lesions, &sizes);
        // a sample with two lesions in one gene counts once
        assert_eq!(nsubj, vec![1, 0, 1, 1, 0, 1]);

        // exact: a sample's hit probability is 1 - prod over its lesions of (1 - (gene + lesion size) / chrom size)
        let none = |prs: &[f64]| prs.iter().map(|x| 1.0 - x).product::<f64>();
        let p0 = 1.0 - none(&[0.061, 0.056]) * none(&[0.051]) * none(&[0.061]);
        let p1 = 1.0 - none(&[0.021, 0.016]) * none(&[0.011]) * none(&[0.021]);
        // approximate: 1 - exp(-(lesion count * gene size + total lesion size) / chrom size)
        let p2 = 1.0 - (-(2.0 * 100.0 + 112.0) / 1e6_f64).exp() * (-(100.0 + 10.0) / 1e6_f64).exp();
        let p3 = 1.0 - (-(10.0 + 1.0) / 1000_f64).exp();
        let expected = [p0, 1.0, p1, p3, 1.0, p2];
        for (i, (a, b)) in p.iter().zip(expected).enumerate() {
            assert!((a - b).abs() < 1e-12, "p[{}] = {}, expected {}", i, a, b);
        }

        // q = min(1, 2 * mean p) * BH(p), per type
        let q = q_values(&p, genes.len(), 2);
        let pi0 = (2.0 * (p0 + p1 + 1.0) / 3.0).min(1.0);
        let pi1 = (2.0 * (1.0 + p3 + p2) / 3.0).min(1.0);
        let expected = [
            pi0 * (p0 * 1.5),
            pi1,
            pi0 * (p1 * 3.0).min(p0 * 1.5),
            pi1 * (p3 * 1.5),
            pi0,
            pi1 * (p2 * 3.0).min(p3 * 1.5),
        ];
        for (i, (a, b)) in q.iter().zip(expected).enumerate() {
            assert!((a - b).abs() < 1e-12, "q[{}] = {}, expected {}", i, a, b);
        }
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
