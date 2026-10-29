import { Link } from 'react-router'

const menuGroups = [
  { number: '01', title: 'Para empezar', description: 'En la carta' },
  { number: '02', title: 'De la cocina', description: 'En la carta' },
  { number: '03', title: 'Para brindar', description: 'En la carta' },
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
          <div className="max-w-xs">
            <p className="text-sm leading-6 text-[#30231b]">La carta completa reúne los platos publicados, sus precios y alérgenos declarados.</p>
            <Link to="/carta" className="mt-5 inline-flex min-h-11 items-center border-b border-[#30231b] pb-1 text-xs font-bold uppercase tracking-[0.16em] transition hover:border-[#131313] hover:text-[#131313] focus:outline-2 focus:outline-offset-4 focus:outline-[#131313]">
              Ver la carta completa <span aria-hidden="true">→</span>
            </Link>
          </div>
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
