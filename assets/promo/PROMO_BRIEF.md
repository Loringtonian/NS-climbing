
**Camera spine (locked to the reference clip `IMG_3328.mov`):** one *continuous
wide-angle gimbal glide* that sweeps left-to-right across the gym to reveal its
scale, then in the **final stretch settles on the climbing board mounted on the
sponsor step-and-repeat photo-backdrop wall** — the branded logo wall as the
backdrop, a photo-op climax. No cuts; a single flowing move.

**Real location (from the reference):** the actual NS gym is a large white
marquee tent with an exposed silver steel-truss A-frame ceiling, hanging dome
pendant lights, white fabric walls, dark rubber tile flooring with green turf
strips, a "Network School" banner and a sponsor step-and-repeat wall.

### Main prompt (copy-paste)

> Continuous wide-angle gimbal glide through a real gym inside a large white
> marquee tent at Network School, Forest City. Exposed silver steel-truss A-frame
> ceiling with hanging dome pendant lights, white fabric walls, dark rubber tile
> flooring with green turf strips. The camera flows forward at walking pace,
> sweeping smoothly left-to-right across the space to reveal its scale, slight
> fisheye wide-angle, then in the final stretch pushes in and settles on the hero:
> a large adjustable black Lemur/Kilter climbing board covered in glowing
> multicolor LED holds, mounted directly onto the white sponsor step-and-repeat
> photo-backdrop wall — repeating "ns.com" and "burn" logos filling the wall, a
> red presentation mat on the floor in front, like a branded photo-op moment. An
> athletic climber explodes through a dynamic move on the steep board against that
> backdrop — chalk dust bursting — as the camera arcs around them and speed-ramps
> on the latch, holding the final frame on the board and the logo wall. Bright
> even daylight through the tent fabric, energetic and kinetic, crisp real-world
> texture, handheld gimbal flow, documentary-real, hyper-detailed, 9:16 vertical.

### Negative prompt

> blurry, warped hands, distorted anatomy, extra limbs, text artifacts, watermark,
> flickering, low resolution, cartoonish, oversaturated, morphing structure,
> wobbling trusses, melting equipment

### Settings
- Aspect **9:16**, duration **~5s**, **high motion** / dynamic camera.
- **Image-to-video start frame** — two options:
  - *Best for the backdrop climax:* use `start_frame_backdrop.jpg`
    (a frame pulled straight from `IMG_3328.mov` showing the white step-and-repeat
    ns.com/burn logo wall + red mat) as the start frame, and let the prompt build
    the board onto that wall.
  - *Clean board reveal:* use `phone_scene_b1.png` as the first frame and
    lean on the tent + logo-wall details in the prompt.
- Generate **3–4 seeds**, keep the cleanest sweep.

### Alternate shots
- **Reveal push:** "Slow-mo hands chalking up, then a fast crash-zoom out revealing
  the whole tent gym."
- **Speed-line orbit:** "Continuous 180° orbit around a climber mid-send, pendant
  lights streaking, ending framed on the glowing Lemur board."

---

## 3. Voiceover script + subtitles

Warm, community "invite to contribute" narration. Files:

| `voiceover.srt` | Subtitles, timed to the narration above. |

### Script (7 lines)
1. Have you ever imagined a climbing wall just seconds away,
2. instead of an hour?
3. It's possible — if we join forces.
4. Right here at Network School. Steps from where we live and work.
5. Put twenty dollars behind it. A deposit, not a donation — pull it back anytime.
6. Enough of us, and it happens.
7. Add your contribution. Scan the code.

### Suggested timeline (~27s reel)
- **0–6s** — real gym B-roll (your `IMG_3328.mov` sweep) under lines 1–2.
- **6–14s** — AI hero clip: glide + board reveal on the logo wall, lines 3–4.
- **14–24s** — climber sending on the board, lines 5–6.
- **24–27s** — hold on the **end-card** (`endcard_9x16.png`), line 7.

### Burn subtitles into the final cut (ffmpeg)
```
ffmpeg -i final_video.mp4 -vf "subtitles=voiceover.srt:force_style='Fontname=Poppins,Fontsize=16,PrimaryColour=&H00FFFFFF,BorderStyle=1,Outline=1,Shadow=0'" -c:a copy final_subtitled.mp4
```
Add the voiceover track:
```
ffmpeg -i final_video.mp4 -i voiceover.mp3 -c:v copy -map 0:v -map 1:a -shortest final_with_vo.mp4
```

> Note: `voiceover.mp3` is a placeholder voice to lock timing and subtitles. For
> the published version, record the same script in ElevenLabs or with a member —
> the `.srt` still matches as long as pacing is close.

---

## 4. End-card (video outro)

`assets/promo/endcard_9x16.png` — 1080×1920, matches the flyer brand and carries
the headline, CTA and the same QR.

How to use: after generating the clip, **append the end-card for the last ~1.5s**
(or overlay it on the final beat) in any editor — CapCut, Premiere, etc. The AI
video won't render crisp text/QR, so keep the CTA in this static card instead.

Quick ffmpeg append (video first, then a 1.5s freeze of the card):
```
ffmpeg -loop 1 -t 1.5 -i endcard_9x16.png -vf "scale=1080:1920,fps=30" endcard.mp4
# then concatenate your generated clip + endcard.mp4
```
