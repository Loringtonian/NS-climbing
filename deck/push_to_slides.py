#!/usr/bin/env python3
"""Upload the finished .pptx to Google Slides (converted, editable) via the
sb-slides-editor service account, then share it to Lorin. Prints the edit URL.

Usage: python3 push_to_slides.py [path-to-pptx]
"""
import sys, json, os
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

KEY = "/Users/lts/.config/sb_slides/slides-sa.json"
PPTX = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "NS_Climbing_Pitch.pptx")
TITLE = "NS Climbing — Pitch Deck"
SHARE_TO = "lorin.symington@gmail.com"

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/drive"])
sess = AuthorizedSession(creds)

# 1. upload pptx with conversion to a native Google Slides presentation
meta = {"name": TITLE, "mimeType": "application/vnd.google-apps.presentation"}
data = open(PPTX, "rb").read()
b = "====nsclimbdeck===="
body = (
    ("--%s\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" % b).encode()
    + json.dumps(meta).encode() + b"\r\n"
    + ("--%s\r\nContent-Type: application/vnd.openxmlformats-officedocument."
       "presentationml.presentation\r\n\r\n" % b).encode()
    + data + ("\r\n--%s--" % b).encode()
)
r = sess.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType",
    data=body, headers={"Content-Type": "multipart/related; boundary=%s" % b})
if r.status_code not in (200, 201):
    print("UPLOAD FAILED", r.status_code, r.text[:500]); sys.exit(1)
fid = r.json()["id"]
print("created:", r.json())

# 2. share to Lorin as writer (no notification email — we hand him the link directly)
p = sess.post(
    "https://www.googleapis.com/drive/v3/files/%s/permissions?sendNotificationEmail=false" % fid,
    json={"role": "writer", "type": "user", "emailAddress": SHARE_TO})
print("share:", p.status_code, p.text[:200])

print("\nEDIT URL: https://docs.google.com/presentation/d/%s/edit" % fid)
