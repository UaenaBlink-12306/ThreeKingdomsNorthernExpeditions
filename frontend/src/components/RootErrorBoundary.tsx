import React from "react";

import { reportConsoleError } from "../utils/errorLogger";

interface RootErrorBoundaryProps {
  children: React.ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
}

export default class RootErrorBoundary extends React.Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportConsoleError("react.error_boundary", error, {
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-shell">页面发生错误，请打开浏览器控制台查看详细日志。</main>;
    }
    return this.props.children;
  }
}
