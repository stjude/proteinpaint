#
# AlphaGenome is an AI application developed by Google DeepMind that predicts the effects of genetic variants on gene regulation 
# and other molecular processes. It takes a DNA sequence as input and predicts thousands of functional genomic features, 
# including gene expression, chromatin accessibility, and splicing, with single base-pair resolution. The application provides tools to 
# analyze the impact of specific mutations, helping researchers in areas like disease diagnosis, drug discovery, and synthetic biology. 
# Below is an example of making a variant prediction. We can predict the effect of a variant on a specific output type and tissue 
# by making predictions for the reference (REF) and alternative (ALT) allele sequences.
#
# Identifying driver mutations: A cancer genome has numerous mutations, but only a small fraction, known as "driver variants," contribute to 
# tumor growth. Variant predictors help distinguish these from "passenger variants," which do not influence tumor progression, 
# by identifying mutations with a significant functional effect. This is crucial for understanding the molecular mechanisms of cancer. 
# In this plot where the red and gray lines diverge, you can infer allele-specific expression (ASE) or transcriptional impact of the variant.
# If red (ALT) is higher than gray (REF), the variant increases expression. If red dips below gray, the variant may decrease expression or disrupt splicing.
# If the effect (divergence) appears only in one or few tissues, it’s tissue-specific. If it appears in many, it may have a broad regulatory effect.

#In order to test this code, you need to set the environment variable API_KEY to your API key.
#



from alphagenome.data import genome
from alphagenome.models import dna_client
from alphagenome.visualization import plot_components
import matplotlib.pyplot as plt
import io
import sys
import json
import base64
import os

try:
    input_data = sys.stdin.read()
    parsed_data = json.loads(input_data)
    ontology_terms = parsed_data['ontologyTerms'] or None

    API_KEY = os.getenv("API_KEY")
    model = dna_client.create(API_KEY)

    metadata = model.output_metadata(dna_client.Organism.HOMO_SAPIENS).rna_seq
    df = metadata
    # Convert to DataFrame
    #df = uberon_metadata.concatenate()

    label_map = dict(zip(df.ontology_curie, df.biosample_name))
    # filter by ontology terms
    if ontology_terms:
        label_map = {k: v for k, v in label_map.items() if k in ontology_terms}
    print(json.dumps(label_map))


except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)