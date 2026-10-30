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
- Multi-tenant: every app table carries `clinic_id`; client code gets it from `useClinic()` (src/lib/clinic.ts), filters and inserts with it, and RLS enforces membership — never rely on unfiltered reads.
- The Z-API webhook identifies the clinic by its per-clinic `webhook_secret`; server code loads settings with `loadZapiSettings(admin, clinicId)` only after resolving the clinic.
