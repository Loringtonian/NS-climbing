#!/usr/bin/env python3
"""Generate the MagicBlock ephemeral-rollup architecture diagram for the pitch deck."""
import os, subprocess
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv("/Users/lts/Desktop/Second_Brain/Projects/Personal_Media_Archive/.env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

PROMPT = """Premium technical architecture diagram, 16:9, on a dark near-black background (#0E1116).
Clean developer-tool infographic style — thin luminous connector lines, generous negative space,
crisp legible sans-serif labels spelled EXACTLY as given, high contrast, no people, no photorealism,
no clutter. Think an elevated Solana / MagicBlock documentation diagram.

Two clearly separated horizontal bands connected by two glowing vertical arrows:

TOP band, accented amber (#FFB24A): a large rounded container with the header label
"MAGICBLOCK  EPHEMERAL ROLLUP". Inside it: a cluster of about six small smartphone glyphs, each
emitting a bright spark toward a central glowing counter chip that shows an upward-ticking number.
A small caption under the counter reads "every tap = 1 gasless transaction  ·  ~10 ms".

BOTTOM band, accented vermilion (#FF6B4A): a single rounded node with the label
"SOLANA  BASE LAYER", containing one small chip labeled "Board PDA — one counter, no funds".

Between the bands: a glowing arrow pointing UP from the base node into the rollup, labeled
"delegate". A second glowing arrow pointing DOWN from the rollup back to the base node, labeled
"commit  →  permanent record".

Colour palette strictly: near-black ground, off-white text, vermilion and amber accents only.
Balanced, symmetrical, poster-quality."""

resp = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=PROMPT,
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)
out = "/Users/lts/Desktop/Second_Brain/Projects/NS-climbing/deck/arch_magicblock.png"
saved = False
for part in resp.parts:
    if part.inline_data:
        part.as_image().save(out)
        saved = True
if saved:
    subprocess.run(["open", out])
    print("SAVED:", out)
else:
    print("NO IMAGE RETURNED; text parts:", [getattr(p, "text", None) for p in resp.parts])
