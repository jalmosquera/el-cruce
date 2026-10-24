import { AccommodationSection } from './sections/AccommodationSection.jsx'
import { ContactSection } from './sections/ContactSection.jsx'
import { Footer } from './sections/Footer.jsx'
import { Header } from './sections/Header.jsx'
import { Hero } from './sections/Hero.jsx'
import { MenuPreview } from './sections/MenuPreview.jsx'
import { RestaurantSection } from './sections/RestaurantSection.jsx'

export function PublicLanding() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#f7f1e7] text-[#29271f]">
      <a
        href="#contenido"
        className="absolute left-4 top-4 z-50 -translate-y-20 rounded-sm bg-[#29271f] px-4 py-3 text-sm font-semibold text-[#fffaf0] transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-[#fffaf0]"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido">
        <Hero />
        <RestaurantSection />
        <AccommodationSection />
        <MenuPreview />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}
