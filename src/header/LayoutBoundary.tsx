import { Component, type ReactNode } from 'react'

interface Props {
  /** Changes when the note or its renderer changes; a failed layout gets another try then. */
  resetKey: string
  fallback: ReactNode
  children: ReactNode
}

/** Catches errors thrown while a layout renders and shows `fallback` (the title alone) instead. */
export class LayoutBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    console.error('Saga header: layout failed, showing the title only', error)
  }

  override componentDidUpdate(previous: Props): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
