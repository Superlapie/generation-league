# Pokémon Emerald Mechanics Parity Audit

Last audited: 2026-07-24

## Executive verdict

Generation League now has a credible, polished single-battle monster-RPG core, but it is **not yet mechanically one-to-one with Pokémon Emerald**. The strongest parity is in the basic creature loop: six-member parties, storage, wild and trainer battles, Gen III-style physical/special typing, stats, IVs/EVs, natures, abilities, held items, PP, capture checks, experience, move replacement, evolution, Shift/Set style, and persistent saves.

The largest remaining parity gaps are not small balance tweaks. They are whole Emerald systems: double and multi battles, the full 17-type/386-species content scale, complete move/status/ability/item behavior, breeding, TMs/HMs and field moves, contests and Pokéblocks, berry growth, PokéNav/Match Call, Secret Bases, multiplayer, and the seven-facility Battle Frontier.

This document targets **mechanical parity and comparable production quality while retaining Generation League's original world, creatures, writing, and visual identity**. It does not recommend copying Nintendo's copyrighted art, maps, names, dialogue, or audiovisual assets.

## Reference baseline

The parity baseline comes from these references:

- [Pokémon Emerald overview and Emerald-specific additions](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Emerald)
- [Generation III system overview](https://bulbapedia.bulbagarden.net/wiki/Generation_III)
- [Generation III individual values](https://bulbapedia.bulbagarden.net/wiki/Individual_values)
- [Effort values](https://bulbapedia.bulbagarden.net/wiki/Effort_values)
- [Double battles](https://bulbapedia.bulbagarden.net/wiki/Double_Battle)
- [PokéNav features](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9Nav)
- [Generation III Battle Frontier](https://bulbapedia.bulbagarden.net/wiki/Battle_Frontier_(Generation_III))
- [Generation III Battle Tower](https://bulbapedia.bulbagarden.net/wiki/Battle_Tower_(Generation_III))
- [Official Japanese Pokémon Emerald page](https://www.pokemon.co.jp/game/gba/emerald/?inc=gba)

## Current product scale

| Area | Generation League today | Emerald parity target | Status |
|---|---:|---:|---|
| Creature species | 32 original species | 386 obtainable/recognized species in Gen III scope | Major gap |
| Elemental types | 17 original types | 17 | Foundation complete; matchup breadth still needs fixture expansion |
| Moves | 35 | Full Gen III move roster and behavior | Major gap |
| Items | 9 core items | Full medicine, balls, battle, held, key, TM/HM, berry and mail systems | Major gap |
| World | 8 outdoor areas plus 14 interiors | Full region, optional areas and postgame | Original compact campaign |
| Major progression | 3 Crests and 3 Wardens | 8 Badges, Elite Four, Champion and postgame | Major gap |
| Battle format | Singles plus playable doubles trainers | Singles, doubles and multi battles | Multi battles and online formats remain |
| Postgame | Free roam and Warden rematches | Battle Frontier, expanded encounters and optional systems | Major gap |

## Detailed parity matrix

### Battle engine

| Mechanic | Status | Evidence / gap |
|---|---|---|
| Turn order, priority and Speed | Implemented | `src/rules.ts` resolves priority and Speed ordering. |
| Six battle stats | Implemented | HP, Attack, Defense, Sp. Atk, Sp. Def and Speed are calculated. |
| IV range | Implemented | Per-stat IVs use the Gen III 0–31 range. |
| EV limits | Implemented | Per-stat 255 and total 510 caps are represented. |
| EV awards | Implemented | Every participant receiving EXP now receives the defeated species' full EV yield, with Gen III per-stat/total caps and no level-100 EV gain. |
| Natures | Implemented | Stat-raising/lowering nature modifiers are applied. |
| Gen III physical/special split | Implemented | Damage category is determined by move type, matching pre-Gen IV behavior. |
| STAB, effectiveness, random damage and critical hits | Implemented | Core damage modifiers exist in `src/rules.ts`. |
| Accuracy/evasion and stat stages | Implemented | Stages use the standard -6 to +6 structure. |
| PP and Struggle | Implemented | Moves consume PP; Struggle is offered when every move is empty. |
| Switching and forced replacement | Implemented | Manual switching and faint replacement are supported. |
| Shift/Set battle style | Implemented | Both choices affect trainer-battle replacement flow. |
| Major status | Partial | Burn, poison, paralysis, sleep, freeze, confusion and escalating toxic poison now resolve; volatile states beyond confusion and complete immunity edge cases remain. |
| Weather | Partial | Custom field effects exist, but the full Gen III weather rules, move interactions, abilities and overworld persistence do not. |
| Abilities | Partial | A small ability trigger registry exists; full Gen III ability coverage and edge cases do not. |
| Held items | Partial | Equipping and several triggers exist; the complete held-item catalogue and interactions do not. |
| Move effects | Partial | Damage, healing, recoil, drain, multihit, Protect, status and stages exist. Full move-specific Gen III behavior does not. |
| Trainer AI | Partial | Functional action selection exists, but not Emerald's trainer classes, item use, switching heuristics and facility AI. |
| Double battles | Partial | Two active slots, target selection, spread damage, per-slot protection, partner/enemy actions, faint replacement and authored UI now run for multi-creature trainers. Item/switch menus and multi battles remain. |
| Multi/link battles | Missing | No partner trainers or network battle layer. |

### Capture, party and growth

| Mechanic | Status | Evidence / gap |
|---|---|---|
| Wild capture checks and shake feedback | Implemented | Capture returns shake count and caught state; the battle scene animates up to three shakes. |
| Ball modifiers | Partial | Capture items can provide modifiers, but Emerald's complete Ball-specific conditions are absent. |
| Party of six | Implemented | Party cap and party UI are enforced. |
| Storage | Implemented | 120-slot local storage with withdraw/swap behavior exists. |
| Experience and levels | Implemented | Growth curves and level cap 100 exist. |
| Four-move limit and replacement | Implemented | Level-up move learning offers a four-slot replacement decision. |
| Evolution animation and cancellation | Implemented | Level evolution can be cancelled with B. |
| Evolution methods | Partial | Level evolution exists. Stones, trades, friendship, beauty and other conditional methods do not. |
| Friendship value | Partial | Stored and displayed, but it is not a complete Emerald friendship system. |
| Gender | Partial | Gender is stored/displayed, but species ratios and gender-dependent mechanics are absent. |
| Nicknames | Partial | The model supports nicknames, but there is no post-capture naming flow or Name Rater equivalent. |
| Personality values, shininess and characteristic derivation | Missing | No Gen III personality-value pipeline. |
| Breeding and Eggs | Missing | No Day Care, Egg groups, inheritance, hatch cycles or Egg moves. |

### Items, moves and field systems

| Mechanic | Status | Evidence / gap |
|---|---|---|
| Bag pockets | Implemented | Recovery, capture, held and key pockets exist; empty speculative pockets are not shown. |
| Bag item actions | Implemented | Field items now use contextual Use/Give/Take/Toss/Cancel actions, target selection, toss quantities and scrolling lists. |
| Healing and status items | Partial | A compact usable subset exists; full Emerald inventory behavior does not. |
| Battle item targeting | Implemented | Recovery items can target a party member during battle. |
| Shops and money | Implemented | Purchases, stock gates and currency persistence exist. |
| TMs/HMs | Missing | No reusable/single-use teaching inventory or compatibility data. |
| Move Tutors | Missing | No tutor interaction or one-time tutor state. |
| Field moves | Missing | Cut, Rock Smash, Strength, Surf, Dive, Waterfall, Flash, Fly and their world permissions are absent. |
| Bikes | Missing | No Mach/Acro Bike movement or bike-gated terrain. |
| Fishing | Missing | No rods, fishing encounters or timing interaction. |
| Berry growth | Missing | No planting, watering, growth clock or harvesting. |
| Real-time clock events | Missing | No clock-based tides, berries, daily events or scheduled rematches. |

### World, progression and side systems

| Mechanic | Status | Evidence / gap |
|---|---|---|
| Tile movement, collision and warps | Implemented | Outdoor maps and furnished interiors are connected and validated. |
| Tall-grass encounters | Implemented | Weighted tables, level ranges and per-map encounter rates exist. |
| Trainer sight and battles | Implemented | Trainers can initiate battles and persist defeat state. |
| Ledges, signs, hidden items and dark caves | Implemented | Core overworld interactions are present. |
| Healing houses and shops | Implemented | Core town services exist. |
| Save resilience | Implemented | Manual save, backup and rotating recovery autosaves exist. |
| Regional guide | Partial | Seen/caught tracking and species pages exist, but Emerald's full Pokédex modes, sorting, habitat behavior and entry flow do not. |
| Main campaign | Original compact equivalent | Three Wardens and the League Spire form a coherent short campaign, not Emerald's eight-Gym League structure. |
| Rival and villain arcs | Missing | No Emerald-scale recurring rival, villain teams, legendary/weather plot or branching story events. |
| PokéNav | Missing | No region map, Condition, Match Call, rematch tracking or ribbon view. |
| Contests, condition and Pokéblocks | Missing | Entire contest stat, block-making and contest-round systems are absent. |
| Ribbons | Missing | No ribbon earning or display model. |
| Secret Bases and record mixing | Missing | No base decoration, trainer data exchange or records. |
| Safari Zone | Missing | No step/ball-limited capture mode or Safari encounter rules. |
| NPC trades and fossils | Missing | No trade flow, fossil choice or revival system. |
| Multiplayer trading/battling | Missing | The game is intentionally offline and local. |
| Battle Frontier | Missing | None of Emerald's seven facilities, Frontier Brains, Battle Points, symbols, rentals or facility rule sets are present. |

## UI and presentation parity

### Now production-ready

- Shared beveled panels, selection accents and tactile buttons are used across scenes.
- Desktop controls remain available but recede until hovered, focused or pressed; touch controls remain high-visibility.
- Party actions no longer collide with the persistent footer.
- Options show only behavior that is actually wired: battle animation, battle style, music, SFX and mute.
- Battle status panels expose names, levels, status, party state, HP bars and exact player HP.
- Capture, evolution, move replacement and trainer-shift decisions have dedicated presentation.
- The battle Bag and party target flow use dedicated full-screen layers with item artwork, descriptions, HP, ownership and contextual prompts.

### Still below Emerald-level presentation

- Front and back creature animation is limited to scene tweens rather than species-specific frame animation.
- Battle backgrounds do not vary by terrain, time or major encounter.
- There is no Pokédex registration ceremony, nickname prompt, item-acquisition card, badge case, map screen or Frontier presentation.
- Sound design is a compact CC0 set rather than a complete cue library.
- The game has no localization pipeline, rebinding screen, screen-reader narration, reduced-motion option or automated visual-regression suite.

## Recommended implementation order

1. **Complete battle correctness:** freeze, confusion, toxic counter, volatile states, full immunity handling, complete move/ability/item test matrix.
2. **Complete double battles:** spread-move semantics, item/switch menus, status parity and multi battles remain after the playable two-slot foundation.
3. **Build the teaching/field stack:** TMs, HMs, tutors, compatibility, field permissions, Surf/Fishing/Bikes.
4. **Complete creature lifecycle:** conditional evolutions, friendship events, personality/shiny values, breeding and Eggs.
5. **Build PokéNav and rematches:** map, trainer calls, rematch schedules and ribbon/condition records.
6. **Build contests, Pokéblocks and berries:** these systems depend on condition stats and time progression.
7. **Build Battle Frontier:** shared streak/reward foundation first, then seven distinct rule engines.
8. **Expand content only after systems stabilize:** more species, moves, items, trainers and areas should use the completed mechanics rather than creating more partial behavior.

## Acceptance standard for claiming parity

Do not call the game “Emerald-parity” until:

- every row above is implemented or deliberately declared out of scope;
- battle formulas and edge cases have deterministic fixture tests against documented Gen III outcomes;
- all battle formats and major side systems can be completed from a clean save;
- save migration covers every new persistent structure;
- keyboard, mouse/touch, desktop and mobile flows pass live visual and interaction QA;
- the game retains original art, names, maps, audio and story rather than shipping copied Pokémon content.
