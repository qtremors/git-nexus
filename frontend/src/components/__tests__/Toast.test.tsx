/**
 * Toast Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from '../ui/Toast'

// Test component that uses the toast hook
function TestComponent() {
    const { showToast } = useToast()

    return (
        <div>
            <button onClick={() => showToast('Success!', 'success')}>
                Show Success
            </button>
            <button onClick={() => showToast('Error!', 'error')}>
                Show Error
            </button>
            <button onClick={() => showToast('Info!')}>
                Show Neutral
            </button>
        </div>
    )
}

describe('Toast', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('throws error when used outside provider', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })

        expect(() => {
            render(<TestComponent />)
        }).toThrow('useToast must be used within a ToastProvider')

        consoleError.mockRestore()
    })

    it('shows success toast when triggered', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('Show Success'))

        expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('shows error toast with correct styling', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('Show Error'))

        const toast = screen.getByText('Error!').closest('div')
        expect(toast).toHaveClass('text-red-200')
    })

    it('auto-dismisses toast after 3 seconds', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('Show Neutral'))
        expect(screen.getByText('Info!')).toBeInTheDocument()

        // Fast forward 3 seconds
        act(() => {
            vi.advanceTimersByTime(3100)
        })

        expect(screen.queryByText('Info!')).not.toBeInTheDocument()
    })

    it('can manually dismiss toast', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('Show Success'))
        expect(screen.getByText('Success!')).toBeInTheDocument()

        // Find and click the dismiss button (X icon)
        const dismissButton = screen.getByText('Success!').closest('div')?.querySelector('button')
        if (dismissButton) {
            fireEvent.click(dismissButton)
        }

        expect(screen.queryByText('Success!')).not.toBeInTheDocument()
    })

    it('can show multiple toasts', async () => {
        render(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        )

        fireEvent.click(screen.getByText('Show Success'))
        fireEvent.click(screen.getByText('Show Error'))

        expect(screen.getByText('Success!')).toBeInTheDocument()
        expect(screen.getByText('Error!')).toBeInTheDocument()
    })
})
