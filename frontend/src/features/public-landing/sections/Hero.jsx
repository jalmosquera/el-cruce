export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[46rem] items-end overflow-hidden bg-[#435d4c] text-[#fffaf0] sm:min-h-[52rem]">
      <div aria-hidden="true" className="abstract-sunrise absolute inset-0 scale-105" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#162d25]/85 via-[#162d25]/20 to-[#162d25]/35" />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 pt-36 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
        <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#fae0b8]">
          <span className="h-px w-9 bg-current" /> Presentación inicial
        </p>
        <h1 id="hero-title" className="display-font max-w-4xl text-5xl leading-[0.94] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
          Un lugar para encontrarse.
        </h1>
        <div className="mt-8 max-w-xl border-l border-[#fae0b8]/70 pl-5 text-base leading-7 text-[#fff5e7] sm:text-lg">
          <p>Una primera mirada a El Cruce. La información de esta página está pendiente de verificación.</p>
        </div>
        <a href="#restaurante" className="mt-10 inline-flex items-center gap-3 border-b border-[#fffaf0] pb-2 text-xs font-bold uppercase tracking-[0.18em] transition hover:text-[#fae0b8] focus:outline-2 focus:outline-offset-4 focus:outline-[#fffaf0]">
          Conocer el proyecto <span aria-hidden="true">↓</span>
        </a>
      </div>
      <p className="absolute bottom-4 right-5 rounded-sm bg-[#29271f]/65 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#fffaf0] sm:bottom-6 sm:right-8 lg:right-12">
        Visual abstracto · no es fotografía
      </p>
    </section>
  )
}
