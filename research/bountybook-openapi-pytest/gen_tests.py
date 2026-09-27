import argparse, json, re
from pathlib import Path
from urllib.parse import urlparse
import requests, yaml

METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}

def load_spec(source):
    if source.startswith(("http://", "https://")):
        text = requests.get(source, timeout=30).text
    else:
        text = Path(source).read_text()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return yaml.safe_load(text)

def value(schema):
    schema = schema or {}
    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    if schema.get("enum"):
        return schema["enum"][0]
    typ = schema.get("type", "string")
    return {"integer": 1, "number": 1, "boolean": True}.get(typ, "test")

def name_for(method, path):
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", path).strip("_") or "root"
    return f"test_{method}_{cleaned}".lower()

def generate(spec, spec_source):
    servers = spec.get("servers") or []
    base = servers[0].get("url", "") if servers else ""
    if base.startswith("http://localhost") and spec_source.startswith("http"):
        p = urlparse(spec_source)
        base = f"{p.scheme}://{p.netloc}"
    lines = ["import requests, pytest", "", f"BASE_URL = {base!r}", ""]
    for path, item in spec.get("paths", {}).items():
        inherited = item.get("parameters", []) if isinstance(item, dict) else []
        for method, op in item.items():
            if method.lower() not in METHODS or not isinstance(op, dict):
                continue
            params = inherited + op.get("parameters", [])
            rendered = path
            query = {}
            for param in params:
                if "$ref" in param:
                    continue
                pname = param.get("name")
                where = param.get("in")
                if not pname:
                    continue
                val = value(param.get("schema"))
                if where == "path":
                    rendered = rendered.replace("{" + pname + "}", str(val))
                elif where == "query" and param.get("required"):
                    query[pname] = val
            codes = []
            for code in op.get("responses", {}):
                try:
                    codes.append(int(code))
                except (TypeError, ValueError):
                    pass
            codes = codes or [200]
            lines += [f"def {name_for(method, path)}():",
                      f"    r = requests.{method.lower()}(BASE_URL + {rendered!r}, params={query!r}, timeout=15)",
                      f"    assert r.status_code in {codes!r}", ""]
    return "\n".join(lines)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--spec", required=True)
    p.add_argument("--output", default="test_api.py")
    args = p.parse_args()
    spec = load_spec(args.spec)
    Path(args.output).write_text(generate(spec, args.spec))

if __name__ == "__main__":
    main()
