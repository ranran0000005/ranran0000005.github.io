#!/usr/bin/env python3
"""
Split a WebVTT file into segment-length VTT files and save them to disk.

Usage:
    python split_vtt_segments.py --input Treasures_of_the_Snow/Treasures_of_the_Snow.vtt \
        --output-dir Treasures_of_the_Snow --prefix Treasures_of_the_Snow --segment 1620

The script detects cues, assigns them to segments by start time, shifts cue times
to be relative to the segment start, and writes files named <prefix>0.vtt, <prefix>1.vtt, ...
"""
import argparse
import os
import re
import math


TIME_RE = re.compile(r"(\d{2}:\d{2}:\d{2}[\.,]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{1,3})")


def parse_time(t):
    t = t.replace(',', '.')
    parts = t.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    if len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(parts[0])


def fmt_time(seconds):
    # format to HH:MM:SS.mmm
    if seconds < 0:
        seconds = 0
    ms = int(round((seconds - int(seconds)) * 1000))
    total = int(seconds)
    s = total % 60
    total //= 60
    m = total % 60
    h = total // 60
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def parse_vtt(text):
    # return list of cues: {id, start, end, text}
    lines = text.replace('\r\n', '\n').split('\n')
    i = 0
    # skip header if present
    if i < len(lines) and lines[i].strip().upper().startswith('WEBVTT'):
        i += 1
    cues = []
    while i < len(lines):
        # skip blanks
        if not lines[i].strip():
            i += 1
            continue
        # possible id
        cue_id = None
        if i + 1 < len(lines) and TIME_RE.search(lines[i+1]):
            cue_id = lines[i].strip()
            i += 1
        # time line
        if i < len(lines) and TIME_RE.search(lines[i]):
            m = TIME_RE.search(lines[i])
            start_s = parse_time(m.group(1))
            end_s = parse_time(m.group(2))
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip():
                text_lines.append(lines[i])
                i += 1
            cues.append({'id': cue_id, 'start': start_s, 'end': end_s, 'text': '\n'.join(text_lines)})
        else:
            # unrecognized block, skip
            i += 1
    return cues


def split_and_write(cues, segment_len, out_dir, prefix, keep_empty=False, max_segments=None):
    if not cues:
        return []
    last_end = max(c['end'] for c in cues)
    nseg = int(math.ceil(last_end / segment_len))
    if max_segments is not None:
        nseg = min(nseg, max_segments)
    written = []
    for si in range(nseg):
        seg_start = si * segment_len
        seg_end = seg_start + segment_len
        seg_cues = [c for c in cues if c['start'] < seg_end and c['end'] > seg_start]
        # keep cues that overlap the segment; shift times
        out_lines = ['WEBVTT', '']
        for idx, c in enumerate(seg_cues, start=1):
            new_start = max(0, c['start'] - seg_start)
            new_end = max(0, c['end'] - seg_start)
            out_lines.append(str(idx))
            out_lines.append(f"{fmt_time(new_start)} --> {fmt_time(new_end)}")
            if c['text']:
                out_lines.append(c['text'])
            out_lines.append('')
        if seg_cues or keep_empty:
            fname = os.path.join(out_dir, f"{prefix}{si}.vtt")
            with open(fname, 'w', encoding='utf-8') as f:
                f.write('\n'.join(out_lines).rstrip() + '\n')
            written.append(fname)
    return written


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', '-i', required=True, help='Input .vtt file path')
    p.add_argument('--output-dir', '-o', required=True, help='Directory to write split vtt files')
    p.add_argument('--prefix', '-p', required=True, help='Output filename prefix, e.g. Treasures_of_the_Snow')
    p.add_argument('--segment', '-s', type=int, default=1620, help='Segment length in seconds (default 1620 = 27min)')
    p.add_argument('--max-segments', type=int, default=None, help='Optional limit to number of segments to write')
    args = p.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    with open(args.input, 'r', encoding='utf-8') as f:
        text = f.read()
    cues = parse_vtt(text)
    written = split_and_write(cues, args.segment, args.output_dir, args.prefix, keep_empty=False, max_segments=args.max_segments)
    if written:
        print('Wrote', len(written), 'files:')
        for w in written:
            print(' -', w)
    else:
        print('No cues found or nothing written.')


if __name__ == '__main__':
    main()
