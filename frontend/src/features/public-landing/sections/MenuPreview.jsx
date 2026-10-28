const menuGroups = [
  { number: '01', title: 'Para empezar', description: 'Próximamente' },
  { number: '02', title: 'De la cocina', description: 'Próximamente' },
  { number: '03', title: 'Para brindar', description: 'Próximamente' },
]

export function MenuPreview() {
  return (
    <section id="carta" aria-labelledby="menu-title" className="scroll-mt-8 bg-[#bf8353] py-20 text-[#201d18] sm:py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-7 border-b border-[#32271e]/45 pb-10 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="eyebrow-rule text-xs font-bold uppercase tracking-[0.22em] text-[#30231b]">03 · Carta</p>
            <h2 id="menu-title" className="display-font mt-6 text-5xl leading-[0.92] tracking-[-0.055em] sm:text-6xl">Una carta aún por descubrir.</h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[#30231b]">Previsualización editorial. Los platos, alérgenos y precios no están publicados.</p>
        </div>
        <ul className="mt-5 divide-y divide-[#32271e]/35">
          {menuGroups.map((group) => (
            <li key={group.number} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-6 transition sm:gap-7 sm:py-8 sm:hover:translate-x-2">
              <span className="display-font text-3xl text-[#30231b]">{group.number}</span>
              <h3 className="display-font text-3xl tracking-[-0.035em] sm:text-4xl">{group.title}</h3>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#30231b]">{group.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
