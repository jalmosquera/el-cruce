import { Route, Routes } from 'react-router'
import { PublicLanding } from '../features/public-landing/PublicLanding.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLanding />} />
    </Routes>
  )
}

export default App
