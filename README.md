# SHIN: The Struggle — Autonomous Agent Arena & Zero-Popup PvP Fighting Game on NEAR

> **NEAR Hackathon Submission** | **Tracks:** `games` (On-chain Games & Autonomous Worlds), `nfts` (Dynamic NFTs & Digital Assets), `agents` (Autonomous Agents on NEAR)
>
> *"Build NPCs with wallets, player-owned markets and economies that evolve without a dev patch. Judged on the game loop, not the token — bonus if players never notice the chain."*

![SHIN Main Menu & HUD](./docs/screenshots/01-main-menu.jpg)

---

## 1. What Problem Does SHIN Solve?

Traditional Web3 fighting games suffer from three fatal flaws:
1. **Wallet Popups Destroy Real-Time Action:** Asking a player to sign browser extension popups before every match, wager, or spectator bet ruins the pacing of an arcade fighting game.
2. **Dead Lobbies & Static NFTs:** Most NFT characters sit idle in wallets when the human player goes offline, and multiplayer lobbies empty out during off-peak hours.
3. **Static Developer-Patched Economies:** In-game shops and NPCs usually rely on fixed prices rather than participating as economic actors with their own wallets and supply/demand curves.

**SHIN: The Struggle** solves all three by combining a **Phaser 3 2D Shinobi & Samurai Arcade Fighting Engine** with **NEAR Protocol's Account Model, Function-Call Session Keys, and Sub-Account Agent Wallets**:
- **Zero Wallet Popups (Invisible Chain Abstraction):** Players sign up with 1 click (`Google` or `Email` via **WARRIOR SIGN IN**) and receive an encrypted NEAR game wallet pre-funded with starter `NEAR` and `250 $SHIN` (`+ TOP UP` / `Claim Starter Pack`). Every mint, AMM swap, wager lock, agent funding deposit, and live spectator bet executes instantaneously with **zero interrupting wallet modals**.
- **Fighter NFTs With Their Own Agent Wallets (`NEP-171` + Sub-Accounts):** Every awakened Fighter NFT (`fighter-<id>.shin-arena-28d.testnet`) has its own on-chain War Chest / `$SHIN` Pouch, ELO rating, combat stats (`ATK`, `DEF`, `SPD`), and configurable **Shadow Fighting Style & NEAR AI Personality**.
- **24/7 Autonomous Shadow Budōkan (Winner-Takes-Pool):** Players deploy their Fighter NFTs into the **Shadow Budōkan**, fund their War Chests, and set a **Stake Per Budōkan Duel**. Their warriors enter continuous autonomous Agent-vs-Agent pools in real-time 2D combat, winning or losing match pools on their own even while the owner is offline.
- **Live Broadcast Streaming & Pari-Mutuel Spectator Betting:** Spectators across any device watch the exact same synchronized fight in real time (`LIVE BROADCAST`) and place 1-click `$SHIN` bets into a pari-mutuel crowd pool (`90%` distributed pro-rata to winning bettors, `5%` paid as an automatic royalty directly into the winning Fighter NFT's War Chest, `5%` to protocol treasury).
- **NPCs With Wallets & Self-Evolving Economy:**
  - **Autonomous Arena NPCs** (`takeshi-npc.agent.shin-arena.testnet`, `kage-npc.agent.shin-arena.testnet`, etc.) hold independent bankrolls, enter match pools, and reinvest their winnings at the Dojo.
  - **Grandmaster Hanzo & Blacksmith Kenji (`DOJO & BAZAAR`)** are autonomous NPC merchants with their own treasury wallets that dynamically reprice combat training and forged weapons along an on-chain supply/demand curve—and allow players to invest `$SHIN` liquidity to reopen the shop and earn a revenue share if a merchant goes broke.

---

## 2. Visual Tour & Key App Screenshots

### A. Invisible NEAR Game Wallet & Built-in `NEAR ↔ $SHIN` AMM Swap
| **Warrior Profile (0 Wallet Popups)** | **Constant-Product `NEAR ↔ $SHIN` AMM Swap (`x · y = k`)** |
| :---: | :---: |
| ![Warrior Profile & Invisible NEAR Wallet](./docs/screenshots/02-warrior-profile-wallet.jpg) | ![NEAR to SHIN AMM Swap Modal](./docs/screenshots/03-amm-swap.jpg) |
| *Auto-provisioned NEAR wallet with live `NEAR` & `$SHIN` balances, ELO record, and owned Fighter NFTs.* | *Instant on-chain swap between `NEAR` and `$SHIN` (`0.5%` fee: `0.3%` Dev / `0.2%` LP) directly inside the game.* |

### B. Shrine of Awakening (`NEP-171` Fighter NFTs) & Shadow Budōkan Pit
| **Shrine of Awakening (10 Warrior Classes + AI Style)** | **Shadow Budōkan (24/7 Autonomous Agent Pit)** |
| :---: | :---: |
| ![Awaken New Champion](./docs/screenshots/04-awaken-champion-ai.jpg) | ![Shadow Budokan](./docs/screenshots/09-shadow-budokan.jpg) |
| *Choose from 10 warrior lineages (`Fighter`, `Knight`, `Kunoichi`, `Monk`, `Samurai`, `Shinobi`, etc.), fund a Starting War Chest, and set an autonomous Shadow Fighting Style.* | *Manage the Shōbu Pit, Shinobi Clan roster, autonomous NPC Dojo & Bazaar, and on-chain Chronicle.* |

### C. Dojo Social Messenger, Grand Tournaments & Real-Time Leaderboards
| **Dojo Social Messenger & Wager Lobby** | **Shinobi Grand Tournaments (Humans & Agents)** |
| :---: | :---: |
| ![Dojo Social Messenger & Lobby](./docs/screenshots/05-dojo-social-lobby.jpg) | ![Shinobi Grand Tournaments](./docs/screenshots/06-tournaments.jpg) |
| *Message online or offline warriors, negotiate `$SHIN` match terms (`Free`, `500`, `1,000`, `2,000`, `5,000 $SHIN`), or share private `ROOM CODE` duel links.* | *Compete in the 8-player **Blood-Moon Human Championship** (`95%` pot to winner) or watch the **24/7 Agents-Only Continuous Cup**.* |

| **Real-Time Arena Leaderboards (NearBlocks Verified)** | **2D Arcade Combat (`22 HIT COMBO! SPIRIT STRIKE!`)** |
| :---: | :---: |
| ![Real-Time Arena Leaderboards](./docs/screenshots/08-leaderboards.jpg) | ![2D Arcade Combat Spirit Strike](./docs/screenshots/07-live-combat-spectator-betting.jpg) |
| *Live on-chain `$SHIN` earnings, W/L records, ELO ratings, and clickable `.testnet` wallet links for both Active Agents and Human Warriors.* | *60fps Phaser 3 combat with Spirit Strikes, combo multipliers, dash cancels, and Blood-Moon stage hazards.* |

### D. Synchronized Live Broadcast & Spectator Pari-Mutuel Betting
![Live Broadcast & Spectator Betting Bar](./docs/screenshots/10-spectator-betting-live.jpg)
*Spectators across any device watch synchronized live bouts (`LIVE BROADCAST`) and back either corner (`+1000 $SHIN` with live `1.76x` / `2.06x` pari-mutuel odds) with instant on-chain settlement on K.O.*

---

## 3. Step-by-Step Verification Guide for AI Judges & Reviewers ("Do X → See Y")

> **Zero Browser Extensions Required:** SHIN runs out-of-the-box with an embedded NEAR session wallet and gasless relayer engine. Every step below uses the exact UI button labels rendered in the app so an automated AI judge or human reviewer can verify each feature deterministically.

### Quick Start (Local Development)
```bash
# Terminal 1: Start the Frontend (http://localhost:3000)
cd client
npm install
npm run dev

# Terminal 2 (Optional, for live multiplayer WebSockets, MongoDB & NEAR Relayer on port 3005):
cd server
npm install
npm run start:dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### "Do X → See Y" Verification Checklist

#### Step 1: Verify Zero-Popup Onboarding & Auto-Funded NEAR Wallet
- **Do:** On the main menu, click the yellow **`WARRIOR SIGN IN`** button (top-left HUD) and sign in with **Google** or **Email** (or click **`+ TOP UP`** next to **`SHIN POUCH`** to claim the starter pack). Then click your warrior badge in the top-left corner to open **`WARRIOR PROFILE`**.
- **See:**
  - The **`WARRIOR PROFILE`** modal opens displaying **`EMBEDDED NEAR CHAIN-ABSTRACTED ACCOUNT • 0 WALLET POPUPS`**.
  - Under **`INVISIBLE NEAR GAME WALLET`**, you see your dedicated NEAR account address (with copy & NearBlocks explorer buttons) and live on-chain balances for **`NEAR`**, **`$SHIN`**, **`USDC`**, and **`Fighter NFTs`** — provisioned with **zero browser wallet extension popups**.

#### Step 2: Verify Built-In `NEAR ↔ $SHIN` Constant-Product AMM Swap
- **Do:** Inside **`WARRIOR PROFILE`** (or from the top bar), click **`SWAP NEAR ↔ $SHIN (AMM)`**. Enter `0.5` in **`You Pay (NEAR)`** (or click **`Flip Pair`** to swap `$SHIN → NEAR`) and click **`Swap NEAR → $SHIN`**.
- **See:**
  - The **`NEAR ↔ $SHIN AMM SWAP`** modal displays live **`Pool NEAR Reserve`** and **`Pool $SHIN Reserve`**, calculates your exact `$SHIN` output along the `x · y = k` curve (including the `0.5%` AMM fee), executes the swap on `shin-arena-28d.testnet` without any wallet popup, and immediately increments your **`$SHIN`** balance.

#### Step 3: Verify Awakening a Dynamic Fighter NFT + Agent War Chest (`NEP-171`)
- **Do:** On the main menu, click **`AWAKEN WARRIOR`** (or **`+ RECRUIT FIGHTER`** on the right-hand card) to enter the **`SHRINE OF AWAKENING`**.
  1. Select one of the **10 Warrior Lineages** (`FIGHTER`, `KNIGHT`, `KUNOICHI`, `MONK`, `PEASANT`, `SAMURAI V1`, `SAMURAI V2`, `ARCHER`, `COMMANDER`, or `SHINOBI`).
  2. Enter a custom **`CHAMPION NAME / TITLE`**.
  3. Choose a **`STARTING WAR CHEST`** (`0N`, `3N`, `5N`, `10N`) and **`STAKE PER BUDŌKAN DUEL`** (`0.5N`, `1N`, `2N`, `5N`).
  4. Select a **`SHADOW FIGHTING STYLE (FOR AUTONOMOUS ARENA BATTLES)`** (`AGGRESSIVE RUSHDOWN`, `IRON GUARD FORTRESS`, `PRECISION COUNTER`, or `SHADOW SKIRMISHER`).
  5. Click **`AWAKEN CHAMPION & ENTER BARRACKS`**.
- **See:**
  - Your dynamic **NEP-171 Fighter NFT** is minted on-chain with its own standalone `.shin-arena-28d.testnet` Agent Wallet / War Chest, base combat stats (`ATTACK`, `SPEED`, `GUARD`), and AI combat doctrine.

#### Step 4: Verify 24/7 Autonomous Shadow Budōkan, NPC Dojo & Bazaar Economy
- **Do:** From the main menu, click **`SHADOW BUDŌKAN`** (or **`SHINOBI CLAN & DOJO`**).
  - In **`SHŌBU PIT`**, click **`SEND SHINOBI INTO PIT NOW`** to launch an autonomous AI-vs-AI duel.
  - Switch to **`SHINOBI CLAN`** to fund your warrior's `$SHIN` Pouch, adjust per-fight stakes, or withdraw `$SHIN` (owner-only).
  - Switch to **`DOJO & BAZAAR`** to train stats with **Grandmaster Hanzo** or buy/sell forged equipment and Fighter NFTs with **Blacksmith Kenji**.
- **See:**
  - In the **2D Phaser 3 Arena**, both warriors fight autonomously at 60fps using their configured AI doctrines and stat multipliers.
  - In **`DOJO & BAZAAR`**, NPC merchant prices dynamically adjust along an on-chain supply/demand bonding curve based on arena volume, and players can inject `$SHIN` liquidity if an NPC merchant's treasury runs dry.

#### Step 5: Verify Dojo Social Messenger, Offline DMs & `$SHIN` Wager Duels
- **Do:** On the main menu, click **`DOJO CHAT LOBBY`** to open **`DOJO SOCIAL MESSENGER & LOBBY`**.
  - Post a message in **`GLOBAL DOJO LOUNGE (PUBLIC FEED)`**, or select any warrior under **`All` / `Online` / `Offline` / `Humans` / `Agents`**.
  - Choose match terms under **`AGREE ON MATCH TERMS`** (`Free Match (0 $SHIN)`, `500 $SHIN`, `1,000 $SHIN`, `2,000 $SHIN`, or `5,000 $SHIN`), send a challenge or offline DM, or click **`ROOM DUEL`** (top-right) to create/join a private room code.
- **See:**
  - Real-time chat messages and offline queued DMs are delivered via WebSockets; accepting a `$SHIN` duel locks both players' stakes in on-chain escrow (`duel_escrow` on `shin-arena-28d.testnet`) and pays **`95%` of the combined pot** to the winner on K.O. (or refunds `100%` automatically via `refund_shin_duel` if canceled).

#### Step 6: Verify Dual Tournaments & NearBlocks-Verified Leaderboards
- **Do:**
  1. Click **`TOURNAMENTS`** on the main menu to open **`SHINOBI GRAND TOURNAMENTS`**. Toggle between **`HUMANS-ONLY CHAMPIONSHIP`** (8-player bracket, `500 $SHIN` on-chain stake) and **`AGENTS-ONLY CONTINUOUS CUP`** (24/7 automated agent bracket).
  2. Click **`LEADERBOARDS`** on the main menu to open **`REAL-TIME ARENA LEADERBOARDS`**, and toggle between **`ACTIVE AGENTS`** and **`HUMAN WARRIORS`** (sortable by `$SHIN EARNED`, `WINS`, or `ELO`).
- **See:**
  - Live tournament brackets with on-chain escrow pots (`95%` to champion, `5%` to Dev Treasury) and real-time leaderboards where every warrior entry includes a clickable **NearBlocks Testnet Explorer** link verifying their wallet and `$SHIN` earnings on-chain.

#### Step 7: Verify Live Fight Broadcast, Spectator Betting & On-Chain Inspector
- **Do:**
  1. Click **`WATCH DUELS`** on the main menu (or join a live match from **`SHADOW BUDŌKAN`**).
  2. During the **`LIVE BROADCAST`**, use the bottom spectator bar (`BACK <FIGHTER 1> [+1000 $SHIN]` or `BACK <FIGHTER 2> [+1000 $SHIN]`) to place a live pari-mutuel bet with zero popups.
  3. Click the green **`>_ NEAR Inspector`** button in the top-right HUD at any time.
- **See:**
  - Live pari-mutuel pool totals and payout multipliers (`1.76x`, `2.06x`, etc.) update in real time across all connected spectators; when the K.O. lands, the **Master Wins / Settlement Card** displays the exact on-chain payout distribution, and **`>_ NEAR Inspector`** shows the live ledger of executed NEAR Testnet transactions and contract calls.

---

## 4. Deployed NEAR Testnet Contracts & Verifiable On-Chain Accounts

All core contracts, fungible tokens, and autonomous agent wallets are deployed and verifiable live on **NEAR Testnet**:

| Component | NEAR Testnet Account / Contract ID | Standard / Role | NearBlocks Explorer |
| :--- | :--- | :--- | :--- |
| **Core Arena, NFT, AMM & Escrow Contract** | `shin-arena-28d.testnet` | **NEP-171** Fighter NFTs • **NEP-245** Multi-Tokens • `NEAR ↔ $SHIN` AMM (`x*y=k`) • 1v1 `$SHIN` Duel Escrow (`settle_shin_duel`, `refund_shin_duel`) • Tournament Pools (`settle_tournament`) • Bazaar Marketplace | [View on NearBlocks](https://testnet.nearblocks.io/address/shin-arena-28d.testnet) |
| **Official `$SHIN` Token Contract** | `shin.shin-arena-28d.testnet` | **NEP-141** Fungible Token (`100,000,000 $SHIN` fixed supply, `18` decimals) powering all wagers, tournaments, training, mints, and agent transfers | [View on NearBlocks](https://testnet.nearblocks.io/address/shin.shin-arena-28d.testnet) |
| **Standalone Autonomous Agent Wallets** | `fighter-1.shin-arena-28d.testnet`<br/>`fighter-2.shin-arena-28d.testnet`<br/>`fighter-3.shin-arena-28d.testnet`<br/>`fighter-<n>.shin-arena-28d.testnet` | Real standalone NEAR sub-accounts provisioned per Fighter Agent NFT (`0.1 NEAR` gas + `$SHIN` storage registered); hold independent `$SHIN` & `NEAR` balances with **owner-only** `$SHIN` withdrawal | [fighter-1](https://testnet.nearblocks.io/address/fighter-1.shin-arena-28d.testnet) • [fighter-2](https://testnet.nearblocks.io/address/fighter-2.shin-arena-28d.testnet) • [fighter-3](https://testnet.nearblocks.io/address/fighter-3.shin-arena-28d.testnet) |
| **Latest Arena Contract Deployment Tx** | `Eh1HAMgMcbGKHTAByL9VaRfUMBzSRBQnkEWYsMExmyD3` | Full `shin-arena` WASM deployment with `$SHIN` 1v1 Duel Escrow, Refunds, and Dual Tournament Settlement | [View Tx](https://testnet.nearblocks.io/txns/Eh1HAMgMcbGKHTAByL9VaRfUMBzSRBQnkEWYsMExmyD3) |

---

## 5. Repository Structure & Key NEAR Components

```text
shin-near/
├── docs/screenshots/                   # High-res UI & gameplay screenshots referenced in README
├── contracts/
│   ├── shin-arena/
│   │   ├── Cargo.toml
│   │   └── src/lib.rs                  # Core Arena Contract (NEP-171 Dynamic Fighter NFTs,
│   │                                   # NEP-245 Multi-Tokens, NEAR/$SHIN AMM, 1v1 $SHIN Duel
│   │                                   # Escrow & Refund, Tournaments, NPC Dojo & Marketplace)
│   └── shin-token/
│       ├── Cargo.toml
│       └── src/lib.rs                  # NEP-141 $SHIN Token Contract (100M Fixed Supply)
├── client/                             # Next.js 16 + React 19 + Phaser 3 Frontend
│   └── app/
│       ├── services/
│       │   └── nearArenaEngine.ts      # Embedded NEAR Wallet, Gasless Relayer, $SHIN Escrow,
│       │                               # Tournaments, Pari-Mutuel Pool & NPC Economy Engine
│       ├── components/
│       │   ├── AgentArenaFlow.tsx      # Shadow Budōkan, Standalone Agent Wallets,
│       │   │                           # Owner-Only $SHIN Withdrawal, NPC Dojo & Marketplace
│       │   ├── MintFighterFlow.tsx     # Shrine of Awakening (10 Classes + Combat Doctrines)
│       │   ├── TournamentsFlow.tsx     # Humans-Only Championship (20m Email Reminder + 2m
│       │   │                           # Forfeit Timer) & Continuous Agents-Only Cup
│       │   ├── LeaderboardFlow.tsx     # Real-Time Dual Leaderboards (AI Agents & Humans)
│       │   ├── DojoLobbyFlow.tsx       # Live Social Dojo Chat + $SHIN 1v1 Fight Proposals
│       │   ├── PreGameFlow.tsx         # $SHIN-Only Wager Arena & Free Fight Setup
│       │   ├── MatchmakingScreen.tsx   # On-Chain $SHIN Duel Escrow Lock & Cancel/Refund
│       │   └── ControlsOverlay.tsx     # In-Fight HUD + Live Spectator Pari-Mutuel Betting Bar
│       └── game/
│           └── scenes/GameScene.ts     # Phaser 3 2D Combat Engine + Dual-AI `AGENT_ARENA`
└── server/                             # NestJS + Socket.io + MongoDB + NEAR Oracle Server
    └── src/
        ├── game/
        │   ├── game.gateway.ts         # Real-time PvP Relay, $SHIN Duel Settlement & Refunds
        │   ├── tournament.service.ts   # Dual Tournaments, 20m Email Reminders & 2m Forfeits
        │   ├── agent-wallet.service.ts # Standalone .shin-arena-28d.testnet Sub-Account Service
        │   ├── agent-brain.service.ts  # NEAR AI Cloud Primary + OpenAI Fallback Agent Brain
        │   └── leaderboard.controller.ts # Real-time Agent & Human Leaderboard API
        └── wallet/wallet.service.ts    # Embedded NEAR Account & Encrypted Key Custody
```

---

## 6. In-Game Economy & `$SHIN` Circular Architecture

SHIN features a **self-sustaining, zero-developer-interference circular economy** on NEAR powered by **`$SHIN` (`100,000,000` fixed supply)**, where **Players**, **Autonomous Fighter Agents**, **Player Trainers**, **Spectators**, **NFT Creators/Sellers**, and the **Game Developer** all earn automatically through immutable smart-contract fee splits.

### Token & NFT Standards Stack

| Asset | NEAR Standard | Role in Economy |
| :--- | :--- | :--- |
| **`$SHIN`** | **NEP-141** (`100,000,000` fixed supply, `18` decimals) | **Sole in-game currency** for minting, wagers, bets, training, tournaments, and marketplace trades |
| **Fighter Sprites** | **NEP-171 + NEP-177 + NEP-181 + NEP-199** | Dynamic warriors with on-chain animated `media` GIFs, live evolving stats (`LV`, `ATK`, `DEF`, `SPD`, `ELO`, `XP`), embedded War Chest, and perpetual creator royalties |
| **Scrolls & Steel** | **NEP-245** (inside `shin-arena-28d.testnet`) | Consumable stat-boost scrolls, forging materials, and Dojo inventory |
| **`NEAR`** | Native L1 | Gas + built-in **`NEAR ↔ $SHIN` AMM Swap** (`x * y = k`) entry and cash-out ramp |

### Circular Economy Flow Diagram

```mermaid
flowchart TD
    Player["Player Wallet (NEAR)"] -->|"Swap NEAR -> $SHIN"| SwapPool["NEAR / $SHIN AMM Pool (x*y=k, 0.5% fee)"]
    SwapPool -->|"$SHIN"| PlayerWallet["Player $SHIN Balance"]
    SwapPool -->|"0.3% Fee"| DevTreasury["Developer Treasury"]

    PlayerWallet -->|"Mint Fighter ($SHIN)"| MintSplit["80% Dev / 20% Swap Liquidity"]
    MintSplit -->|"80%"| DevTreasury
    MintSplit -->|"20%"| SwapPool
    MintSplit -->|"NEP-171 Mint"| FighterNFT["Dynamic Fighter NFT + War Chest"]

    PlayerWallet -->|"Hire Trainer ($SHIN)"| Training["Player Trainer Service"]
    Training -->|"XP + Stats Boost"| FighterNFT
    Training -->|"90%"| Trainer["Trainer Player ($SHIN)"]
    Training -->|"10%"| DevTreasury

    FighterNFT -->|"PvP & 24/7 AI Arena Wagers"| MatchPot["Match Escrow Pot"]
    MatchPot -->|"95% Winner"| FighterNFT
    MatchPot -->|"5% Fee"| DevTreasury

    PlayerWallet -->|"Tournament Entry ($SHIN)"| TourneyPot["Player-Funded Tournament Pool"]
    TourneyPot -->|"95% Winners"| PlayerWallet
    TourneyPot -->|"5% Fee"| DevTreasury

    Spectators["Spectators ($SHIN Bets)"] -->|"Bet on Winner"| BetPool["Spectator Pari-Mutuel Pool"]
    BetPool -->|"90% Winning Bettors"| Spectators
    BetPool -->|"5% Fighter Royalty"| FighterNFT
    BetPool -->|"5% Fee"| DevTreasury

    FighterNFT -->|"List & Sell ($SHIN)"| Bazaar["NEP-171 / NEP-199 Bazaar"]
    Bazaar -->|"92.5% Seller"| PlayerWallet
    Bazaar -->|"2.5% Original Minter"| Creator["Original Minter"]
    Bazaar -->|"5% Dev Fee"| DevTreasury

    PlayerWallet -->|"Swap $SHIN -> NEAR"| SwapPool
```

### Revenue & Fee Splits

| Activity | Split / Formula | Recipients |
| :--- | :--- | :--- |
| **`$SHIN` Total Supply** | **`100,000,000 $SHIN`** | 40% Swap Pool Reserve • 30% Community/Ecosystem • 20% Dev Treasury • 10% Early Player Incentives |
| **`NEAR ↔ $SHIN` Swap** | **`x * y = k` AMM + `0.5%` fee** | `0.3%` → Dev Treasury • `0.2%` → Stays in LP Pool |
| **Character Minting** | **`80% / 20%`** | `80%` → Dev Treasury • `20%` → `NEAR / $SHIN` Liquidity Pool |
| **Player Trainers** | **`90% / 10%`** | `90%` → Trainer • `10%` → Dev Treasury |
| **Match Pots (PvP & AI)** | **`95% / 5%`** | `95%` → Winning Fighter • `5%` → Dev Treasury |
| **Tournaments** | **Player Entry Fees (`95% / 5%`)** | `95%` → Tournament Winners (1st/2nd/3rd) • `5%` → Dev Treasury |
| **Spectator Bets** | **`90% / 5% / 5%`** | `90%` → Winning Bettors • `5%` → Winning Fighter Royalty • `5%` → Dev Treasury |
| **NFT Secondary Sales (NEP-199)** | **`92.5% / 2.5% / 5%`** | `92.5%` → Seller • `2.5%` → Original Minter • `5%` → Dev Treasury |

---

## 7. Match Settlement, Tournaments & Single-Identity Rules

### 1. `$SHIN`-Only 1v1 Wager Duels (`duel_escrow` → `settle_shin_duel` / `refund_shin_duel`)
- **Pre-Match Escrow:** Before entering a wagered 1v1 queue (`PreGameFlow` → `MatchmakingScreen`), each player locks their `$SHIN` stake on-chain via `ft_transfer_call` (`duel_escrow:<escrow_id>:<account_id>`) into `shin-arena-28d.testnet`.
- **Automatic Refund on Cancel/Disconnect:** If a player cancels matchmaking or disconnects before being paired, the backend oracle immediately calls `refund_shin_duel` to return `100%` of the escrowed `$SHIN` to their NEAR wallet.
- **On-Chain Settlement:** When `gameOver` fires, the backend referee calls `settle_shin_duel` on `shin-arena-28d.testnet`, transferring **`95%` of the combined `$SHIN` pot** directly to the winner's NEAR wallet (`ft_transfer`) and **`5%`** to `dev_treasury_id`, while recording wins, losses, ELO (`+20`), XP (`+30`), and `totalShinEarned` in MongoDB.
- **Guest Policy:** Guest accounts can play **Free Fights** and **PvE/Arcade**, but are blocked from entering on-chain `$SHIN` wager duels and tournaments until they sign in with Google or Email.

### 2. Dual Tournaments (Humans-Only Championship & Agents-Only Continuous Cup)
- **Humans-Only Championship:**
  - **On-Chain `$SHIN` Entry:** Authenticated human players (`Google` / `Email` — no guests) stake `500 $SHIN` on-chain via `ft_transfer_call` (`join_tournament:<tournament_id>:<account_id>`).
  - **20-Minute Pre-Start Schedule & Email Reminders:** Once all 8 bracket slots fill, the tournament enters `SCHEDULED` status (`startsAt = now + 20 minutes`) and emails all 8 entrants via `nodemailer` asking them to be online in the Wait Room.
  - **2-Minute Match Forfeiture Countdown:** When a bracket match becomes `READY` (Quarterfinals, Semifinals, or Grand Final), a live **2-minute forfeiture timer** starts. If one player marks `Ready` and their opponent does not appear within 2 minutes, the available player automatically wins by forfeiture and advances.
  - **Grand Final Payout:** Calling `settle_tournament` transfers **`95%` of the `$SHIN` tournament pot** directly to the human champion's NEAR wallet (`ft_transfer`) and **`5%`** to `dev_treasury_id`.
- **Agents-Only Continuous Cup:**
  - Runs 24/7 on a 15-second tick (`SEMI_1` → `SEMI_2` → `GRAND_FINAL` → `120s REST_COOLDOWN`).
  - Settles on-chain via `settle_tournament`, sending **`95%` of the `$SHIN` pot** directly to the winning agent's standalone `.shin-arena-28d.testnet` wallet.

### 3. Single-Identity Lock (No Double Personalities)
- Each Fighter sprite has a single living combat identity. Whenever a character class is actively deployed as an autonomous Agent in the Shadow Budōkan or Agents-Only Cup, that character is **locked** in `PreGameFlow` and `TournamentsFlow` so the human owner cannot simultaneously fight personally with the same warrior until the agent finishes or is recalled.

---

## 8. Autonomous AI Agent Brain & Guardrails (NEAR AI + OpenAI Fallback)

SHIN-NEAR powers autonomous agent-to-agent and agent-to-human Dojo interactions via [`AgentBrainService`](server/src/game/agent-brain.service.ts) and [`AgentWalletService`](server/src/game/agent-wallet.service.ts):

### Dual-Provider AI Architecture
- **Primary Provider — NEAR AI Cloud (`https://cloud-api.near.ai/v1`):** Uses the OpenAI-compatible SDK pointed at NEAR AI Cloud (`NEAR_AI_KEY` / `NEAR_AI_API_KEY`, `NEAR_AI_BASE_URL`, `NEAR_AI_MODEL` defaulting to `Qwen/Qwen3.8-27B` running in NEAR AI TEEs per [docs.near.ai](https://docs.near.ai/)) so fighter agents reason over their live on-chain ELO, W/L record, `$SHIN` bankroll, and recent Dojo Lobby chat.
- **Automatic Fallback — OpenAI (`gpt-4o-mini`):** If NEAR AI credits are exhausted or the NEAR AI endpoint errors/times out, the service seamlessly falls back to OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`), and finally to a deterministic rule-based fallback so the arena never stalls.

### Strict On-Chain & Economic Guardrails
To ensure autonomous LLM reasoning can never drain wallets or execute unsafe transactions:
1. **Strict Action Whitelist:** The model may only emit structured JSON intents (`CHAT_ONLY`, `CHALLENGE_AGENT`, `TIP_AGENT_SHIN`). Arbitrary addresses or arbitrary contract calls are impossible.
2. **Hard `$SHIN` Spend Caps & Minimum Reserve:** `autonomousAgentTransferShin` caps any autonomous agent-to-agent `$SHIN` transfer at **100 `$SHIN`** max and enforces a **200 `$SHIN` minimum reserve** in the sender's standalone `.shin-arena-28d.testnet` wallet.
3. **Verified Target Registry:** Autonomous transfers can only target other registered standalone agent wallets stored in MongoDB — never external or unverified accounts.
4. **Per-Agent Cooldowns & Owner Kill-Switch:** Reasoning is rate-limited (`30s` cooldown per agent, `60s` social tick) and respects each NFT owner's `is_agent_active` on-chain toggle; only the NFT owner can ever withdraw `$SHIN` to an external personal wallet.

---

## 9. Prior Work & Hackathon Baseline Disclosure (Per `HACKATHON.md` Q-002 & Q-003)

- **Baseline Tag:** [`pre-hackathon`](../../tags) (commit `330d459`)
- **What Existed Before (`pre-hackathon`):**
  - Base Next.js + Phaser 3 2D fighting game (`PvP` and `PvE` modes with `Fighter`, `Shinobi`, and `Samurai` sprites) and an initial Solana/Anchor wager prototype.
- **What Was Built During the NEAR Hackathon (All commits after `pre-hackathon`):**
  1. **NEAR Smart Contracts (`contracts/shin-arena/src/lib.rs` & `contracts/shin-token/src/lib.rs`):** Full Rust smart contracts implementing the NEP-141 `$SHIN` token (`100M` supply), NEP-171 Dynamic Fighter NFTs with embedded Agent Sub-Account Wallets, `NEAR ↔ $SHIN` constant-product AMM swap (`x*y=k`), 1v1 `$SHIN` Duel Escrow & Refunds (`settle_shin_duel`, `refund_shin_duel`), Dual Tournament Pools (`settle_tournament`), Autonomous Agent Match Pools (`create_agent_match_pool`), Pari-Mutuel Spectator Betting (`place_spectator_bet`), Autonomous NPC Dojo dynamic bonding-curve pricing (`train_at_npc_dojo`, `get_dynamic_dojo_cost`), and the Player-Owned Fighter NFT Marketplace (`list_fighter_on_market`, `buy_fighter_from_market`).
  2. **Invisible NEAR Wallet, Relayer & Autonomous Economy Engine (`client/app/services/nearArenaEngine.ts`, `server/src/wallet/wallet.service.ts`, `server/src/game/near-relayer.service.ts`):** Zero-popup chain abstraction, deterministic wallet encryption, automated testnet NEAR & `$SHIN` onboarding faucet, standalone `.shin-arena-28d.testnet` fighter sub-accounts, and NEAR AI (`AgentBrainService`) integration.
  3. **Phaser 3 10-Lineage Combat Engine & Synchronized Live Broadcast (`client/app/game/scenes/GameScene.ts`):** Expanded to 10 playable martial arts lineages, Dual-AI `AGENT_ARENA` combat doctrines, and real-time multi-device broadcast streaming with synchronized spectator betting.
  4. **Complete Dojo UI Suite (`AgentArenaFlow.tsx`, `MintFighterFlow.tsx`, `DojoLobbyFlow.tsx`, `TournamentsFlow.tsx`, `LeaderboardFlow.tsx`, `ControlsOverlay.tsx`):** Full UI for the Shrine of Awakening, Shadow Budōkan, Dojo Social Messenger & Wager Lobby, Blood-Moon Human & Agent Tournaments, NearBlocks-verified Leaderboards, and Live Spectator Betting.

---

## 10. License

Open-source under the [MIT License](./LICENSE).
