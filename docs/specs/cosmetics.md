# Cosmetics Spec: Civilizations and Crowns

**Decided:** the first thing for sale is how your empire **looks**. A cosmetic civilization restyles every piece and building you own, and everyone who visits your lands sees it. Nothing for sale changes how the game plays.

## 1. Civilizations

Four at launch, each researched from real architecture and dress, and drawn in the game's style (thick ink outlines, flat fills, stoic faces). Every chess role stays instantly readable. Art lives in `art/assets/civ-<id>.mjs`; each file exports `PIECES` and `BUILDINGS` with the same signatures and footprints as the base art, so a civilization drops in anywhere.

| Civilization | Palace | Temple | Barracks | House | Stable | Pieces |
|---|---|---|---|---|---|---|
| **Dravidian** | Painted gopuram between towers, pillared halls | Brihadeeswarar-style granite vimana | Gingee-style hill fort with a gate gopuram | Chettinad house, tiled roof, veranda | Pillared stable, brass bell | Chola crowns; queen with jasmine and temple jewelry; war elephant in gold nettipattam; sage with tripundra; plumed horse; soldiers with vel spears |
| **Roman** | Pantheon dome and portico, eagle standards | Maison Carrée | Porta Nigra–style gate, legion's eagle | Domus with terracotta roof | Travertine arcade | Laurel crowns (the Emperor's in gold); empress with diadem; war elephant with a siege tower; pontifex with lituus; cavalry horse in a parade mask; legionaries |
| **Chinese** | Hall of Supreme Harmony | Five-storey pagoda | Great Wall gate tower | Siheyuan gate, red doors, lanterns | Moon-gate stable | Mianguan crown (the Emperor in a dragon robe); phoenix crown; elephant with a pagoda howdah; Daoist sage; Tang horse; soldiers with ji halberds |
| **Egyptian** | Pylon gateway with obelisks and flag masts | Temple pylon, winged sun disk | Buhen-style fortress | Mudbrick house with a wind catcher | Chariot stable | Pharaoh in nemes or pschent (the Emperor with crook and flail); queen with a vulture crown; pylon-towered elephant; priest with an ankh; plumed chariot horse; soldiers with khopesh |

- **Wearing it:** a civilization is stored per account (`PlayerRec.civs` owned, `civ` in use) and broadcast in the player list, so every client draws that player's pieces, buildings and battle pieces in it. Team colors still show, on sashes, banners and plumes.
- **Switching** between owned civilizations, or back to Classic, is free and instant.

## 2. Crowns (the shop currency)

Civilizations cost **500 Crowns**. Crowns come in packs through Stripe:

| Pack | Price | |
|---|---|---|
| 500 Crowns | $4.99 | exactly one civilization |
| 1,100 Crowns | $9.99 | +10% |
| 2,400 Crowns | $19.99 | +20%, enough for all four civilizations with 400 left over |

**Why a currency:** the shop shows prices in Crowns ("500") rather than dollars, and unlocking with Crowns you already have is one tap inside the game. Money only comes up at one clear moment: choosing a pack.

**Purchase flow,** designed to be low-pressure until the payment page:
1. **Menu → coin button → Civilizations.** Every card previews *your* empire (your color) in that style.
2. **Tap "500".**
   - If you have the Crowns, an inline "Unlock for 500" confirmation appears.
   - If you don't, the **Get Crowns** step opens and says how many you're short.
3. **Pick a pack.** Only now does the page leave the game, for **Stripe Checkout**. That's Stripe's own secure page, with Apple Pay, Google Pay, Link and cards; the game never sees card details. Each pack shows its coin-pile image (`/img/crowns-N.png`, made by `node art/stripe-images.mjs`).
4. **Back in the game** (`/?shop=success`), the shop reopens. The Crowns arrive with Stripe's webhook, usually within seconds, with an alert: "500 Crowns added. Thank you!"

**Accounts:** buying needs a Google sign-in. Guest empires fall when their player leaves, and purchases must never fall with them. The shop asks guests to sign in first.

## 3. Server

`apps/server/src/shop.ts` uses no Stripe SDK: one REST call and a signature check.
- **`shop.checkout {pack}`** (over the game socket, so it's already authenticated) creates a Checkout Session.
  - The session carries the price, the pack's image, the player's email, and the metadata `playerId` and `pack`.
  - Payment methods are left to the Stripe dashboard (dynamic payment methods), so wallets appear automatically when they're enabled there.
  - The server replies with `shop.url`, and the client goes there.
- **`POST /stripe/webhook`:**
  - It verifies `Stripe-Signature` (HMAC-SHA256 of `t.payload`, constant-time compare, 5-minute tolerance).
  - On `checkout.session.completed` (or `async_payment_succeeded`) with `payment_status: paid`, it credits the pack. This happens **once per session id** (`PlayerRec.receipts`), so Stripe's retries are harmless.
- **`civ.buy {civ}`** spends Crowns and equips. Buying one you already own is a no-op, never a double charge. **`civ.equip {civ|null}`** switches the look.
- **`/shop/config`** reports whether the shop is open. It's open only when both Stripe keys are set.

## 4. Setup (production)

1. **Keys:** in the Stripe dashboard, get the secret key (`sk_live_…`; use `sk_test_…` first to try it end to end).
2. **Webhook:** Developers → Webhooks → add the endpoint `https://openworldchess.com/stripe/webhook` with the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret (`whsec_…`).
3. **Wallets:** Settings → Payment methods: turn on **Apple Pay** and **Google Pay**, and Link if you like. Checkout needs no domain verification for wallets.
4. **Server env:** on the server, add both keys to `/etc/owc/env`:
   ```
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```
   Then `sudo systemctl restart owc-server`. Until both are set, the shop shows "opens soon" and nothing can be charged.
5. **Check it:** buy a pack in test mode with card `4242 4242 4242 4242`; the Crowns should arrive within seconds.
6. **Refunds and disputes** are handled in the Stripe dashboard. To take back Crowns after a refund, edit the player record (`crowns`), for now.

## 5. The showcase

Now and then, one civilization appears in a corner card with the player's own empire already wearing it (palace, temple and four pieces in their color), a line of invitation, and **Take a look**, which opens the shop scrolled to that civilization and makes its card glow (`apps/client/src/ui/CivShowcase.tsx`).

- **Rarely:** first after 20 minutes of active play (tab visible), then at most every 45 minutes. It never appears during a battle or onboarding, with a sheet or card open, or once the player owns every civilization. Closing it just lets it go until next time.
- **One at a time,** rotating, and skipping ones the player owns. A civilization marked `isNew` in `CIVS` is shown first, once. So future civilizations get their moment automatically: add art, add a `CIVS` entry with a `pitch`, and set `isNew`.
- **Checking it:** `?showcase` in the URL shows one right away.
