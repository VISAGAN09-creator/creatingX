# Website assets in Firebase

The storefront reads one Firestore document, `assets/website`, when a component
needs a website-owned asset. The client resolves the declared Storage paths to
download URLs once, caches that result for the current page session, and keeps
rendering if the document or an individual object is unavailable.

## Firestore document

Create the document `assets/website` in the Firebase Console. Add these map
fields exactly; `heroPoster` is optional but strongly recommended.

```json
{
  "logo": { "storagePath": "website/logo.png" },
  "sale": { "storagePath": "website/sale.png" },
  "heroVideo": { "storagePath": "website/hero.mp4" },
  "heroPoster": { "storagePath": "website/hero-poster.jpg" }
}
```

Firestore contains only these Storage paths. It does not contain the image or
video bytes, and it does not need a generated download URL.

## Upload process

1. Open Firebase Console for the same project configured by the app's
   `VITE_FIREBASE_*` variables, then open **Storage**.
2. Upload the existing source files without deleting them locally:

   | Local file | Storage object path |
   | --- | --- |
   | `src/assets/logo.png` | `website/logo.png` |
   | `src/assets/sale.png` | `website/sale.png` |
   | `src/assets/hero video.mp4` | `website/hero.mp4` |

3. Export a compressed still frame from the hero video and upload it as
   `website/hero-poster.jpg`. For example, with FFmpeg installed:

   ```powershell
   ffmpeg -ss 00:00:01 -i "src/assets/hero video.mp4" -frames:v 1 -q:v 2 hero-poster.jpg
   ```

4. Open **Firestore Database** and create the `assets/website` document using
   the fields above.
5. Confirm the existing Storage policy permits the intended storefront users to
   read `website/*`. This repository has no Storage rules file, and this change
   does not alter Firebase rules.

## Verification

Run `npm.cmd run dev`, visit `/varataaa/`, and confirm the remote logo, sale
badges, and desktop video load. Then temporarily set one `storagePath` to a
nonexistent object and refresh:

- missing `logo`: a text METALFLUX wordmark remains;
- missing `sale`: sale badges are omitted;
- missing `heroVideo` or `heroPoster`: the Hero keeps its dark, styled backdrop.

Restore the path after the check. Do not remove `src/assets/logo.png`,
`src/assets/sale.png`, or `src/assets/hero video.mp4` until the Storage-hosted
versions are verified in the deployed environment.
