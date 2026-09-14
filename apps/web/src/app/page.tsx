export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <span className="text-xl font-bold tracking-tight">E-moment</span>
        <span className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">Coming soon</span>
      </nav>
      <section className="mx-auto grid max-w-6xl gap-12 py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#c84f68]">Digital photo box</p>
          <h1 className="max-w-xl text-5xl font-bold tracking-tight sm:text-6xl">Your moments, beautifully framed.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#594d61]">
            Create playful photo strips on your own or share the moment with someone, wherever they are.
          </p>
          <button className="mt-8 rounded-full bg-[#241a2b] px-6 py-3 font-semibold text-white transition hover:bg-[#3e3048]">
            Create a moment
          </button>
        </div>
        <div className="mx-auto w-full max-w-sm rotate-3 rounded-sm bg-white p-4 shadow-[0_18px_45px_rgba(70,38,78,0.18)]">
          <div className="grid grid-cols-2 gap-3">
            {["smile", "pose", "laugh", "keep"].map((caption, index) => (
              <div key={caption} className="aspect-square rounded bg-[#f3dfdd] p-3 text-sm text-[#8c5260]">
                <div className={`h-full rounded ${index % 2 === 0 ? "bg-[#d9c8ff]" : "bg-[#ffd9a6]"}`} />
              </div>
            ))}
          </div>
          <p className="pt-4 text-center font-semibold tracking-wide">a little moment, 2026</p>
        </div>
      </section>
    </main>
  );
}
