# ZE Ledger API Architecture

## Goal

Provide a backend that maps to the Flutter app's business operations and is ready to grow beyond a demo-only Firebase setup, using MySQL as the primary relational database.

## Core modules

### Auth

- register and login for real users
- guest session creation so the app can keep its current anonymous demo flow
- JWT-based stateless authentication

### Party

- create and list parties
- fetch a single party
- maintain running balance fields on the party document

### Ledger

- persist immutable ledger entries
- attach each entry to a party and a user
- support `opening_balance`, `sale`, and `payment`

## Data design

### `users`

- identity and authentication
- roles: `admin`, `staff`, `guest`

### `parties`

- flattened snapshot of balances for quick dashboard reads
- one record per customer or supplier party

### `ledger_entries`

- append-oriented financial events
- acts as the source for transaction history and daily summaries

### Dashboard

- aggregate today's sales
- aggregate today's collections
- calculate outstanding totals and overdue counts
