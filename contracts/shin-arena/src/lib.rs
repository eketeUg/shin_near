use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, NearToken, PanicOnDefault, Promise};

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

/// Autonomous NPC Merchant / Dojo Master with its own wallet and self-adjusting bonding curve
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct NpcDojoMaster {
    pub npc_wallet_id: String,
    pub treasury_balance_milli_near: u128,
    pub total_trainings_completed: u64,
    pub base_training_cost_milli_near: u128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ShinArenaContract {
    pub oracle_id: AccountId,
    pub fighters: UnorderedMap<String, FighterNft>,
    pub matches: LookupMap<String, ArenaMatchPool>,
    pub npc_dojo: NpcDojoMaster,
    pub next_token_nonce: u64,
}

#[near_bindgen]
impl ShinArenaContract {
    #[init]
    pub fn new(oracle_id: AccountId) -> Self {
        Self {
            oracle_id,
            fighters: UnorderedMap::new(b"f"),
            matches: LookupMap::new(b"m"),
            npc_dojo: NpcDojoMaster {
                npc_wallet_id: "hanzo-dojo-npc.shin-arena.testnet".to_string(),
                treasury_balance_milli_near: 50_000, // 50 NEAR initial NPC liquidity
                total_trainings_completed: 0,
                base_training_cost_milli_near: 500, // 0.5 NEAR base cost, scales with demand
            },
            next_token_nonce: 1,
        }
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
        let agent_wallet_id = format!("{}.agent.shin-arena.testnet", token_id);
        self.next_token_nonce += 1;

        let attached_milli = env::attached_deposit().as_millinear();

        let fighter = FighterNft {
            token_id: token_id.clone(),
            owner_id: caller,
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
            vault_balance_milli_near: attached_milli,
            wager_per_fight_milli_near: 1_000, // Default 1 NEAR per fight
            is_agent_active: false,
            auto_train_at_dojo: false,
            doctrine: CombatDoctrine::AggressiveRushdown,
            market_price_milli_near: 0,
        };

        self.fighters.insert(&token_id, &fighter);
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

        // 1. Credit Fighter Wager Pool to Winning Fighter's Agent Wallet
        let total_spectator_pool =
            pool.total_spectator_bets_f1_milli_near + pool.total_spectator_bets_f2_milli_near;
        let fighter_royalty = total_spectator_pool * 5 / 100; // 5% spectator royalty to winning Fighter NFT!
        winner.vault_balance_milli_near += pool.total_fighter_pot_milli_near + fighter_royalty;

        // 2. Evolve Dynamic NFT Combat Stats & ELO
        winner.wins += 1;
        winner.power_level += 1;
        winner.elo += 24;
        winner.atk += 1;

        loser.losses += 1;
        loser.elo = loser.elo.saturating_sub(18);
        if loser.vault_balance_milli_near < loser.wager_per_fight_milli_near {
            loser.is_agent_active = false; // Auto-pause agent if bankroll depleted
        }

        // 3. Autonomous Agent-to-NPC Commerce: if auto_train_at_dojo is enabled and affordable,
        // the Fighter Agent autonomously pays the NPC Dojo Master to boost its stats!
        let current_dojo_cost = self.get_dynamic_dojo_cost();
        if winner.auto_train_at_dojo && winner.vault_balance_milli_near >= current_dojo_cost * 3 {
            winner.vault_balance_milli_near -= current_dojo_cost;
            self.npc_dojo.treasury_balance_milli_near += current_dojo_cost;
            self.npc_dojo.total_trainings_completed += 1;
            winner.power_level += 1;
            winner.def += 2;
            winner.spd += 2;
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
        fighter.owner_id = env::predecessor_account_id();
        fighter.market_price_milli_near = 0;
        self.fighters.insert(&token_id, &fighter);

        Promise::new(seller).transfer(NearToken::from_millinear(attached));
        fighter
    }

    pub fn get_all_fighters(&self) -> Vec<FighterNft> {
        self.fighters.values().collect()
    }
}
