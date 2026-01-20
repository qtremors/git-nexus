import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-neutral-100 p-8">
                    <h1 className="text-3xl font-bold mb-4 text-red-500">Something went wrong.</h1>
                    <p className="mb-4 text-neutral-400">
                        An unexpected error occurred. Please reload the application.
                    </p>
                    <pre className="bg-neutral-900 p-4 rounded text-sm text-red-300 max-w-2xl overflow-auto mb-6">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
