def flatten_dict(d: dict, sep: str = '.') -> dict:
    out = {}

    def walk(value, parts):
        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, parts + [str(key)])
        elif parts:
            out[sep.join(parts)] = value

    walk(d, [])
    return out
