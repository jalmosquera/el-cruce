import { Route, Routes } from 'react-router'
import { BootstrapStatusPage } from '../features/status/BootstrapStatusPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<BootstrapStatusPage />} />
    </Routes>
  )
}

export default App
