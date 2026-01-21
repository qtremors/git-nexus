/**
 * Badge Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../../test/utils'
import { Badge } from '../ui/Badge'

describe('Badge', () => {
    it('renders children correctly', () => {
        render(<Badge>Test Badge</Badge>)
        expect(screen.getByText('Test Badge')).toBeInTheDocument()
    })

    it('renders as span when not clickable', () => {
        render(<Badge>Static Badge</Badge>)
        const element = screen.getByText('Static Badge')
        expect(element.tagName).toBe('SPAN')
    })

    it('renders as button when onClick is provided', () => {
        const handleClick = vi.fn()
        render(<Badge onClick={handleClick}>Clickable Badge</Badge>)

        const element = screen.getByText('Clickable Badge')
        expect(element.tagName).toBe('BUTTON')
    })

    it('calls onClick when button is clicked', () => {
        const handleClick = vi.fn()
        render(<Badge onClick={handleClick}>Click me</Badge>)

        fireEvent.click(screen.getByText('Click me'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('applies custom className', () => {
        render(<Badge className="my-custom-class">Styled Badge</Badge>)
        const element = screen.getByText('Styled Badge')
        expect(element).toHaveClass('my-custom-class')
    })

    it('applies color classes correctly', () => {
        const { rerender } = render(<Badge color="green">Green</Badge>)
        expect(screen.getByText('Green')).toHaveClass('text-emerald-400')

        rerender(<Badge color="purple">Purple</Badge>)
        expect(screen.getByText('Purple')).toHaveClass('text-purple-400')
    })

    it('uses blue as default color', () => {
        render(<Badge>Default</Badge>)
        expect(screen.getByText('Default')).toHaveClass('text-blue-400')
    })
})
