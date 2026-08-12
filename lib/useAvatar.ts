import { useEffect, useState } from 'react';
import { fetchAvatar, resolvePhoto } from './photos';

/**
 * The image URI for a user's avatar, or '' when there is none.
 *
 * Photos live in `userPhotos/{uid}` rather than on the user document (see
 * lib/photos.ts), so a screen that wants to draw one has to ask for it. This
 * hook is where that read happens, and it is deliberately per-component: the
 * cleaner list is a FlatList, so only the cards actually near the viewport ever
 * mount — and therefore only those photos are fetched. Rendering the same list
 * as a plain `.map()` would undo that.
 *
 * Two shortcuts skip the read entirely:
 *   • the document still carries the photo inline (older profiles);
 *   • `hasPhoto === false`, meaning the profile is known to have none.
 *
 * `lib/photos` caches per session, so scrolling a list back and forth costs one
 * read per cleaner rather than one per render.
 */
export function useAvatar(uid?: string | null, source?: any): string {
  const inline = resolvePhoto(source);
  const hasPhoto = source?.hasPhoto;
  const [url, setUrl] = useState(inline);

  useEffect(() => {
    if (inline) { setUrl(inline); return; }
    if (!uid || hasPhoto === false) return;
    let active = true;
    fetchAvatar(uid).then((u) => { if (active && u) setUrl(u); });
    return () => { active = false; };
  }, [uid, inline, hasPhoto]);

  return url;
}
