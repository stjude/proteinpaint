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
#
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

input_data = sys.stdin.read()
parsed_data = json.loads(input_data)
position = int(parsed_data['position']) or 36201698
chromosome = parsed_data['chromosome'] or 'chr22'
reference = parsed_data['reference'] or 'A'
alternate = parsed_data['alternate'] or 'C'

API_KEY = os.getenv("API_KEY")
model = dna_client.create(API_KEY)
len = 2048
interval = genome.Interval(chromosome=chromosome, start=35677410, end=36725986)
variant = genome.Variant(
    chromosome=chromosome,
    position=position,
    reference_bases=reference,
    alternate_bases=alternate,
)

outputs = model.predict_variant(
    interval=interval,
    variant=variant,
    ontology_terms=['UBERON:0001157'],
    requested_outputs=[dna_client.OutputType.RNA_SEQ],
)


fig = plot_components.plot(
    [
        plot_components.OverlaidTracks(
            tdata={
                'REF': outputs.reference.rna_seq,
                'ALT': outputs.alternate.rna_seq,
            },
            colors={'REF': 'dimgrey', 'ALT': 'red'},
        ),
    ],
    interval=outputs.reference.rna_seq.interval.resize(2**15),
    # Annotate the location of the variant as a vertical line.
    annotations=[plot_components.VariantAnnotation([variant], alpha=0.8)],
)


# Output the image data to stdout
buf = io.BytesIO()
fig.savefig(buf, format='png', bbox_inches='tight', facecolor='white')
data = base64.b64encode(buf.getbuffer()).decode("ascii")
buffer_url = f"data:image/png;base64,{data}"
buf.seek(0)
plt.close()
print(buffer_url)
