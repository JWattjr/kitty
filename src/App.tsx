import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import NewPotPage from '@/pages/NewPotPage'
import PotPage from '@/pages/PotPage'
import GiftPage from '@/pages/GiftPage'
import PotsPage from '@/pages/PotsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/new" element={<NewPotPage />} />
          <Route path="/pot/:id" element={<PotPage />} />
          <Route path="/gift/:id" element={<GiftPage />} />
          <Route path="/pots" element={<PotsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
