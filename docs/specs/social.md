# Finding each other

Status: built (Find panel, deep links, friends). Provisional like everything in DESIGN.md.

## 1. Find

- Open it with `/` on desktop, the search icon in the top bar, or **Find a ruler or city** in the phone menu.
- Search by part of a name (two letters or more). Rulers come first, then cities. In each list, exact names come first, then names that start with the search, then names that contain it.
- Bots and the wilds never appear.
- Each result shows how far it is from your nearest king, as squares and a compass direction (for example "1.7k squares east").
  - **Go** flies the camera there.
  - **Link** copies a shareable link.
  - **Add** makes the ruler a friend.
- A ruler is shown with up to four of their biggest cities. A ruler with no town yet is placed at their kings.
- **Friends** are kept in this browser (`owc.friends`, up to 50). They are listed whenever the search box is empty, and their whereabouts refresh each time Find opens.
- Server: `GET /api/find?q=` (`apps/server/src/directory.ts`).
  - The city index is rebuilt at most once a minute.
  - Each IP gets one search per 250 ms.
  - Only public information is returned: names and city positions, which anyone can already see on the map.

## 2. Deep links

| Link | Goes to |
| --- | --- |
| `openworldchess.com/?city=Rookbridge&at=x,y` | The spot given by `at`. Names can repeat, so the spot decides. |
| `?city=Name` | The best match for that city name. |
| `?player=Name` | That ruler's biggest city, or their kings. |
| `?at=x,y` | That square. |

- The Herald's city posts use the `?city=...&at=...` form.
- **Players** (a saved token): the camera flies there and a toast explains how to get home. The link is then removed from the address bar, so a reload goes home as usual.
- **Visitors** (no account): they watch without an empire, with a bar at the bottom: "Visiting {city} · **Play free**". Play free opens the usual name screen. The rest of the HUD is hidden.
