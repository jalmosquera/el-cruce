const menuGroups = [
  { number: '01', title: 'Para empezar', description: 'Próximamente' },
  { number: '02', title: 'De la cocina', description: 'Próximamente' },
  { number: '03', title: 'Para brindar', description: 'Próximamente' },
]

export function MenuPreview() {
  return (
    <section id="carta" aria-labelledby="menu-title" className="scroll-mt-8 bg-[#d6a06f] py-20 text-[#2d251e] sm:py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-7 border-b border-[#6f4632]/40 pb-10 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6f4632]">03 · Carta</p>
            <h2 id="menu-title" className="display-font mt-5 text-4xl leading-none tracking-[-0.035em] sm:text-5xl">Una carta aún por descubrir.</h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[#563a2e]">Previsualización editorial. Los platos, alérgenos y precios no están publicados.</p>
        </div>
        <ul className="mt-4 divide-y divide-[#6f4632]/30">
          {menuGroups.map((group) => (
            <li key={group.number} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-6 sm:gap-7 sm:py-8">
              <span className="display-font text-2xl text-[#6f4632]">{group.number}</span>
              <h3 className="display-font text-2xl sm:text-3xl">{group.title}</h3>
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#6f4632]">{group.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
