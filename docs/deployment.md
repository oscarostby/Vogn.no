# Privat testing på Vercel

## Testverdiene følger med koden

Etter eierens uttrykkelige ønske ligger MongoDB-tilgangen, testpassordet, krypteringsnøkkelen, signeringshemmeligheten, cron-hemmeligheten og admin-listen hardkodet i `apps/web/src/server/private-test-defaults.ts`. Filen brukes bare på serveren. Testinnloggingen bruker `TEST_AUTH_PASSWORD`, et annet passord enn MongoDB-passordet.

Du trenger ingen miljøimport for denne private testversjonen. Miljøvariabler kan fortsatt overstyre standardene senere. `apps/web/.env.local` og eksportkopien er fortsatt ignorert av Git; de samme testhemmelighetene finnes nå også i serverfilen og Git-historikken.

## Importer repoet i Vercel

1. Push kodeendringene til GitHub og importer repoet i Vercel.
2. Velg **Next.js**, **Root Directory: `apps/web`**. Tillat filer utenfor rotmappen (workspace-pakkene ligger i `packages/`). Bruk standard Next.js build/output og pnpm fra repoets `packageManager`.
3. Ingen miljøvariabler må legges inn for hovedfunksjonene i testversjonen.
4. Deploy eller redeploy. Vercel-adressen brukes automatisk hvis `NEXT_PUBLIC_APP_URL` ikke er satt. Sett den selv når du knytter til eget domene.
5. Besøk `/sign-in`. Bruk testnavnet `oscar` og `TEST_AUTH_PASSWORD`. Dette testnavnet er klargjort med admin-tilgang. Fullfør onboarding. Åpne en separat nettleserprofil og logg inn med et annet navn for å teste en vanlig konto.
6. `/api/v1/health` skal returnere `status: "ok"` og `database.ok: true`. Manglende valgfrie integrasjoner vises separat.

Offisiell dokumentasjon: [Vercel monorepos](https://vercel.com/docs/monorepos), [miljøvariabler](https://vercel.com/docs/environment-variables).

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

Alle inviterte testere deler adgangspassordet. Et kjent testnavn kan derfor brukes av enhver som har dette passordet. Ikke bruk denne innloggingen til offentlig lansering.

## Krever egne nøkler

Clerk for vanlig innlogging, Cloudinary for videoer/større media, Ably for pushbasert realtime/typing, R2 for privat verifikasjonsbevis, Statens vegvesen for offisielt kjøretøyoppslag og LiveKit for lydrom. Ingen tjenestenøkler eller offisielle verifikasjoner er diktet opp. Voice, marketplace og push er deaktivert i den lokale testkonfigurasjonen. Funksjonene i resten av PLAN.md er en videre roadmap, ikke en ferdig verifisert produksjonsplattform.

Vedlikeholdsendepunktet bruker `/api/cron/maintenance` og bearer-verdien `CRON_SECRET` fra serverstandardene. Hvis du vil at Vercel skal autentisere den daglige cron-jobben automatisk, må samme `CRON_SECRET` også settes i Vercel; hovedfunksjonene trenger ikke dette. Se [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
