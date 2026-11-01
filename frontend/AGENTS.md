<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pages call service modules in `src/services/` (diseaseModel, weather, simulation), never hard-coded data — so the Python API (VITE_PHYTO_API_URL) can replace demo services without touching UI.
- Shared request/response contracts live in `src/types/index.ts` — they mirror the planned REST endpoints.
- Disease coefficients come only from `src/data/diseases.ts`, each tagged literature/prototype/not_configured — never present prototype values as validated.
- App state persists via the zustand store in `src/store/analysis.ts` (localStorage, rehydrated in __root) until Lovable Cloud is enabled.
- Leaflet is loaded client-only through `ClientFieldMap` — it breaks SSR if imported directly.

- Disease prediction uses its own centralized API base and the verified multipart `/predict` contract; keep simulation configuration independent to avoid redirecting unsupported endpoints.
- Keep original upload files in transient service memory and require re-upload after reload; persisted thumbnails are previews, not substitutes for model input.
- For multiple leaf images show independent API scores and the latest image’s exact confidence, never synthesize a pooled confidence.
- Keep full original previews and per-image /predict explanation payloads in transient service memory, separate from persisted predictions, to avoid browser storage limits and pairing maps with the wrong image.
