# BAR FLAVOUR Training App

This is a static PWA for the BAR FLAVOUR training handbook.

## Local Preview

```bash
python3 -m http.server 4177
```

Open `http://127.0.0.1:4177/`.

## Update Content

The published default content is generated from:

`content.md`

After editing that Markdown source, rebuild the app assets:

```bash
node build-app-assets.cjs
```

The app also supports editing on the phone. Those edits are saved in the current browser and can be exported as Markdown.
