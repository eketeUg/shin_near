# SHIN: The Struggle — Autonomous Agent Arena & Zero-Popup PvP Fighting Game on NEAR

> **NEAR Hackathon Submission** | **Tracks:** `games` (On-chain Games & Autonomous Worlds), `nfts` (Dynamic NFTs & Digital Assets), `agents` (Autonomous Agents on NEAR)
>
> *"Build NPCs with wallets, player-owned markets and economies that evolve without a dev patch. Judged on the game loop, not the token — bonus if players never notice the chain."*

---

## 1. What Problem Does SHIN Solve?

Traditional Web3 fighting games suffer from three fatal flaws:
1. **Wallet Popups Destroy Real-Time Action:** Asking a player to sign browser extension popups before every match, wager, or spectator bet ruins the pacing of an arcade fighting game.
2. **Dead Lobbies & Static NFTs:** Most NFT characters sit idle in wallets when the human player goes offline, and multiplayer lobbies empty out during off-peak hours.
3. **Static Developer-Patched Economies:** In-game shops and NPCs usually rely on fixed prices rather than participating as economic actors with their own wallets and supply/demand curves.

**SHIN: The Struggle** solves all three by combining a **Phaser 3 2D Shinobi & Samurai Arcade Fighting Engine** with **NEAR Protocol's Account Model, Function-Call Session Keys, and Sub-Account Agent Wallets**:
- **Zero Wallet Popups (Invisible Chain Abstraction):** Players sign up with 1 click (`Instant Warrior Login`) or email and receive an embedded `.shin-arena.testnet` account with a scoped `FunctionCall` access key (`250 TGas` relayer allowance). Every mint, wager lock, agent funding deposit, and live spectator bet executes instantaneously with **zero interrupting wallet modals**.
- **Fighter NFTs With Their Own Agent Wallets (`NEP-171` + Sub-Accounts):** Every Fighter NFT (`fighter-<id>.shin-arena.testnet`) has its own on-chain vault balance, ELO rating, combat stats (`ATK`, `DEF`, `SPD`, `AGGRESSION`), and configurable **Combat AI Doctrine**.
- **24/7 Autonomous Agent Arena (Winner-Takes-Pool):** Players can assign their Fighter NFT to the **Agent Arena**, fund its agent wallet with NEAR, and set a **Max Wager Per Fight**. Their fighter enters continuous autonomous Agent-vs-Agent pools in real-time 2D combat, winning or losing match pools on its own.
- **Live Spectator Mode & Pari-Mutuel Betting:** Spectators watch live Agent-vs-Agent or PvP fights in the Phaser 3 arena and place 1-click NEAR bets into a pari-mutuel spectator pool (`95%` distributed pro-rata to winning bettors, `5%` paid as an automatic royalty directly into the winning Fighter NFT's agent wallet).
- **NPCs With Wallets & Self-Evolving Economy:**
  - **6 Autonomous Arena NPCs** (`takeshi-npc.agent.shin-arena.testnet`, `kage-npc.agent.shin-arena.testnet`, etc.) hold independent NEAR bankrolls, enter match pools, and automatically reinvest `10%` of their winnings at the Dojo.
  - **Grandmaster Hanzo's NPC Dojo (`hanzo-dojo-npc.shin-arena.testnet`)** is an autonomous NPC sensei with its own treasury wallet that dynamically reprices stat training along an on-chain bonding curve (`base_cost + sessions * 0.08 NEAR + total_arena_volume * 0.015 NEAR`) without any developer patch.
  - **Player-Owned Fighter Market:** Players list and buy trained high-ELO Fighter NFTs — and because the Agent Sub-Account Wallet travels with the NFT, buying a Fighter transfers its entire remaining NEAR agent vault balance and combat history.

---

## 2. Repository Structure & Key NEAR Components

```text
shin-near/
├── contracts/
│   └── shin-arena/
│       ├── Cargo.toml
│       └── src/lib.rs                  # NEAR Smart Contract (NEP-171 Dynamic Fighter NFTs,
│                                       # Agent Sub-Account Vaults, Match Pools, Pari-Mutuel
│                                       # Spectator Betting, Dynamic NPC Dojo & Marketplace)
├── client/                             # Next.js 16 + React 19 + Phaser 3 Frontend
│   └── app/
│       ├── services/
│       │   └── nearArenaEngine.ts      # Embedded NEAR Wallet, Gasless Relayer, Agent Arena
│       │                               # Matchmaker, Pari-Mutuel Pool & NPC Economy Engine
│       ├── components/
│       │   ├── AgentArenaFlow.tsx      # 4-Tab Autonomous Agent Arena, Fighter Vaults,
│       │   │                           # NPC Dojo & Marketplace, On-Chain Ledger
│       │   ├── MintFighterFlow.tsx     # Gasless NEP-171 Fighter NFT + Sub-Account Minting
│       │   ├── ControlsOverlay.tsx     # In-Fight HUD + Live Spectator Pari-Mutuel Betting Bar
│       │   │                           # + Post-Match On-Chain Pool Settlement Report
│       │   ├── LiveFightsFlow.tsx      # Live Arena Broadcasts + Instant Pre-Watch Betting
│       │   ├── SpectateScreen.tsx      # Live Spectator Stream + Pari-Mutuel Betting Drawer
│       │   ├── PreGameFlow.tsx         # PvP / PvE Wager Setup (NEAR / USDC / USDT)
│       │   └── AuthModal.tsx           # 1-Click Instant Warrior Login (Zero Popups)
│       └── game/
│           └── scenes/GameScene.ts     # Phaser 3 2D Combat Engine + Dual-AI `AGENT_ARENA`
│                                       # Autonomous State Machine (4 Combat Doctrines)
└── server/                             # NestJS + Socket.io Multiplayer & Match Settlement Relay
    └── src/
        ├── game/game.gateway.ts        # Real-time WebSocket Relay + NEAR Referee Settlement
        └── wallet/wallet.service.ts    # Embedded NEAR Account & NEP-141 Balance Service
```

---

## 3. Quick Start & Verification Guide (For Judges & Screening Agents)

> **Zero External Secrets or Browser Extensions Required:** The client runs out-of-the-box with an embedded NEAR session wallet and gasless relayer engine.

### Step 1: Install & Run the Client
```bash
cd client
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

*(Optional: To also run the NestJS multiplayer WebSocket server on port 3005, run `cd server && npm install && npm run start:dev` in a second terminal.)*

### Step 2: Judge Verification Walkthrough ("Do X -> See Y")

1. **Verify Zero-Popup Embedded NEAR Wallet:**
   - **Do:** Load `http://localhost:3000`. Look at the top-left HUD bar (or click **Login -> 1-Click Instant Warrior Login**).
   - **See:** An embedded `.shin-arena.testnet` account is provisioned immediately with `25.00 NEAR` starter balance and an active `Zero-Popup Relayer Key` badge — no browser extension popup appears.

2. **Verify Dynamic Fighter NFT + Agent Sub-Account Minting:**
   - **Do:** Click **Mint Fighter** on the main menu, enter a custom fighter name, choose a class (`Shinobi`, `Samurai`, or `Fighter`), pick an initial **Combat AI Doctrine**, and click **Mint Fighter NFT + Agent Wallet**.
   - **See:** Your NEP-171 Fighter NFT is minted gaslessly with its own dedicated `fighter-<id>.shin-arena.testnet` sub-account wallet pre-funded with `3.00 NEAR`.

3. **Verify Autonomous Agent Arena, Fighter Vaults & Wager-Per-Fight:**
   - **Do:** Click **Agent Arena** on the main menu and switch to the **My Fighter Agents & Wallets** tab.
   - **See:** Your Fighter NFTs alongside their dedicated Agent Sub-Account Wallets.
   - **Do:** Deposit `+2 NEAR` into a fighter's agent wallet, adjust its **Wager / Fight** (`0.5` to `5 NEAR`), select its **Combat AI Doctrine** (`Aggressive Rushdown`, `Iron Guard`, `Counter Striker`, or `Shadow Evasive`), and toggle **Autonomous Arena Mode** ON. Click **Launch My Agent Into Live Fight Now**.
   - **See:** The Phaser 3 2D combat arena launches immediately in `AGENT_ARENA` mode where both fighters battle autonomously using their AI doctrines and stat multipliers, with a locked **Winner-Takes-All Fighter Pool** shown in the top HUD.

4. **Verify Live Spectator Mode & Pari-Mutuel Betting (Zero Popups):**
   - **Do:** While watching a live Agent-vs-Agent fight (either via **Agent Arena -> Watch & Bet in 2D Arena** or **Watch Live** from the main menu), use the bottom **Live Spectator Pari-Mutuel Pool** bar to bet `0.5 NEAR`, `1 NEAR`, or `2.5 NEAR` on Fighter 1 or Fighter 2.
   - **See:** Your bet is locked into the pari-mutuel pool instantaneously (zero wallet popups), the live payout multiplier (`1.85x`, etc.) updates in real time, and when the KO happens, the **Game Over On-Chain Settlement Card** displays the Winner-Takes-All Fighter Pool payout, the `5%` Fighter Royalty, and your spectator bet payout.

5. **Verify NPCs With Wallets & Self-Evolving Economy (No Dev Patch):**
   - **Do:** Open **Agent Arena -> NPC Dojo & Fighter Market**.
   - **See:**
     - **Grandmaster Hanzo's Autonomous NPC Dojo (`hanzo-dojo-npc.shin-arena.testnet`)** with its own live NEAR wallet balance and bonding-curve training price. Train a fighter's `ATK`, `DEF`, or `SPD` and watch the Dojo's wallet balance and next session price automatically evolve based on arena demand.
     - **Autonomous NPC Combatants Leaderboard** showing 6 NPCs with their own `.shin-arena.testnet` wallets, strategies, and live bankrolls.
     - **Player-Owned Fighter NFT Marketplace** where you can list or buy trained Fighter NFTs (including their embedded Agent Wallet balances).

---

## 4. Prior Work & Hackathon Baseline Disclosure (Per `HACKATHON.md` Q-002 & Q-003)

- **Baseline Tag:** [`pre-hackathon`](../../tags) (commit `330d459`)
- **What Existed Before (`pre-hackathon`):**
  - Base Next.js + Phaser 3 2D fighting game (`PvP` and `PvE` modes with `Fighter`, `Shinobi`, and `Samurai` sprites) and an initial Solana/Anchor wager prototype.
- **What Was Built During the NEAR Hackathon (All commits after `pre-hackathon`):**
  1. **NEAR Smart Contract (`contracts/shin-arena/src/lib.rs`):** Full Rust smart contract implementing NEP-171 Dynamic Fighter NFTs with embedded Agent Sub-Account Wallets, Autonomous Agent Match Pools (`create_agent_match_pool`), Pari-Mutuel Spectator Betting (`place_spectator_bet`), Match Settlement with 5% spectator royalty to the winning Fighter NFT (`settle_match`), Autonomous NPC Dojo dynamic bonding-curve pricing (`train_at_npc_dojo`, `get_dynamic_dojo_cost`), and the Player-Owned Fighter NFT Marketplace (`list_fighter_on_market`, `buy_fighter_from_market`).
  2. **Invisible NEAR Wallet & Autonomous Economy Engine (`client/app/services/nearArenaEngine.ts`):** Session-key chain abstraction (zero wallet popups), embedded `.shin-arena.testnet` player & fighter agent wallets, 6 autonomous funded NPCs, pari-mutuel odds calculator, and on-chain transaction ledger.
  3. **Phaser 3 Dual-AI `AGENT_ARENA` Mode (`client/app/game/scenes/GameScene.ts`):** Upgraded the Phaser 3 combat engine so two autonomous AI agents can fight each other in real time using 4 distinct Combat Doctrines (`AGGRESSIVE_RUSHDOWN`, `IRON_GUARD`, `COUNTER_STRIKER`, `SHADOW_EVASIVE`) and on-chain NFT stat scaling (`ATK`, `DEF`, `SPD`).
  4. **Agent Arena Hub & In-Fight Spectator Betting UI (`AgentArenaFlow.tsx`, `ControlsOverlay.tsx`, `MintFighterFlow.tsx`, `LiveFightsFlow.tsx`, `SpectateScreen.tsx`):** Complete UI for managing Fighter Agent vaults, configuring per-fight wagers, placing 1-click live spectator bets during combat, training at the dynamic NPC Dojo, and trading Fighter NFTs.

---

## 5. License

Open-source under the [MIT License](./LICENSE).
