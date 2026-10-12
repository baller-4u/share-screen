# ScreenVibe

Private screen-sharing rooms. Create a room, set a password, and friends join with the code or by scanning a QR code.

Built with plain HTML, CSS and JavaScript, using WebRTC (PeerJS) for the connection.

## Run it
Host it on GitHub Pages (screen sharing needs HTTPS):
1. Settings > Pages
2. Source: Deploy from a branch > main > / (root) > Save
3. Open `https://YOUR-USERNAME.github.io/REPO-NAME/`

## Notes
- Sharing works from laptops and desktops. Phones can watch but not share.
- Some networks block direct connections. A TURN server fixes this.
- Best for small rooms (about 4 viewers or fewer).
