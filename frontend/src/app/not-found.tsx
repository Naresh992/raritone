import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-[640px] mx-auto px-4 py-16 text-center">
      <div className="text-xs tracking-[0.2em] uppercase text-clay font-semibold">404</div>
      <h1 className="font-display text-4xl mt-2">This look doesn&apos;t exist.</h1>
      <p className="text-sm text-stoney-600 mt-3">The page you&apos;re looking for moved or never existed. Try one of these instead.</p>
      <div className="grid grid-cols-2 gap-2 mt-8 text-sm">
        {[
          ["Discover", "/discover"],
          ["Try-On", "/try-on"],
          ["Open App", "/app"],
          ["Track Order", "/track-order"],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="border border-stoney-200 p-4 hover:border-ink transition bg-white">{label} →</Link>
        ))}
      </div>
      <Link href="/" className="inline-flex mt-6 h-10 px-6 bg-ink text-white items-center text-xs tracking-widest uppercase">Back home</Link>
    </div>
  );
}
