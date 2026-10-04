# Google and Facebook account sign-in

The top-right account menu uses this site's Supabase Auth project, following MovieNight's browser-session pattern. OAuth uses PKCE. Users return to the page they were viewing after sign-in, and can sign out from the same menu. Location preferences are saved with Supabase Auth user metadata; cloud favourites have not been added yet. Server APIs must independently verify tokens before granting account access.

## Site configuration

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (or the legacy `SUPABASE_ANON_KEY`) in `.env.local` and Vercel. The public configuration endpoint deliberately exposes only the project URL and public key. Never set a service-role or secret key as the public key.

In Supabase Authentication → URL Configuration, set Site URL to `https://showhomeexplorer.vercel.app` (or your production custom domain), and allow these redirects:

- `https://showhomeexplorer.vercel.app/auth/callback**`
- `http://localhost:3000/auth/callback**`
- `http://127.0.0.1:3000/auth/callback**`

The suffix allows the `next` query parameter. Add explicit callback patterns for any custom domain you use. Avoid broad production-domain wildcards.

## Google

Create a Web application OAuth client for Showhome Explorer in Google Cloud's Google Auth Platform. Configure branding, audience, and basic OpenID/email/profile scopes. Add the site origin and local origin as authorised JavaScript origins. Set the authorised redirect URI to `https://hnxrbhlffwmlymxflrdb.supabase.co/auth/v1/callback`. Put that client's ID and secret into Supabase Authentication → Sign In / Providers → Google, then enable the provider. Use separate credentials from MovieNight.

## Facebook

Create a Meta app with Facebook Login for Showhome Explorer. Set its valid OAuth redirect URI to `https://hnxrbhlffwmlymxflrdb.supabase.co/auth/v1/callback`. Configure the site URL, app domain, privacy-policy URL and user-data deletion instructions required by Meta. Put its App ID and App Secret into Supabase Authentication → Sign In / Providers → Facebook and enable it. While the app is in development mode only authorised app roles/test users can sign in; complete Meta's required checks before enabling public sign-in.

## Validation

Test each provider on localhost and production: successful consent returns to the original page, the header shows the account name, refresh retains the session, and sign out clears it. Also test cancelled consent and expired/reused callback codes. The implementation shows a recoverable error instead of treating those as success.

References: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/social-login/auth-facebook

## Location preferences

Distance filters and nearest-first ordering open a device-location/postcode dialog only when no saved location is available. Guest preferences are stored in browser storage with a fixed 24-hour expiry, checked on reuse, focus and while the page remains open. This provides a 24-hour guest session across page navigation and browser restarts. Old records without an expiry are discarded.

Signed-in preferences are saved immediately with `auth.updateUser`, under `showhome_location`. Supabase persists this metadata in `auth.users.raw_user_meta_data`; no separate profile table or schema migration is needed. The profile page reads the same value. On successful sign-in, a valid guest location is copied to a new profile when that account has no existing location preference. Save failures remain visible and do not report success.

Source: https://supabase.com/docs/guides/auth/managing-user-data#adding-and-retrieving-user-metadata
