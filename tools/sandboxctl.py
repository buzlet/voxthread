# tools/sandboxctl.py
import argparse, hashlib, json, os, shutil, subprocess, tarfile, tempfile, uuid, zipfile
from datetime import datetime, timezone
from pathlib import Path

META = ".sandbox"
IGNORE = {META, "node_modules", "dist", "coverage", "playwright-report", "test-results"}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def git_sha(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def digest(data): return hashlib.sha256(data).hexdigest()
def load(p): return json.loads(Path(p).read_text("utf-8"))
def save(p, obj): Path(p).write_text(json.dumps(obj, indent=2) + "\n", "utf-8")
def state(root): return load(Path(root) / META / "state.json")


def ensure_metadata(root, st):
    changed = False
    stamp = now()
    defaults = {
        "transaction_id": lambda: str(uuid.uuid4()),
        "created_at": lambda: stamp,
        "updated_at": lambda: stamp,
        "pending_commit_sha": lambda: None,
        "pending_tree_sha": lambda: None,
        "pushed_sha": lambda: None,
    }
    for key, factory in defaults.items():
        if key not in st:
            st[key] = factory(); changed = True
    if changed:
        save_state(root, st)
    return st


def save_state(root, st):
    st["updated_at"] = now()
    save(Path(root) / META / "state.json", st)


def safe_extract(tf, dst):
    dst = Path(dst).resolve()
    for m in tf.getmembers():
        p = (dst / m.name).resolve()
        if p != dst and dst not in p.parents:
            raise SystemExit(f"unsafe archive path: {m.name}")
    tf.extractall(dst, filter="data")


def changes(root, st=None):
    root, st = Path(root), st or state(root)
    base = {x["path"]: x for x in st["files"]}
    out = []
    for rel, entry in base.items():
        p = root / rel
        got = git_sha(p.read_bytes()) if p.is_file() else None
        if got != entry["sha"]:
            out.append({"path": rel, "kind": "modified" if got else "deleted", "sha": got, "mode": entry["mode"]})
    for p in root.rglob("*"):
        if not p.is_file() or any(x in IGNORE for x in p.relative_to(root).parts):
            continue
        rel = p.relative_to(root).as_posix()
        if rel not in base:
            mode = "100755" if p.stat().st_mode & 0o111 else "100644"
            out.append({"path": rel, "kind": "added", "sha": git_sha(p.read_bytes()), "mode": mode})
    return sorted(out, key=lambda x: x["path"])


def require(root, phase="active"):
    st = ensure_metadata(root, state(root))
    if st.get("phase") != phase:
        raise SystemExit(f"session phase={st.get('phase')}; required={phase}")
    return st


def pull(bundle, root):
    bundle, root = Path(bundle), Path(root)
    if root.exists() and (root / META / "state.json").exists():
        old = state(root)
        if old.get("phase") in {"active", "push-ready", "commit-created"} and changes(root, old):
            raise SystemExit("REFUSE: workspace has uncommitted changes")
    with zipfile.ZipFile(bundle) as z:
        manifest = json.loads(z.read("manifest.json"))
        src, cache = z.read("source.tgz"), z.read("npm-cache.tgz")
        if digest(src) != manifest["source_sha256"] or digest(cache) != manifest["npm_cache_sha256"]:
            raise SystemExit("bundle digest mismatch")
        tmp = Path(tempfile.mkdtemp(prefix="voxthread-pull-"))
        try:
            with tarfile.open(fileobj=__import__("io").BytesIO(src), mode="r:gz") as tf:
                safe_extract(tf, tmp)
            if root.exists():
                shutil.rmtree(root)
            shutil.move(str(tmp), str(root)); tmp = None
            meta = root / META; meta.mkdir()
            cache_home = meta / "cache-home"; cache_home.mkdir()
            with tarfile.open(fileobj=__import__("io").BytesIO(cache), mode="r:gz") as tf:
                safe_extract(tf, cache_home)
            stamp = now()
            manifest.update({
                "phase": "active",
                "transaction_id": str(uuid.uuid4()),
                "created_at": stamp,
                "updated_at": stamp,
                "pending_commit_sha": None,
                "pending_tree_sha": None,
                "pushed_sha": None,
                "files": manifest["files"],
            })
            save(meta / "state.json", manifest)
        finally:
            if tmp and tmp.exists():
                shutil.rmtree(tmp)
    print(f"READY tx={manifest['transaction_id']} commit={manifest['commit']} branch={manifest['branch']} files={len(manifest['files'])}")


def status(root):
    st = ensure_metadata(root, state(root)); ch = changes(root, st)
    pending = st.get("pending_commit_sha") or "-"
    print(f"tx={st.get('transaction_id','-')} phase={st['phase']} branch={st['branch']} base={st['commit']} pending={pending} changes={len(ch)}")
    for x in ch:
        print(f"{x['kind'].upper():8} {x['path']}")
    return ch


def run_tests(root):
    require(root); root = Path(root)
    env = os.environ.copy(); env["npm_config_cache"] = str(root / META / "cache-home" / ".npm")
    cmds = [
        ["npm", "ci", "--offline", "--no-audit"],
        ["npm", "test"],
        ["npm", "run", "build:dev"],
        ["npm", "run", "build:userscript"],
        ["npm", "run", "verify:userscript"],
    ]
    for cmd in cmds:
        subprocess.run(cmd, cwd=root, env=env, check=True)
    print("TESTS OK")


def prepare(root):
    st = require(root); ch = changes(root, st)
    if not ch:
        raise SystemExit("nothing to push")
    run_tests(root)
    doc = {
        "transaction_id": st["transaction_id"],
        "branch": st["branch"],
        "base_sha": st["commit"],
        "base_tree": st["tree"],
        "changes": ch,
        "prepared_at": now(),
        "pending_commit_sha": None,
        "pending_tree_sha": None,
    }
    save(Path(root) / META / "push.json", doc)
    st["phase"] = "push-ready"
    st["pending_commit_sha"] = None
    st["pending_tree_sha"] = None
    save_state(root, st)
    print(f"PUSH-READY tx={st['transaction_id']} base={st['commit']} changes={len(ch)}")


def abort_push(root):
    st = require(root, "push-ready")
    st["phase"] = "active"
    save_state(root, st)
    p = Path(root) / META / "push.json"
    if p.exists():
        p.unlink()
    print("phase=active")


def record_commit(root, commit_sha, tree_sha):
    st = require(root, "push-ready")
    push_path = Path(root) / META / "push.json"
    doc = load(push_path)
    if doc.get("base_sha") != st["commit"] or doc.get("transaction_id") != st["transaction_id"]:
        raise SystemExit("push manifest does not match transaction")
    doc["pending_commit_sha"] = commit_sha
    doc["pending_tree_sha"] = tree_sha
    doc["commit_created_at"] = now()
    save(push_path, doc)
    st["pending_commit_sha"] = commit_sha
    st["pending_tree_sha"] = tree_sha
    st["phase"] = "commit-created"
    save_state(root, st)
    print(f"COMMIT-CREATED sha={commit_sha} tree={tree_sha}")


def mark_pushed(root, sha):
    st = require(root, "commit-created")
    pending = st.get("pending_commit_sha")
    if not pending or sha != pending:
        raise SystemExit(f"refuse mark-pushed: expected pending commit {pending}, got {sha}")
    st["phase"] = "stale"
    st["pushed_sha"] = sha
    st["pushed_at"] = now()
    save_state(root, st)
    print(f"STALE pushed={sha}")


def recover(root, remote_head):
    root = Path(root)
    p = root / META / "state.json"
    if not p.exists():
        print("RECOVERY NO-STATE: discard/recreate workspace and START from the current exact-HEAD bundle")
        return 2
    st = ensure_metadata(root, load(p))
    phase = st.get("phase")
    base = st.get("commit")
    pending = st.get("pending_commit_sha")
    tx = st.get("transaction_id", "-")
    print(f"RECOVERY tx={tx} phase={phase} base={base} pending={pending or '-'} remote={remote_head}")
    if phase == "stale":
        print("ACTION START-NEW: this workspace is closed and must not be reused")
        return 0
    if phase == "active":
        if remote_head == base:
            print("ACTION RESUME-ACTIVE: local transaction may continue; inspect sandboxctl status first")
            return 0
        print("ACTION RESTART: remote branch moved; do not push from this workspace")
        return 3
    if phase == "push-ready":
        if remote_head == base:
            print("ACTION RESUME-PUSH: remote is still at base; recreate/continue the GitHub commit, then record-commit")
            return 0
        print("ACTION RESTART: remote moved after prepare-push; do not publish this prepared transaction")
        return 3
    if phase == "commit-created":
        if not pending:
            print("ACTION STOP: commit-created state has no pending_commit_sha; repair transaction metadata")
            return 4
        if remote_head == pending:
            print(f"ACTION CLOSE: commit is already published; run mark-pushed {root} {pending}")
            return 0
        if remote_head == base:
            print(f"ACTION PUBLISH-PENDING: commit exists but branch was not advanced; re-check HEAD then update_ref(force=false) to {pending}")
            return 0
        print("ACTION CONFLICT: remote is neither base nor pending commit; do not push, restart/port changes")
        return 3
    print(f"ACTION STOP: unknown phase {phase}")
    return 4


def main():
    ap = argparse.ArgumentParser(); s = ap.add_subparsers(dest="cmd", required=True)
    p = s.add_parser("pull"); p.add_argument("bundle"); p.add_argument("root")
    for n in ("status", "test", "prepare-push", "abort-push"):
        s.add_parser(n).add_argument("root")
    p = s.add_parser("record-commit"); p.add_argument("root"); p.add_argument("commit_sha"); p.add_argument("tree_sha")
    p = s.add_parser("mark-pushed"); p.add_argument("root"); p.add_argument("sha")
    p = s.add_parser("recover"); p.add_argument("root"); p.add_argument("remote_head")
    a = ap.parse_args()
    if a.cmd == "pull": pull(a.bundle, a.root)
    elif a.cmd == "status": status(a.root)
    elif a.cmd == "test": run_tests(a.root)
    elif a.cmd == "prepare-push": prepare(a.root)
    elif a.cmd == "abort-push": abort_push(a.root)
    elif a.cmd == "record-commit": record_commit(a.root, a.commit_sha, a.tree_sha)
    elif a.cmd == "mark-pushed": mark_pushed(a.root, a.sha)
    else: raise SystemExit(recover(a.root, a.remote_head))


if __name__ == "__main__":
    main()
