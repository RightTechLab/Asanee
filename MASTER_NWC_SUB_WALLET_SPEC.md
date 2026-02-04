# Master NWC–Based Multi-Sub-Wallet Lightning Wallet Spec

## 1. Overview

This document specifies the architecture and behavior of a **non-custodial Lightning Bitcoin wallet** that uses **Nostr Wallet Connect (NWC)** with a **Master NWC connection** to create and manage multiple **sub-wallets**.

The application never manages private keys.  
All signing and Lightning operations are delegated to an external wallet via NWC.

---

## 2. Core Concept

### Master NWC

- A single, primary NWC connection
- Acts as the **root authority**
- Used only for:
  - Authentication
  - Creating sub-wallet connections
  - Revoking sub-wallet connections

### Sub-Wallets

- Logical wallets created via the master connection
- Each sub-wallet:
  - Has its own NWC URI
  - Has restricted permissions
  - Can be revoked independently
  - Represents a separate Lightning account or capability set

```
User
└── Master NWC
    ├── Sub-Wallet: Spending
    ├── Sub-Wallet: Savings
    └── Sub-Wallet: Merchant
```

---

## 3. Goals

- Single sign-in using NWC
- Support multiple Lightning wallets inside one app
- Strong permission isolation
- Least-privilege security model
- Easy revocation and recovery

---

## 4. Data Models

### SubWallet

```ts
type SubWallet = {
  id: string
  name: string
  nwcUri: string
  permissions: NWCPermission[]
  budgetMsat?: number
  createdAt: number
  status: "active" | "revoked"
}
```

### NWCPermission

```ts
type NWCPermission =
  | "get_info"
  | "get_balance"
  | "make_invoice"
  | "pay_invoice"
  | "list_payments"
```

---

## 5. Permission Strategy

Permissions are scoped **per sub-wallet**.

Examples:

| Wallet Type    | Permissions                                  |
| -------------- | -------------------------------------------- |
| Savings        | `get_balance`, `make_invoice`                |
| Spending       | `get_balance`, `make_invoice`, `pay_invoice` |
| POS / Merchant | `make_invoice`, `list_payments`              |
| Read-only      | `get_info`, `list_payments`                  |

Optional limits:

* Spending cap (`budget_msat`)
* Time-based expiration (future)

---

## 6. Sub-Wallet Creation Flow

### Step 1: Connect Master NWC

The app establishes a single master NWC session.

```ts
connect(masterNwcUri)
```

---

### Step 2: Request Delegated Connection

The app requests a new scoped connection from the wallet provider.

```json
{
  "method": "create_connection",
  "params": {
    "name": "Spending Wallet",
    "permissions": [
      "get_balance",
      "make_invoice",
      "pay_invoice"
    ],
    "budget_msat": 500000000
  }
}
```

The request is signed via **Master NWC**.

---

### Step 3: Receive Sub-Wallet NWC URI

```json
{
  "nwc_uri": "nostr+walletconnect://..."
}
```

---

### Step 4: Persist Sub-Wallet

Store only metadata and the NWC URI using encrypted storage.

```ts
secureStore.save(subWallet)
```

---

## 7. Wallet Manager Service

Central service responsible for wallet lifecycle management.

```ts
class WalletManager {
  masterNWC: NWCSession
  subWallets: Map<string, SubWallet>

  createSubWallet(config): Promise<SubWallet>
  revokeSubWallet(id: string): Promise<void>
  getWallet(id: string): SubWallet
  listWallets(): SubWallet[]
}
```

---

## 8. Using a Sub-Wallet

Once created, sub-wallets operate independently.

```ts
const wallet = walletManager.getWallet("spending")

await wallet.nwc.call("pay_invoice", {
  invoice: bolt11
})
```

* No master approval required
* Permissions enforced by the wallet provider

---

## 9. Revocation Flow

Sub-wallets can be revoked without affecting others.

```json
{
  "method": "revoke_connection",
  "params": {
    "connection_id": "subwallet-id"
  }
}
```

Effects:

* Sub-wallet NWC URI becomes invalid
* Other wallets remain functional
* Master wallet remains secure

---

## 10. Storage Rules

| Data                | Storage                  |
| ------------------- | ------------------------ |
| Master NWC URI      | Encrypted Secure Storage |
| Sub-wallet NWC URIs | Encrypted Secure Storage |
| Balances            | Cached only              |
| Private keys        | ❌ Never stored           |

---

## 11. Security Properties

* Fully non-custodial
* Capability-based access control
* Reduced blast radius on compromise
* External wallet enforces limits and permissions

---

## 12. UX Flow

### First Launch

1. Connect Master NWC
2. Create default sub-wallet
3. Enter dashboard

### Add Sub-Wallet

* Name
* Permissions
* Optional spending limit

### Settings

* View permissions
* Revoke wallet
* Rotate connections

---

## 13. Future Extensions

* Time-limited permissions
* Watch-only sub-wallets
* Per-wallet fiat display
* Multi-device sync via Nostr events
* Hardware wallet–backed master NWC

---

## 14. Summary

The application uses **one Master NWC connection** to securely create, manage, and revoke **multiple scoped sub-wallets**, enabling a powerful multi-wallet Lightning experience without ever handling private keys.

---
Builds on the skeleton:
🔗 https://github.com/getAlby/nwc-react-native-expo

✅ Integrates with the NWC API (e.g., get_info)
🔗 https://docs.nwc.dev/reference-api/overview/get_info