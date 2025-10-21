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
    API_KEY = parsed_data.get('API_KEY', os.getenv("API_KEY"))

    ontology_terms = parsed_data.get('ontologyTerms', None) 

    model = dna_client.create(API_KEY)

    metadata = model.output_metadata(dna_client.Organism.HOMO_SAPIENS).rna_seq
    df = metadata
    # Convert to DataFrame
    #df = uberon_metadata.concatenate()

    ontologyMap = dict(zip(df.biosample_name, df.ontology_curie))
    # filter by ontology terms
    if ontology_terms:
        ontologyTerms = [{"label": label, "value": value} for k, v in ontologyMap.items() if k in ontology_terms]
    else:
        ontologyTerms = [{"label": k, "value": v} for k, v in ontologyMap.items()]

    outputTypes = [{"label": outputType.name, "value": outputType.value} for outputType in dna_client.OutputType]
    intervals = [{"label": interval, "value": interval} for interval in [2048, 16384, 131072, 524288]]
    result = { "ontologyTerms": ontologyTerms, "outputTypes": outputTypes, "intervals": intervals }
    print(json.dumps(result))


except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)