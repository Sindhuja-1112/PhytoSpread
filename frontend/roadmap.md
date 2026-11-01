# Roadmap
- [x] Design system, sidebar layout, all 17 pages
- [x] Demo disease model, uncertainty flow, saliency placeholder
- [x] Live weather (Open-Meteo) + demo fallback, location search
- [x] Field map drawing, spatial grid, spatial SEIR, interventions, analytics, validation, history, settings
- [ ] Accounts, database tables and image storage on Lovable Cloud (awaiting user go-ahead)
- [x] Connect deployed FastAPI disease prediction; verify upload, API errors and CORS
- [x] Connect API Grad-CAM fields; verify rendering, missing/invalid images, loading and retry with controlled browser responses
- [ ] Verify live Grad-CAM upload-to-result and CORS (blocked: deployed API returns 502 or times out)
- [ ] Connect real SEIR service (simulation endpoints not provided)
