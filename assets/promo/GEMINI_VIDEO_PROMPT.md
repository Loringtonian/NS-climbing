# Gemini video — climbing-wall final scene, joined to the original clip

Goal: generate a short clip that ENDS on the composite scene (LEMUR/Kilter board
installed in the NS tent gym, two climbers on it, friends watching), then append
it to the original walkthrough `IMG_3328.mov` — keeping the original intact.

---

## A. Image-to-video (recommended — animate the final scene)

Feed the **composite image as the first frame** and generate motion so it plays as
the closing beat.

**Prompt:**

> Photorealistic handheld shot inside a white marquee-tent gym with an exposed
> steel-truss ceiling, hanging dome pendant lights and dark rubber flooring. A
> large black "LEMUR" adjustable Kilter climbing board with a slight overhang
> stands against the wall, its dense grid of grey and white holds lit with colored
> route lines in blue, yellow, magenta, purple and green; "TRAIN HARD / CLIMB
> HIGHER" and the KILTER logo visible. Two athletes are mid-climb — a woman on the
> left in black activewear reaching for the next hold, a man on the right pulling
> up — while a small group of five friends in athletic wear stand on the mat
> watching, one nodding, one pointing, natural chatter. Gentle life: climbers move
> upward, chalk dust drifts, onlookers shift and react. Camera slowly pushes in
> and tilts up the board to reveal its full height, then holds. Warm community
> energy, soft overcast daylight through the tent, crisp real textures, cinematic
> shallow depth of field, 9:16 vertical.

**Negative prompt:** `morphing bodies, extra limbs, warped hands, distorted faces,
melting holds, wobbling trusses, duplicated climbers, floating people, plastic
look, watermark, text artifacts, jitter`

---

## B. Frames-to-video (seamless morph from the original)

If Gemini supports first + last frame, use:
- **First frame:** `assets/promo/original_lastframe.jpg` (last frame of `IMG_3328.mov`)
- **Last frame:** the composite climbing-wall image

**Prompt:** "Continue the smooth gimbal walkthrough of the tent gym; the camera
glides forward and the empty branded backdrop transitions to reveal the installed
LEMUR climbing board with two climbers on it and friends watching — end exactly on
that scene. Consistent lighting, photorealistic, no cuts, 9:16 vertical."

This makes the AI clip pick up right where the original ends → the join is invisible.

---

## C. Append to the original (keep the original untouched)

Once you've saved the Gemini clip (e.g. `gemini_final.mp4`) and the original in the
same folder, concatenate — re-encode so the two sources match cleanly:

```
# normalize both to the same size/fps, then concat
ffmpeg -i IMG_3328.mov      -vf "scale=1080:1920,fps=30,setsar=1" -an -c:v libx264 -crf 18 a.mp4
ffmpeg -i gemini_final.mp4  -vf "scale=1080:1920,fps=30,setsar=1" -an -c:v libx264 -crf 18 b.mp4
printf "file 'a.mp4'\nfile 'b.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -crf 18 original_plus_final.mp4
```

Add the voiceover + burn subtitles afterward (see PROMO_BRIEF.md §3).

> I can run step C for you the moment you drop `gemini_final.mp4` (and/or save the
> composite image as a file) into `assets/promo/`.
