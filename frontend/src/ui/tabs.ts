import { Tab } from 'bootstrap'

/** Programmatically activate a navbar tab by its pane selector, e.g. '#panel-file'. */
export function showTab(paneSelector: string): void {
  const trigger = document.querySelector(`[data-bs-target="${paneSelector}"]`)
  if (trigger) Tab.getOrCreateInstance(trigger).show()
}
