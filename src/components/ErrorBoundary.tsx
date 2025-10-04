import React from 'react'

type Props = { children: React.ReactNode; onReset?: () => void }
type State = { hasError: boolean; message?: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || String(err) }
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <div className="text-sm text-slate-600 mb-4">{this.state.message || 'An unexpected error occurred while rendering this component.'}</div>
            <div className="flex justify-end">
              <button className="px-3 py-2 border rounded mr-2" onClick={() => { this.setState({ hasError: false, message: undefined }); if (this.props.onReset) this.props.onReset() }}>Close</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children as any
  }
}
