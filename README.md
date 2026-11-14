# Rai Lanna (ไร่ล้านนา)

**English** · [ภาษาไทย](README.th.md)

A 2D farm-life game set in northern Thailand that runs in the web browser, built with Phaser 4, TypeScript and Vite.
Grow vegetables, keep an orchard, fish, mine, raise animals, sell at the market and join the village festivals.
It is our own game in the classic farming genre, with Lanna art and atmosphere.

The game is in English by default and can be switched to Thai at any time.

<p align="center">
  <img src="docs/readme/farm.webp" alt="Rai Lanna Farm: the cottage, the vegetable field and the pond" width="100%">
</p>

> Status: in development. The main systems are playable from end to end (see "Roadmap" for what is still open).
> Every picture on this page is taken from the real game. Some were staged first (crops already planted, animals already bought) so one picture can show a whole system.

## Getting started

You need [Node.js](https://nodejs.org) and npm (tested with Node 26).

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs the game-rule tests (Vitest) |
| `npm run typecheck` | Checks types with TypeScript |
| `npm run build` | Checks types, then builds the files to publish into `dist` |
| `npm run preview` | Serves the built files |

To try it on a phone on the same network, run `npm run dev -- --host` and open your computer's IP address on the phone.

### Language

Open **Settings** (the gear at the top) and press the **Language · ภาษา** button. The farm is saved and the game reloads in the other language.
The choice is remembered by the browser.

## How to play

<p align="center">
  <img src="docs/readme/howto.webp" alt="The game screen with numbered parts" width="100%">
</p>

| No. | What it is | How to use it |
|:-:|---|---|
| 1 | Main menu | Travel map · farm · farm journal · bag · calendar · outfits and pets |
| 2 | To-do card | Suggests the next job. Press it to open the farm journal |
| 3 | Day, season, time, money, energy | Every job costs energy. If it runs out you fall ill and wake up in the clinic |
| 4 | Tool belt | Press 1–7 or click to choose a tool |
| 5 | Field | Click a soil tile and the farmer walks over to use the tool: hoe tills, seed bag plants, can waters, hand harvests |
| 6 | Villagers and signposts | Click them, or walk up and press E, to talk, shop or take a job |
| 7 | Pond | Choose the rod (5), walk to the water and press Space. Press again when a fish bites and the needle is in the green band |
| 8 | Your farmer | Walk with WASD or the arrow keys, or click a path |
| 9 | How to play | Press H for the in-game guide |

### Keys

| Key | What it does |
|---|---|
| WASD or arrows | Walk |
| Space | Use the tool on the tile in front of you (or cast and reel in) |
| 1 hoe · 2 watering can · 3 harvest hand · 4 seed bag · 5 rod · 6 axe · 7 pickaxe | Choose a tool |
| Q | Switch the seed in the bag |
| E | Interact with the place or person nearby |
| M · I · J · C · H | Travel map · bag · farm journal · calendar · how to play |
| F2 | Start a new game (press Y to confirm) |
| Esc | Close a window, or put the rod away |

### One day

1. Wake up, look at the weather for today and tomorrow, and read the morning report (what sold, what grew, festival news).
2. Work: till, plant, water, harvest, fish, mine, look after the orchard and the animals.
3. Put what you want to sell in the shipping crate (paid next morning), or sell it yourself at your stall in the fresh market.
4. Visit the village and the market for seeds, tools, food and villagers' requests.
5. Go into the cottage and sleep in the bed before your energy runs out. The game saves every morning.

One day (06:00–24:00) lasts about 10 real minutes. If you are still up at bedtime you collapse and pay a clinic fee.
A higher level lets you stay up later and gives you more energy.

### Getting around

Every place is its own painted map. Walk off the edge along a road, or through a doorway, and you arrive on the matching road of the next map.
The travel map (M) walks you there automatically, through each place on the way.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/travel.webp" alt="The travel map with a route to each place"></td>
    <td width="50%"><img src="docs/readme/village.webp" alt="Wiang Kham Village with signposts to every neighbouring place"></td>
  </tr>
  <tr>
    <td align="center">Travel map</td>
    <td align="center">Wiang Kham Village: signposts point to each road and door</td>
  </tr>
</table>

### On a phone

The game takes touch (tap the ground to walk, tap a sign to use it) and every button is on screen, so no keyboard is needed.
The scene scrolls sideways with a finger. The pictures below come from the browser's phone-screen mode (390 pixels wide); it has not been
play-tested by touch on a real phone yet, and it cannot be installed as an app (browser only).

<p align="center">
  <img src="docs/readme/phoneFarm.webp" alt="The game on a tall phone screen" width="260">
  &nbsp;&nbsp;
  <img src="docs/readme/phoneBag.webp" alt="The bag window on a phone" width="260">
</p>

## What is in the game

### Farm, crops and weather

- **29 crops.** Grow them in the field by the cottage and water them every day. Seeds are sold at the seed shop in Wiang Kham Market; price and growing time differ by crop.
- **4 seasons.** Summer → autumn → winter → spring, 14 days each (56 days a year). Crops that cannot stand the new season wither, and the game warns you 3 days ahead.
- **5 kinds of weather.** Sunny, rain, heatwave, storm and snow, always with a forecast for tomorrow. Rain waters the field for you, a storm can wilt plants and a heatwave makes every job more tiring.
- **Day and night.** The sky darkens with the clock and the lamps you have placed light up after dark.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/night.webp" alt="The farm at night with the cottage lamp lit"></td>
    <td width="50%"><img src="docs/readme/bag.webp" alt="The bag: seeds, produce, fish and village goods"></td>
  </tr>
  <tr>
    <td align="center">Night on the farm</td>
    <td align="center">The bag: seeds, produce, fish, wild food</td>
  </tr>
</table>

### Fishing

34 fish (20 freshwater, 14 saltwater) that appear by season, time of day, weather and water. There are three places to fish: the farm pond,
Bua Kaew Lake and Pearl Bay Beach. Fishing is seen through your own eyes: wait for the bite, then press when the needle is inside the green band.
Each fish has a wider or narrower band, a better rod widens it, four kinds of bait raise the odds of rare fish, and Luck helps too.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/lake.webp" alt="Bua Kaew Lake with its jetty, waterfall and lotus"></td>
    <td width="50%"><img src="docs/readme/fishing.webp" alt="Holding up a snakehead that was just caught"></td>
  </tr>
  <tr>
    <td align="center">Bua Kaew Lake</td>
    <td align="center">Caught one</td>
  </tr>
</table>

### Orchard and fruit jam

- 6 plots west of the farm and 4 kinds of tree: banana, mango, longan and tangerine. Clear the wood and rocks from a plot, plant a sapling, water it until it is grown, and it fruits in its own seasons in rounds.
- Manure gives extra fruit. A storm knocks down half of what is hanging, so pick before it comes. A tree you no longer want can be felled.
- Fruit can be sold, or made into jam at the stove in the dining room (the house has to be extended first): 2 fruit make 1 jar overnight, worth as much as 3 fruit.

<p align="center">
  <img src="docs/readme/orchardMap.webp" alt="The orchard with grown trees and a sapling" width="80%">
</p>

### Mining, levels and tools

- **Star Stone Cave.** Each vein may or may not be there on a given day and is spent once mined. 5 ores (copper, iron, silver, gold, star crystal), dug with the pickaxe, with a bonus ore of the next kind depending on Luck.
- **Frontier Meadow.** Open new farmland by clearing grass, trees and rocks, then till and plant it. Later plots need better tools.
- **Levels and stats.** Work earns XP. Each level gives points for Strength, Stamina and Luck, more energy and a later bedtime.
- **Blacksmith.** Trade ore to upgrade the hoe, axe and pickaxe, and buy lamps to place along the paths.
- **Village quests.** Rewards for clearing land, mining and fishing.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/mine.webp" alt="Star Stone Cave with its cart track and ore veins"></td>
    <td width="50%"><img src="docs/readme/journal.webp" alt="The farm journal: level, XP, stat points and quests"></td>
  </tr>
  <tr>
    <td align="center">Star Stone Cave</td>
    <td align="center">Farm journal: level and stats</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/readme/meadow.webp" alt="Frontier Meadow covered in grass, stumps and rocks"></td>
    <td width="50%"><img src="docs/readme/coast.webp" alt="Pearl Bay Beach with its pier and fishing boats"></td>
  </tr>
  <tr>
    <td align="center">Frontier Meadow, waiting to be cleared</td>
    <td align="center">Pearl Bay Beach</td>
  </tr>
</table>

### Ranch animals

Hens, ducks, cows and sheep live at the Livestock Ranch. Buy animals, feed each one a portion a day, and the produce (eggs, milk, wool) is in your bag next morning.
You can also have a chicken coop built on your own farm.

<p align="center">
  <img src="docs/readme/ranch.webp" alt="The Livestock Ranch with cows, ducks and the ranch shop" width="80%">
</p>

### Village, markets and neighbours

- **Wiang Kham Village.** Mali and Uncle Chai have friendship levels, take gifts and have a daily request. Uncle Chai also sells new farm plots, extends the house as you level up and builds the chicken coop.
- **Villagers on the move.** 22 named residents walk their own daily routes, some of them along the roads between maps. Walk up and press E to say hello. During a festival they all gather in the village square.
- **Notice board.** Take one delivery job a day (vegetables for Mali's kitchen or fruit for Uncle Chai) for money and friendship.
- **Wiang Kham Market.** The seed shop, a food stall, the blacksmith and a trader who buys your goods.
- **Growers' Fresh Market.** Open your own stall (07:00–18:00): choose an item, a quantity and a price. Customers buy according to their budget, the money comes at once, and festival days bring more of them.
- **Wiang Kham Clinic.** Where you recover when your energy runs out, for a fee of ฿60.
- **Sweetleaf Glade and Bamboo Forest.** Gather fiddlehead ferns, wild mulberries and wild bananas in the glade (they grow back in a few days), and herbs and bamboo in the forest.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/market.webp" alt="Wiang Kham Market: food stall, seed shop and blacksmith"></td>
    <td width="50%"><img src="docs/readme/stall.webp" alt="Setting an item, quantity and price at your own stall"></td>
  </tr>
  <tr>
    <td align="center">Wiang Kham Market</td>
    <td align="center">Your own stall in the fresh market</td>
  </tr>
</table>

<p align="center">
  <img src="docs/readme/noticeboard.webp" alt="The notice board with requests from Mali and Uncle Chai" width="80%">
</p>

### Seven festivals a year

Each festival can be joined only on its day and during its hours, and a storm cancels it. Every festival raises friendship with all the neighbours.
The morning report announces a festival 2 days ahead with what to bring, and the calendar (C) shows the whole year.

| Festival | Day | Hours | What you get |
|---|---|---|---|
| Songkran, Lanna New Year | Summer, day 6 | 09:00–18:00 | Energy +25 |
| Rocket Festival | Summer, day 12 | 10:00–18:00 | Costs 3 wood; tomorrow's forecast becomes rain |
| Seed Swap Fair | Autumn, day 2 | 08:00–16:00 | 3 packs of cucumber seeds |
| Longboat Race | Autumn, day 11 | 10:00–18:00 | Costs 30 energy; win (50% chance) ฿200, lose ฿40 |
| Yi Peng Lantern Night | Winter, day 3 | 17:00–23:00 | Lantern fee ฿30; the neighbours are very impressed |
| New Rice Offering & Crop Contest | Winter, day 10 | 09:00–17:00 | The dearest item in your bag wins 4× its price |
| Blossom Fair | Spring, day 5 | 08:00–18:00 | 4 packs of lettuce seeds |

<table>
  <tr>
    <td width="50%"><img src="docs/readme/festival.webp" alt="The festival window on Songkran day"></td>
    <td width="50%"><img src="docs/readme/calendar.webp" alt="The calendar with festival days marked"></td>
  </tr>
  <tr>
    <td align="center">Festival day</td>
    <td align="center">Calendar</td>
  </tr>
</table>

### Outfits and pets

Three outfits to wear, and one dog or cat to adopt. Pet it once a day, and choose whether it walks with you or waits at home.

<p align="center">
  <img src="docs/readme/style.webp" alt="The outfits and pets window" width="80%">
</p>

### Autosave

The game saves into the browser (localStorage) every new morning, and older saves are upgraded to the current format automatically.
If you close the game in the middle of a day, that day's work is lost, so go to bed first.

## Roadmap

1. ~~The daily loop~~
2. ~~Calendar, seasons and weather~~ (4 seasons, with snow)
3. ~~Fishing~~ (first-person view, bait)
4. ~~Rice paddy~~ removed; land expansion and the Frontier Meadow replace it
5. ~~Orchard~~ (with fruit jam)
6. ~~Animals~~ (hens, ducks, cows, sheep)
7. ~~Village, neighbours, festivals~~ (with the fresh-market stall and the calendar)
8. ~~Mining, levels, tools and wild food~~
9. ~~English and Thai~~
10. Lanna art and sound: mostly done

Still to do

- Seasonal scenery (the farm uses one picture in every season)
- Play-testing on a real phone, and installing to the home screen as an app (PWA)

## About the `.claude/skills` folder

These are 17 game-development skills chosen from
[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
for Claude Code to use while developing this game. They play no part when the game runs. They are under the Apache-2.0 licence
(`LICENSE` and `NOTICE` are in that folder) and can be deleted without affecting the game.

## Licence

No licence has been chosen for the game itself yet.
