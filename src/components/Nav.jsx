import { Link } from 'react-router-dom'
import { useCart } from '../cart'
import { useHelpline } from '../helpline'

// brand sits in the top middle; Shop + Help on the left, Cart on the right
export default function Nav() {
  const { count, setOpen } = useCart()
  const { openHelpline } = useHelpline()
  return (
    <header className="nav">
      <nav className="nav-left">
        <Link to="/">Shop</Link>
        <button onClick={() => openHelpline()}>Help</button>
      </nav>
      <Link to="/" className="logo">Lumora</Link>
      <nav className="nav-right">
        <button onClick={() => setOpen(true)}>Cart ({count})</button>
      </nav>
    </header>
  )
}
