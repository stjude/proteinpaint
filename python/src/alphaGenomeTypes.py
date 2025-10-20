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
    ontology_terms = parsed_data.get('ontologyTerms', None) 

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

    outputTypes = [{"label": outputType.name, "value": outputType.value} for outputType in dna_client.OutputType]

    result = { "ontologyTerms": label_map, "outputTypes": outputTypes }
    print(json.dumps(result))


except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)