# Zagreb Fina Kava (ZFK)

Web-stranica za ponudu Lavazza BLUE aparata i kapsula za dom, apartman i ured.

## Projekt

- Repozitorij: https://github.com/Jops2103/zagrebfinakava
- Produkcijska stranica: https://zagrebfinakava.pages.dev/
- Glavna grana za objavu: `main` (Cloudflare Pages)

## Glavne datoteke

- `index.html` — javna stranica i obrasci za nove i postojeće korisnike
- `styles.css` — izgled stranice i prilagodba mobilnim uređajima
- `script.js` — ponašanje stranice i obrazaca
- `admin.html` — administratorsko sučelje
- `privatnost.html` — obavijest o privatnosti
- `machine-lightbox.js` i `machine-selection-scroll.js` — prikaz i odabir aparata
- `kapsule/` — pojedinačne stranice kapsula
- `supabase/` — konfiguracija i migracije baze
- `.github/workflows/` — automatizacije, uključujući sigurnosne kopije

## Održavanje

Prije objave provjerite promjene u Preview okruženju. Promjene obrazaca, sigurnosne provjere Turnstile, administratorske prijave, Supabase baze i sigurnosnih kopija zahtijevaju zasebno funkcionalno testiranje.

Ovaj README opisuje strukturu projekta; poslovne cijene i minimalne količine provjeravaju se u aktualnoj ponudi i ugovornoj dokumentaciji.
