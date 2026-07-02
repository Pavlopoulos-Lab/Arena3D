// Entry point — Three.js canvas setup and app initialisation
// Ports: www/js/on_page_load.js (Phase 12)
import { fetchConfig } from './api/config'

fetchConfig()
  .then((config) => {
    console.log('[arena3d] config loaded', config)
  })
  .catch((err: unknown) => {
    console.error('[arena3d] config fetch failed', err)
  })
