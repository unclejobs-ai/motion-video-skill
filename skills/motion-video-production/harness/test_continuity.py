#!/usr/bin/env python3
"""Deterministic continuity contract and safety tests; no network or generation."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "continuity.py"
spec = importlib.util.spec_from_file_location("continuity", SCRIPT)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class ContinuityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.m = {"version": 1, "character_lock": "character.txt", "reference_sheet": "sheet/ref.png",
                  "style_lock": "Exact style\nwith punctuation!", "scenes": []}
        for sid in ("01", "02"):
            self.m["scenes"].append({"id": sid, "start_keyframe": f"key/{sid}.png", "clip": f"clip/{sid}.mp4",
                                    "duration": 5, "action": "walk", "camera": "static", "end_state": "stopped",
                                    "screen_direction": "right", "transition_to_next": "match_cut"})
            self.put(f"key/{sid}.png", f"image-{sid}")
            self.put(f"clip/{sid}.mp4", f"video-{sid}")
        self.put("sheet/ref.png", "reference")
        self.put("character.txt", "  Exact character, colors.\n")
        self.save("continuity.json", self.m)
        self.mock_probe = patch.object(c, "probe", side_effect=self.probe).start()
        self.addCleanup(patch.stopall)
        self.addCleanup(self.tmp.cleanup)

    def probe(self, path, video=False):
        if not path.is_file():
            raise ValueError("missing media")
        return 20 if video else {}

    def put(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def save(self, rel, data):
        self.put(rel, json.dumps(data))

    def edit(self):
        self.save("edit.json", {"fps": 25, "cuts": [
            {"t": 2, "d": 1, "src": "clip:02@3.0", "rate": 0.5},
            {"t": 0, "d": 2, "src": "clip:01@1.0", "rate": 2}]})

    def review(self, kind, accept=False):
        folder = f"qa/{kind}-sheet"
        hashes, pairs = c.review_inputs(self.root, self.m, kind)
        self.save(f"{folder}/index.json", {"kind": kind, "inputs": hashes, "pairs": pairs})
        for i in range(len(pairs)):
            self.put(f"{folder}/pair-{i + 1:03d}.png", f"render-{i}")
        c.review_template(self.root, kind, folder)
        path = f"qa/continuity-{kind}-review.json"
        if accept:
            data = c.read_json(self.root / path)
            data.update(status="REVIEWED", reviewer="Human Tester", date="2026-01-01")
            for pair in data["pairs"]:
                pair["verdict"] = "ACCEPT"
            self.save(path, data)
        return path

    def passes(self):
        return all(level == "PASS" for level, _, _ in c.check_project(self.root))

    def test_absent_manifest_does_not_change_existing_flow(self):
        (self.root / "continuity.json").unlink()
        self.assertEqual(c.check_project(self.root)[0][:2], ("PASS", "CT00"))

    def test_schema_rejects_duplicates_nonfinite_and_unsafe_id(self):
        for field, value in (("id", "01"), ("id", "../oops"), ("duration", float("nan")), ("duration", True)):
            with self.subTest(field=field, value=value):
                m = json.loads(json.dumps(self.m))
                m["scenes"][1][field] = value
                self.save("continuity.json", m)
                with self.assertRaises(ValueError):
                    c.load_manifest(self.root)

    def test_schema_rejects_wrong_scene_mapping(self):
        self.m["scenes"][0]["start_keyframe"] = "key/02.png"
        self.save("continuity.json", self.m)
        with self.assertRaises(ValueError):
            c.load_manifest(self.root)

    def test_paths_reject_traversal_absolute_symlink_and_broken_symlink(self):
        (self.root / "escape").symlink_to(self.root.parent, target_is_directory=True)
        (self.root / "broken").symlink_to(self.root.parent / "missing")
        for path in ("../oops", "/tmp/oops", "a/../b", "escape/oops", "broken", ".", "a\\b"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                c.confined(self.root, path)

    def test_actual_used_boundaries_include_offset_rate_and_sort(self):
        self.edit()
        _, pairs = c.review_inputs(self.root, self.m, "boundaries")
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0]["left"], "clip/01.mp4")
        self.assertAlmostEqual(pairs[0]["left_time"], 4.92)
        self.assertEqual(pairs[0]["right_time"], 3)

    def test_bad_edits_fail(self):
        for change in ({"rate": 0}, {"rate": float("inf")}, {"src": "clip:missing@0"},
                       {"src": "clip:01@19.5"}, {"t": 5}, {"d": -1}):
            self.edit()
            edit = c.read_json(self.root / "edit.json")
            edit["cuts"][1].update(change)
            self.save("edit.json", edit)
            with self.subTest(change=change), self.assertRaises(ValueError):
                c.cut_frames(self.root, self.m)

    def test_single_cut_still_requires_start_end_review(self):
        self.save("edit.json", {"fps": 25, "cuts": [{"t": 0, "d": 1, "src": "clip:01@1"}]})
        _, pairs = c.review_inputs(self.root, self.m, "boundaries")
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0]["left_time"], 1)
        self.assertAlmostEqual(pairs[0]["right_time"], 1.96)

    def test_pending_only_then_human_review_and_hash_invalidation(self):
        path = self.review("keyframes")
        r = c.read_json(self.root / path)
        self.assertEqual(r["status"], "PENDING")
        self.assertTrue(all(p["verdict"] == "PENDING" for p in r["pairs"]))
        self.assertFalse(self.passes())
        r.update(status="REVIEWED", reviewer="Human Tester", date="2026-01-01")
        for p in r["pairs"]:
            p["verdict"] = "ACCEPT"
        self.save(path, r)
        self.assertTrue(self.passes())
        self.put("character.txt", "Changed identity")
        self.assertFalse(self.passes())

    def test_rejected_and_missing_pair_block(self):
        path = self.review("keyframes", True)
        r = c.read_json(self.root / path)
        r["pairs"][0]["verdict"] = "REJECT"
        self.save(path, r)
        self.assertFalse(self.passes())
        r["pairs"].pop()
        self.save(path, r)
        self.assertFalse(self.passes())

    def test_added_key_or_changed_sheet_invalidates_review(self):
        self.review("keyframes", True)
        self.assertTrue(self.passes())
        added = self.put("key/new.png", "new image")
        self.assertFalse(self.passes())
        added.unlink()
        self.assertTrue(self.passes())
        self.put("qa/keyframes-sheet/pair-001.png", "different render")
        self.assertFalse(self.passes())

    def test_clips_do_not_expire_keyframe_review_but_edit_requires_boundary_review(self):
        self.review("keyframes", True)
        self.put("clip/01.mp4", "new clip")
        self.put("clip/extra.mp4", "extra clip")
        self.assertTrue(self.passes())
        self.edit()
        self.assertFalse(self.passes())
        self.review("boundaries", True)
        self.assertTrue(self.passes())
        self.put("clip/extra.mp4", "changed clip")
        self.assertFalse(self.passes())

    def test_template_rejects_stale_sheet_and_never_overwrites(self):
        self.review("keyframes")
        with self.assertRaises(FileExistsError):
            c.review_template(self.root, "keyframes", "qa/keyframes-sheet")
        self.put("key/01.png", "changed")
        with self.assertRaises(ValueError):
            c.review_template(self.root, "keyframes", "qa/keyframes-sheet")

    def test_export_preserves_exact_locks_and_no_overwrite(self):
        c.export_package(self.root, "handoff/package")
        prompt = (self.root / "handoff/package/scene-prompts.md").read_text()
        self.assertEqual(prompt.count("  Exact character, colors.\n"), 2)
        self.assertEqual(prompt.count(self.m["style_lock"]), 2)
        self.assertTrue((self.root / "handoff/package/assets/sheet/ref.png").is_file())
        with self.assertRaises(ValueError):
            c.export_package(self.root, "handoff/package")

    def test_import_validates_all_before_mutation_and_refuses_overwrite(self):
        (self.root / "key/01.png").unlink()
        (self.root / "key/02.png").unlink()
        self.put("downloads/first.png", "valid")
        self.save("mapping.json", {"version": 1, "assets": [
            {"scene_id": "01", "kind": "start_keyframe", "source": "downloads/first.png"},
            {"scene_id": "02", "kind": "start_keyframe", "source": "downloads/missing.png"}]})
        with self.assertRaises(OSError):
            c.import_assets(self.root, "mapping.json")
        self.assertFalse((self.root / "key/01.png").exists())
        self.put("downloads/missing.png", "valid2")
        c.import_assets(self.root, "mapping.json")
        self.assertEqual((self.root / "key/01.png").read_text(), "valid")
        with self.assertRaises(ValueError):
            c.import_assets(self.root, "mapping.json")

    def test_import_failure_during_commit_rolls_back_created_files(self):
        for sid in ("01", "02"):
            (self.root / f"key/{sid}.png").unlink()
            self.put(f"downloads/{sid}.png", "valid")
        self.save("mapping.json", {"version": 1, "assets": [
            {"scene_id": sid, "kind": "start_keyframe", "source": f"downloads/{sid}.png"} for sid in ("01", "02")]})
        real_link = c.os.link
        calls = []
        def fail_second(src, dst):
            calls.append(dst)
            if len(calls) == 2:
                raise OSError("simulated commit failure")
            real_link(src, dst)
        with patch.object(c.os, "link", side_effect=fail_second), self.assertRaises(OSError):
            c.import_assets(self.root, "mapping.json")
        self.assertFalse((self.root / "key/01.png").exists())
        self.assertFalse((self.root / "key/02.png").exists())

    def test_sheet_ffmpeg_failure_does_not_publish_output(self):
        with patch.object(c, "run", side_effect=ValueError("ffmpeg failed")), self.assertRaises(ValueError):
            c.sheet(self.root, "keyframes", "qa/failed-sheet")
        self.assertFalse((self.root / "qa/failed-sheet").exists())
        self.assertFalse(list((self.root / "qa").glob(".continuity-sheet-*")))

    def test_broken_edit_symlink_blocks_instead_of_skipping(self):
        self.review("keyframes", True)
        (self.root / "edit.json").symlink_to(self.root.parent / "missing-edit")
        self.assertFalse(self.passes())

    def test_character_crlf_preserved_in_export(self):
        (self.root / "character.txt").write_bytes(b"Character line one.\r\nLine two.\r\n")
        c.export_package(self.root, "handoff/crlf")
        content = (self.root / "handoff/crlf/scene-prompts.md").read_bytes()
        self.assertEqual(content.count(b"Character line one.\r\nLine two.\r\n"), 2)

    def test_optional_endframe_is_compared_when_present(self):
        self.m["scenes"][0]["end_keyframe"] = "key-end/01.png"
        self.put("key-end/01.png", "end")
        hashes, pairs = c.review_inputs(self.root, self.m, "keyframes")
        self.assertIn("key-end/01.png", hashes)
        self.assertEqual(pairs[-1]["left"], "key-end/01.png")


if __name__ == "__main__":
    unittest.main()
