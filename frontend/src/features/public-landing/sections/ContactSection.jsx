export function ContactSection() {
  return (
    <section id="contacto" aria-labelledby="contact-title" className="scroll-mt-8 bg-[#282b22] py-20 text-[#f4eddd] sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-12">
        <div>
          <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-[#dca15d]">04 · Ubicación y contacto</p>
          <h2 id="contact-title" className="display-font mt-6 max-w-md text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl">Pronto, todos los caminos llegarán aquí.</h2>
        </div>
        <div className="border border-[#d6b477]/45 bg-[#f0e7d5] p-7 text-[#27271f] shadow-[10px_10px_0_#161914] sm:p-10">
          <p className="text-lg leading-8 text-[#454238]">La dirección, horarios y canales de contacto se incorporarán cuando estén confirmados.</p>
          <div className="mt-9 grid gap-3 border-t border-[#b8a88d] pt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#625d51] sm:grid-cols-2">
            <span>Datos pendientes</span>
            <span className="sm:text-right">Sin reservas en línea</span>
          </div>
        </div>
      </div>
    </section>
  )
}
