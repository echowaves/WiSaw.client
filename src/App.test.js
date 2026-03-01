import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app shell', () => {
  render(<App />)
  const rootElement = screen.getByText(/loading/i)
  expect(rootElement).toBeInTheDocument()
})
