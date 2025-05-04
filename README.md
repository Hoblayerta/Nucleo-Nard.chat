# Participatory Creation Protocol with Blockchain Storage(Nard.chat by La Blocka)

## Description

A participatory creation protocol that enables collaborative development of stories and content with decentralized storage on the Arbitrum Sepolia chain. The platform uses Hyperlane infrastructure to grant reputation in the form of badges to holders of NFTs that represent attributions to the project.

## Key Features

- **Nested Comment System:** Enables organized conversations with unlimited threaded replies
- **Dual Voting System:** Upvotes/downvotes with multipliers assigned by administrators (1x to 10x)
- **Public Leaderboard:** Displays the most active users and those with the highest scores
- **Administrative Controls:** Complete management of users, posts, and comments
- **Comment Visualization:** Clear hierarchical representation with color-coded guides
- **Blockchain Integration:** Content preservation on the Arbitrum Sepolia network
- **User Verification:** System to mark users as "IRL" (in real life) and "Handmade" (original content)
- **Badge System:** Includes director, screenwriter, rookie, spammer, artist, animator, hacker, superfan, fan, master-animator
- **Slow Mode:** Configurable time intervals between comments

## Technologies

- **Frontend:** React with TanStack Query and Tailwind CSS
- **Backend:** Express.js with in-memory storage
- **Blockchain:** Integration with Arbitrum Sepolia using ethers.js v6
- **Wallets:** Support for multiple wallets through WalletConnect

## Blockchain Integration

The platform uses various smart contracts on the Arbitrum Sepolia network along with Hyperlane infrastructure to enable participatory creation and decentralized storage of stories:

### Smart Contracts

#### SimpleStorage (Main Storage)
- **Address:** [0xe074123df0616fdb1fd0e5eb3efefe43d59b218a](https://sepolia.arbiscan.io/address/0xe074123df0616fdb1fd0e5eb3efefe43d59b218a#code)
- **Function:** Contract on Arbitrum Sepolia that stores information about stories and comments to create decentralized narratives on the blockchain

#### Emitter Contract (Hyperlane)
- **Address:** [0x6aF5E39339296E8F22D510E5F9071cD369aE6db3](https://sepolia.arbiscan.io/address/0x6aF5E39339296E8F22D510E5F9071cD369aE6db3)
- **Function:** Part of the Hyperlane infrastructure that verifies the ownership of NFTs representing attributions to the project
- **Story Protocol Reference:** [Aeneid IPA 0xDC39364746fE32b0Cc383628c01A2f50a390FB6b](https://aeneid.explorer.story.foundation/ipa/0xDC39364746fE32b0Cc383628c01A2f50a390FB6b)

#### Receiver Contract (Hyperlane)
- **Address:** [0xa38d18d7Ec91ED8543970040cdC8b7a98a63603B](https://sepolia.arbiscan.io/address/0xa38d18d7Ec91ED8543970040cdC8b7a98a63603B)
- **Function:** Part of the Hyperlane infrastructure that receives cross-chain confirmation and grants reputation badges such as "superfan" to participants

## Blockchain Architecture

The system uses Hyperlane infrastructure for cross-chain communication and data storage:

1. **SimpleStorage:** Main contract on Arbitrum Sepolia that stores stories and comments to preserve them in a decentralized manner
2. **Emitter -> Receiver:** Contracts from the Hyperlane infrastructure that enable cross-chain communication, verify NFT ownership, and grant reputation in the form of badges to project participants

## How to Use the Blockchain Integration

### For Users
1. Connect your wallet using the "Connect" button in the navigation bar
2. Navigate to any post to see the "Preserve this content on the blockchain" section
3. Use the "Save to Blockchain" button to preserve the post and its most important comments
4. If you own the required NFT in Story Protocol, the "superfan" badge will automatically appear on your profile

### For Administrators
1. In the admin panel, use the "Write to Contract" button next to "New Post"
2. Select between showing "Most voted" or "Most recent" comments
3. Configure the number of comments to include
4. Save the information on the blockchain to preserve it permanently

## Setup and Development

### Prerequisites
- Node.js v18 or higher
- Metamask or another wallet compatible with Arbitrum Sepolia
- Access to Arbitrum Sepolia RPC

### Installation

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Key File Structure

- `client/src/lib/ethereum.ts` - Ethereum connection configuration
- `client/src/lib/writesm.ts` - Functions to interact with SimpleStorage
- `client/src/lib/abi.ts` - Smart contract ABIs
- `client/src/components/blockchain-button.tsx` - Main button for blockchain interaction
- `client/src/components/write-contract-button.tsx` - Button to write comments to blockchain

## Access Data

### Default Admin Access
- Username: `admin`
- Password: `admin123`

## License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
