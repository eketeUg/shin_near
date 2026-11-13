use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};

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
}

#[near]
impl ShinArenaContract {
    #[init]
    pub fn new(oracle_id: AccountId) -> Self {
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
        let agent_wallet_id = format!("{}.agent.shin-arena.testnet", token_id);
        self.next_token_nonce += 1;

        let attached_milli = env::attached_deposit().as_millinear();

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
            vault_balance_milli_near: attached_milli,
            wager_per_fight_milli_near: 1_000, // Default 1 NEAR per fight
            is_agent_active: false,
            auto_train_at_dojo: false,
            doctrine: CombatDoctrine::AggressiveRushdown,
            market_price_milli_near: 0,
        };

        self.fighters.insert(&token_id, &fighter);

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

        Promise::new(seller)
            .transfer(NearToken::from_millinear(attached))
            .detach();
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
        assert_eq!(fighter.vault_balance_milli_near, 5_000);
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
        assert_eq!(funded.vault_balance_milli_near, 4_500);
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

        // f1 started with 5000, staked 1000 -> 4000, won 2000 pot + 100 (5% of 2000 bet) = 6100,
        // auto_train_at_dojo paid 500 -> 5600
        assert_eq!(winner.vault_balance_milli_near, 5_600);
        assert_eq!(winner.wins, 1);
        assert_eq!(winner.elo, 1024);
        assert_eq!(winner.power_level, 3); // +1 from win, +1 from auto-train

        assert_eq!(loser.losses, 1);
        assert_eq!(loser.elo, 982);
        assert_eq!(loser.vault_balance_milli_near, 4_000);

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
        assert_eq!(trained.vault_balance_milli_near, 4_500);

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
}
