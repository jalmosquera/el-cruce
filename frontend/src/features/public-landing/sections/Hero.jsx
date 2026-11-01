export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[46rem] items-end overflow-hidden bg-background text-foreground sm:min-h-[52rem]">
      <div aria-hidden="true" className="abstract-sunrise absolute inset-0 scale-105" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-background/60" />
      <div aria-hidden="true" className="paper-grain absolute inset-0 opacity-50" />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-14 pt-36 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
        <p className="entrance-reveal eyebrow-rule mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
          Presentación inicial
        </p>
        <h1 id="hero-title" className="entrance-reveal display-font max-w-4xl text-6xl leading-[0.87] tracking-[-0.065em] sm:text-8xl lg:text-9xl">
          Un lugar para encontrarse.
        </h1>
        <div className="entrance-reveal-delayed mt-9 max-w-xl border-l border-secondary/70 pl-5 text-base leading-7 text-foreground sm:text-lg">
          <p>Una primera mirada a El Cruce. La información de esta página está pendiente de verificación.</p>
        </div>
        <a href="#restaurante" className="entrance-reveal-delayed mt-11 inline-flex items-center gap-3 border-b border-secondary pb-2 text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-primary hover:text-primary focus:outline-2 focus:outline-offset-4 focus:outline-focus-on-dark">
          Conocer el proyecto <span aria-hidden="true">↓</span>
        </a>
      </div>
      <p className="absolute bottom-4 right-5 border border-foreground/20 bg-background/65 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-foreground sm:bottom-6 sm:right-8 lg:right-12">
        Visual abstracto · no es fotografía
      </p>
    </section>
  )
}
