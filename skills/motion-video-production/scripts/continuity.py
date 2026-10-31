#!/usr/bin/env python3
"""Offline continuity handoff, contact sheets and evidence-bound human review."""
import argparse
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}\Z")
KINDS = ("keyframes", "boundaries")
MEDIA = {"start_keyframe", "end_keyframe", "clip"}


def confined(root, value):
    """Reject absolute/traversal/symlink paths, including symlinked output parents."""
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError("path must be a nonempty relative POSIX path")
    p = Path(value)
    if p.is_absolute() or any(x in ("..", ".") for x in value.split("/")):
        raise ValueError(f"unsafe path: {value}")
    root = Path(root).resolve()
    candidate = root
    for part in p.parts:
        candidate /= part
        if candidate.is_symlink():
            raise ValueError(f"symlink not allowed: {value}")
    try:
        candidate.resolve().relative_to(root)
    except ValueError:
        raise ValueError(f"path escapes project: {value}")
    return candidate


def number(value, label, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{label} must be finite")
    if value < 0 or (positive and value == 0):
        raise ValueError(f"{label} must be {'positive' if positive else 'nonnegative'}")
    return value


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_manifest(root):
    m = read_json(confined(root, "continuity.json"))
    if not isinstance(m, dict) or type(m.get("version")) is not int or m["version"] != 1:
        raise ValueError("continuity.json version must be 1")
    for field in ("character_lock", "reference_sheet"):
        confined(root, m.get(field))
    if not isinstance(m.get("style_lock"), str) or not m["style_lock"].strip():
        raise ValueError("style_lock must be nonempty text")
    if not isinstance(m.get("scenes"), list) or not 1 <= len(m["scenes"]) <= 200:
        raise ValueError("scenes must contain 1..200 scenes")
    seen, targets = set(), {m["character_lock"], m["reference_sheet"], "continuity.json", "edit.json"}
    for scene in m["scenes"]:
        if not isinstance(scene, dict):
            raise ValueError("each scene must be an object")
        sid = scene.get("id")
        if not isinstance(sid, str) or not SAFE_ID.fullmatch(sid) or sid in seen:
            raise ValueError(f"invalid or duplicate scene id: {sid}")
        seen.add(sid)
        number(scene.get("duration"), f"{sid}.duration", True)
        for field in ("action", "camera", "end_state", "screen_direction"):
            if not isinstance(scene.get(field), str) or not scene[field].strip():
                raise ValueError(f"{sid}.{field} must be nonempty text")
        if scene.get("transition_to_next") not in ("hard_cut", "match_cut", "continuous"):
            raise ValueError(f"{sid}.transition_to_next is invalid")
        expected = {"start_keyframe": f"key/{sid}.png", "end_keyframe": f"key-end/{sid}.png", "clip": f"clip/{sid}.mp4"}
        for field in MEDIA:
            if field == "end_keyframe" and field not in scene:
                continue
            value = scene.get(field)
            confined(root, value)
            if value != expected[field] or value in targets:
                raise ValueError(f"{sid}.{field} must be {expected[field]} and unique")
            targets.add(value)
    return m


def run(command):
    p = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if p.returncode:
        raise ValueError(f"{command[0]} failed: {p.stderr[-1500:]}")
    return p.stdout


def probe(path, video=False):
    if not path.is_file():
        raise ValueError(f"missing media: {path.name}")
    data = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                           "stream=width,height,codec_name,avg_frame_rate:format=duration", "-of", "json", str(path)]))
    streams = data.get("streams", [])
    if not streams or streams[0].get("width", 0) <= 0 or streams[0].get("height", 0) <= 0:
        raise ValueError(f"no readable video/image stream: {path.name}")
    if video:
        duration = float(data.get("format", {}).get("duration", "nan"))
        number(duration, "media duration", True)
        return duration
    if path.suffix.lower() == ".png" and streams[0].get("codec_name") != "png":
        raise ValueError(f"PNG destination requires PNG input: {path.name}")
    return data


def lock_text(root, m):
    with confined(root, m["character_lock"]).open(encoding="utf-8", newline="") as stream:
        text = stream.read()
    if not text.strip():
        raise ValueError("empty character lock")
    return text


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def exclusive_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")


def cut_frames(root, m):
    """Source timestamps for last USED output frame and next USED first frame."""
    e = read_json(confined(root, "edit.json"))
    if not isinstance(e, dict):
        raise ValueError("edit.json must be an object")
    fps = number(e.get("fps"), "edit fps", True)
    cuts = e.get("cuts")
    if not isinstance(cuts, list) or not cuts or len(cuts) > 2000:
        raise ValueError("edit cuts must contain 1..2000 cuts")
    scenes = {s["id"]: s for s in m["scenes"]}
    parsed, durations = [], {}
    for cut in cuts:
        if not isinstance(cut, dict):
            raise ValueError("cut must be an object")
        t = number(cut.get("t"), "cut t")
        d = number(cut.get("d"), "cut d", True)
        rate = number(cut.get("rate", 1), "cut rate", True)
        src = cut.get("src")
        match = re.fullmatch(r"clip:([A-Za-z0-9][A-Za-z0-9_-]{0,63})@([0-9]+(?:\.[0-9]+)?)", src or "") if isinstance(src, str) else None
        if not match or match[1] not in scenes:
            raise ValueError(f"cut src must map to a manifest scene id: {src}")
        sid, offset = match[1], float(match[2])
        number(offset, "source offset")
        clip = scenes[sid]["clip"]
        if clip not in durations:
            durations[clip] = probe(confined(root, clip), True)
        if offset + d * rate > durations[clip] + 0.0001:
            raise ValueError(f"cut exceeds clip duration: {sid}")
        # Sample one output frame before the cut, converted into source time.
        parsed.append({"id": sid, "path": clip, "t": t, "d": d, "start": offset,
                       "end": offset + max(0, d - 1 / fps) * rate})
    parsed.sort(key=lambda c: c["t"])
    if parsed[0]["t"] > 1 / fps or any(abs(a["t"] + a["d"] - b["t"]) > 1 / fps + 1e-8 for a, b in zip(parsed, parsed[1:])):
        raise ValueError("edit cuts contain a gap/overlap or do not start at zero")
    return parsed


def review_inputs(root, m, kind):
    """Return immutable input hashes and the exact pairs requiring human review."""
    lock_text(root, m)
    paths = {"continuity.json", m["character_lock"], m["reference_sheet"]}
    probe(confined(root, m["reference_sheet"]))
    pairs = []
    if kind == "keyframes":
        for scene in m["scenes"]:
            for field in ("start_keyframe", "end_keyframe"):
                if field in scene:
                    path = scene[field]
                    probe(confined(root, path))
                    paths.add(path)
                    pairs.append({"id": f"reference:{scene['id']}:{field}",
                                  "left": m["reference_sheet"], "left_time": 0,
                                  "right": path, "right_time": 0})
        for a, b in zip(m["scenes"], m["scenes"][1:]):
            pairs.append({"id": f"key:{a['id']}->{b['id']}", "transition": a["transition_to_next"],
                          "left": a.get("end_keyframe", a["start_keyframe"]), "left_time": 0,
                          "right": b["start_keyframe"], "right_time": 0})
    elif kind == "boundaries":
        cuts = cut_frames(root, m)
        paths.add("edit.json")
        for s in m["scenes"]:
            for field in MEDIA:
                if field in s:
                    probe(confined(root, s[field]), field == "clip")
                    paths.add(s[field])
        by_id = {s["id"]: s for s in m["scenes"]}
        for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
            pairs.append({"id": f"cut:{i + 1}:{a['id']}->{b['id']}",
                          "transition": by_id[a["id"]]["transition_to_next"],
                          "left": a["path"], "left_time": a["end"],
                          "right": b["path"], "right_time": b["start"]})
        # A one-cut edit still requires an identity and drift review.
        if len(cuts) == 1:
            a = cuts[0]
            pairs.append({"id": f"cut:1:{a['id']}:start->end", "left": a["path"],
                          "left_time": a["start"], "right": a["path"], "right_time": a["end"]})
    else:
        raise ValueError(f"unknown kind: {kind}")
    # Full inventory detects added/replaced reference, keyframe and clip inputs.
    for folder in (("sheet", "key", "key-end", "clip") if kind == "boundaries" else ("sheet", "key", "key-end")):
        base = confined(root, folder)
        if base.exists():
            for path in base.rglob("*"):
                rel = path.relative_to(Path(root).resolve()).as_posix()
                safe = confined(root, rel)
                if safe.is_file():
                    paths.add(rel)
    hashes = {p: digest(confined(root, p)) for p in sorted(paths)}
    return hashes, pairs


def sheet_evidence(root, folder, kind, hashes, pairs):
    base = confined(root, folder)
    index_path = confined(root, f"{folder}/index.json")
    index = read_json(index_path)
    if index != {"kind": kind, "inputs": hashes, "pairs": pairs}:
        raise ValueError(f"{kind}: stale or mismatched contact sheet; regenerate it")
    evidence = {f"{folder}/index.json": digest(index_path)}
    for i in range(1, len(pairs) + 1):
        rel = f"{folder}/pair-{i:03d}.png"
        path = confined(root, rel)
        probe(path)
        evidence[rel] = digest(path)
    return evidence


def review_template(root, kind, folder):
    m = load_manifest(root)
    hashes, pairs = review_inputs(root, m, kind)
    evidence = sheet_evidence(root, folder, kind, hashes, pairs)
    for pair in pairs:
        pair.update(verdict="PENDING", notes="")
    data = {"version": 1, "kind": kind, "status": "PENDING", "reviewer": "", "date": "",
            "inputs": hashes, "sheet": folder, "evidence": evidence, "pairs": pairs}
    exclusive_json(confined(root, f"qa/continuity-{kind}-review.json"), data)
    return data


def check_project(root):
    """Gate adapter: list of (PASS|BLOCK, stable check id, human-readable message)."""
    root = Path(root).resolve()
    if not (root / "continuity.json").exists() and not (root / "continuity.json").is_symlink():
        return [("PASS", "CT00", "continuity.json absent; optional continuity workflow skipped")]
    try:
        m = load_manifest(root)
        results = [("PASS", "CT01", "continuity manifest validated")]
        edit = root / "edit.json"
        kinds = KINDS if edit.exists() or edit.is_symlink() else ("keyframes",)
        for kind in kinds:
            hashes, pairs = review_inputs(root, m, kind)
            review = read_json(confined(root, f"qa/continuity-{kind}-review.json"))
            if not isinstance(review, dict) or (type(review.get("version")) is not int or review["version"] != 1) or review.get("kind") != kind:
                raise ValueError(f"{kind}: review schema mismatch")
            if review.get("evidence") != sheet_evidence(root, review.get("sheet"), kind, hashes, pairs):
                raise ValueError(f"{kind}: contact sheet evidence changed")
            if review.get("inputs") != hashes:
                raise ValueError(f"{kind}: stale review; inputs changed")
            name = review.get("reviewer")
            if review.get("status") != "REVIEWED" or not isinstance(name, str) or not name.strip() or name.strip().lower() in {"pending", "reviewer", "todo", "your name", "name"} or any(c in name for c in "<>\n"):
                raise ValueError(f"{kind}: human reviewer and REVIEWED status required")
            date = review.get("date")
            if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                raise ValueError(f"{kind}: review date must be YYYY-MM-DD")
            if datetime.date.fromisoformat(date) > datetime.date.today():
                raise ValueError(f"{kind}: review date cannot be in the future")
            recorded = review.get("pairs")
            if not isinstance(recorded, list) or len(recorded) != len(pairs):
                raise ValueError(f"{kind}: missing review pairs")
            for expected, actual in zip(pairs, recorded):
                if not isinstance(actual, dict) or any(actual.get(k) != v for k, v in expected.items()) or actual.get("verdict") != "ACCEPT":
                    raise ValueError(f"{kind}: pending/rejected/mismatched pair {expected['id']}")
            results.append(("PASS", "CT02" if kind == "keyframes" else "CT03", f"{kind}: human review current ({len(pairs)} pairs); no automated visual-quality claim"))
        return results
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        return [("BLOCK", "CT01", str(exc))]


def sheet(root, kind, out):
    m = load_manifest(root)
    hashes, pairs = review_inputs(root, m, kind)
    output = confined(root, out)
    if output.exists():
        raise ValueError(f"output already exists: {out}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".continuity-sheet-", dir=output.parent))
    try:
        for i, pair in enumerate(pairs, 1):
            frames = []
            for side in ("left", "right"):
                frame = stage / f"{side}.png"
                run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(pair[f"{side}_time"]),
                     "-i", str(confined(root, pair[side])), "-frames:v", "1", "-vf",
                     "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2", str(frame)])
                if not frame.is_file():
                    raise ValueError(f"frame extraction produced no frame: {pair['id']}")
                frames.append(frame)
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(frames[0]), "-i", str(frames[1]),
                 "-filter_complex", "hstack=inputs=2", "-frames:v", "1", str(stage / f"pair-{i:03d}.png")])
            for frame in frames:
                frame.unlink()
        exclusive_json(stage / "index.json", {"kind": kind, "inputs": hashes, "pairs": pairs})
        (stage / "README.md").write_text("# Continuity contact sheets\n\nEach pair shows left → right. Times are source seconds; inspect index.json.\n\n" +
            "\n".join(f"- pair-{i:03d}.png: {p['id']} ({p['left_time']:.6f}s → {p['right_time']:.6f}s)" for i, p in enumerate(pairs, 1)) + "\n", encoding="utf-8")
        if output.exists():
            raise ValueError(f"output already exists: {out}")
        stage.rename(output)
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def export_package(root, out):
    m = load_manifest(root)
    character = lock_text(root, m)
    probe(confined(root, m["reference_sheet"]))
    output = confined(root, out)
    if output.exists():
        raise ValueError(f"output already exists: {out}")
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".continuity-export-", dir=output.parent))
    try:
        assets = {m["character_lock"], m["reference_sheet"]}
        for s in m["scenes"]:
            for field in MEDIA:
                if field in s and confined(root, s[field]).is_file():
                    probe(confined(root, s[field]), field == "clip")
                    assets.add(s[field])
        for path in sorted(assets):
            dest = stage / "assets" / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(confined(root, path), dest)
        exclusive_json(stage / "manifest.json", m)
        exclusive_json(stage / "mapping-template.json", {"version": 1, "assets": [
            {"scene_id": s["id"], "kind": "start_keyframe", "source": f"downloads/{s['id']}.png"} for s in m["scenes"]]})
        exclusive_json(stage / "assets-sha256.json", {p: digest(confined(root, p)) for p in sorted(assets)})
        chunks = ["# Manual SceneSteller handoff\n\nThis is our package, not a documented SceneSteller native format or API.\nCopy prompts and upload selected local assets manually. Check the chosen provider supports end frames before using them.\n"]
        for s in m["scenes"]:
            chunks.append(f"\n## Scene {s['id']}\n\nCharacter lock (verbatim):\n\n" + character + "\n\nStyle lock (verbatim):\n\n" + m["style_lock"] + "\n\n" +
                          "\n".join(f"{key}: {s[key]}" for key in ("duration", "action", "camera", "end_state", "screen_direction", "transition_to_next")) + "\n" +
                          "\n".join(f"{key}: {s[key]}" for key in ("start_keyframe", "end_keyframe", "clip") if key in s) + "\n")
        (stage / "scene-prompts.md").write_text("\n".join(chunks), encoding="utf-8")
        if output.exists():
            raise ValueError(f"output already exists: {out}")
        stage.rename(output)
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def import_assets(root, mapping):
    m = load_manifest(root)
    data = read_json(confined(root, mapping))
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("assets"), list) or not data["assets"]:
        raise ValueError("mapping requires version 1 and nonempty assets")
    if len(data["assets"]) > len(m["scenes"]) * 3:
        raise ValueError("too many mapped assets")
    scenes = {s["id"]: s for s in m["scenes"]}
    stage = Path(tempfile.mkdtemp(prefix=".continuity-import-", dir=Path(root).resolve()))
    staged, targets, written = [], set(), []
    try:
        for i, item in enumerate(data["assets"]):
            if not isinstance(item, dict):
                raise ValueError("asset mapping must be an object")
            sid, kind = item.get("scene_id"), item.get("kind")
            if not isinstance(sid, str) or not isinstance(kind, str) or sid not in scenes or kind not in MEDIA or kind not in scenes[sid]:
                raise ValueError("unknown scene id or asset kind")
            source = confined(root, item.get("source"))
            target = confined(root, scenes[sid][kind])
            if target.exists() or target in targets:
                raise ValueError(f"destination already exists or repeated: {target.name}")
            targets.add(target)
            suffix = ".mp4" if kind == "clip" else ".png"
            if source.suffix.lower() != suffix:
                raise ValueError(f"{kind} source must use {suffix}")
            copy = stage / f"{i}{suffix}"
            shutil.copyfile(source, copy)
            probe(copy, kind == "clip")
            staged.append((copy, target))
        # Only fully probed assets enter the project; exclusive hard links never overwrite.
        for source, target in staged:
            confined(root, target.relative_to(Path(root).resolve()).as_posix())
            target.parent.mkdir(parents=True, exist_ok=True)
            os.link(source, target)
            written.append(target)
    except Exception:
        for path in written:
            path.unlink()
        raise
    finally:
        shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    for name in ("export", "import", "sheet", "review-template", "check"):
        sub = subs.add_parser(name)
        sub.add_argument("root", type=Path, help="existing project directory")
        if name in ("sheet", "review-template"):
            sub.add_argument("--kind", choices=KINDS, required=True)
        if name in ("sheet", "export"):
            sub.add_argument("--out", required=True, help="new project-relative output directory; no overwrite")
        if name == "review-template":
            sub.add_argument("--sheet", required=True, help="project-relative contact sheet folder from sheet command")
        if name == "import":
            sub.add_argument("--mapping", required=True, help="project-relative JSON; explicit scene_id/kind/source per asset")
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if not root.is_dir():
            raise ValueError("project root must be an existing directory")
        if args.command == "check":
            report = check_project(root)
            for level, cid, message in report:
                print(f"{level:5} {cid}  {message}")
            return int(any(item[0] == "BLOCK" for item in report))
        if args.command == "export":
            export_package(root, args.out)
        elif args.command == "import":
            import_assets(root, args.mapping)
        elif args.command == "sheet":
            sheet(root, args.kind, args.out)
        else:
            review_template(root, args.kind, args.sheet)
        print(f"Created: {args.command}; no external service accessed")
        return 0
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print(f"BLOCK: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
