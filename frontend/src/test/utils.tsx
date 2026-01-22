/**
 * Test Utilities
 * 
 * Provides wrapper components and helpers for testing.
 */

import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from '../components/ui/Toast'

// Providers wrapper for tests
function AllTheProviders({ children }: { children: ReactNode }) {
    return (
        <BrowserRouter>
            <ToastProvider>
                {children}
            </ToastProvider>
        </BrowserRouter>
    )
}

// Custom render that includes providers
const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }
