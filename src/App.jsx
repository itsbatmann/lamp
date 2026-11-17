import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CartProvider } from './cart'
import { CatalogProvider } from './catalog'
import Nav from './components/Nav'
import CartDrawer from './components/CartDrawer'
import Intro from './components/Intro'
import Helpline from './components/Helpline'
import { HelplineProvider } from './helpline'
import Shop from './pages/Shop'
import Configurator from './pages/Configurator'
import Checkout from './pages/Checkout'
import Order from './pages/Order'

// intro plays once per browser tab; add ?intro to the URL to replay it
function useIntro() {
  const [show, setShow] = useState(() => {
    if (new URLSearchParams(window.location.search).has('intro')) return true
    try { return !sessionStorage.getItem('intro') } catch { return true }
  })
  const done = () => {
    try { sessionStorage.setItem('intro', '1') } catch { /* private mode */ }
    setShow(false)
  }
  return [show, done]
}

function Pages() {
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  return (
    <Routes>
      <Route path="/" element={<Shop />} />
      <Route path="/lamp/:id" element={<Configurator />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order/:id" element={<Order />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  const [intro, introDone] = useIntro()
  return (
    <BrowserRouter>
      {/* outside CatalogProvider so it shows instantly, before the API responds */}
      {intro && <Intro onDone={introDone} />}
      <CatalogProvider>
        <CartProvider>
          <HelplineProvider>
            <Nav />
            <CartDrawer />
            <Pages />
            <Helpline />
          </HelplineProvider>
        </CartProvider>
      </CatalogProvider>
    </BrowserRouter>
  )
}
