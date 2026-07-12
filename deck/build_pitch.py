#!/usr/bin/env python3
"""NS-climbing hackathon pitch deck -> .pptx (imports cleanly into Google Slides).
Brand matches the live site: near-black ground, vermilion->amber accents, wall imagery.
A dedicated QR slide points the room at the live cheer board (gasless, no wallet)."""
import os, segno
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

HERE   = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
OUT    = os.path.join(HERE, "NS_Climbing_Pitch.pptx")
QR_PNG = os.path.join(HERE, "cheer_qr.png")
CHEER_URL = "https://tinyurl.com/sendcheer"   # 301 -> cheer board (short = scans from the back row)

# ---- brand tokens (from the live site) ----
BG     = RGBColor(0x0E, 0x11, 0x16)   # near-black ground
PANEL  = RGBColor(0x16, 0x1B, 0x22)
INK    = RGBColor(0xF2, 0xF4, 0xF7)   # titles / statements
BODY   = RGBColor(0xC7, 0xCF, 0xDA)   # body
MUTE   = RGBColor(0x9A, 0xA4, 0xB2)   # captions
ACCENT = RGBColor(0xFF, 0x6B, 0x4A)   # vermilion
AMBER  = RGBColor(0xFF, 0xB2, 0x4A)   # amber
GREEN  = RGBColor(0x7F, 0xE0, 0xB2)   # "live" pill
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
FONT   = "Arial"                       # universally present after Google Slides import

# ---- QR: dark modules on white, generous quiet zone, crisp for a projector ----
segno.make(CHEER_URL, error="h").save(QR_PNG, scale=24, border=3,
                                       dark="#0e1116", light="#ffffff")

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
SW, SH = prs.slide_width, prs.slide_height

def slide(bg=BG):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid(); s.background.fill.fore_color.rgb = bg
    return s

def tb(s, l, t, w, h, anchor=MSO_ANCHOR.TOP):
    b = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = b.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    return b, tf

def para(tf, text, size, color, bold=False, align=PP_ALIGN.LEFT, first=False,
         spacing=1.0, tracking=None, before=0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align; p.line_spacing = spacing
    if before: p.space_before = Pt(before)
    r = p.add_run(); r.text = text
    f = r.font; f.size = Pt(size); f.bold = bold; f.color.rgb = color; f.name = FONT
    return p, r

def bar(s, l, t, w=1.7, h=0.11, color=ACCENT):
    b = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
    b.fill.solid(); b.fill.fore_color.rgb = color; b.line.fill.background()
    b.shadow.inherit = False
    return b

def pill(s, l, t, text, color=GREEN, w=2.2):
    p = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(0.42))
    p.fill.solid(); p.fill.fore_color.rgb = BG
    p.line.color.rgb = color; p.line.width = Pt(1.25); p.shadow.inherit = False
    tf = p.text_frame; tf.word_wrap = False
    r = tf.paragraphs[0]; r.alignment = PP_ALIGN.CENTER
    run = r.add_run(); run.text = text
    run.font.size = Pt(13); run.font.bold = True; run.font.color.rgb = color; run.font.name = FONT
    return p

def _optimized(img, maxw=1800):
    """downscale a full-bleed image to a lean JPEG so the .pptx stays small."""
    from PIL import Image
    src = os.path.join(ASSETS, img)
    if not os.path.exists(src):
        return None
    out = os.path.join(HERE, "_opt_" + os.path.splitext(img)[0] + ".jpg")
    im = Image.open(src).convert("RGB")
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(out, "JPEG", quality=82, optimize=True)
    return out

def fullbleed(s, img, dark=0.62):
    """cover image + dark scrim so text stays legible."""
    path = _optimized(img)
    if path and os.path.exists(path):
        s.shapes.add_picture(path, 0, 0, width=SW, height=SH)
    ov = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, SH)
    ov.fill.solid(); ov.fill.fore_color.rgb = BG
    ov.line.fill.background(); ov.shadow.inherit = False
    ov.fill.transparency = 0  # set below via alpha hack
    # python-pptx has no direct transparency; emulate with a solid near-black at given alpha
    _set_alpha(ov, int(dark * 255))
    return ov

def _set_alpha(shape, alpha):
    """add an <a:alpha> to a solidFill (0..255 -> 0..100000)."""
    from pptx.oxml.ns import qn
    sp = shape.fill._xPr.find(qn('a:solidFill'))
    srgb = sp.find(qn('a:srgbClr'))
    a = srgb.makeelement(qn('a:alpha'), {'val': str(int(alpha/255*100000))})
    srgb.append(a)

def footer(s):
    b, tf = tb(s, 0.55, 7.02, 8, 0.4)
    para(tf, "Network School  ·  send-climbing  ·  loringtonian.github.io/NS-climbing",
         11, MUTE, first=True, tracking=True)

def diagram(s, path, top=1.6, maxw=11.7, maxh=5.35):
    """center a generated architecture diagram, re-encoded lean (opaque dark
    image -> high-q JPEG at 1800px; labels stay crisp, deck stays small)."""
    from PIL import Image as _IM
    if not os.path.exists(path):
        return
    im = _IM.open(path).convert("RGB")
    if im.width > 1800:
        im = im.resize((1800, round(im.height * 1800 / im.width)), _IM.LANCZOS)
    path = os.path.splitext(path)[0] + "_opt.jpg"
    im.save(path, "JPEG", quality=90, optimize=True)
    iw, ih = _IM.open(path).size
    ar = iw / ih
    w = maxw; h = w / ar
    if h > maxh:
        h = maxh; w = h * ar
    s.shapes.add_picture(path, Inches((13.333 - w) / 2), Inches(top),
                         width=Inches(w), height=Inches(h))

# ============================ SLIDES ============================

# 1 — TITLE
s = slide()
fullbleed(s, "bg_wall.jpg", dark=0.58)
_, tf = tb(s, 0.9, 2.35, 11.5, 3.2)
para(tf, "MEMBER INITIATIVE", 15, AMBER, bold=True, first=True)
para(tf, "We want a climbing wall", 54, INK, bold=True, before=10)
p, r = para(tf, "at Network School.", 54, ACCENT, bold=True)
para(tf, "A petition where the signatures are money.", 24, BODY, before=18)
footer(s)

# 2 — THE PROBLEM
s = slide()
bar(s, 0.9, 1.1)
_, tf = tb(s, 0.9, 2.3, 11.5, 3.0)
para(tf, "Last year, a petition almost", 46, INK, bold=True, first=True)
para(tf, "flipped it. Almost.", 46, INK, bold=True)
para(tf, "Signatures are free. Free means “maybe.”  A list of names "
        "that costs nothing proves nothing.", 24, MUTE, before=26)
footer(s)

# 3 — THE TURN
s = slide()
bar(s, 0.9, 1.1, color=AMBER)
_, tf = tb(s, 0.9, 2.15, 11.5, 3.4)
para(tf, "This time the signatures", 46, INK, bold=True, first=True)
para(tf, "are money.", 46, AMBER, bold=True)
para(tf, "You lock USDC into a pool no person holds.", 26, BODY, before=24)
para(tf, "That's the point — a commitment, not a maybe.", 26, MUTE, before=6)
footer(s)

# 4 — HOW MONEY MOVES (three exits)
s = slide()
_, tf = tb(s, 0.9, 0.75, 11.5, 1.0)
para(tf, "Out only together.", 40, INK, bold=True, first=True)
para(tf, "Three ways money can move — every one is collective, all enforced by code.",
     19, MUTE, before=6)
cards = [
    ("BUILD", ACCENT, "A dollar-majority of depositors backs the organizer's proposed address. Funds the wall."),
    ("DISSOLVE", AMBER, "A dollar-majority votes no-confidence. Everyone is refunded, in full."),
    ("TIMEOUT", GREEN, "180 days pass with no build. Everyone is refunded, automatically."),
]
cw, gap, x0, y0 = 3.7, 0.35, 0.9, 2.35
for i,(head,col,desc) in enumerate(cards):
    x = x0 + i*(cw+gap)
    c = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y0), Inches(cw), Inches(3.1))
    c.fill.solid(); c.fill.fore_color.rgb = PANEL; c.line.color.rgb = col; c.line.width = Pt(1.5)
    c.shadow.inherit = False
    _, ctf = tb(s, x+0.32, y0+0.3, cw-0.6, 2.6)
    para(ctf, head, 26, col, bold=True, first=True)
    para(ctf, desc, 18, BODY, before=14, spacing=1.08)
_, tf2 = tb(s, 0.9, 5.95, 11.5, 0.8)
para(tf2, "No one — not the organizer, not anyone — can move a cent alone.",
     22, INK, bold=True, first=True)
footer(s)

# 5 — WHY YOU CAN TRUST IT
s = slide()
bar(s, 0.9, 1.1, color=GREEN)
_, tf = tb(s, 0.9, 1.55, 11.5, 4.6)
para(tf, "Don't trust us. Ask your own agent.", 40, INK, bold=True, first=True)
para(tf, "Votes are weighted by dollars locked — not by wallet.", 23, BODY, before=22)
para(tf, "A flood of cheap wallets can't capture it; the people with the most at stake decide.",
     18, MUTE, before=4)
para(tf, "The upgrade key is burned. The code is immutable — it can never change.",
     23, BODY, before=18)
para(tf, "Every claim is verifiable on-chain. Paste the repo to any AI and have it audit the contract.",
     18, MUTE, before=4)
footer(s)

# 6 — LIVE ESCROW (proof #1, crypto-native)
s = slide()
pill(s, 0.9, 1.0, "●  LIVE ON SOLANA MAINNET", GREEN, w=3.4)
_, tf = tb(s, 0.9, 1.8, 11.6, 4.6)
para(tf, "The escrow is real, and immutable.", 40, INK, bold=True, first=True)
para(tf, "An Anchor program on Solana — the upgrade authority is burned, so the bytecode "
        "can never change.", 21, BODY, before=18, spacing=1.08)
para(tf, "USDC locks in a program vault PDA. Each depositor gets a non-transferable receipt "
        "PDA — badge, vote, and refund in one.", 21, BODY, before=8, spacing=1.08)
para(tf, "Release requires  payout_vote_amount × 2 > total_escrowed  — a majority of dollars, "
        "not wallets. Refunds are permissionless, and funds only ever return to each depositor.",
     21, BODY, before=8, spacing=1.08)
para(tf, "Program  2PAg6iMEzPQnfzVmKdeUDctmmCYwts46Y5GEZBUDA4KJ", 14, MUTE, before=16)
footer(s)

# 6b — ESCROW ARCHITECTURE (the shape of the contract)
s = slide()
_, tf = tb(s, 0.9, 0.5, 11.6, 0.95)
para(tf, "The shape of the contract.", 30, INK, bold=True, first=True)
para(tf, "Deposits in. Three collective ways out. No individual withdraw.", 17, MUTE, before=6)
diagram(s, os.path.join(HERE, "arch_escrow.png"), top=1.78)
footer(s)

# 7 — CHEER BOARD ON MAGICBLOCK (proof #2, the real ER lifecycle)
s = slide()
pill(s, 0.9, 1.0, "●  LIVE ON A MAGICBLOCK EPHEMERAL ROLLUP", AMBER, w=5.2)
_, tf = tb(s, 0.9, 1.75, 11.6, 1.5)
para(tf, "The cheer board is a live Solana demo.", 38, INK, bold=True, first=True)
para(tf, "MagicBlock Ephemeral Rollups are on-demand SVM runtimes on Solana: delegate an "
        "account, run it at ~10 ms and gasless, then commit state back to the base layer.",
     18, MUTE, before=8, spacing=1.06)
_, t2 = tb(s, 0.9, 3.45, 11.6, 2.7)
def _life(tag, col, txt, first=False):
    p = t2.paragraphs[0] if first else t2.add_paragraph()
    p.space_before = Pt(0 if first else 13); p.line_spacing = 1.05
    a = p.add_run(); a.text = tag + "   "
    a.font.bold = True; a.font.size = Pt(20); a.font.color.rgb = col; a.font.name = FONT
    b = p.add_run(); b.text = txt
    b.font.size = Pt(18.5); b.font.color.rgb = BODY; b.font.name = FONT
_life("DELEGATE", ACCENT, "we hand the rollup one counter PDA — a single number, never funds.", first=True)
_life("CHEER", AMBER, "every tap is its own gasless transaction, ~10 ms, signed by a throwaway "
      "in-page key. No wallet, no SOL. ~366 / sec.")
_life("COMMIT", GREEN, "undelegate, and the final tally lands on Solana L1 as a permanent record.")
_, t3 = tb(s, 0.9, 6.35, 11.6, 0.7)
para(t3, "Tallied straight from the chain, not a database — no server. Your face is your "
        "pubkey; no name ever touches the chain.", 15, MUTE, first=True)
footer(s)

# 8 — MAGICBLOCK ARCHITECTURE (the shape of the rollup flow)
s = slide()
_, tf = tb(s, 0.9, 0.5, 11.6, 0.95)
para(tf, "One PDA — delegated to a rollup, committed back.", 30, INK, bold=True, first=True)
para(tf, "How the cheer board runs on MagicBlock.", 17, MUTE, before=6)
diagram(s, os.path.join(HERE, "arch_magicblock.png"), top=1.78)
footer(s)

# 8 — SCAN TO CHEER (the live moment)
s = slide()
_, tf = tb(s, 0.85, 1.15, 6.6, 5.0, anchor=MSO_ANCHOR.MIDDLE)
para(tf, "Scan to cheer.", 52, INK, bold=True, first=True)
para(tf, "Right now, from your seat.", 30, AMBER, bold=True, before=6)
para(tf, "No wallet. No cost. Tap as many times as you mean it — "
        "every tap is its own gasless transaction on the rollup.", 22, BODY, before=24, spacing=1.12)
para(tf, "tinyurl.com/sendcheer", 22, MUTE, bold=True, before=20)
# QR panel
qx, qy, qs = 8.15, 1.55, 4.35
panel = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(qx-0.28), Inches(qy-0.28),
                           Inches(qs+0.56), Inches(qs+0.56))
panel.fill.solid(); panel.fill.fore_color.rgb = WHITE; panel.line.fill.background()
panel.shadow.inherit = False
s.shapes.add_picture(QR_PNG, Inches(qx), Inches(qy), width=Inches(qs), height=Inches(qs))
footer(s)

# 9 — WHY IT'S FUNDABLE
s = slide()
bar(s, 0.9, 1.1)
_, tf = tb(s, 0.9, 1.55, 11.5, 4.8)
para(tf, "Priced demand, not a signature list.", 40, INK, bold=True, first=True)
para(tf, "Communities set a goal, pool resources, and let the rules — and their agents — execute.",
     23, BODY, before=22)
para(tf, "The rails are chain-agnostic in principle: Solana today, any wallet on any chain next.",
     20, MUTE, before=10)
para(tf, "A live wedge, not a slide: a real contract, real deposits, real on-chain usage this weekend.",
     20, MUTE, before=6)
footer(s)

# 10 — CLOSE
s = slide()
fullbleed(s, "gym_concept_v0.png", dark=0.66)
_, tf = tb(s, 0.9, 2.05, 8.0, 3.4)
para(tf, "A signature says", 40, BODY, bold=True, first=True)
para(tf, "“sure, whatever.”", 40, MUTE, bold=True)
para(tf, "Locked money says “build it.”", 46, INK, bold=True, before=16)
para(tf, "tinyurl.com/sendcheer", 22, AMBER, bold=True, before=22)
# small QR bottom-right
qs2 = 2.15
panel = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.75), Inches(4.55),
                           Inches(qs2+0.3), Inches(qs2+0.3))
panel.fill.solid(); panel.fill.fore_color.rgb = WHITE; panel.line.fill.background()
panel.shadow.inherit = False
s.shapes.add_picture(QR_PNG, Inches(10.9), Inches(4.7), width=Inches(qs2), height=Inches(qs2))

prs.save(OUT)
print("saved:", OUT)
print("slides:", len(prs.slides._sldIdLst))
