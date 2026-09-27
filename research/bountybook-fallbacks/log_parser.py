import re

_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+(?P<user>\S+)\s+\[(?P<timestamp>[^\]]+)\]\s+'
    r'"(?P<method>\S+)\s+(?P<path>\S+)\s+(?P<protocol>[^"]+)"\s+'
    r'(?P<status>\d{3})\s+(?P<bytes>\d+|-)(?:\s+.*)?$'
)

def parse_log(log_text: str) -> list[dict]:
    rows = []
    for line in log_text.splitlines():
        match = _PATTERN.match(line)
        if not match:
            continue
        g = match.groupdict()
        rows.append({
            "ip": g["ip"],
            "user": None if g["user"] == "-" else g["user"],
            "timestamp": g["timestamp"],
            "method": g["method"],
            "path": g["path"],
            "protocol": g["protocol"],
            "status": int(g["status"]),
            "bytes": 0 if g["bytes"] == "-" else int(g["bytes"]),
        })
    return rows
