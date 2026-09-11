# Upload Dead Ahead to your website

This folder contains a ready-built static website. No build command or server application is needed on your host.

## GitHub Pages — ready-built version

1. Unzip **dead-ahead-website.zip** into a folder.
2. Create a GitHub repository on the `main` branch and upload the **unzipped contents**, with `index.html` at the repository root. Keep every asset folder and the hidden `.nojekyll` file.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
4. Wait for the Pages deployment to finish, then use the link shown in **Settings → Pages**.

Do not upload the ZIP itself or put the whole game inside an extra wrapper folder unless you want that folder in its website URL.

[GitHub's publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Your own host

Upload everything in this folder to your website's public folder, or to a subfolder such as `games/dead-ahead/`. Keep `assets/`, `models/`, `art/`, `fonts/`, `licenses/`, credits, and `index.html` together.

Visit the hosted folder with a trailing slash, for example `https://your-domain.com/games/dead-ahead/`. Your host should serve JavaScript, CSS, PNG, WOFF2, and GLB files as static files. No PHP, database, environment variables, or API keys are needed.

To show the game within another page, use an iframe pointing to its hosted address:

```html
<iframe src="/games/dead-ahead/" title="Dead Ahead — Mandarin Survival"
  width="100%" height="900" style="border:0"
  allow="fullscreen" allowfullscreen></iframe>
```

Click inside the game before using the keyboard. Use HTTPS for your public website.

## Play and edit

Use WASD/arrow keys to move, E to rescue nearby civilians, pinyin plus Enter to fight, and Escape to pause. Sound starts after interaction; Mandarin speech uses voices available on the player's device.

Test through a web server, not by double-clicking `index.html`. The game needs a current browser with WebGL 2.

For edits and automatic GitHub deployment, use the companion **dead-ahead-github-source.zip**. Its README explains the source workflow. Keep the asset credits and license notices with either version.

