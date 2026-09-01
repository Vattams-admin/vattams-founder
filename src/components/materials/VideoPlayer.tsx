// HTML5 <video> playback for course material videos. The bucket is
// private Supabase Storage — `url` is a short-lived signed download
// URL obtained through the course-material Edge Function immediately
// before rendering, not a permanent/public URL. Native controls
// already provide play/pause/seek/volume/fullscreen — no paid
// streaming platform, no custom player library.
//
// Known limitation (documented per the brief, not hidden): this is
// progressive download, not adaptive-bitrate streaming. Supabase
// Storage serves the whole file at one quality with HTTP range
// support (so seeking works), but there's no automatic quality
// switching for slow connections the way a real streaming platform
// (Mux, Cloudflare Stream, YouTube, etc.) would provide. For a
// free-first architecture with no paid video service, this is the
// tradeoff — keep uploaded lecture videos reasonably sized (see the
// upload limit) or link to an external host for longer recordings.
export default function VideoPlayer({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        className="max-h-full max-w-full"
        aria-label={title}
      >
        <source src={url} />
        Your browser doesn&apos;t support playing this video inline.{' '}
        <a href={url} className="underline">
          Download it instead.
        </a>
      </video>
    </div>
  )
}
