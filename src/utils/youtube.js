// Extracts an 11-char YouTube video ID from a full URL, share link, or a
// bare ID pasted directly (mirrors the mobile app's extractYoutubeVideoId).
export function extractYoutubeVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  // Already looks like a bare video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];

  for (const re of patterns) {
    const match = trimmed.match(re);
    if (match) return match[1];
  }
  return null;
}

export function getYouTubeThumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// Uses YouTube's public oEmbed endpoint to fetch a video's title without
// needing a YouTube Data API key.
export async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) throw new Error("oEmbed request failed");
    const data = await res.json();
    return data.title || "YouTube video";
  } catch {
    return "YouTube video";
  }
}

export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
