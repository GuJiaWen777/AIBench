import { useEffect } from 'react'

/** Applies the native theme to the document and follows later changes. */
export function useTheme(): void {
  useEffect(() => {
    const apply = (isDark: boolean): void => {
      document.documentElement.classList.toggle('dark', isDark)
    }
    void window.aibench.theme.get().then(apply)
    return window.aibench.theme.onChanged(apply)
  }, [])
}
