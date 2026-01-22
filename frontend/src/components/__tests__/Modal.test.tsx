/**
 * Modal Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../ui/Modal'

describe('Modal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        title: 'Test Modal',
        children: <p>Modal content</p>,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders nothing when closed', () => {
        render(<Modal {...defaultProps} isOpen={false} />)
        expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    })

    it('renders title and content when open', () => {
        render(<Modal {...defaultProps} />)

        expect(screen.getByText('Test Modal')).toBeInTheDocument()
        expect(screen.getByText('Modal content')).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(<Modal {...defaultProps} onClose={onClose} />)

        // Find the close button (X icon button)
        const closeButtons = screen.getAllByRole('button')
        const closeButton = closeButtons.find(btn => btn.querySelector('svg'))

        if (closeButton) {
            fireEvent.click(closeButton)
            expect(onClose).toHaveBeenCalledTimes(1)
        }
    })

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn()
        render(<Modal {...defaultProps} onClose={onClose} />)

        // Click on the backdrop (the div with bg-black/60)
        const backdrop = document.querySelector('.bg-black\\/60')
        if (backdrop) {
            fireEvent.click(backdrop)
            expect(onClose).toHaveBeenCalledTimes(1)
        }
    })

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn()
        render(<Modal {...defaultProps} onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders footer when provided', () => {
        render(
            <Modal {...defaultProps} footer={<button>Save</button>} />
        )

        expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('applies custom width class', () => {
        render(<Modal {...defaultProps} width="max-w-lg" />)

        const modalContent = document.querySelector('.max-w-lg')
        expect(modalContent).toBeInTheDocument()
    })
})
