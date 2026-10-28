import { useState } from 'react'

const navigationItems = [
  { href: '#restaurante', label: 'Restaurante' },
  { href: '#estancia', label: 'Estancia' },
  { href: '#carta', label: 'Carta' },
  { href: '#contacto', label: 'Ubicación' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function closeMenu() {
    setIsMenuOpen(false)
  }

  return (
    <header className="absolute inset-x-0 top-0 z-20 text-[#f4eddd]">
      <div className="mx-auto flex max-w-7xl items-center justify-between border-b border-[#f4eddd]/15 px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
        <a href="#contenido" className="display-font text-3xl tracking-[-0.05em] transition hover:text-[#dfb468] focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd]">
          El Cruce
        </a>
        <nav aria-label="Navegación principal" className="hidden items-center gap-8 text-[0.68rem] font-semibold uppercase tracking-[0.2em] md:flex">
          {navigationItems.map((item) => (
              <a key={item.href} href={item.href} className="border-b border-transparent pb-1 transition hover:border-[#dfb468] hover:text-[#dfb468] focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd]">
              {item.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          className="grid size-11 place-items-center rounded-full border border-[#f4eddd]/50 bg-[#131313]/30 text-xs font-semibold uppercase tracking-[0.12em] transition hover:border-[#dfb468] hover:text-[#dfb468] focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd] md:hidden"
        >
          <span className="sr-only">{isMenuOpen ? 'Cerrar' : 'Abrir'} navegación</span>
          <span aria-hidden="true">{isMenuOpen ? '×' : 'Menú'}</span>
        </button>
      </div>
      {isMenuOpen && (
        <nav id="mobile-navigation" aria-label="Navegación móvil" className="border-y border-[#f4eddd]/20 bg-[#131313]/95 px-5 py-6 backdrop-blur-sm md:hidden">
          <ul className="mx-auto grid max-w-7xl gap-4 text-sm font-semibold uppercase tracking-[0.16em]">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={closeMenu} className="block py-2 transition hover:text-[#dfb468] focus:outline-2 focus:outline-offset-4 focus:outline-[#f4eddd]">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
