export function ContactSection() {
  return (
    <section id="contacto" aria-labelledby="contact-title" className="scroll-mt-8 bg-[#f7f1e7] py-20 sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a85739]">04 · Ubicación y contacto</p>
          <h2 id="contact-title" className="display-font mt-5 max-w-md text-4xl leading-none tracking-[-0.035em] text-[#413328] sm:text-5xl">Pronto, todos los caminos llegarán aquí.</h2>
        </div>
        <div className="border border-[#bcae9d] bg-[#fffaf0] p-7 sm:p-10">
          <p className="text-lg leading-8 text-[#5c5145]">La dirección, horarios y canales de contacto se incorporarán cuando estén confirmados.</p>
          <div className="mt-9 grid gap-3 border-t border-[#d9cdbf] pt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#75685a] sm:grid-cols-2">
            <span>Datos pendientes</span>
            <span className="sm:text-right">Sin reservas en línea</span>
          </div>
        </div>
      </div>
    </section>
  )
}
