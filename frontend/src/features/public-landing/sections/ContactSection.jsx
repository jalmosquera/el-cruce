export function ContactSection() {
  return (
    <section id="contacto" aria-labelledby="contact-title" className="scroll-mt-8 bg-surface py-20 text-foreground sm:py-28 lg:py-36">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-12">
        <div>
          <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-secondary">04 · Ubicación y contacto</p>
          <h2 id="contact-title" className="display-font mt-6 max-w-md text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl">Pronto, todos los caminos llegarán aquí.</h2>
        </div>
        <div className="art-shadow border border-secondary/45 bg-primary p-7 text-primary-foreground sm:p-10">
          <p className="text-lg leading-8 text-primary-foreground">La dirección, horarios y canales de contacto se incorporarán cuando estén confirmados.</p>
          <div className="mt-9 grid gap-3 border-t border-border pt-6 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground sm:grid-cols-2">
            <span>Datos pendientes</span>
            <span className="sm:text-right">Sin reservas en línea</span>
          </div>
        </div>
      </div>
    </section>
  )
}
