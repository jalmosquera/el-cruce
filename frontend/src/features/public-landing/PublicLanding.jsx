import { AccommodationSection } from './sections/AccommodationSection.jsx'
import { ContactSection } from './sections/ContactSection.jsx'
import { Footer } from './sections/Footer.jsx'
import { Header } from './sections/Header.jsx'
import { Hero } from './sections/Hero.jsx'
import { MenuPreview } from './sections/MenuPreview.jsx'
import { RestaurantSection } from './sections/RestaurantSection.jsx'

export function PublicLanding() {
  return (
    <div className="landing-grain min-h-screen overflow-x-clip bg-[#131313] text-[#f4eddd]">
      <a
        href="#contenido"
        className="absolute left-4 top-4 z-50 -translate-y-20 border border-[#d6b477] bg-[#131313] px-4 py-3 text-sm font-semibold text-[#f4eddd] transition focus:translate-y-0 focus:outline-2 focus:outline-offset-2 focus:outline-[#f4eddd]"
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
