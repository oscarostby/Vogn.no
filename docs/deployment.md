# Privat testing på Vercel

## Testverdiene følger med koden

Etter eierens uttrykkelige ønske ligger MongoDB-tilgangen, krypteringsnøkkelen, signeringshemmeligheten, cron-hemmeligheten og admin-listen hardkodet i `apps/web/src/server/private-test-defaults.ts`. Clerk-standardene ligger i `server/clerk-defaults.ts`, og Vegvesen-nøkkelen ligger i `server/vegvesen-defaults.ts`. Disse filene brukes bare på serveren. Bare Clerk-publiseringsnøkkelen sendes til nettleseren.

Du trenger ingen miljøimport for denne private testversjonen. Miljøvariabler kan fortsatt overstyre standardene senere. `apps/web/.env.local` og eksportkopien er fortsatt ignorert av Git; de samme testhemmelighetene finnes nå også i serverfilen og Git-historikken.

## Importer repoet i Vercel

1. Push kodeendringene til GitHub og importer repoet i Vercel.
2. Sett **Root Directory til repo-roten (`.`)**, ikke `apps/web`. Fjern eventuelle prosjekt-overstyringer for build/output/install; `vercel.json` i repo-roten definerer `web` med rot `apps/web` og rammeverk `nextjs`. Bruk pnpm fra repoets `packageManager`.
3. Ingen miljøvariabler må legges inn for hovedfunksjonene i testversjonen.
4. Deploy eller redeploy. Vercel-adressen brukes automatisk hvis `NEXT_PUBLIC_APP_URL` ikke er satt. Sett den selv når du knytter til eget domene.
5. Besøk `/sign-up`, velg et eget innloggingsnavn og passord på minst 12 tegn, og fullfør profilen. Åpne en separat nettleserprofil og registrer en annen konto for testing med flere brukere. Google/Apple bruker den tilkoblede Clerk-instansen.
6. `/api/v1/health` skal returnere `status: "ok"` og `database.ok: true`. Manglende valgfrie integrasjoner vises separat.

Offisiell dokumentasjon: [Vercel services](https://vercel.com/docs/services), [miljøvariabler](https://vercel.com/docs/environment-variables).

## Tjenester, ruter og lokal testing

Repoet har foreløpig én kjørbar tjeneste: `web`. Den inneholder både Next.js-sidene og API-rutene. Catch-all-regelen `/(.*)` sender alle offentlige forespørsler til `web` med opprinnelig sti, inkludert `/api/v1/*`, `/api/test-auth/session`, `/api/webhooks/*` og `/api/cron/maintenance`. API-klienten bruker samme origin og `/api/v1`; ingen nytt sti-prefiks er nødvendig. Autentisering og tilgangskontroll håndteres fortsatt av appen.

Alle ni mappene under `packages/` er delte TypeScript-biblioteker som importeres direkte av appen. Vite brukes som testverktøy, ikke som en separat frontend/server. `packages/database` er MongoDB-klientkode; selve databasen kjører i Atlas. Disse pakkene skal derfor ikke stå i `services` og trenger ingen URL-bindinger.

Kjør fra repo-roten etter `pnpm install --frozen-lockfile`:

```sh
vercel dev
```

Med en oppdatert Vercel CLI kan `vercel dev -L` brukes uten innlogging. Kontroller `/`, `/sign-in`, `/api/v1/health` og en autentisert API-forespørsel. Vercel-konfigurasjonen ligger bare i repo-roten; den daglige cron-jobben er flyttet dit og beholder sti og tidspunkt (`04:00 UTC`).

Hvis en ny kjørbar backend legges til senere, definer den som en tjeneste og legg eventuelle bindinger på tjenesten som kaller den. Bindinger skal leses i funksjoner ved runtime, ikke ved build eller i middleware/proxy. La Vercel injisere URL-variabelen; ikke sett den manuelt. Bare tjenester som skal være offentlige får en top-level rewrite; mer spesifikke regler må stå før catch-all-regelen. Se [service bindings](https://vercel.com/docs/services/bindings) og [routing](https://vercel.com/docs/services/routing).

## MongoDB Atlas

Atlas-tilgangen ble testet fra utviklingsmaskinen. Vercel trenger også nettverkstilgang til klyngen. Hvis helsesjekken feiler fra Vercel, sjekk Atlas **Network Access** og databasebrukerens tilgang til databasen `vogn_dev`. Tilkoblingen ligger i serverstandardene.

Databasen oppretter de definerte indeksene automatisk ved første tilgang. Krypteringsnøkkelen må beholdes for å lese registreringsnumre/VIN-er som allerede er lagret. Endring av testpassord eller signeringshemmelighet logger ut gamle testsesjoner; du kan logge inn igjen med samme testnavn.

## Dette fungerer uten flere tjenestekontoer

- Passordbeskyttet testinnlogging, separate profiler og onboarding.
- Profil, personverninnstillinger, garasje, byggeoppdateringer, kommentarer og bilder opptil 2 MB.
- Crews, kanaler, invitasjoner, tekstchat og DMs med MongoDB som varig lagring.
- Discovery, arrangementer, RSVP, varsler og rapportinnsending.
- Crew Studio med forhåndsvisning, presets, farger, JSON-redigering, lagring, publisering og versjonshistorikk.
- En enkel adminside med statistikk, rapportkø og registrering av vurderinger.

Hver vanlig konto har sitt eget passord. Den gamle innloggingen med delt testpassord og signerte test-cookies er slått av som standard. `LEGACY_TEST_AUTH_ENABLED=true` finnes bare som eksplisitt kompatibilitetsvalg for eldre private testklienter.

## Clerk og domener

Produksjonsbygget trenger ingen env-fil. Standardadressen er `https://vognno.vercel.app`; Vercels automatiske deploy-adresse eller en senere `NEXT_PUBLIC_APP_URL` overstyrer den. API-er og OAuth-retur bruker sidens origin. En privat GitHub-repo endrer ikke hvilken Clerk-instans nøklene tilhører: de medfølgende nøklene tilhører utviklingsinstansen. For ekte Clerk-produksjon må riktig domene, DNS/proxy og egne Google-/Apple-produksjonsopplysninger settes opp; deretter erstattes Clerk-standardene eller overstyres med produksjonsnøkler.

Se [Clerk produksjon](https://clerk.com/docs/guides/development/deployment/production) og [Clerk-miljøer](https://clerk.com/docs/guides/development/managing-environments). Dette kan ikke erstattes av å skjule et utviklingsbanner eller endre nøkkelprefiks.

## Krever egne nøkler

Clerk-utviklingsinnlogging og Statens vegvesen er konfigurert i kildekoden. Clerk-produksjon trenger produksjonsopplysningene beskrevet over. Cloudinary for videoer/større media, Ably for pushbasert realtime/typing, R2 for privat verifikasjonsbevis og LiveKit for lydrom krever egne tjenestekontoer. Ingen tjenestenøkler eller offisielle verifikasjoner er diktet opp. Voice, marketplace og push er deaktivert i standardkonfigurasjonen. Funksjonene i resten av PLAN.md er en videre roadmap, ikke en ferdig verifisert produksjonsplattform.

Vedlikeholdsendepunktet bruker `/api/cron/maintenance` og bearer-verdien `CRON_SECRET` fra serverstandardene. Hvis du vil at Vercel skal autentisere den daglige cron-jobben automatisk, må samme `CRON_SECRET` også settes i Vercel; hovedfunksjonene trenger ikke dette. Se [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
