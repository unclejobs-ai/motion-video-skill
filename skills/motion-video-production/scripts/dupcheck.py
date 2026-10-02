#!/usr/bin/env python3
"""반복 장면 게이트: 편집표의 각 컷이 어떤 키프레임을 보여 주는지 매핑하고,
2개 이상의 컷이 같은 키프레임을 쓰면 '반복'으로 보고한다.

사용법:  python3 dupcheck.py edit.json [shotlist.json]

edit.json 형식:
  {"cuts": [{"t": 0.0, "d": 3.5, "src": "clip:01@0.5", "rate": 1.0}, ...]}
  - src = "clip:<클립ID>@<시작초>"  (클립ID의 숫자 부분 = 키프레임 번호로 간주, 접미사 'vN'은 무시)
  - rate(선택) = 재생 속도 배율
shotlist.json(선택): 한 클립이 여러 키프레임을 거치는 경우의 앵커 목록
  {"sequences": [{"name": "seqA", "first_frame": "01", "keyframes": [{"t": 3.0, "id": "02"}], "last_frame": "03"}]}
  이 경우 src 의 클립ID 가 sequences[].name 과 같으면, 사용 구간을 0.25초 간격으로 샘플링해
  1.0초 이내에서 가장 가까운 앵커의 키프레임을 '보여 준 것'으로 센다.
직전 컷의 소스를 끊김 없이 이어 쓰는 컷은 반복으로 세지 않는다.
종료 코드: 반복 그룹이 0개면 0, 있으면 1.
"""
import collections
import json
import sys


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    edit = json.load(open(sys.argv[1], encoding="utf-8"))
    seqs = {}
    if len(sys.argv) > 2:
        seqs = {s["name"]: s for s in json.load(open(sys.argv[2], encoding="utf-8"))["sequences"]}

    use = collections.defaultdict(list)
    prev = None
    for c in edit["cuts"]:
        ref = c["src"].split(":", 1)[1]
        cid, off = ref.split("@")
        off = float(off)
        rate = c.get("rate", 1)
        span = c["d"] * rate
        if cid in seqs:
            s = seqs[cid]
            anchors = [(0, s["first_frame"])] + [(k["t"], k["id"]) for k in s.get("keyframes", [])]
            anchors.append((s.get("length", 15), s["last_frame"]))
            kfs = set()
            for i in range(int(span / 0.25) + 1):
                t = off + min(span, i * 0.25)
                a = min(anchors, key=lambda a: abs(a[0] - t))
                if abs(a[0] - t) <= 1.0:
                    kfs.add(a[1])
        else:
            kfs = {cid.split("v")[0]}
        cont = prev is not None and prev[0] == cid and abs(prev[1] - off) < 1e-6
        prev = (cid, off + span)
        for k in kfs:
            if not (cont and use[k]):
                use[k].append(str(c["t"]))

    bad = {k: v for k, v in use.items() if len(v) > 1}
    for k, v in sorted(bad.items()):
        print("REPEAT keyframe", k, "at t =", v)
    print("repeat groups:", len(bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
