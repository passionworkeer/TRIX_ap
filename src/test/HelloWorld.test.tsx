import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelloWorld } from './HelloWorld'

describe('HelloWorld Component', () => {
  it('renders hello world text', () => {
    render(<HelloWorld />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders with custom name', () => {
    render(<HelloWorld name="TRIX" />)
    expect(screen.getByText('Hello TRIX')).toBeInTheDocument()
  })
})
