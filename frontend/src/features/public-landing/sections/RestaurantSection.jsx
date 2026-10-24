export function RestaurantSection() {
  return (
    <section id="restaurante" aria-labelledby="restaurant-title" className="paper-grain scroll-mt-8 bg-[#f7f1e7] py-20 sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-20 lg:px-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a85739]">01 · Restaurante</p>
          <h2 id="restaurant-title" className="display-font mt-5 max-w-md text-4xl leading-none tracking-[-0.035em] text-[#413328] sm:text-5xl">Una mesa abierta a lo que está por contar.</h2>
        </div>
        <div className="grid gap-7 sm:grid-cols-[1fr_0.85fr] sm:items-end">
          <div className="abstract-table relative aspect-[4/5] overflow-hidden bg-[#a86140]">
            <p className="absolute bottom-3 right-3 rounded-sm bg-[#29271f]/75 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#fffaf0]">Visual abstracto</p>
          </div>
          <div className="pb-2">
            <p className="text-lg leading-8 text-[#5c5145]">La propuesta gastronómica y sus detalles se incorporarán cuando sean confirmados por el establecimiento.</p>
            <p className="mt-6 border-l-2 border-[#d5a278] pl-4 text-sm leading-6 text-[#75685a]">Contenido temporal pendiente de verificación.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
