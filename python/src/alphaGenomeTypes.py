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
import re


try:
    input_data = sys.stdin.read()
    parsed_data = json.loads(input_data)
    API_KEY = parsed_data.get('API_KEY', os.getenv("API_KEY"))


    model = dna_client.create(API_KEY)

    metadata = model.output_metadata(dna_client.Organism.HOMO_SAPIENS).rna_seq

    is_valid_name = lambda name: bool(re.match(r"^[a-z\s]{3,}$", name))

    # Filter the ontologyMap
    ontologyMap = {name: curie for name, curie in zip(metadata.biosample_name, metadata.ontology_curie) if is_valid_name(name)}
    ontologyTerms = [{"label": k, "value": v} for k, v in ontologyMap.items()]

    outputTypes = [{"label": outputType.name, "value": outputType.value} for outputType in dna_client.OutputType if outputType not in [dna_client.OutputType.CONTACT_MAPS, dna_client.OutputType.SPLICE_JUNCTIONS]]
    intervals = [{"label": interval, "value": interval} for interval in [16384, 131072, 524288, 1048576]] #lengths supported by the model
    result = { "ontologyTerms": ontologyTerms, "outputTypes": outputTypes, "intervals": intervals }
    print(json.dumps(result))


except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)