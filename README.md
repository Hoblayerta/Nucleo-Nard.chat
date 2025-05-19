# Participatory Creation Protocol with Blockchain Storage(Nard.chat by La Blocka)

## Description

A participatory creation protocol that enables collaborative development of stories and content with decentralized storage on the Mantle Sepolia chain. The platform uses infrastructure to grant reputation in the form of badges to legitimize users that represent attributions to the project.

## Key Features

- **Nested Comment System:** Enables organized conversations with unlimited threaded replies
- **Dual Voting System:** Upvotes/downvotes with multipliers assigned by administrators (1x to 10x)
- **Public Leaderboard:** Displays the most active users and those with the highest scores
- **Administrative Controls:** Complete management of users, posts, and comments
- **Comment Visualization:** Clear hierarchical representation with color-coded guides
- **Blockchain Integration:** Content preservation on the Mantle Sepolia network
- **User Verification:** System to mark users as "IRL" (in real life) and "Handmade" (original content)
- **Badge System:** Includes director, screenwriter, rookie, spammer, artist, animator, hacker, superfan, fan, master-animator
- **Slow Mode:** Configurable time intervals between comments

## Technologies

- **Frontend:** React with TanStack Query and Tailwind CSS
- **Backend:** Express.js with in-memory storage
- **Blockchain:** Integration with Mantle Sepolia using ethers.js v6
- **Wallets:** Support for multiple wallets through WalletConnect

## Blockchain Integration

The platform uses smart contract on the Mantle Sepolia network along infrastructure to enable participatory creation and decentralized storage of stories:

### Smart Contracts

#### SimpleStorage (Main Storage)
- **Address:** [0x4981E0a42Fb19e569e9F6952DD814f8598FB7593](https://explorer.sepolia.mantle.xyz/address/0x4981E0a42Fb19e569e9F6952DD814f8598FB7593)
- **Function:** Contract on Mantle Sepolia that stores information about stories and comments to create decentralized narratives on the blockchain
-**I.e:** https://explorer.sepolia.mantle.xyz/tx/0xf11948f85cb505188b1be3fe2f229c18398d3ae7364830e63c3e11910442247f

## Blockchain Architecture

1. **SimpleStorage:** Main contract on Mantle Sepolia that stores stories and comments to preserve them in a decentralized manner


## How to Use the Blockchain Integration

### For Administrators and Mods
1. In the admin panel, use the "Write to Contract" button next to "New Post"
2. Select between showing "Most voted" or "Most recent" comments
3. Configure the number of comments to include
4. Save the information on the blockchain to preserve it permanently

## Setup and Development

### Prerequisites
- Node.js v18 or higher
- Metamask or another wallet compatible with Mantle Sepolia
- Access to Mantle Sepolia RPC

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
  
## Usefull links
https://nucleo-nard-chat-7qtf.onrender.com

User: admin
Password: admin123


https://lablocka.lol/


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
