import argparse
import json
from collections import deque
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.request import Request, urlopen

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        for k, v in attrs:
            if k.lower() == "href" and v:
                self.links.append(v)

def normalize(url):
    url, _ = urldefrag(url)
    p = urlparse(url)
    path = p.path.rstrip("/")
    if not path:
        path = ""
    return p._replace(path=path, fragment="").geturl()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("seed_url")
    ap.add_argument("--max-pages", type=int, default=50)
    ap.add_argument("--timeout", type=float, default=5)
    args = ap.parse_args()

    seed = normalize(args.seed_url)
    origin = urlparse(seed)
    q = deque([seed])
    queued = {seed}
    site_map = {}

    while q and len(site_map) < max(0, args.max_pages):
        url = q.popleft()
        try:
            req = Request(url, headers={"User-Agent": "site-crawler/1.0"})
            with urlopen(req, timeout=args.timeout) as resp:
                body = resp.read().decode(resp.headers.get_content_charset() or "utf-8", errors="replace")
        except Exception:
            continue

        parser = LinkParser()
        try:
            parser.feed(body)
        except Exception:
            pass

        links = []
        seen = set()
        for href in parser.links:
            absolute = normalize(urljoin(url + ("/" if urlparse(url).path and not url.endswith("/") else ""), href))
            p = urlparse(absolute)
            if p.scheme == origin.scheme and p.hostname == origin.hostname and p.port == origin.port:
                if absolute not in seen:
                    seen.add(absolute)
                    links.append(absolute)
                if absolute not in queued and absolute not in site_map:
                    queued.add(absolute)
                    q.append(absolute)
        site_map[url] = links

    print(json.dumps({"seed": seed, "pages_visited": len(site_map), "site_map": site_map}))

if __name__ == "__main__":
    main()
