# tools/sandboxctl.py
import argparse, hashlib, json, os, shutil, subprocess, tarfile, tempfile, zipfile
from pathlib import Path

META = ".sandbox"
IGNORE = {META, "node_modules", "dist", "coverage", "playwright-report", "test-results"}

def git_sha(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()

def digest(data): return hashlib.sha256(data).hexdigest()
def load(p): return json.loads(Path(p).read_text("utf-8"))
def save(p, obj): Path(p).write_text(json.dumps(obj, indent=2) + "\n", "utf-8")
def state(root): return load(Path(root) / META / "state.json")

def safe_extract(tf, dst):
    dst = Path(dst).resolve()
    for m in tf.getmembers():
        p = (dst / m.name).resolve()
        if p != dst and dst not in p.parents: raise SystemExit(f"unsafe archive path: {m.name}")
    tf.extractall(dst, filter="data")

def changes(root, st=None):
    root, st = Path(root), st or state(root)
    base = {x["path"]: x for x in st["files"]}
    out = []
    for rel, entry in base.items():
        p = root / rel
        got = git_sha(p.read_bytes()) if p.is_file() else None
        if got != entry["sha"]: out.append({"path": rel, "kind": "modified" if got else "deleted", "sha": got, "mode": entry["mode"]})
    for p in root.rglob("*"):
        if not p.is_file() or any(x in IGNORE for x in p.relative_to(root).parts): continue
        rel = p.relative_to(root).as_posix()
        if rel not in base:
            mode = "100755" if p.stat().st_mode & 0o111 else "100644"
            out.append({"path": rel, "kind": "added", "sha": git_sha(p.read_bytes()), "mode": mode})
    return sorted(out, key=lambda x: x["path"])

def require(root, phase="active"):
    st = state(root)
    if st.get("phase") != phase: raise SystemExit(f"session phase={st.get('phase')}; required={phase}")
    return st

def pull(bundle, root):
    bundle, root = Path(bundle), Path(root)
    if root.exists() and (root / META / "state.json").exists():
        old = state(root)
        if old.get("phase") == "active" and changes(root, old): raise SystemExit("REFUSE: workspace has uncommitted changes")
    with zipfile.ZipFile(bundle) as z:
        manifest = json.loads(z.read("manifest.json"))
        src, cache = z.read("source.tgz"), z.read("npm-cache.tgz")
        if digest(src) != manifest["source_sha256"] or digest(cache) != manifest["npm_cache_sha256"]:
            raise SystemExit("bundle digest mismatch")
        tmp = Path(tempfile.mkdtemp(prefix="voxthread-pull-"))
        try:
            with tarfile.open(fileobj=__import__('io').BytesIO(src), mode="r:gz") as tf: safe_extract(tf, tmp)
            if root.exists(): shutil.rmtree(root)
            shutil.move(str(tmp), str(root)); tmp = None
            meta = root / META; meta.mkdir()
            cache_home = meta / "cache-home"; cache_home.mkdir()
            with tarfile.open(fileobj=__import__('io').BytesIO(cache), mode="r:gz") as tf: safe_extract(tf, cache_home)
            manifest.update({"phase":"active", "files":manifest["files"]})
            save(meta / "state.json", manifest)
        finally:
            if tmp and tmp.exists(): shutil.rmtree(tmp)
    print(f"READY commit={manifest['commit']} branch={manifest['branch']} files={len(manifest['files'])}")

def status(root):
    st = state(root); ch = changes(root, st)
    print(f"phase={st['phase']} base={st['commit']} changes={len(ch)}")
    for x in ch: print(f"{x['kind'].upper():8} {x['path']}")
    return ch

def run_tests(root):
    st = require(root); root = Path(root)
    env = os.environ.copy(); env["npm_config_cache"] = str(root / META / "cache-home" / ".npm")
    cmds = [["npm","ci","--offline","--no-audit"],["npm","test"],["npm","run","build:dev"],
            ["npm","run","build:userscript"],["npm","run","verify:userscript"]]
    for cmd in cmds: subprocess.run(cmd, cwd=root, env=env, check=True)
    print("TESTS OK")

def prepare(root):
    st = require(root); ch = changes(root, st)
    if not ch: raise SystemExit("nothing to push")
    run_tests(root)
    save(Path(root)/META/"push.json", {"branch":st["branch"],"base_sha":st["commit"],"base_tree":st["tree"],"changes":ch})
    st["phase"]="push-ready"; save(Path(root)/META/"state.json", st)
    print(f"PUSH-READY base={st['commit']} changes={len(ch)}")

def phase(root, new):
    st = state(root); st["phase"] = new; save(Path(root)/META/"state.json", st); print(f"phase={new}")

def main():
    ap=argparse.ArgumentParser(); s=ap.add_subparsers(dest="cmd",required=True)
    p=s.add_parser("pull"); p.add_argument("bundle"); p.add_argument("root")
    for n in ("status","test","prepare-push","abort-push"): s.add_parser(n).add_argument("root")
    p=s.add_parser("mark-pushed"); p.add_argument("root"); p.add_argument("sha")
    a=ap.parse_args()
    if a.cmd=="pull": pull(a.bundle,a.root)
    elif a.cmd=="status": status(a.root)
    elif a.cmd=="test": run_tests(a.root)
    elif a.cmd=="prepare-push": prepare(a.root)
    elif a.cmd=="abort-push": phase(a.root,"active")
    else:
        st=require(a.root,"push-ready"); st["phase"]="stale"; st["pushed_sha"]=a.sha; save(Path(a.root)/META/"state.json",st); print(f"STALE pushed={a.sha}")
if __name__=="__main__": main()
