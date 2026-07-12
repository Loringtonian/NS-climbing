#!/usr/bin/env python3
"""Generate the Solana escrow smart-contract architecture diagram for the pitch deck."""
import os, subprocess
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv("/Users/lts/Desktop/Second_Brain/Projects/Personal_Media_Archive/.env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

PROMPT = """Premium technical architecture diagram, 16:9, on a dark near-black background (#0E1116).
Clean developer-tool infographic style — thin luminous connector lines, generous negative space,
crisp legible sans-serif labels spelled EXACTLY as given, high contrast, no people, no photorealism,
no clutter. Elevated Solana documentation aesthetic. Palette strictly: near-black ground, off-white
text, vermilion (#FF6B4A), amber (#FFB24A), and mint-green (#7FE0B2) accents.

CENTER: a large glowing rounded vault node with an amber outline. Header label on it:
"ESCROW VAULT — PDA". Sub-label inside: "locked USDC · no individual withdraw".

LEFT: three small stacked wallet/phone glyphs, each holding a coin, group-labeled "DEPOSITORS".
Thin arrows flow rightward from them into the vault, the arrow group labeled "deposit (each signs)".
Beside the wallets, a small chip labeled "Receipt PDA = badge · vote · refund".

TOP-CENTER, above the vault: a smaller node with a vermilion outline, labeled
"CAMPAIGN PDA · dollar-weighted rules · 180-day clock", with a thin line down to the vault.

RIGHT: three separate glowing arrows leave the vault, stacked vertically, each ending in a small
target box, labeled exactly:
  top arrow, amber: "BUILD → payout  (dollar-majority + organizer)"
  middle arrow, vermilion: "DISSOLVE → refund all  (dollar-majority)"
  bottom arrow, mint-green: "TIMEOUT → refund all  (180 days)"

Balanced, symmetrical, poster-quality. Only near-black, off-white, vermilion, amber, mint-green."""

resp = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=PROMPT,
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)
out = "/Users/lts/Desktop/Second_Brain/Projects/NS-climbing/deck/arch_escrow.png"
saved = False
for part in resp.parts:
    if part.inline_data:
        part.as_image().save(out); saved = True
if saved:
    subprocess.run(["open", out]); print("SAVED:", out)
else:
    print("NO IMAGE; parts:", [getattr(p, "text", None) for p in resp.parts])
