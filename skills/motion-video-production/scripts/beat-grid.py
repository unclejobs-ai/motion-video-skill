#!/usr/bin/env python3
"""박자 격자 계산기: BPM 기준으로 장면 길이를 '박' 단위로 맞춘다.

사용법:
  python3 beat-grid.py grid <BPM> <초>            # 1박 길이, 그 길이 안의 박 수, 4박(1마디) 길이
  python3 beat-grid.py snap <BPM> <초> [<초> ...]  # 각 초 값을 가장 가까운 박 위치로 맞춘 값과 오차
예) python3 beat-grid.py snap 144 1.7 2.5 26.0
"""
import sys


def main():
    if len(sys.argv) < 4 or sys.argv[1] not in ("grid", "snap"):
        print(__doc__)
        return 2
    cmd, bpm = sys.argv[1], float(sys.argv[2])
    beat = 60.0 / bpm
    if cmd == "grid":
        total = float(sys.argv[3])
        print(f"BPM {bpm:g}: 1박 = {beat:.4f}초, 1마디(4박) = {beat*4:.4f}초, {total:g}초 = {total/beat:.2f}박")
    else:
        for s in sys.argv[3:]:
            t = float(s)
            n = round(t / beat)
            print(f"{t:g}초 -> {n}박째 = {n*beat:.3f}초 (오차 {abs(n*beat-t):.3f}초)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
