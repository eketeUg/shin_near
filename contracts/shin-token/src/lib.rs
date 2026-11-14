use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, PromiseResult,
};

/// 0.00125 NEAR minimum storage deposit per account (NEP-145 standard)
const STORAGE_BALANCE_MIN: u128 = 1_250_000_000_000_000_000_000;
const GAS_FOR_FT_TRANSFER_CALL: Gas = Gas::from_tgas(35);
const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas::from_tgas(10);

/// 100,000,000 $SHIN with 18 decimals
pub const DEFAULT_TOTAL_SUPPLY: u128 = 100_000_000 * 1_000_000_000_000_000_000;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct FungibleTokenMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
    pub decimals: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct StorageBalanceBounds {
    pub min: U128,
    pub max: Option<U128>,
}

#[ext_contract(ext_ft_receiver)]
pub trait FungibleTokenReceiver {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128>;
}

#[ext_contract(ext_self)]
pub trait FtSelf {
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ShinTokenContract {
    pub accounts: LookupMap<AccountId, u128>,
    pub total_supply: u128,
    pub metadata: FungibleTokenMetadata,
}

#[near]
impl ShinTokenContract {
    #[init]
    pub fn new(owner_id: AccountId, total_supply: Option<U128>, icon: Option<String>) -> Self {
        let supply = total_supply.map(|s| s.0).unwrap_or(DEFAULT_TOTAL_SUPPLY);
        let mut contract = Self {
            accounts: LookupMap::new(b"a"),
            total_supply: supply,
            metadata: FungibleTokenMetadata {
                spec: "ft-1.0.0".to_string(),
                name: "SHIN".to_string(),
                symbol: "SHIN".to_string(),
                icon,
                reference: None,
                reference_hash: None,
                decimals: 18,
            },
        };
        contract.accounts.insert(&owner_id, &supply);
        Self::emit_ft_mint(&owner_id, supply, Some("Initial fixed 100M $SHIN supply"));
        contract
    }

    // =========================================================================
    // NEP-141 CORE
    // =========================================================================

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount.0, memo);
    }

    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, amount.0, memo);

        let attached_gas = env::prepaid_gas()
            .saturating_sub(GAS_FOR_FT_TRANSFER_CALL)
            .saturating_sub(GAS_FOR_RESOLVE_TRANSFER);

        ext_ft_receiver::ext(receiver_id.clone())
            .with_static_gas(attached_gas.max(GAS_FOR_FT_TRANSFER_CALL))
            .ft_on_transfer(sender_id.clone(), amount, msg)
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE_TRANSFER)
                    .ft_resolve_transfer(sender_id, receiver_id, amount),
            )
            .into()
    }

    #[private]
    pub fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let unused_amount = match env::promise_result(0) {
            PromiseResult::Successful(value) => {
                if let Ok(unused) = near_sdk::serde_json::from_slice::<U128>(&value) {
                    unused.0.min(amount.0)
                } else {
                    0
                }
            }
            PromiseResult::Failed => amount.0,
        };

        if unused_amount > 0 {
            let receiver_balance = self.accounts.get(&receiver_id).unwrap_or(0);
            let refund = unused_amount.min(receiver_balance);
            if refund > 0 {
                self.accounts.insert(&receiver_id, &(receiver_balance - refund));
                let sender_balance = self.accounts.get(&sender_id).unwrap_or(0);
                self.accounts.insert(&sender_id, &(sender_balance + refund));
                Self::emit_ft_transfer(
                    &receiver_id,
                    &sender_id,
                    refund,
                    Some("Refund unused ft_transfer_call amount"),
                );
                return U128(amount.0 - refund);
            }
        }
        amount
    }

    pub fn ft_total_supply(&self) -> U128 {
        U128(self.total_supply)
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.accounts.get(&account_id).unwrap_or(0))
    }

    pub fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.clone()
    }

    // =========================================================================
    // NEP-145 STORAGE MANAGEMENT
    // =========================================================================

    #[payable]
    pub fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        let deposit = env::attached_deposit().as_yoctonear();
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let reg_only = registration_only.unwrap_or(false);

        if self.accounts.get(&target).is_some() {
            if deposit > 0 {
                let _ = Promise::new(env::predecessor_account_id())
                    .transfer(NearToken::from_yoctonear(deposit));
            }
            return StorageBalance {
                total: U128(STORAGE_BALANCE_MIN),
                available: U128(0),
            };
        }

        assert!(
            deposit >= STORAGE_BALANCE_MIN,
            "Requires at least {} yoctoNEAR for storage deposit",
            STORAGE_BALANCE_MIN
        );
        self.accounts.insert(&target, &0);

        let refund = if reg_only {
            deposit - STORAGE_BALANCE_MIN
        } else {
            deposit - STORAGE_BALANCE_MIN
        };
        if refund > 0 {
            let _ = Promise::new(env::predecessor_account_id())
                .transfer(NearToken::from_yoctonear(refund));
        }

        StorageBalance {
            total: U128(STORAGE_BALANCE_MIN),
            available: U128(0),
        }
    }

    #[payable]
    pub fn storage_withdraw(&mut self, amount: Option<U128>) -> StorageBalance {
        assert_one_yocto();
        let _ = amount;
        let account_id = env::predecessor_account_id();
        assert!(self.accounts.get(&account_id).is_some(), "Account not registered");
        StorageBalance {
            total: U128(STORAGE_BALANCE_MIN),
            available: U128(0),
        }
    }

    #[payable]
    pub fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        if let Some(balance) = self.accounts.get(&account_id) {
            if balance > 0 && !force.unwrap_or(false) {
                env::panic_str("Cannot unregister account with positive $SHIN balance");
            }
            self.accounts.remove(&account_id);
            let _ = Promise::new(account_id).transfer(NearToken::from_yoctonear(STORAGE_BALANCE_MIN));
            true
        } else {
            false
        }
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        if self.accounts.get(&account_id).is_some() {
            Some(StorageBalance {
                total: U128(STORAGE_BALANCE_MIN),
                available: U128(0),
            })
        } else {
            None
        }
    }

    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds {
            min: U128(STORAGE_BALANCE_MIN),
            max: Some(U128(STORAGE_BALANCE_MIN)),
        }
    }

    // =========================================================================
    // INTERNAL HELPERS & NEP-141 EVENTS
    // =========================================================================

    fn internal_transfer(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        amount: u128,
        memo: Option<String>,
    ) {
        assert_ne!(sender_id, receiver_id, "Sender and receiver should be different");
        assert!(amount > 0, "Transfer amount must be positive");

        let sender_balance = self
            .accounts
            .get(sender_id)
            .expect("Sender account is not registered");
        assert!(
            sender_balance >= amount,
            "Insufficient $SHIN balance"
        );
        assert!(
            self.accounts.get(receiver_id).is_some(),
            "Receiver account is not registered (call storage_deposit first)"
        );

        self.accounts.insert(sender_id, &(sender_balance - amount));
        let receiver_balance = self.accounts.get(receiver_id).unwrap_or(0);
        self.accounts
            .insert(receiver_id, &(receiver_balance + amount));

        Self::emit_ft_transfer(sender_id, receiver_id, amount, memo.as_deref());
    }

    fn emit_ft_mint(owner_id: &AccountId, amount: u128, memo: Option<&str>) {
        let log = near_sdk::serde_json::json!({
            "standard": "nep141",
            "version": "1.0.0",
            "event": "ft_mint",
            "data": [{
                "owner_id": owner_id,
                "amount": amount.to_string(),
                "memo": memo,
            }]
        });
        env::log_str(&format!("EVENT_JSON:{}", log));
    }

    fn emit_ft_transfer(
        old_owner_id: &AccountId,
        new_owner_id: &AccountId,
        amount: u128,
        memo: Option<&str>,
    ) {
        let log = near_sdk::serde_json::json!({
            "standard": "nep141",
            "version": "1.0.0",
            "event": "ft_transfer",
            "data": [{
                "old_owner_id": old_owner_id,
                "new_owner_id": new_owner_id,
                "amount": amount.to_string(),
                "memo": memo,
            }]
        });
        env::log_str(&format!("EVENT_JSON:{}", log));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId, deposit: u128) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit));
        builder
    }

    #[test]
    fn initializes_100m_fixed_supply() {
        let owner: AccountId = "shin-arena-28d.testnet".parse().unwrap();
        testing_env!(get_context(owner.clone(), 0).build());

        let contract = ShinTokenContract::new(owner.clone(), None, None);
        assert_eq!(contract.ft_total_supply().0, DEFAULT_TOTAL_SUPPLY);
        assert_eq!(contract.ft_balance_of(owner).0, DEFAULT_TOTAL_SUPPLY);
        assert_eq!(contract.ft_metadata().symbol, "SHIN");
        assert_eq!(contract.ft_metadata().decimals, 18);
    }

    #[test]
    fn storage_deposit_and_ft_transfer_work() {
        let owner: AccountId = "shin-arena-28d.testnet".parse().unwrap();
        let alice: AccountId = "alice.testnet".parse().unwrap();

        testing_env!(get_context(owner.clone(), 0).build());
        let mut contract = ShinTokenContract::new(owner.clone(), None, None);

        testing_env!(get_context(alice.clone(), STORAGE_BALANCE_MIN).build());
        let sb = contract.storage_deposit(Some(alice.clone()), None);
        assert_eq!(sb.total.0, STORAGE_BALANCE_MIN);

        let transfer_amt = 1_000 * 1_000_000_000_000_000_000u128;
        testing_env!(get_context(owner.clone(), 1).build());
        contract.ft_transfer(alice.clone(), U128(transfer_amt), Some("Welcome".into()));

        assert_eq!(contract.ft_balance_of(alice).0, transfer_amt);
        assert_eq!(
            contract.ft_balance_of(owner).0,
            DEFAULT_TOTAL_SUPPLY - transfer_amt
        );
    }
}
