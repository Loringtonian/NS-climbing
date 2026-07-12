#!/usr/bin/env python3
"""Generate the any-chain / embedded-wallet (Privy) flow diagram for the pitch deck.

Left-to-right flow with recognisable brand marks — the point of the slide is that a
judge sees MetaMask / Ethereum / Circle-USDC / Solana and instantly gets the reach,
without reading a paragraph.
"""
import os, subprocess
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv("/Users/lts/Desktop/Second_Brain/Projects/Personal_Media_Archive/.env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

PROMPT = """A bold, CONCEPTUAL flow graphic, 16:9, on a dark near-black background (#0E1116).
Minimal and iconic — big recognisable brand logos, thin luminous connector arrows, huge amounts of
negative space. Almost no text. NOT a busy technical schematic, NOT photorealistic, no people.
Poster-quality, the kind of clean hero graphic on a Stripe or Solana landing page.

A simple LEFT-TO-RIGHT flow, four beats, evenly spaced across the frame:

BEAT 1 (left): a loose cluster of three LARGE, instantly recognisable logos floating together —
the orange MetaMask fox head, the Ethereum diamond, and a simple white envelope (email).
One short amber label beneath the cluster: "ANY CHAIN"

Glowing arrow right.

BEAT 2: a single LARGE glowing wallet shape carrying the Solana logo (three slanted parallel bars,
teal-to-purple gradient). One short label beneath: "PRIVY WALLET"

Glowing arrow right, with the circular blue USDC coin logo riding along the arrow.

BEAT 3: a LARGE closed vault / padlock, glowing strong vermilion (#FF6B4A), sitting on the Solana
logo. One short label beneath: "IMMUTABLE ESCROW"

Those are the ONLY words in the image: "ANY CHAIN", "PRIVY WALLET", "IMMUTABLE ESCROW".
Spell them exactly. No other captions, no paragraphs, no legend.

Colour palette strictly: near-black ground, off-white text, vermilion and amber accents, plus the
logos' own brand colours. Big, simple, confident, lots of breathing room."""

resp = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=PROMPT,
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)
out = "/Users/lts/Desktop/Second_Brain/Projects/NS-climbing/deck/arch_anychain.png"
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
