import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    maxWidth: '800px',
                    margin: '40px auto',
                    fontFamily: 'monospace',
                    background: '#1a1a2e',
                    color: '#ff6b6b',
                    borderRadius: '12px',
                }}>
                    <h1 style={{ color: '#00d9ff' }}>🚨 WebVina Error</h1>
                    <h2 style={{ color: '#ff6b6b' }}>
                        {this.state.error?.name}: {this.state.error?.message}
                    </h2>
                    <pre style={{
                        background: '#0d0d1a',
                        padding: '20px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '12px',
                        color: '#00ff88',
                    }}>
                        {this.state.error?.stack}
                    </pre>
                    <h3 style={{ color: '#00d9ff', marginTop: '20px' }}>Component Stack:</h3>
                    <pre style={{
                        background: '#0d0d1a',
                        padding: '20px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        fontSize: '12px',
                        color: '#ffcc00',
                    }}>
                        {this.state.errorInfo?.componentStack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            background: '#00d9ff',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#1a1a2e',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                        }}
                    >
                        🔄 Reload App
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
