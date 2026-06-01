"""Human-readable elapsed-time formatting for proteinpaint Python scripts.

Mirrors the Node utility `formatElapsedTime` in shared/utils/src/time.ts so
that timing logs read consistently across the Node<->Python boundary. The
buckets match the JS version:
    < 1s   -> 'NNNms'
    < 1m   -> 'N.NNs'
    >= 1m  -> 'Nm N.NNs'
The sign is preserved for defensive use (e.g. a start/stop swapped delta).

Note: the JS helper takes milliseconds; this takes seconds, since Python's
`time.perf_counter()` returns seconds.
"""


def format_elapsed_time(seconds, precision: int = 2) -> str:
    if not isinstance(seconds, (int, float)) or isinstance(seconds, bool):
        return "Invalid time: not a number"
    if seconds != seconds:  # NaN
        return "Invalid time: NaN"
    if seconds == float("inf") or seconds == float("-inf"):
        return "Infinite time" if seconds > 0 else "-Infinite time"

    abs_s = abs(seconds)
    sign = "-" if seconds < 0 else ""

    if abs_s < 1:
        return f"{sign}{round(abs_s * 1000)}ms"
    if abs_s < 60:
        return f"{sign}{abs_s:.{precision}f}s"
    minutes = int(abs_s // 60)
    rem = abs_s % 60
    return f"{sign}{minutes}m {rem:.{precision}f}s"
