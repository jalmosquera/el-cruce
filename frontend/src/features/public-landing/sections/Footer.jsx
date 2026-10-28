export function Footer() {
  return (
    <footer className="border-t border-[#d6b477]/30 bg-[#161914] text-[#f4eddd]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12 lg:py-16">
        <div>
          <p className="display-font text-4xl tracking-[-0.05em]">El Cruce</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#d4cbb9]">La carta pública se actualiza desde el panel interno. La información de alojamiento, contacto y reservas se publicará cuando esté verificada.</p>
        </div>
        <p className="border-t border-[#d6b477]/50 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b477] lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">Carta pública · Sitio en preparación</p>
      </div>
    </footer>
  )
}
