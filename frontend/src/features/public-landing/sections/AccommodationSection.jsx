export function AccommodationSection() {
  return (
    <section id="estancia" aria-labelledby="accommodation-title" className="scroll-mt-8 bg-[#3d574a] py-20 text-[#fffaf0] sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:px-12">
        <div className="abstract-window relative order-2 aspect-[5/4] overflow-hidden border border-white/20 lg:order-1">
          <p className="absolute bottom-3 left-3 rounded-sm bg-[#29271f]/70 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em]">Visual abstracto · no es fotografía</p>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f1c691]">02 · Estancia</p>
          <h2 id="accommodation-title" className="display-font mt-5 max-w-md text-4xl leading-none tracking-[-0.035em] sm:text-5xl">El descanso empieza con una buena bienvenida.</h2>
          <p className="mt-7 max-w-lg text-lg leading-8 text-[#edf0e4]">La información de alojamiento, disponibilidad y condiciones se publicará tras su validación.</p>
          <p className="mt-6 text-sm leading-6 text-[#d4dbce]">No se muestran habitaciones, servicios ni tarifas mientras no haya datos verificados.</p>
        </div>
      </div>
    </section>
  )
}
