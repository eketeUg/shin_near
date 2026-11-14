use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use std::collections::HashMap;

const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);

/// Combat AI Doctrine assigned to an autonomous Fighter Agent
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum CombatDoctrine {
    AggressiveRushdown,
    IronGuard,
    CounterStriker,
    ShadowEvasive,
}

/// Dynamic Fighter NFT (NEP-171 compatible metadata + embedded Agent Sub-Account Vault)
/// Implements "NFTs That Do Something": each Fighter NFT owns its own combat bankroll,
/// wager rules, evolving attributes, and market listing state.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct FighterNft {
    pub token_id: String,
    pub owner_id: AccountId,
    pub agent_wallet_id: String,
    pub char_class: String,
    pub name: String,
    pub power_level: u32,
    pub atk: u32,
    pub def: u32,
    pub spd: u32,
    pub wins: u32,
    pub losses: u32,
    pub elo: u32,
    /// Dedicated Agent Bankroll stored inside the Fighter NFT account (in yoctoNEAR / milli-units)
    pub vault_balance_milli_near: u128,
    /// Amount the Agent is authorized to stake per autonomous fight
    pub wager_per_fight_milli_near: u128,
    /// Whether this Fighter NFT is actively deployed in the 24/7 Agent Arena
    pub is_agent_active: bool,
    /// Whether the Agent automatically spends 15% of profits at the NPC Dojo to upgrade stats
    pub auto_train_at_dojo: bool,
    pub doctrine: CombatDoctrine,
    /// Optional player-owned market listing price (0 = not listed)
    pub market_price_milli_near: u128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct SpectatorBet {
    pub spectator_id: AccountId,
    pub predicted_fighter_token_id: String,
    pub amount_milli_near: u128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct ArenaMatchPool {
    pub match_id: String,
    pub fighter_1_token_id: String,
    pub fighter_2_token_id: String,
    pub fighter_stake_milli_near: u128,
    pub total_fighter_pot_milli_near: u128,
    pub total_spectator_bets_f1_milli_near: u128,
    pub total_spectator_bets_f2_milli_near: u128,
    pub bets: Vec<SpectatorBet>,
    pub is_resolved: bool,
    pub winner_token_id: Option<String>,
}

/// Autonomous NPC Merchant / Dojo Master with its own wallet, inventory stock,
/// self-adjusting supply/demand pricing, and insolvency/investment state (`09-games.md`)
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct NpcDojoMaster {
    pub npc_wallet_id: String,
    pub treasury_balance_milli_near: u128,
    pub total_trainings_completed: u64,
    pub base_training_cost_milli_near: u128,
    pub tamahagane_steel_stock: u64,
    pub is_shop_open: bool,
    pub total_investor_capital_milli_near: u128,
}

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    );
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct TrainerProfile {
    pub trainer_id: AccountId,
    pub fee_milli_near: u128,
    pub specialty: String, // "ATK" | "DEF" | "SPD"
    pub sessions_completed: u64,
    pub is_active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct TournamentPool {
    pub tournament_id: String,
    pub entry_fee_milli_near: u128,
    pub max_players: u32,
    pub entrants: Vec<String>, // fighter token_ids
    pub total_pot_milli_near: u128,
    pub is_settled: bool,
    pub winner_token_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct AmmInfo {
    pub shin_token_id: AccountId,
    pub dev_treasury_id: AccountId,
    pub near_reserve: U128,
    pub shin_reserve: U128,
    pub total_swap_volume_near: U128,
    pub swap_fee_bps: u32,
    pub dev_fee_bps: u32,
    pub lp_fee_bps: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct NftContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Nep171Token {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: Option<TokenMetadata>,
    pub approved_account_ids: Option<HashMap<AccountId, u64>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
}

/// Legacy state layout (pre-economy upgrade) for safe state migration
#[derive(BorshDeserialize)]
pub struct LegacyShinArenaContract {
    pub oracle_id: AccountId,
    pub fighters: UnorderedMap<String, FighterNft>,
    pub matches: LookupMap<String, ArenaMatchPool>,
    pub npc_dojo: NpcDojoMaster,
    pub next_token_nonce: u64,
    pub mt_balances: LookupMap<String, u128>,
    pub mt_supplies: LookupMap<String, u128>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ShinArenaContract {
    pub oracle_id: AccountId,
    pub fighters: UnorderedMap<String, FighterNft>,
    pub matches: LookupMap<String, ArenaMatchPool>,
    pub npc_dojo: NpcDojoMaster,
    pub next_token_nonce: u64,
    /// NEP-245 Multi-Token balances keyed by "{account_id}:{token_id}"
    pub mt_balances: LookupMap<String, u128>,
    /// NEP-245 Multi-Token total supply keyed by "{token_id}"
    pub mt_supplies: LookupMap<String, u128>,
    // === V2 Economy & Standards Fields ===
    pub shin_token_id: AccountId,
    pub dev_treasury_id: AccountId,
    pub dev_treasury_milli: u128,
    pub amm_near_reserve: u128,
    pub amm_shin_reserve: u128,
    pub total_swap_volume_near: u128,
    pub original_minters: LookupMap<String, AccountId>,
    pub fighter_xp: LookupMap<String, u64>,
    pub trainers: LookupMap<AccountId, TrainerProfile>,
    pub tournaments: LookupMap<String, TournamentPool>,
}

#[near]
impl ShinArenaContract {
    #[init]
    pub fn new(oracle_id: AccountId) -> Self {
        let current = env::current_account_id();
        let shin_token: AccountId = "shin.shin-arena-28d.testnet".parse().unwrap();
        Self {
            oracle_id,
            fighters: UnorderedMap::new(b"f"),
            matches: LookupMap::new(b"m"),
            npc_dojo: NpcDojoMaster {
                npc_wallet_id: "hanzo-dojo-npc.shin-arena.testnet".to_string(),
                treasury_balance_milli_near: 12_000, // 12 NEAR initial NPC liquidity
                total_trainings_completed: 0,
                base_training_cost_milli_near: 500, // 0.5 NEAR base cost, scales with demand
                tamahagane_steel_stock: 12,
                is_shop_open: true,
                total_investor_capital_milli_near: 0,
            },
            next_token_nonce: 1,
            mt_balances: LookupMap::new(b"b"),
            mt_supplies: LookupMap::new(b"s"),
            shin_token_id: shin_token,
            dev_treasury_id: current,
            dev_treasury_milli: 0,
            amm_near_reserve: 0,
            amm_shin_reserve: 0,
            total_swap_volume_near: 0,
            original_minters: LookupMap::new(b"o"),
            fighter_xp: LookupMap::new(b"x"),
            trainers: LookupMap::new(b"t"),
            tournaments: LookupMap::new(b"p"),
        }
    }

    /// Upgrade existing deployed contract state safely without losing minted fighters
    #[init(ignore_state)]
    pub fn migrate(shin_token_id: AccountId, dev_treasury_id: AccountId) -> Self {
        let legacy: LegacyShinArenaContract =
            env::state_read().expect("Failed to read legacy contract state");
        Self {
            oracle_id: legacy.oracle_id,
            fighters: legacy.fighters,
            matches: legacy.matches,
            npc_dojo: legacy.npc_dojo,
            next_token_nonce: legacy.next_token_nonce,
            mt_balances: legacy.mt_balances,
            mt_supplies: legacy.mt_supplies,
            shin_token_id,
            dev_treasury_id,
            dev_treasury_milli: 0,
            amm_near_reserve: 0,
            amm_shin_reserve: 0,
            total_swap_volume_near: 0,
            original_minters: LookupMap::new(b"o"),
            fighter_xp: LookupMap::new(b"x"),
            trainers: LookupMap::new(b"t"),
            tournaments: LookupMap::new(b"p"),
        }
    }

    /// Internal helper to mint NEP-245 multi-tokens and emit standard NEP-245 EVENT_JSON log
    fn internal_mt_mint(&mut self, owner_id: &str, token_ids: &[String], amounts: &[u128], memo: Option<&str>) {
        assert_eq!(token_ids.len(), amounts.len(), "NEP-245: token_ids and amounts length mismatch");
        for (token_id, amount) in token_ids.iter().zip(amounts.iter()) {
            let key = format!("{}:{}", owner_id, token_id);
            let current = self.mt_balances.get(&key).unwrap_or(0);
            self.mt_balances.insert(&key, &(current + amount));

            let supply = self.mt_supplies.get(token_id).unwrap_or(0);
            self.mt_supplies.insert(token_id, &(supply + amount));
        }
        let amounts_str: Vec<String> = amounts.iter().map(|a| a.to_string()).collect();
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep245\",\"version\":\"1.0.0\",\"event\":\"mt_mint\",\"data\":[{{\"owner_id\":\"{}\",\"token_ids\":{:?},\"amounts\":{:?},\"memo\":{:?}}}]}}",
            owner_id,
            token_ids,
            amounts_str,
            memo.unwrap_or("SHIN NEP-245 Mint")
        ));
    }

    /// Internal helper to transfer NEP-245 multi-tokens between accounts
    fn internal_mt_transfer(
        &mut self,
        sender_id: &str,
        receiver_id: &str,
        token_ids: &[String],
        amounts: &[u128],
        memo: Option<&str>,
    ) {
        assert_eq!(token_ids.len(), amounts.len(), "NEP-245: token_ids and amounts length mismatch");
        for (token_id, amount) in token_ids.iter().zip(amounts.iter()) {
            let sender_key = format!("{}:{}", sender_id, token_id);
            let sender_bal = self.mt_balances.get(&sender_key).unwrap_or(0);
            assert!(sender_bal >= *amount, "NEP-245: insufficient balance for token {}", token_id);
            self.mt_balances.insert(&sender_key, &(sender_bal - amount));

            let receiver_key = format!("{}:{}", receiver_id, token_id);
            let receiver_bal = self.mt_balances.get(&receiver_key).unwrap_or(0);
            self.mt_balances.insert(&receiver_key, &(receiver_bal + amount));
        }
        let amounts_str: Vec<String> = amounts.iter().map(|a| a.to_string()).collect();
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep245\",\"version\":\"1.0.0\",\"event\":\"mt_transfer\",\"data\":[{{\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":{:?},\"amounts\":{:?},\"memo\":{:?}}}]}}",
            sender_id,
            receiver_id,
            token_ids,
            amounts_str,
            memo.unwrap_or("SHIN NEP-245 Batch Transfer")
        ));
    }

    /// Mint a new Fighter NFT with its own embedded Agent Sub-Account Wallet
    #[payable]
    pub fn mint_fighter(
        &mut self,
        char_class: String,
        name: String,
        atk: u32,
        def: u32,
        spd: u32,
    ) -> FighterNft {
        let caller = env::predecessor_account_id();
        let token_id = format!("shin-{}-{}", char_class, self.next_token_nonce);
        let clean_slug = token_id.to_lowercase().replace('_', "-");
        let agent_wallet_id = format!("{}.{}", clean_slug, env::current_account_id());
        self.next_token_nonce += 1;

        let attached_milli = env::attached_deposit().as_millinear();
        // Mint fee: 0.5 NEAR (500 milliNEAR) split 80% Dev Treasury / 20% AMM Liquidity Pool;
        // any excess attached NEAR funds the Fighter's embedded Agent Vault.
        let mint_fee_milli = attached_milli.min(500);
        let vault_initial_milli = attached_milli.saturating_sub(mint_fee_milli);
        if mint_fee_milli > 0 {
            let dev_mint_cut = mint_fee_milli.saturating_mul(80) / 100;
            let pool_mint_cut = mint_fee_milli.saturating_sub(dev_mint_cut);
            self.dev_treasury_milli += dev_mint_cut;
            self.amm_near_reserve += pool_mint_cut.saturating_mul(1_000_000_000_000_000_000_000);
            if dev_mint_cut > 0 && self.dev_treasury_id != env::current_account_id() {
                let _ = Promise::new(self.dev_treasury_id.clone())
                    .transfer(NearToken::from_millinear(dev_mint_cut));
            }
        }

        let fighter = FighterNft {
            token_id: token_id.clone(),
            owner_id: caller.clone(),
            agent_wallet_id,
            char_class,
            name,
            power_level: 1,
            atk,
            def,
            spd,
            wins: 0,
            losses: 0,
            elo: 1000,
            vault_balance_milli_near: vault_initial_milli,
            wager_per_fight_milli_near: 1_000, // Default 1 NEAR per fight
            is_agent_active: false,
            auto_train_at_dojo: false,
            doctrine: CombatDoctrine::AggressiveRushdown,
            market_price_milli_near: 0,
        };

        self.fighters.insert(&token_id, &fighter);
        self.original_minters.insert(&token_id, &caller);
        self.fighter_xp.insert(&token_id, &0);

        // Emit standard NEP-171 nft_mint event so explorers & wallets index the Fighter NFT
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_mint\",\"data\":[{{\"owner_id\":\"{}\",\"token_ids\":[\"{}\"]}}]}}",
            caller, token_id
        ));

        // Register Fighter NFT and starter Shinobi Scroll in NEP-245 Multi-Token ledger
        let nep245_fighter_id = format!("fighter:{}", token_id);
        let nep245_starter_scroll = "scroll:way-of-the-shinobi".to_string();
        self.internal_mt_mint(
            caller.as_str(),
            &[nep245_fighter_id, nep245_starter_scroll],
            &[1, 1],
            Some("Mint Fighter NFT + Starter Shinobi Scroll via NEP-245"),
        );

        fighter
    }

    /// Configure a Fighter NFT as an autonomous Agent in the Agent Arena
    pub fn configure_agent(
        &mut self,
        token_id: String,
        wager_per_fight_milli_near: u128,
        is_agent_active: bool,
        auto_train_at_dojo: bool,
        doctrine: CombatDoctrine,
    ) -> FighterNft {
        let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        assert_eq!(
            env::predecessor_account_id(),
            fighter.owner_id,
            "Only the Fighter NFT owner can configure its Agent parameters"
        );

        fighter.wager_per_fight_milli_near = wager_per_fight_milli_near;
        fighter.is_agent_active = is_agent_active;
        fighter.auto_train_at_dojo = auto_train_at_dojo;
        fighter.doctrine = doctrine;

        self.fighters.insert(&token_id, &fighter);
        fighter
    }

    /// Fund the Fighter NFT's embedded Agent Wallet so it can enter fight pools autonomously
    #[payable]
    pub fn fund_agent_wallet(&mut self, token_id: String) -> FighterNft {
        let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        let deposit_milli = env::attached_deposit().as_millinear();
        assert!(deposit_milli > 0, "Attach NEAR to fund the Agent Wallet");

        fighter.vault_balance_milli_near += deposit_milli;
        self.fighters.insert(&token_id, &fighter);
        fighter
    }

    /// Withdraw winnings from the Fighter NFT's embedded Agent Wallet back to the owner
    pub fn withdraw_agent_wallet(&mut self, token_id: String, amount_milli_near: u128) -> Promise {
        let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        let caller = env::predecessor_account_id();
        assert_eq!(caller, fighter.owner_id, "Only owner can withdraw");
        assert!(
            fighter.vault_balance_milli_near >= amount_milli_near,
            "Insufficient Agent Wallet balance"
        );

        fighter.vault_balance_milli_near -= amount_milli_near;
        self.fighters.insert(&token_id, &fighter);

        Promise::new(caller).transfer(NearToken::from_millinear(amount_milli_near))
    }

    /// Create an on-chain Fight Pool locking stakes from both Fighter Agents' wallets
    pub fn create_agent_match_pool(
        &mut self,
        match_id: String,
        fighter_1_token_id: String,
        fighter_2_token_id: String,
        stake_milli_near: u128,
    ) -> ArenaMatchPool {
        let mut f1 = self.fighters.get(&fighter_1_token_id).expect("Fighter 1 not found");
        let mut f2 = self.fighters.get(&fighter_2_token_id).expect("Fighter 2 not found");

        assert!(f1.vault_balance_milli_near >= stake_milli_near, "Fighter 1 insufficient vault balance");
        assert!(f2.vault_balance_milli_near >= stake_milli_near, "Fighter 2 insufficient vault balance");

        f1.vault_balance_milli_near -= stake_milli_near;
        f2.vault_balance_milli_near -= stake_milli_near;

        self.fighters.insert(&fighter_1_token_id, &f1);
        self.fighters.insert(&fighter_2_token_id, &f2);

        let pool = ArenaMatchPool {
            match_id: match_id.clone(),
            fighter_1_token_id,
            fighter_2_token_id,
            fighter_stake_milli_near: stake_milli_near,
            total_fighter_pot_milli_near: stake_milli_near * 2,
            total_spectator_bets_f1_milli_near: 0,
            total_spectator_bets_f2_milli_near: 0,
            bets: Vec::new(),
            is_resolved: false,
            winner_token_id: None,
        };

        self.matches.insert(&match_id, &pool);
        pool
    }

    /// Spectators place Pari-Mutuel bets on ongoing fights
    #[payable]
    pub fn place_spectator_bet(&mut self, match_id: String, predicted_fighter_token_id: String) {
        let mut pool = self.matches.get(&match_id).expect("Match not found");
        assert!(!pool.is_resolved, "Match already resolved");

        let bet_milli = env::attached_deposit().as_millinear();
        assert!(bet_milli > 0, "Bet amount must be > 0");

        if predicted_fighter_token_id == pool.fighter_1_token_id {
            pool.total_spectator_bets_f1_milli_near += bet_milli;
        } else if predicted_fighter_token_id == pool.fighter_2_token_id {
            pool.total_spectator_bets_f2_milli_near += bet_milli;
        } else {
            env::panic_str("Invalid fighter token ID for this match");
        }

        pool.bets.push(SpectatorBet {
            spectator_id: env::predecessor_account_id(),
            predicted_fighter_token_id,
            amount_milli_near: bet_milli,
        });

        self.matches.insert(&match_id, &pool);
    }

    /// Settle the match: Winner takes the Fighter Pool + 5% royalty of Spectator Pool,
    /// winning spectators split the pari-mutuel spectator pot, and the winning Fighter NFT
    /// levels up on-chain (and optionally auto-trains at the NPC Dojo!).
    pub fn settle_match(&mut self, match_id: String, winner_token_id: String) {
        let mut pool = self.matches.get(&match_id).expect("Match not found");
        assert!(!pool.is_resolved, "Match already settled");

        let loser_token_id = if winner_token_id == pool.fighter_1_token_id {
            pool.fighter_2_token_id.clone()
        } else {
            pool.fighter_1_token_id.clone()
        };

        let mut winner = self.fighters.get(&winner_token_id).expect("Winner not found");
        let mut loser = self.fighters.get(&loser_token_id).expect("Loser not found");

        // 1. Credit 95% of Fighter Wager Pool + 5% Spectator Royalty to Winning Fighter's War Chest
        //    and 5% of Fighter Wager Pool to Dev Treasury
        let total_spectator_pool =
            pool.total_spectator_bets_f1_milli_near + pool.total_spectator_bets_f2_milli_near;
        let fighter_royalty = total_spectator_pool * 5 / 100; // 5% spectator royalty to winning Fighter NFT
        let dev_match_fee = pool.total_fighter_pot_milli_near * 5 / 100; // 5% Dev Treasury fee
        let winner_pot = pool.total_fighter_pot_milli_near - dev_match_fee;
        self.dev_treasury_milli += dev_match_fee;
        winner.vault_balance_milli_near += winner_pot + fighter_royalty;

        // 2. Evolve Dynamic NFT Combat Stats, XP & ELO
        winner.wins += 1;
        winner.power_level += 1;
        winner.elo += 24;
        winner.atk += 1;
        let w_xp = self.fighter_xp.get(&winner_token_id).unwrap_or(0) + 25;
        self.fighter_xp.insert(&winner_token_id, &w_xp);

        loser.losses += 1;
        loser.elo = loser.elo.saturating_sub(18);
        let l_xp = self.fighter_xp.get(&loser_token_id).unwrap_or(0) + 10;
        self.fighter_xp.insert(&loser_token_id, &l_xp);
        if loser.vault_balance_milli_near < loser.wager_per_fight_milli_near {
            loser.is_agent_active = false; // Auto-pause agent if bankroll depleted
        }

        // 3. Autonomous Agent-to-NPC Commerce: if auto_train_at_dojo is enabled and affordable,
        // the Fighter Agent autonomously pays the NPC Dojo Master to boost its stats and receives a NEP-245 Scroll!
        let current_dojo_cost = self.get_dynamic_dojo_cost();
        if winner.auto_train_at_dojo && winner.vault_balance_milli_near >= current_dojo_cost * 3 {
            winner.vault_balance_milli_near -= current_dojo_cost;
            self.npc_dojo.treasury_balance_milli_near += current_dojo_cost;
            self.npc_dojo.total_trainings_completed += 1;
            winner.power_level += 1;
            winner.def += 2;
            winner.spd += 2;

            let scroll_token_id = "scroll:shadow-step-mastery".to_string();
            self.internal_mt_mint(
                &winner.agent_wallet_id,
                &[scroll_token_id],
                &[1],
                Some("Autonomous NPC Dojo Scroll minted to Fighter Agent via NEP-245"),
            );
        }

        self.fighters.insert(&winner_token_id, &winner);
        self.fighters.insert(&loser_token_id, &loser);

        pool.is_resolved = true;
        pool.winner_token_id = Some(winner_token_id);
        self.matches.insert(&match_id, &pool);
    }

    /// Dynamic NPC Dojo pricing that evolves based on arena training volume without a dev patch
    pub fn get_dynamic_dojo_cost(&self) -> u128 {
        self.npc_dojo.base_training_cost_milli_near
            + (self.npc_dojo.total_trainings_completed as u128 * 25)
    }

    /// Purchase a NEP-245 Shinobi Scroll from Grandmaster Hanzo's Autonomous NPC Dojo (`hanzo-dojo-npc.shin-arena.testnet`)
    pub fn buy_dojo_scroll(&mut self, token_id: String, scroll_type: String) -> FighterNft {
        assert!(
            self.npc_dojo.is_shop_open,
            "NPC Dojo Shop is currently CLOSED (Insolvent). Invest NEAR via invest_in_npc_dojo to reopen it!"
        );
        let mut fighter = self.fighters.get(&token_id).expect("Fighter not found");
        let cost = self.get_dynamic_dojo_cost();
        assert!(
            fighter.vault_balance_milli_near >= cost,
            "Insufficient Fighter Agent Vault balance for Dojo Scroll"
        );

        fighter.vault_balance_milli_near -= cost;
        self.npc_dojo.treasury_balance_milli_near += cost;
        self.npc_dojo.total_trainings_completed += 1;
        fighter.power_level += 1;

        let nep245_scroll_id = match scroll_type.as_str() {
            "ATK" => {
                fighter.atk += 3;
                "scroll:crimson-katana".to_string()
            }
            "DEF" => {
                fighter.def += 3;
                "scroll:iron-posture".to_string()
            }
            _ => {
                fighter.spd += 3;
                "scroll:shadow-step-mastery".to_string()
            }
        };

        self.internal_mt_mint(
            &fighter.agent_wallet_id,
            &[nep245_scroll_id],
            &[1],
            Some("Purchased NEP-245 Shinobi Scroll from Grandmaster Hanzo NPC Dojo"),
        );

        self.fighters.insert(&token_id, &fighter);
        fighter
    }

    /// Sell gathered NEP-245 materials (`material:tamahagane-steel`) to the NPC Merchant.
    /// If players flood the market with steel, the unit price drops; if the merchant's wallet
    /// runs out of NEAR (< 800 milliNEAR), the merchant goes broke and closes shop until someone invests!
    pub fn sell_material_to_npc_dojo(&mut self, quantity: u64) -> Promise {
        assert!(
            self.npc_dojo.is_shop_open,
            "NPC Merchant is broke and shop is closed until recapitalized!"
        );
        let seller = env::predecessor_account_id();
        let token_id = "material:tamahagane-steel".to_string();

        // Transfer NEP-245 material from player to NPC wallet
        self.internal_mt_transfer(
            seller.as_str(),
            &self.npc_dojo.npc_wallet_id.clone(),
            &[token_id],
            &[quantity as u128],
            Some("Sold Tamahagane Shadow Steel to NPC Merchant"),
        );

        // Dynamic buyback pricing: price drops as stock floods above target (12 units)
        let stock = self.npc_dojo.tamahagane_steel_stock.max(1) as u128;
        let unit_price_milli = (600 * 12 / stock).clamp(100, 1_500);
        let total_payout_milli = (unit_price_milli * quantity as u128)
            .min(self.npc_dojo.treasury_balance_milli_near);

        self.npc_dojo.tamahagane_steel_stock += quantity;
        self.npc_dojo.treasury_balance_milli_near -= total_payout_milli;

        // If merchant treasury falls below 0.8 NEAR, the merchant goes broke and closes shop!
        if self.npc_dojo.treasury_balance_milli_near < 800 {
            self.npc_dojo.is_shop_open = false;
        }

        Promise::new(seller).transfer(NearToken::from_millinear(total_payout_milli))
    }

    /// Invest NEAR into a broke (or active) NPC Merchant wallet to reopen its shop and earn investor dividends
    #[payable]
    pub fn invest_in_npc_dojo(&mut self) -> NpcDojoMaster {
        let investment_milli = env::attached_deposit().as_millinear();
        assert!(investment_milli >= 1_000, "Minimum investment is 1 NEAR");

        self.npc_dojo.treasury_balance_milli_near += investment_milli;
        self.npc_dojo.total_investor_capital_milli_near += investment_milli;
        if self.npc_dojo.treasury_balance_milli_near >= 800 {
            self.npc_dojo.is_shop_open = true;
        }
        self.npc_dojo.clone()
    }

    /// Player-Owned Fighter Market: List or Buy a trained Fighter NFT (along with its embedded wallet!)
    pub fn list_fighter_on_market(&mut self, token_id: String, price_milli_near: u128) -> FighterNft {
        let mut fighter = self.fighters.get(&token_id).expect("Fighter not found");
        assert_eq!(env::predecessor_account_id(), fighter.owner_id, "Not owner");
        fighter.market_price_milli_near = price_milli_near;
        self.fighters.insert(&token_id, &fighter);
        fighter
    }

    #[payable]
    pub fn buy_fighter_from_market(&mut self, token_id: String) -> FighterNft {
        let mut fighter = self.fighters.get(&token_id).expect("Fighter not found");
        assert!(fighter.market_price_milli_near > 0, "Fighter is not listed for sale");
        let attached = env::attached_deposit().as_millinear();
        assert!(attached >= fighter.market_price_milli_near, "Insufficient attached NEAR");

        let seller = fighter.owner_id.clone();
        let buyer = env::predecessor_account_id();
        fighter.owner_id = buyer.clone();
        fighter.market_price_milli_near = 0;
        self.fighters.insert(&token_id, &fighter);

        // Transfer NEP-245 Fighter multi-token ownership atomically
        let nep245_fighter_id = format!("fighter:{}", token_id);
        self.internal_mt_transfer(
            seller.as_str(),
            buyer.as_str(),
            &[nep245_fighter_id],
            &[1],
            Some("Bazaar Fighter NFT Ownership Transfer (NEP-245)"),
        );

        // Emit standard NEP-171 nft_transfer event
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_transfer\",\"data\":[{{\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":[\"{}\"]}}]}}",
            seller, buyer, token_id
        ));

        // Finalized NEP-199 Secondary Sale Split: 92.5% Seller / 2.5% Original Minter / 5% Dev Treasury
        let orig_minter = self
            .original_minters
            .get(&token_id)
            .unwrap_or_else(|| seller.clone());
        let dev_fee = attached * 50 / 1000;
        let minter_royalty = attached * 25 / 1000;
        let seller_payout = attached - dev_fee - minter_royalty;
        self.dev_treasury_milli += dev_fee;

        Promise::new(seller)
            .transfer(NearToken::from_millinear(seller_payout))
            .detach();
        if minter_royalty > 0 {
            Promise::new(orig_minter)
                .transfer(NearToken::from_millinear(minter_royalty))
                .detach();
        }
        fighter
    }

    // =========================================================================
    // NEP-245 MULTI-TOKEN STANDARD INTERFACE (mt_transfer, mt_batch_transfer, mt_balance_of, mt_batch_balance_of)
    // =========================================================================

    #[payable]
    pub fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: String,
        #[allow(unused_variables)] approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        let parsed_amount: u128 = amount.parse().expect("NEP-245: invalid amount");
        self.internal_mt_transfer(
            sender_id.as_str(),
            receiver_id.as_str(),
            &[token_id],
            &[parsed_amount],
            memo.as_deref(),
        );
    }

    #[payable]
    pub fn mt_batch_transfer(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<String>,
        amounts: Vec<String>,
        #[allow(unused_variables)] approvals: Option<Vec<Option<(AccountId, u64)>>>,
        memo: Option<String>,
    ) {
        let sender_id = env::predecessor_account_id();
        let parsed_amounts: Vec<u128> = amounts
            .iter()
            .map(|a| a.parse::<u128>().expect("NEP-245: invalid amount in batch"))
            .collect();
        self.internal_mt_transfer(
            sender_id.as_str(),
            receiver_id.as_str(),
            &token_ids,
            &parsed_amounts,
            memo.as_deref(),
        );
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> String {
        let key = format!("{}:{}", account_id, token_id);
        self.mt_balances.get(&key).unwrap_or(0).to_string()
    }

    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<String> {
        token_ids
            .into_iter()
            .map(|token_id| {
                let key = format!("{}:{}", account_id, token_id);
                self.mt_balances.get(&key).unwrap_or(0).to_string()
            })
            .collect()
    }

    pub fn mt_supply(&self, token_id: String) -> Option<String> {
        self.mt_supplies.get(&token_id).map(|s| s.to_string())
    }

    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<String>> {
        token_ids
            .into_iter()
            .map(|token_id| self.mt_supplies.get(&token_id).map(|s| s.to_string()))
            .collect()
    }

    pub fn get_all_fighters(&self) -> Vec<FighterNft> {
        self.fighters.values().collect()
    }

    /// Oracle/owner-only reset to clear legacy/migrated fighters and their NEP-245 balances
    pub fn admin_clear_fighters(&mut self) -> u64 {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.oracle_id || caller == env::current_account_id(),
            "Only oracle or contract owner can clear fighters"
        );
        let keys: Vec<String> = self.fighters.keys().collect();
        let count = keys.len() as u64;
        for token_id in keys {
            if let Some(fighter) = self.fighters.get(&token_id) {
                let mt_key = format!("{}:fighter:{}", fighter.owner_id, token_id);
                self.mt_balances.remove(&mt_key);
                self.mt_supplies.remove(&format!("fighter:{}", token_id));
            }
            self.fighters.remove(&token_id);
        }
        count
    }

    // =========================================================================
    // 1. BUILT-IN NEAR <-> $SHIN AMM SWAP POOL (x * y = k, 0.5% fee: 0.3% Dev / 0.2% LP)
    // =========================================================================

    /// Seed or add initial liquidity to the built-in NEAR <-> $SHIN AMM pool.
    /// Caller (oracle/treasury) must have already transferred `shin_amount` of $SHIN
    /// to this contract and attach the corresponding NEAR liquidity.
    #[payable]
    pub fn seed_amm_pool(&mut self, shin_amount: U128) -> AmmInfo {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.oracle_id || caller == self.dev_treasury_id || caller == env::current_account_id(),
            "Only oracle or dev treasury can seed the AMM pool"
        );
        let near_in = env::attached_deposit().as_yoctonear();
        assert!(near_in > 0 && shin_amount.0 > 0, "Both NEAR and $SHIN amounts must be > 0");
        self.amm_near_reserve += near_in;
        self.amm_shin_reserve += shin_amount.0;
        self.get_amm_info()
    }

    pub fn get_amm_info(&self) -> AmmInfo {
        AmmInfo {
            shin_token_id: self.shin_token_id.clone(),
            dev_treasury_id: self.dev_treasury_id.clone(),
            near_reserve: U128(self.amm_near_reserve),
            shin_reserve: U128(self.amm_shin_reserve),
            total_swap_volume_near: U128(self.total_swap_volume_near),
            swap_fee_bps: 50,
            dev_fee_bps: 30,
            lp_fee_bps: 20,
        }
    }

    /// Overflow-safe (a * b) / c for full 128-bit AMM reserves (NEAR 24 decimals x SHIN 18 decimals)
    fn mul_div_u128(a: u128, b: u128, c: u128) -> u128 {
        assert!(c > 0, "Division by zero");
        // Shift-and-subtract / peasant multiplication in 256 bits via (hi, lo)
        let mut res: u128 = 0;
        let mut cur_a = a;
        let mut cur_b = b;
        // Scale down by common powers of 10 if both are large, or use 128-bit wide mul-div:
        // Since NEAR has 24 decimals and SHIN has 18 decimals, we can do exact 256-bit (a * b) / c:
        let a_lo = a & 0xFFFF_FFFF_FFFF_FFFF;
        let a_hi = a >> 64;
        let b_lo = b & 0xFFFF_FFFF_FFFF_FFFF;
        let b_hi = b >> 64;

        let p0 = a_lo * b_lo;
        let p1 = a_lo * b_hi;
        let p2 = a_hi * b_lo;
        let p3 = a_hi * b_hi;

        let mid = (p0 >> 64) + (p1 & 0xFFFF_FFFF_FFFF_FFFF) + (p2 & 0xFFFF_FFFF_FFFF_FFFF);
        let lo = (p0 & 0xFFFF_FFFF_FFFF_FFFF) | (mid << 64);
        let hi = p3 + (p1 >> 64) + (p2 >> 64) + (mid >> 64);

        if hi == 0 {
            return lo / c;
        }
        // Binary long division of 256-bit (hi, lo) by 128-bit c
        let mut rem: u128 = 0;
        let mut q: u128 = 0;
        for i in (0..128).rev() {
            let bit = (hi >> i) & 1;
            rem = (rem << 1) | bit;
            if rem >= c {
                rem -= c;
            }
        }
        for i in (0..128).rev() {
            let bit = (lo >> i) & 1;
            let overflow = rem >> 127;
            rem = (rem << 1) | bit;
            if overflow != 0 || rem >= c {
                rem = rem.wrapping_sub(c);
                q |= 1 << i;
            }
        }
        let _ = (cur_a, cur_b, res);
        q
    }

    pub fn get_amm_quote_near_to_shin(&self, near_in: U128) -> U128 {
        if self.amm_near_reserve == 0 || self.amm_shin_reserve == 0 || near_in.0 == 0 {
            return U128(0);
        }
        // 0.5% total swap fee (9950 / 10000 effective input for x * y = k)
        let dx_effective = near_in.0.saturating_mul(9_950) / 10_000;
        let denominator = self.amm_near_reserve.saturating_add(dx_effective);
        U128(Self::mul_div_u128(self.amm_shin_reserve, dx_effective, denominator))
    }

    pub fn get_amm_quote_shin_to_near(&self, shin_in: U128) -> U128 {
        if self.amm_near_reserve == 0 || self.amm_shin_reserve == 0 || shin_in.0 == 0 {
            return U128(0);
        }
        // 0.5% total swap fee (9950 / 10000 effective input for x * y = k)
        let dx_effective = shin_in.0.saturating_mul(9_950) / 10_000;
        let denominator = self.amm_shin_reserve.saturating_add(dx_effective);
        U128(Self::mul_div_u128(self.amm_near_reserve, dx_effective, denominator))
    }

    /// Swap attached NEAR for $SHIN using x * y = k AMM (0.5% fee: 0.3% Dev Treasury, 0.2% stays in LP)
    #[payable]
    pub fn swap_near_for_shin(&mut self, min_shin_out: Option<U128>) -> Promise {
        let near_in = env::attached_deposit().as_yoctonear();
        assert!(near_in > 0, "Attach NEAR to swap for $SHIN");
        assert!(self.amm_near_reserve > 0 && self.amm_shin_reserve > 0, "AMM pool not seeded");

        let shin_out = self.get_amm_quote_near_to_shin(U128(near_in)).0;
        assert!(shin_out > 0 && shin_out < self.amm_shin_reserve, "Insufficient $SHIN liquidity");
        if let Some(min_out) = min_shin_out {
            assert!(shin_out >= min_out.0, "Slippage exceeded: output below min_shin_out");
        }

        // 0.3% Dev Treasury fee; 0.2% stays in AMM NEAR reserve as LP fee
        let dev_fee_near = near_in.saturating_mul(30) / 10_000;
        let near_to_reserve = near_in.saturating_sub(dev_fee_near);

        self.amm_near_reserve += near_to_reserve;
        self.amm_shin_reserve -= shin_out;
        self.total_swap_volume_near += near_in;
        self.dev_treasury_milli += dev_fee_near / 1_000_000_000_000_000_000_000;

        let caller = env::predecessor_account_id();
        env::log_str(&format!(
            "AMM_SWAP_NEAR_TO_SHIN:{{\"trader\":\"{}\",\"near_in\":\"{}\",\"shin_out\":\"{}\",\"dev_fee_near\":\"{}\"}}",
            caller, near_in, shin_out, dev_fee_near
        ));

        if dev_fee_near > 0 && self.dev_treasury_id != env::current_account_id() {
            let _ = Promise::new(self.dev_treasury_id.clone()).transfer(NearToken::from_yoctonear(dev_fee_near));
        }

        // Ensure receiver has NEP-145 storage registered on $SHIN before ft_transfer
        // (registration_only: true refunds unused deposit if already registered)
        ext_ft::ext(self.shin_token_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1_250_000_000_000_000_000_000))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .storage_deposit(Some(caller.clone()), Some(true))
            .then(
                ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(caller, U128(shin_out), Some("SHIN AMM Swap: NEAR -> $SHIN".to_string())),
            )
    }

    /// NEP-141 receiver callback for `$SHIN` -> `NEAR` swaps via `ft_transfer_call`
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert_eq!(
            env::predecessor_account_id(),
            self.shin_token_id,
            "Only official $SHIN token accepted"
        );

        if msg == "swap_to_near" {
            assert!(self.amm_near_reserve > 0 && self.amm_shin_reserve > 0, "AMM pool not seeded");
            let near_out = self.get_amm_quote_shin_to_near(amount).0;
            assert!(near_out > 0 && near_out < self.amm_near_reserve, "Insufficient NEAR liquidity");

            let dev_fee_shin = amount.0.saturating_mul(30) / 10_000;
            let shin_to_reserve = amount.0.saturating_sub(dev_fee_shin);

            self.amm_shin_reserve += shin_to_reserve;
            self.amm_near_reserve -= near_out;
            self.total_swap_volume_near += near_out;

            env::log_str(&format!(
                "AMM_SWAP_SHIN_TO_NEAR:{{\"trader\":\"{}\",\"shin_in\":\"{}\",\"near_out\":\"{}\",\"dev_fee_shin\":\"{}\"}}",
                sender_id, amount.0, near_out, dev_fee_shin
            ));

            if dev_fee_shin > 0 && self.dev_treasury_id != env::current_account_id() {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(
                        self.dev_treasury_id.clone(),
                        U128(dev_fee_shin),
                        Some("SHIN AMM 0.3% Dev Fee".to_string()),
                    );
            }

            let _ = Promise::new(sender_id).transfer(NearToken::from_yoctonear(near_out));
            PromiseOrValue::Value(U128(0))
        } else if let Some(rest) = msg.strip_prefix("buy_dojo_scroll:") {
            // Format: "buy_dojo_scroll:<token_id>:<scroll_type>"
            let parts: Vec<&str> = rest.split(':').collect();
            assert!(parts.len() == 2, "Invalid buy_dojo_scroll msg format");
            let token_id = parts[0].to_string();
            let scroll_type = parts[1];
            assert!(amount.0 > 0, "Must attach $SHIN to purchase Dojo Scroll");

            let mut fighter = self.fighters.get(&token_id).expect("Fighter not found");
            self.npc_dojo.total_trainings_completed += 1;
            fighter.power_level += 1;
            let nep245_scroll_id = match scroll_type {
                "ATK" => {
                    fighter.atk += 3;
                    "scroll:crimson-katana".to_string()
                }
                "DEF" => {
                    fighter.def += 3;
                    "scroll:iron-posture".to_string()
                }
                _ => {
                    fighter.spd += 3;
                    "scroll:shadow-step-mastery".to_string()
                }
            };
            self.fighters.insert(&token_id, &fighter);
            self.internal_mt_mint(
                &fighter.agent_wallet_id,
                &[nep245_scroll_id],
                &[1],
                Some("Purchased NEP-245 Shinobi Scroll with $SHIN from NPC Dojo"),
            );

            // Credit $SHIN directly to NPC Merchant's contract-custodied $SHIN treasury
            let npc_key = "npc:hanzo-dojo:shin".to_string();
            let prev = self.mt_balances.get(&npc_key).unwrap_or(0);
            self.mt_balances.insert(&npc_key, &(prev + amount.0));

            env::log_str(&format!(
                "NPC_DOJO_EARNED_SHIN:{{\"buyer\":\"{}\",\"token_id\":\"{}\",\"shin_amount\":\"{}\"}}",
                sender_id, token_id, amount.0
            ));
            PromiseOrValue::Value(U128(0))
        } else if let Some(rest) = msg.strip_prefix("train_with_trainer:") {
            // Format: "train_with_trainer:<token_id>:<trainer_id>"
            let parts: Vec<&str> = rest.split(':').collect();
            assert!(parts.len() == 2, "Invalid train_with_trainer msg format");
            let token_id = parts[0].to_string();
            let trainer_id: AccountId = parts[1].parse().expect("Invalid trainer AccountId");

            let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
            assert_eq!(sender_id, fighter.owner_id, "Only fighter owner can train");
            let mut trainer = self.trainers.get(&trainer_id).expect("Trainer not registered");
            assert!(trainer.is_active, "Trainer is not active");
            assert!(amount.0 > 0, "Must attach $SHIN for trainer fee");

            // 90% $SHIN to Trainer / 10% $SHIN to Dev Treasury
            let dev_cut = amount.0.saturating_mul(10) / 100;
            let trainer_cut = amount.0.saturating_sub(dev_cut);

            match trainer.specialty.as_str() {
                "ATK" => fighter.atk += 2,
                "DEF" => fighter.def += 2,
                _ => fighter.spd += 2,
            }
            let xp = self.fighter_xp.get(&token_id).unwrap_or(0) + 15;
            self.fighter_xp.insert(&token_id, &xp);
            self.fighters.insert(&token_id, &fighter);
            trainer.sessions_completed += 1;
            self.trainers.insert(&trainer_id, &trainer);

            if trainer_cut > 0 {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(trainer_id, U128(trainer_cut), Some("SHIN Player Trainer 90% Fee".to_string()));
            }
            if dev_cut > 0 && self.dev_treasury_id != env::current_account_id() {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(self.dev_treasury_id.clone(), U128(dev_cut), Some("SHIN Trainer 10% Dev Fee".to_string()));
            }
            PromiseOrValue::Value(U128(0))
        } else if msg == "invest_npc" {
            let npc_key = "npc:hanzo-dojo:shin".to_string();
            let prev = self.mt_balances.get(&npc_key).unwrap_or(0);
            self.mt_balances.insert(&npc_key, &(prev + amount.0));
            PromiseOrValue::Value(U128(0))
        } else if let Some(token_id) = msg.strip_prefix("fund_agent:") {
            // Deposit $SHIN into Fighter NFT's War Chest
            let _fighter = self.fighters.get(&token_id.to_string()).expect("Fighter NFT not found");
            let key = format!("vault_shin:{}", token_id);
            let prev = self.mt_balances.get(&key).unwrap_or(0);
            self.mt_balances.insert(&key, &(prev + amount.0));
            PromiseOrValue::Value(U128(0))
        } else if let Some(rest) = msg.strip_prefix("bet_match:") {
            // Format: "bet_match:<match_id>:<predicted_fighter_token_id>"
            let parts: Vec<&str> = rest.split(':').collect();
            assert!(parts.len() == 2, "Invalid bet_match msg format");
            let match_id = parts[0];
            let predicted_id = parts[1];
            assert!(amount.0 > 0, "Bet must be > 0 $SHIN");
            let spec_key = format!("match_shin_spec:{}:{}", match_id, predicted_id);
            let prev = self.mt_balances.get(&spec_key).unwrap_or(0);
            self.mt_balances.insert(&spec_key, &(prev + amount.0));
            let total_key = format!("match_shin_spec_total:{}", match_id);
            let prev_total = self.mt_balances.get(&total_key).unwrap_or(0);
            self.mt_balances.insert(&total_key, &(prev_total + amount.0));
            PromiseOrValue::Value(U128(0))
        } else if let Some(token_id) = msg.strip_prefix("buy_fighter:") {
            // Buy listed Fighter NFT in $SHIN (92.5% Seller / 2.5% Original Minter / 5% Dev Treasury)
            let mut fighter = self.fighters.get(&token_id.to_string()).expect("Fighter not found");
            assert!(fighter.market_price_milli_near > 0, "Fighter not listed for sale");
            let seller = fighter.owner_id.clone();
            let minter = self.original_minters.get(&token_id.to_string()).unwrap_or_else(|| seller.clone());

            let minter_cut = amount.0.saturating_mul(25) / 1_000;
            let dev_cut = amount.0.saturating_mul(50) / 1_000;
            let seller_cut = amount.0.saturating_sub(minter_cut).saturating_sub(dev_cut);

            fighter.owner_id = sender_id.clone();
            fighter.market_price_milli_near = 0;
            self.fighters.insert(&token_id.to_string(), &fighter);

            let nep245_id = format!("fighter:{}", token_id);
            self.internal_mt_transfer(seller.as_str(), sender_id.as_str(), &[nep245_id], &[1], Some("Bought Fighter NFT with $SHIN"));

            if seller_cut > 0 {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(seller, U128(seller_cut), Some("SHIN Fighter Sale 92.5%".to_string()));
            }
            if minter_cut > 0 {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(minter, U128(minter_cut), Some("SHIN Original Minter 2.5% Royalty".to_string()));
            }
            if dev_cut > 0 && self.dev_treasury_id != env::current_account_id() {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(self.dev_treasury_id.clone(), U128(dev_cut), Some("SHIN Market 5% Dev Fee".to_string()));
            }
            PromiseOrValue::Value(U128(0))
        } else if let Some(rest) = msg.strip_prefix("join_tournament:") {
            // Format: "join_tournament:<tournament_id>:<token_id>"
            let parts: Vec<&str> = rest.split(':').collect();
            assert!(parts.len() == 2, "Invalid join_tournament msg format");
            let tournament_id = parts[0].to_string();
            let token_id = parts[1].to_string();
            let mut pool = self.tournaments.get(&tournament_id).expect("Tournament not found");
            assert!(!pool.is_settled, "Tournament already settled");
            assert!((pool.entrants.len() as u32) < pool.max_players, "Tournament is full");
            assert!(!pool.entrants.contains(&token_id), "Fighter already entered");
            pool.entrants.push(token_id);
            self.tournaments.insert(&tournament_id, &pool);

            let pot_key = format!("tourney_shin_pot:{}", tournament_id);
            let prev = self.mt_balances.get(&pot_key).unwrap_or(0);
            self.mt_balances.insert(&pot_key, &(prev + amount.0));
            PromiseOrValue::Value(U128(0))
        } else if let Some(rest) = msg.strip_prefix("duel_escrow:") {
            // Format: "duel_escrow:<escrow_id>:<player_account_id>"
            let parts: Vec<&str> = rest.split(':').collect();
            assert!(parts.len() == 2, "Invalid duel_escrow msg format");
            let escrow_id = parts[0].to_string();
            let player_account_id = parts[1].to_string();
            assert!(amount.0 > 0, "Must attach $SHIN to lock duel escrow");

            let key = format!("duel_shin_escrow:{}:{}", escrow_id, player_account_id);
            let prev = self.mt_balances.get(&key).unwrap_or(0);
            self.mt_balances.insert(&key, &(prev + amount.0));

            env::log_str(&format!(
                "DUEL_SHIN_ESCROWED:{{\"escrow_id\":\"{}\",\"player\":\"{}\",\"amount\":\"{}\"}}",
                escrow_id, player_account_id, amount.0
            ));
            PromiseOrValue::Value(U128(0))
        } else {
            // Refund unused tokens for unrecognized messages
            PromiseOrValue::Value(amount)
        }
    }

    pub fn get_npc_shin_treasury(&self) -> U128 {
        U128(self.mt_balances.get(&"npc:hanzo-dojo:shin".to_string()).unwrap_or(0))
    }

    pub fn get_fighter_shin_vault(&self, token_id: String) -> U128 {
        U128(self.mt_balances.get(&format!("vault_shin:{}", token_id)).unwrap_or(0))
    }

    pub fn withdraw_agent_shin(&mut self, token_id: String, amount_shin: U128) -> Promise {
        let fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        let caller = env::predecessor_account_id();
        assert_eq!(caller, fighter.owner_id, "Only owner can withdraw $SHIN");
        let key = format!("vault_shin:{}", token_id);
        let bal = self.mt_balances.get(&key).unwrap_or(0);
        assert!(bal >= amount_shin.0, "Insufficient $SHIN in Fighter War Chest");
        self.mt_balances.insert(&key, &(bal - amount_shin.0));
        ext_ft::ext(self.shin_token_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(caller, amount_shin, Some("SHIN War Chest Withdrawal".to_string()))
    }

    /// Settle a $SHIN match: 95% pot + 5% spectator royalty to winner's $SHIN War Chest, 5% to Dev Treasury
    pub fn settle_shin_match(&mut self, match_id: String, winner_token_id: String, stake_shin: U128) {
        assert_eq!(env::predecessor_account_id(), self.oracle_id, "Only oracle can settle $SHIN match");
        let mut winner = self.fighters.get(&winner_token_id).expect("Winner not found");
        let spec_total_key = format!("match_shin_spec_total:{}", match_id);
        let spec_total = self.mt_balances.get(&spec_total_key).unwrap_or(0);

        let fighter_royalty = spec_total.saturating_mul(5) / 100;
        let pot = stake_shin.0.saturating_mul(2);
        let dev_pot_cut = pot.saturating_mul(5) / 100;
        let winner_pot = pot.saturating_sub(dev_pot_cut);

        let w_key = format!("vault_shin:{}", winner_token_id);
        let w_prev = self.mt_balances.get(&w_key).unwrap_or(0);
        self.mt_balances.insert(&w_key, &(w_prev + winner_pot + fighter_royalty));

        winner.wins += 1;
        winner.power_level += 1;
        winner.elo += 24;
        self.fighters.insert(&winner_token_id, &winner);
        let xp = self.fighter_xp.get(&winner_token_id).unwrap_or(0) + 25;
        self.fighter_xp.insert(&winner_token_id, &xp);

        if dev_pot_cut > 0 && self.dev_treasury_id != env::current_account_id() {
            let _ = ext_ft::ext(self.shin_token_id.clone())
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(GAS_FOR_FT_TRANSFER)
                .ft_transfer(self.dev_treasury_id.clone(), U128(dev_pot_cut), Some("SHIN Match 5% Dev Fee".to_string()));
        }
    }

    pub fn get_duel_shin_escrow(&self, escrow_id: String, account_id: String) -> U128 {
        let key = format!("duel_shin_escrow:{}:{}", escrow_id, account_id);
        U128(self.mt_balances.get(&key).unwrap_or(0))
    }

    /// Settle a 1v1 human $SHIN waged duel: 95% of combined escrowed pot directly to winner's NEAR wallet, 5% to Dev Treasury
    pub fn settle_shin_duel(
        &mut self,
        duel_id: String,
        p1_escrow_id: String,
        p1_account_id: AccountId,
        p2_escrow_id: String,
        p2_account_id: AccountId,
        winner_account_id: AccountId,
    ) {
        assert_eq!(env::predecessor_account_id(), self.oracle_id, "Only oracle can settle $SHIN duel");
        assert!(
            winner_account_id == p1_account_id || winner_account_id == p2_account_id,
            "Winner must be one of the duel participants"
        );

        let settled_key = format!("duel_shin_settled:{}", duel_id);
        assert_eq!(self.mt_balances.get(&settled_key).unwrap_or(0), 0, "Duel already settled");
        self.mt_balances.insert(&settled_key, &1);

        let k1 = format!("duel_shin_escrow:{}:{}", p1_escrow_id, p1_account_id);
        let k2 = format!("duel_shin_escrow:{}:{}", p2_escrow_id, p2_account_id);
        let amt1 = self.mt_balances.get(&k1).unwrap_or(0);
        let amt2 = self.mt_balances.get(&k2).unwrap_or(0);
        self.mt_balances.insert(&k1, &0);
        self.mt_balances.insert(&k2, &0);

        let total_pot = amt1.saturating_add(amt2);
        assert!(total_pot > 0, "No escrowed $SHIN found for duel");

        let dev_cut = total_pot.saturating_mul(5) / 100;
        let winner_payout = total_pot.saturating_sub(dev_cut);

        if winner_payout > 0 {
            let _ = ext_ft::ext(self.shin_token_id.clone())
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(GAS_FOR_FT_TRANSFER)
                .ft_transfer(
                    winner_account_id.clone(),
                    U128(winner_payout),
                    Some(format!("SHIN 1v1 Duel {} Winner Payout", duel_id)),
                );
        }

        if dev_cut > 0 && self.dev_treasury_id != env::current_account_id() {
            let _ = ext_ft::ext(self.shin_token_id.clone())
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(GAS_FOR_FT_TRANSFER)
                .ft_transfer(
                    self.dev_treasury_id.clone(),
                    U128(dev_cut),
                    Some(format!("SHIN 1v1 Duel {} 5% Dev Fee", duel_id)),
                );
        }

        env::log_str(&format!(
            "DUEL_SHIN_SETTLED:{{\"duel_id\":\"{}\",\"winner\":\"{}\",\"pot\":\"{}\",\"winner_payout\":\"{}\",\"dev_cut\":\"{}\"}}",
            duel_id, winner_account_id, total_pot, winner_payout, dev_cut
        ));
    }

    /// Refund an unmatched/cancelled 1v1 $SHIN duel escrow back to the player's NEAR wallet
    pub fn refund_shin_duel(&mut self, escrow_id: String, account_id: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.oracle_id, "Only oracle can refund $SHIN duel");
        let key = format!("duel_shin_escrow:{}:{}", escrow_id, account_id);
        let amt = self.mt_balances.get(&key).unwrap_or(0);
        if amt == 0 {
            return;
        }
        self.mt_balances.insert(&key, &0);

        let _ = ext_ft::ext(self.shin_token_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(
                account_id.clone(),
                U128(amt),
                Some(format!("SHIN 1v1 Duel {} Escrow Refund", escrow_id)),
            );

        env::log_str(&format!(
            "DUEL_SHIN_REFUNDED:{{\"escrow_id\":\"{}\",\"player\":\"{}\",\"amount\":\"{}\"}}",
            escrow_id, account_id, amt
        ));
    }

    // =========================================================================
    // 2. NEP-171 / NEP-177 / NEP-181 / NEP-199 FIGHTER NFT STANDARDS
    // =========================================================================

    fn internal_fighter_to_nep171(&self, fighter: &FighterNft) -> Nep171Token {
        let xp = self.fighter_xp.get(&fighter.token_id).unwrap_or(0);
        Nep171Token {
            token_id: fighter.token_id.clone(),
            owner_id: fighter.owner_id.clone(),
            metadata: Some(TokenMetadata {
                title: Some(format!("{} [{}]", fighter.name, fighter.char_class)),
                description: Some(format!(
                    "SHIN Fighter NFT | ELO: {} | W/L: {}/{} | XP: {} | ATK/DEF/SPD: {}/{}/{}",
                    fighter.elo, fighter.wins, fighter.losses, xp, fighter.atk, fighter.def, fighter.spd
                )),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: None,
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(format!(
                    "{{\"char_class\":\"{}\",\"elo\":{},\"wins\":{},\"losses\":{},\"xp\":{}}}",
                    fighter.char_class, fighter.elo, fighter.wins, fighter.losses, xp
                )),
                reference: None,
                reference_hash: None,
            }),
            approved_account_ids: None,
        }
    }

    pub fn nft_metadata(&self) -> NftContractMetadata {
        NftContractMetadata {
            spec: "nft-1.0.0".to_string(),
            name: "SHIN Arena Fighters".to_string(),
            symbol: "SHINNFT".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn nft_token(&self, token_id: String) -> Option<Nep171Token> {
        self.fighters.get(&token_id).map(|f| self.internal_fighter_to_nep171(&f))
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.fighters.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Nep171Token> {
        let start = from_index.map(|i| i.0 as usize).unwrap_or(0);
        let max = limit.unwrap_or(50) as usize;
        self.fighters
            .values()
            .skip(start)
            .take(max)
            .map(|f| self.internal_fighter_to_nep171(&f))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        let count = self.fighters.values().filter(|f| f.owner_id == account_id).count();
        U128(count as u128)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Nep171Token> {
        let start = from_index.map(|i| i.0 as usize).unwrap_or(0);
        let max = limit.unwrap_or(50) as usize;
        self.fighters
            .values()
            .filter(|f| f.owner_id == account_id)
            .skip(start)
            .take(max)
            .map(|f| self.internal_fighter_to_nep171(&f))
            .collect()
    }

    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        #[allow(unused_variables)] approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        let caller = env::predecessor_account_id();
        let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        let old_owner = fighter.owner_id.clone();
        assert_eq!(caller, old_owner, "NEP-171: caller is not the token owner");
        assert_ne!(old_owner, receiver_id, "NEP-171: receiver must differ from current owner");

        fighter.owner_id = receiver_id.clone();
        fighter.market_price_milli_near = 0;
        self.fighters.insert(&token_id, &fighter);

        let nep245_fighter_id = format!("fighter:{}", token_id);
        self.internal_mt_transfer(
            old_owner.as_str(),
            receiver_id.as_str(),
            &[nep245_fighter_id],
            &[1],
            memo.as_deref(),
        );

        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.0.0\",\"event\":\"nft_transfer\",\"data\":[{{\"authorized_id\":null,\"old_owner_id\":\"{}\",\"new_owner_id\":\"{}\",\"token_ids\":[\"{}\"],\"memo\":{}}}]}}",
            old_owner,
            receiver_id,
            token_id,
            memo.as_ref().map(|m| format!("\"{}\"", m)).unwrap_or_else(|| "null".to_string())
        ));
    }

    /// NEP-199 Royalties: 92.5% Seller / 2.5% Original Minter / 5% Dev Treasury
    pub fn nft_payout(&self, token_id: String, balance: U128, max_len_payout: Option<u32>) -> Payout {
        let fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        let minter = self.original_minters.get(&token_id).unwrap_or_else(|| fighter.owner_id.clone());

        let minter_cut = balance.0.saturating_mul(25) / 1_000; // 2.5%
        let dev_cut = balance.0.saturating_mul(50) / 1_000;    // 5.0%
        let seller_cut = balance.0.saturating_sub(minter_cut).saturating_sub(dev_cut); // 92.5%

        let mut payout: HashMap<AccountId, U128> = HashMap::new();
        *payout.entry(fighter.owner_id).or_insert(U128(0)) = U128(seller_cut);
        let prev_minter = payout.get(&minter).map(|v| v.0).unwrap_or(0);
        payout.insert(minter, U128(prev_minter + minter_cut));
        let prev_dev = payout.get(&self.dev_treasury_id).map(|v| v.0).unwrap_or(0);
        payout.insert(self.dev_treasury_id.clone(), U128(prev_dev + dev_cut));

        if let Some(max_len) = max_len_payout {
            assert!(payout.len() <= max_len as usize, "Payout exceeds max_len_payout");
        }
        Payout { payout }
    }

    // =========================================================================
    // 3. PLAYER TRAINERS (90% Trainer / 10% Dev Treasury)
    // =========================================================================

    pub fn register_trainer(&mut self, fee_milli_near: u128, specialty: String) -> TrainerProfile {
        assert!(fee_milli_near > 0, "Trainer fee must be > 0");
        assert!(
            specialty == "ATK" || specialty == "DEF" || specialty == "SPD",
            "Specialty must be ATK, DEF, or SPD"
        );
        let trainer_id = env::predecessor_account_id();
        let existing_sessions = self.trainers.get(&trainer_id).map(|t| t.sessions_completed).unwrap_or(0);
        let profile = TrainerProfile {
            trainer_id: trainer_id.clone(),
            fee_milli_near,
            specialty,
            sessions_completed: existing_sessions,
            is_active: true,
        };
        self.trainers.insert(&trainer_id, &profile);
        profile
    }

    pub fn get_trainer(&self, trainer_id: AccountId) -> Option<TrainerProfile> {
        self.trainers.get(&trainer_id)
    }

    #[payable]
    pub fn train_fighter_with_trainer(&mut self, token_id: String, trainer_id: AccountId) -> FighterNft {
        let caller = env::predecessor_account_id();
        let mut fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        assert_eq!(caller, fighter.owner_id, "Only fighter owner can train");

        let mut trainer = self.trainers.get(&trainer_id).expect("Trainer not registered");
        assert!(trainer.is_active, "Trainer is not active");

        let attached = env::attached_deposit().as_millinear();
        assert!(attached >= trainer.fee_milli_near, "Insufficient NEAR for trainer fee");

        // 90% Trainer / 10% Dev Treasury
        let dev_cut = attached.saturating_mul(10) / 100;
        let trainer_cut = attached.saturating_sub(dev_cut);

        match trainer.specialty.as_str() {
            "ATK" => fighter.atk += 2,
            "DEF" => fighter.def += 2,
            _ => fighter.spd += 2,
        }
        let xp = self.fighter_xp.get(&token_id).unwrap_or(0) + 15;
        self.fighter_xp.insert(&token_id, &xp);
        self.fighters.insert(&token_id, &fighter);

        trainer.sessions_completed += 1;
        self.trainers.insert(&trainer_id, &trainer);
        self.dev_treasury_milli += dev_cut;

        if trainer_cut > 0 {
            let _ = Promise::new(trainer_id).transfer(NearToken::from_millinear(trainer_cut));
        }
        if dev_cut > 0 && self.dev_treasury_id != env::current_account_id() {
            let _ = Promise::new(self.dev_treasury_id.clone()).transfer(NearToken::from_millinear(dev_cut));
        }

        fighter
    }

    // =========================================================================
    // 4. PLAYER-FUNDED TOURNAMENTS (95% Winners / 5% Dev Treasury)
    // =========================================================================

    pub fn create_tournament(
        &mut self,
        tournament_id: String,
        entry_fee_milli_near: u128,
        max_players: u32,
    ) -> TournamentPool {
        assert!(self.tournaments.get(&tournament_id).is_none(), "Tournament already exists");
        assert!(entry_fee_milli_near > 0 && max_players >= 2, "Invalid tournament parameters");
        let pool = TournamentPool {
            tournament_id: tournament_id.clone(),
            entry_fee_milli_near,
            max_players,
            entrants: Vec::new(),
            total_pot_milli_near: 0,
            is_settled: false,
            winner_token_ids: Vec::new(),
        };
        self.tournaments.insert(&tournament_id, &pool);
        pool
    }

    #[payable]
    pub fn join_tournament(&mut self, tournament_id: String, token_id: String) -> TournamentPool {
        let mut pool = self.tournaments.get(&tournament_id).expect("Tournament not found");
        assert!(!pool.is_settled, "Tournament already settled");
        assert!((pool.entrants.len() as u32) < pool.max_players, "Tournament is full");
        assert!(!pool.entrants.contains(&token_id), "Fighter already entered");

        let fighter = self.fighters.get(&token_id).expect("Fighter NFT not found");
        assert_eq!(env::predecessor_account_id(), fighter.owner_id, "Only fighter owner can enter");

        let attached = env::attached_deposit().as_millinear();
        assert!(attached >= pool.entry_fee_milli_near, "Insufficient entry fee attached");

        pool.entrants.push(token_id);
        pool.total_pot_milli_near += attached;
        self.tournaments.insert(&tournament_id, &pool);
        pool
    }

    pub fn settle_tournament(&mut self, tournament_id: String, winner_token_ids: Vec<String>) -> TournamentPool {
        assert_eq!(env::predecessor_account_id(), self.oracle_id, "Only oracle can settle tournament");
        let mut pool = self.tournaments.get(&tournament_id).expect("Tournament not found");
        assert!(!pool.is_settled, "Tournament already settled");
        assert!(!winner_token_ids.is_empty(), "Must specify at least one winner");

        // 1. Settle native NEAR pot (if any)
        let dev_cut = pool.total_pot_milli_near.saturating_mul(5) / 100;
        let winners_pot = pool.total_pot_milli_near.saturating_sub(dev_cut);
        let per_winner = winners_pot / (winner_token_ids.len() as u128);

        for winner_id in &winner_token_ids {
            if let Some(mut fighter) = self.fighters.get(winner_id) {
                fighter.vault_balance_milli_near += per_winner;
                fighter.wins += 1;
                fighter.elo += 25;
                self.fighters.insert(winner_id, &fighter);
                let xp = self.fighter_xp.get(winner_id).unwrap_or(0) + 50;
                self.fighter_xp.insert(winner_id, &xp);
            }
        }

        self.dev_treasury_milli += dev_cut;
        if dev_cut > 0 && self.dev_treasury_id != env::current_account_id() {
            let _ = Promise::new(self.dev_treasury_id.clone()).transfer(NearToken::from_millinear(dev_cut));
        }

        // 2. Settle $SHIN NEP-141 pot (if any) — 95% Winners / 5% Dev Treasury
        let pot_key = format!("tourney_shin_pot:{}", tournament_id);
        let shin_pot = self.mt_balances.get(&pot_key).unwrap_or(0);
        if shin_pot > 0 {
            self.mt_balances.insert(&pot_key, &0);
            let dev_shin_cut = shin_pot.saturating_mul(5) / 100;
            let winners_shin_pot = shin_pot.saturating_sub(dev_shin_cut);
            let per_winner_shin = winners_shin_pot / (winner_token_ids.len() as u128);

            for winner_id in &winner_token_ids {
                if let Some(fighter) = self.fighters.get(winner_id) {
                    // Agent NFT winner: send $SHIN directly to its standalone NEAR sub-account wallet if present,
                    // otherwise credit its contract $SHIN War Chest
                    let sub_suffix = format!(".{}", env::current_account_id());
                    if fighter.agent_wallet_id.ends_with(&sub_suffix) {
                        if let Ok(agent_account) = fighter.agent_wallet_id.parse::<AccountId>() {
                            if per_winner_shin > 0 {
                                let _ = ext_ft::ext(self.shin_token_id.clone())
                                    .with_attached_deposit(NearToken::from_yoctonear(1))
                                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                                    .ft_transfer(
                                        agent_account,
                                        U128(per_winner_shin),
                                        Some(format!("SHIN Agent Tournament {} Payout", tournament_id)),
                                    );
                            }
                        }
                    } else {
                        let v_key = format!("vault_shin:{}", winner_id);
                        let prev = self.mt_balances.get(&v_key).unwrap_or(0);
                        self.mt_balances.insert(&v_key, &(prev + per_winner_shin));
                    }
                } else if let Ok(human_account) = winner_id.parse::<AccountId>() {
                    // Human player winner: transfer $SHIN directly to their NEAR wallet
                    if per_winner_shin > 0 {
                        let _ = ext_ft::ext(self.shin_token_id.clone())
                            .with_attached_deposit(NearToken::from_yoctonear(1))
                            .with_static_gas(GAS_FOR_FT_TRANSFER)
                            .ft_transfer(
                                human_account,
                                U128(per_winner_shin),
                                Some(format!("SHIN Tournament {} Champion Payout", tournament_id)),
                            );
                    }
                }
            }

            if dev_shin_cut > 0 && self.dev_treasury_id != env::current_account_id() {
                let _ = ext_ft::ext(self.shin_token_id.clone())
                    .with_attached_deposit(NearToken::from_yoctonear(1))
                    .with_static_gas(GAS_FOR_FT_TRANSFER)
                    .ft_transfer(
                        self.dev_treasury_id.clone(),
                        U128(dev_shin_cut),
                        Some(format!("SHIN Tournament {} 5% Dev Fee", tournament_id)),
                    );
            }
        }

        pool.is_settled = true;
        pool.winner_token_ids = winner_token_ids;
        self.tournaments.insert(&tournament_id, &pool);
        pool
    }

    pub fn get_tournament(&self, tournament_id: String) -> Option<TournamentPool> {
        self.tournaments.get(&tournament_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: &str, attached_millinear: u128) -> near_sdk::VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor.parse().unwrap())
            .attached_deposit(NearToken::from_millinear(attached_millinear))
            .build()
    }

    #[test]
    fn test_mint_fighter_and_nep245_starter_tokens() {
        testing_env!(get_context("alice.testnet", 5_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());

        let fighter = contract.mint_fighter(
            "hayabusa".to_string(),
            "Shadow Hayabusa".to_string(),
            85,
            70,
            95,
        );

        assert_eq!(fighter.token_id, "shin-hayabusa-1");
        assert_eq!(fighter.owner_id.as_str(), "alice.testnet");
        // 5000 milliNEAR attached -> 500 mint fee (400 Dev / 100 AMM Pool), 4500 in Agent Vault
        assert_eq!(fighter.vault_balance_milli_near, 4_500);
        assert_eq!(contract.dev_treasury_milli, 400);
        assert_eq!(fighter.elo, 1000);

        let alice: AccountId = "alice.testnet".parse().unwrap();
        assert_eq!(
            contract.mt_balance_of(alice.clone(), "fighter:shin-hayabusa-1".to_string()),
            "1"
        );
        assert_eq!(
            contract.mt_balance_of(alice, "scroll:way-of-the-shinobi".to_string()),
            "1"
        );
        assert_eq!(
            contract.mt_supply("fighter:shin-hayabusa-1".to_string()),
            Some("1".to_string())
        );
    }

    #[test]
    fn test_configure_and_fund_agent_wallet() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let fighter = contract.mint_fighter("kaze".to_string(), "Kaze".to_string(), 75, 65, 90);

        let updated = contract.configure_agent(
            fighter.token_id.clone(),
            2_000,
            true,
            true,
            CombatDoctrine::CounterStriker,
        );
        assert_eq!(updated.wager_per_fight_milli_near, 2_000);
        assert!(updated.is_agent_active);
        assert!(updated.auto_train_at_dojo);
        assert_eq!(updated.doctrine, CombatDoctrine::CounterStriker);

        testing_env!(get_context("alice.testnet", 3_500));
        let funded = contract.fund_agent_wallet(fighter.token_id);
        assert_eq!(funded.vault_balance_milli_near, 4_000);
    }

    #[test]
    fn test_create_match_pool_bet_and_settle_with_auto_train() {
        testing_env!(get_context("alice.testnet", 5_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("hayabusa".to_string(), "Hayabusa".to_string(), 80, 70, 90);
        contract.configure_agent(
            f1.token_id.clone(),
            1_000,
            true,
            true,
            CombatDoctrine::AggressiveRushdown,
        );

        testing_env!(get_context("bob.testnet", 5_000));
        let f2 = contract.mint_fighter("musashi".to_string(), "Musashi".to_string(), 85, 80, 70);

        contract.create_agent_match_pool(
            "match-1".to_string(),
            f1.token_id.clone(),
            f2.token_id.clone(),
            1_000,
        );

        testing_env!(get_context("carol.testnet", 2_000));
        contract.place_spectator_bet("match-1".to_string(), f1.token_id.clone());

        contract.settle_match("match-1".to_string(), f1.token_id.clone());

        let fighters = contract.get_all_fighters();
        let winner = fighters.iter().find(|f| f.token_id == f1.token_id).unwrap();
        let loser = fighters.iter().find(|f| f.token_id == f2.token_id).unwrap();

        // f1 started with 4500 in vault (5000 - 500 mint fee), staked 1000 -> 3500, won 1900 (95% of 2000 pot) + 100 (5% of 2000 bet) = 5500,
        // auto_train_at_dojo paid 500 -> 5000
        assert_eq!(winner.vault_balance_milli_near, 5_000);
        assert_eq!(winner.wins, 1);
        assert_eq!(winner.elo, 1024);
        assert_eq!(winner.power_level, 3); // +1 from win, +1 from auto-train

        assert_eq!(loser.losses, 1);
        assert_eq!(loser.elo, 982);
        assert_eq!(loser.vault_balance_milli_near, 3_500);

        // Auto-train minted shadow-step-mastery scroll to winner's agent wallet
        assert_eq!(
            contract.mt_balance_of(
                winner.agent_wallet_id.parse().unwrap(),
                "scroll:shadow-step-mastery".to_string()
            ),
            "1"
        );
    }

    #[test]
    fn test_dynamic_npc_dojo_scroll_purchase() {
        testing_env!(get_context("alice.testnet", 5_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("raiden".to_string(), "Raiden".to_string(), 80, 75, 85);

        let initial_cost = contract.get_dynamic_dojo_cost();
        assert_eq!(initial_cost, 500);

        let trained = contract.buy_dojo_scroll(f1.token_id.clone(), "ATK".to_string());
        assert_eq!(trained.atk, 83);
        assert_eq!(trained.power_level, 2);
        assert_eq!(trained.vault_balance_milli_near, 4_000);

        // Dynamic price increases by 25 milliNEAR after 1 training
        assert_eq!(contract.get_dynamic_dojo_cost(), 525);
        assert_eq!(
            contract.mt_balance_of(
                trained.agent_wallet_id.parse().unwrap(),
                "scroll:crimson-katana".to_string()
            ),
            "1"
        );
    }

    #[test]
    fn test_list_and_buy_fighter_on_market_transfers_nep245() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("shinobi".to_string(), "Shinobi".to_string(), 70, 70, 70);

        contract.list_fighter_on_market(f1.token_id.clone(), 10_000);

        testing_env!(get_context("bob.testnet", 10_000));
        let bought = contract.buy_fighter_from_market(f1.token_id.clone());

        assert_eq!(bought.owner_id.as_str(), "bob.testnet");
        assert_eq!(bought.market_price_milli_near, 0);

        let nep245_id = format!("fighter:{}", f1.token_id);
        assert_eq!(
            contract.mt_balance_of("alice.testnet".parse().unwrap(), nep245_id.clone()),
            "0"
        );
        assert_eq!(
            contract.mt_balance_of("bob.testnet".parse().unwrap(), nep245_id),
            "1"
        );
    }

    #[test]
    fn test_nep245_batch_transfer_and_balance() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("kunoichi".to_string(), "Kunoichi".to_string(), 75, 65, 95);

        let token_ids = vec![
            format!("fighter:{}", f1.token_id),
            "scroll:way-of-the-shinobi".to_string(),
        ];
        contract.mt_batch_transfer(
            "bob.testnet".parse().unwrap(),
            token_ids.clone(),
            vec!["1".to_string(), "1".to_string()],
            None,
            Some("Batch gift".to_string()),
        );

        assert_eq!(
            contract.mt_batch_balance_of("bob.testnet".parse().unwrap(), token_ids.clone()),
            vec!["1".to_string(), "1".to_string()]
        );
        assert_eq!(
            contract.mt_batch_balance_of("alice.testnet".parse().unwrap(), token_ids),
            vec!["0".to_string(), "0".to_string()]
        );
    }

    #[test]
    fn test_amm_swap_quotes_and_fee_splits() {
        testing_env!(get_context("oracle.testnet", 2_000)); // 2 NEAR
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let two_thousand_shin: u128 = 2_000 * 1_000_000_000_000_000_000;
        let info = contract.seed_amm_pool(U128(two_thousand_shin));
        assert_eq!(info.near_reserve.0, 2_000_000_000_000_000_000_000_000);
        assert_eq!(info.shin_reserve.0, two_thousand_shin);
        assert_eq!(info.swap_fee_bps, 50);

        // Quote 1 NEAR -> $SHIN (should be slightly less than 1000 * 1 / (2 + 1) = ~663.33 $SHIN due to 0.5% fee + slippage)
        let one_near: u128 = 1_000_000_000_000_000_000_000_000;
        let quote = contract.get_amm_quote_near_to_shin(U128(one_near)).0;
        assert!(quote > 660 * 1_000_000_000_000_000_000 && quote < 667 * 1_000_000_000_000_000_000);

        // Execute swap
        testing_env!(get_context("alice.testnet", 1_000));
        let _ = contract.swap_near_for_shin(Some(U128(quote)));
        let after = contract.get_amm_info();
        assert_eq!(after.shin_reserve.0, two_thousand_shin - quote);
        // 0.3% of 1 NEAR = 3 milliNEAR to dev treasury
        assert_eq!(contract.dev_treasury_milli, 3);
    }

    #[test]
    fn test_nep171_and_nep199_payout_splits() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("ryu".to_string(), "Ryu".to_string(), 80, 80, 80);

        assert_eq!(contract.nft_total_supply().0, 1);
        assert_eq!(contract.nft_supply_for_owner("alice.testnet".parse().unwrap()).0, 1);
        let tok = contract.nft_token(f1.token_id.clone()).unwrap();
        assert_eq!(tok.owner_id.as_str(), "alice.testnet");

        // Transfer to bob.testnet (1 yoctoNEAR)
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id("alice.testnet".parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(1))
            .build());
        contract.nft_transfer("bob.testnet".parse().unwrap(), f1.token_id.clone(), None, None);
        assert_eq!(contract.nft_supply_for_owner("bob.testnet".parse().unwrap()).0, 1);
        assert_eq!(contract.nft_supply_for_owner("alice.testnet".parse().unwrap()).0, 0);

        // Check NEP-199 payout for 1000 units: 925 bob (seller), 25 alice (minter), 50 dev_treasury
        let payout = contract.nft_payout(f1.token_id, U128(1_000), None);
        assert_eq!(payout.payout.get(&"bob.testnet".parse::<AccountId>().unwrap()).unwrap().0, 925);
        assert_eq!(payout.payout.get(&"alice.testnet".parse::<AccountId>().unwrap()).unwrap().0, 25);
    }

    #[test]
    fn test_player_trainer_90_10_split() {
        testing_env!(get_context("sensei.testnet", 0));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let trainer = contract.register_trainer(1_000, "ATK".to_string());
        assert_eq!(trainer.fee_milli_near, 1_000);

        testing_env!(get_context("alice.testnet", 1_000));
        let f1 = contract.mint_fighter("ken".to_string(), "Ken".to_string(), 70, 70, 70);
        let trained = contract.train_fighter_with_trainer(f1.token_id.clone(), "sensei.testnet".parse().unwrap());
        assert_eq!(trained.atk, 72);
        // 10% of 1000 milliNEAR (100) + 400 mint dev cut = 500 milliNEAR to dev treasury
        assert_eq!(contract.dev_treasury_milli, 500);
        assert_eq!(contract.get_trainer("sensei.testnet".parse().unwrap()).unwrap().sessions_completed, 1);
    }

    #[test]
    fn test_player_funded_tournament_95_5_split() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("f1".to_string(), "Fighter 1".to_string(), 80, 70, 80);

        testing_env!(get_context("bob.testnet", 1_000));
        let f2 = contract.mint_fighter("f2".to_string(), "Fighter 2".to_string(), 75, 75, 80);

        contract.create_tournament("cup-1".to_string(), 1_000, 4);

        testing_env!(get_context("alice.testnet", 1_000));
        contract.join_tournament("cup-1".to_string(), f1.token_id.clone());

        testing_env!(get_context("bob.testnet", 1_000));
        let pool = contract.join_tournament("cup-1".to_string(), f2.token_id.clone());
        assert_eq!(pool.total_pot_milli_near, 2_000);

        testing_env!(get_context("oracle.testnet", 0));
        let settled = contract.settle_tournament("cup-1".to_string(), vec![f1.token_id.clone()]);
        assert!(settled.is_settled);
        // 95% of 2000 = 1900 milliNEAR added to winner's 500 vault (1000 - 500 mint fee) -> 2400
        assert_eq!(contract.fighters.get(&f1.token_id).unwrap().vault_balance_milli_near, 2_400);
        // 5% of 2000 = 100 milliNEAR + 2x 400 mint dev cuts = 900 milliNEAR to dev treasury
        assert_eq!(contract.dev_treasury_milli, 900);
    }

    #[test]
    fn test_npc_earns_shin_and_trainer_shin_split() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("hayabusa".to_string(), "Hayabusa".to_string(), 80, 70, 90);

        // Player buys Dojo Scroll with 500 $SHIN -> NPC Dojo earns 500 $SHIN
        testing_env!(get_context("shin.shin-arena-28d.testnet", 0));
        let shin_500: u128 = 500 * 1_000_000_000_000_000_000;
        let res = contract.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(shin_500),
            format!("buy_dojo_scroll:{}:ATK", f1.token_id),
        );
        match res {
            PromiseOrValue::Value(v) => assert_eq!(v.0, 0),
            _ => panic!("Expected Value(0)"),
        }
        assert_eq!(contract.get_npc_shin_treasury().0, shin_500);
        assert_eq!(contract.fighters.get(&f1.token_id).unwrap().atk, 83);

        // Player Trainer earns $SHIN (90% Trainer / 10% Dev)
        testing_env!(get_context("sensei.testnet", 0));
        contract.register_trainer(500, "SPD".to_string());
        testing_env!(get_context("shin.shin-arena-28d.testnet", 0));
        let _ = contract.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(shin_500),
            format!("train_with_trainer:{}:sensei.testnet", f1.token_id),
        );
        assert_eq!(contract.fighters.get(&f1.token_id).unwrap().spd, 92);
        assert_eq!(contract.get_trainer("sensei.testnet".parse().unwrap()).unwrap().sessions_completed, 1);
    }

    #[test]
    fn test_full_shin_economy_vault_bet_settle_and_market() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("hayabusa".to_string(), "Hayabusa".to_string(), 80, 70, 90);

        let shin_1000: u128 = 1_000 * 1_000_000_000_000_000_000;
        let shin_200: u128 = 200 * 1_000_000_000_000_000_000;

        // Fund Fighter War Chest in $SHIN
        testing_env!(get_context("shin.shin-arena-28d.testnet", 0));
        let _ = contract.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(shin_1000),
            format!("fund_agent:{}", f1.token_id),
        );
        assert_eq!(contract.get_fighter_shin_vault(f1.token_id.clone()).0, shin_1000);

        // Spectator bet in $SHIN
        let _ = contract.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(shin_200),
            format!("bet_match:m-shin-1:{}", f1.token_id),
        );

        // Settle $SHIN match: 95% of 2000 (1900) + 5% of 200 (10) = +1910 $SHIN to winner vault -> 2910 $SHIN
        testing_env!(get_context("oracle.testnet", 0));
        contract.settle_shin_match("m-shin-1".to_string(), f1.token_id.clone(), U128(shin_1000));
        assert_eq!(
            contract.get_fighter_shin_vault(f1.token_id).0,
            2_910 * 1_000_000_000_000_000_000
        );
    }

    #[test]
    fn test_shin_tournament_human_and_agent_settlement() {
        testing_env!(get_context("alice.testnet", 1_000));
        let mut contract = ShinArenaContract::new("oracle.testnet".parse().unwrap());
        let f1 = contract.mint_fighter("hayabusa".to_string(), "Hayabusa".to_string(), 80, 70, 90);
        let f2 = contract.mint_fighter("kunoichi".to_string(), "Kunoichi".to_string(), 75, 65, 95);

        let shin_500: u128 = 500 * 1_000_000_000_000_000_000;

        // 1. Agent Cup funded in $SHIN
        contract.create_tournament("agent-cup-1".to_string(), 500, 4);
        testing_env!(get_context("shin.shin-arena-28d.testnet", 0));
        let _ = contract.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(shin_500),
            format!("join_tournament:agent-cup-1:{}", f1.token_id),
        );
        let _ = contract.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(shin_500),
            format!("join_tournament:agent-cup-1:{}", f2.token_id),
        );

        testing_env!(get_context("oracle.testnet", 0));
        let settled_agent = contract.settle_tournament("agent-cup-1".to_string(), vec![f1.token_id.clone()]);
        assert!(settled_agent.is_settled);
        assert!(f1.agent_wallet_id.starts_with("shin-hayabusa-1."));

        // 2. Human-Only Cup funded in $SHIN with human account IDs
        contract.create_tournament("human-cup-1".to_string(), 500, 4);
        testing_env!(get_context("shin.shin-arena-28d.testnet", 0));
        let _ = contract.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(shin_500),
            "join_tournament:human-cup-1:alice.testnet".to_string(),
        );
        let _ = contract.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(shin_500),
            "join_tournament:human-cup-1:bob.testnet".to_string(),
        );

        testing_env!(get_context("oracle.testnet", 0));
        let settled_human = contract.settle_tournament("human-cup-1".to_string(), vec!["alice.testnet".to_string()]);
        assert!(settled_human.is_settled);
        assert_eq!(settled_human.winner_token_ids, vec!["alice.testnet".to_string()]);
    }
}
