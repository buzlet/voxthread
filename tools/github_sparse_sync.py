# tools/github_sparse_sync.py
import argparse, base64, hashlib, json
from pathlib import Path

STATE = ".github-sync-state.json"

def git_sha(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()

def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text("utf-8"))
    except FileNotFoundError:
        return {} if default is None else default

def safe(root, rel):
    root, p = root.resolve(), (root / rel).resolve()
    if p != root and root not in p.parents:
        raise SystemExit(f"unsafe path: {rel}")
    return p

def sha(path):
    try:
        return git_sha(path.read_bytes())
    except FileNotFoundError:
        return None

def wanted(doc):
    return {e["path"]: e["sha"] for e in doc.get("files", [])}

def plan(doc, root):
    return [{"path": p, "sha": s} for p, s in wanted(doc).items()
            if sha(safe(root, p)) != s]

def verify(doc, root):
    bad = plan(doc, root)
    if bad:
        for e in bad:
            print(f"MISMATCH {e['path']} expected={e['sha']} got={sha(safe(root, e['path']))}")
        return 1
    print(f"verified={len(wanted(doc))}")
    return 0

def apply(doc, root, delete=False):
    root.mkdir(parents=True, exist_ok=True)
    old = read_json(root / STATE, {"files": []})
    remote, blobs = wanted(doc), doc.get("blobs", {})
    changed = removed = 0
    for rel, expected in remote.items():
        path = safe(root, rel)
        if sha(path) == expected:
            continue
        encoded = blobs.get(expected)
        if encoded is None:
            raise SystemExit(f"missing blob {expected} for {rel}")
        data = base64.b64decode(encoded)
        if git_sha(data) != expected:
            raise SystemExit(f"SHA mismatch for downloaded blob {rel}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data); changed += 1
    if delete:
        for rel, previous in wanted(old).items():
            if rel not in remote:
                path = safe(root, rel)
                if path.is_file() and sha(path) == previous:
                    path.unlink(); removed += 1
    (root / STATE).write_text(json.dumps({"files": doc["files"]}, indent=2) + "\n", "utf-8")
    print(f"updated={changed} removed={removed} total={len(remote)}")

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    for cmd in ("plan", "verify"):
        p = sub.add_parser(cmd); p.add_argument("manifest"); p.add_argument("root")
    p = sub.add_parser("apply"); p.add_argument("bundle"); p.add_argument("root"); p.add_argument("--delete", action="store_true")
    ns = ap.parse_args(); root = Path(ns.root)
    doc = read_json(getattr(ns, "manifest", None) or ns.bundle)
    if ns.cmd == "plan":
        print(json.dumps({"need": plan(doc, root)}, indent=2)); return 0
    if ns.cmd == "verify":
        return verify(doc, root)
    apply(doc, root, ns.delete); return 0

if __name__ == "__main__":
    raise SystemExit(main())
