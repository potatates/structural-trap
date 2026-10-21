"""Builds preview.html, a copy of index.html without the <html>/<head>/<body>
wrapper, for publishing as a Claude artifact (which adds its own wrapper).
Run: python3 tools/make-preview.py  (from the belief-web folder)"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'index.html').read_text()
head = re.search(r'<head>(.*)</head>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', '', head)
body = re.search(r'<body>(.*)</body>', src, re.S).group(1)
(root / 'preview.html').write_text(head.strip() + '\n' + body.strip() + '\n')
print('wrote preview.html')
