"""
GPDM — Gaussian Process Differential Methylation
Regional annotation-aware differential methylation analysis.
"""

from .core import (
    RegionalDMAnalysis,
    Annotation,
    DMR,
    GPDMResults,
    NaiveGP,
    DomainPartitionedGP,
)

__version__ = "0.1.0"
__all__ = [
    "RegionalDMAnalysis",
    "Annotation",
    "DMR",
    "GPDMResults",
    "NaiveGP",
    "DomainPartitionedGP",
]
