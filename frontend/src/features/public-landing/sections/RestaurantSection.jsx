export function RestaurantSection() {
  return (
    <section id="restaurante" aria-labelledby="restaurant-title" className="paper-grain scroll-mt-8 bg-surface py-20 text-foreground sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-20 lg:px-12">
        <div>
          <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-secondary">01 · Restaurante</p>
          <h2 id="restaurant-title" className="display-font mt-6 max-w-md text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl">Una mesa abierta a lo que está por contar.</h2>
        </div>
        <div className="grid gap-7 sm:grid-cols-[1fr_0.85fr] sm:items-end">
          <div className="abstract-table art-shadow relative aspect-[4/5] overflow-hidden border border-secondary/30 bg-accent transition duration-500 hover:-translate-y-1">
            <p className="absolute bottom-3 right-3 border border-foreground/20 bg-background/75 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-foreground">Visual abstracto</p>
          </div>
          <div className="pb-2">
            <p className="text-lg leading-8 text-foreground">La propuesta gastronómica y sus detalles se incorporarán cuando sean confirmados por el establecimiento.</p>
            <p className="mt-7 border-l-2 border-accent pl-4 text-sm leading-6 text-muted">Contenido temporal pendiente de verificación.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
