export function AccommodationSection() {
  return (
    <section id="estancia" aria-labelledby="accommodation-title" className="scroll-mt-8 bg-[#1e2920] py-20 text-[#f4eddd] sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:px-12">
          <div className="abstract-window relative order-2 aspect-[5/4] overflow-hidden border border-[#e1bd78]/30 shadow-[-12px_12px_0_#4e563c] transition duration-500 hover:-translate-y-1 hover:shadow-[-16px_16px_0_#4e563c] lg:order-1">
            <p className="absolute bottom-3 left-3 border border-[#f4eddd]/20 bg-[#131313]/75 px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.13em]">Visual abstracto · no es fotografía</p>
        </div>
        <div className="order-1 lg:order-2">
          <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-[#e1bd78]">02 · Estancia</p>
          <h2 id="accommodation-title" className="display-font mt-6 max-w-md text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl">El descanso empieza con una buena bienvenida.</h2>
          <p className="mt-8 max-w-lg text-lg leading-8 text-[#eee6d5]">La información de alojamiento, disponibilidad y condiciones se publicará tras su validación.</p>
          <p className="mt-6 text-sm leading-6 text-[#cfc6b5]">No se muestran habitaciones, servicios ni tarifas mientras no haya datos verificados.</p>
        </div>
      </div>
    </section>
  )
}
