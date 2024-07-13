import { Button, Frog, TextInput } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
// import { neynar } from 'frog/hubs'
import { createSystem } from 'frog/ui'
import { handle } from 'frog/vercel';
import { ethers } from 'ethers'
// import { config } from 'dotenv';

// config();

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }


export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  title: 'Dice Roll',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})
const provider = new ethers.InfuraProvider('arbitrum', 'ae187603145b4a27b749631af33080f7')

const contractAddress = '0xA67f50c3B27F2a832DD9EeAbb4ec179603d20F96' as string;
const contractAbi = [
  {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": true,
              "internalType": "address",
              "name": "player",
              "type": "address"
          },
          {
              "indexed": false,
              "internalType": "bool",
              "name": "won",
              "type": "bool"
          },
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "amountWon",
              "type": "uint256"
          },
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "roll",
              "type": "uint256"
          }
      ],
      "name": "GamePlayed",
      "type": "event"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": true,
              "internalType": "address",
              "name": "to",
              "type": "address"
          },
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
          }
      ],
      "name": "Withdrawal",
      "type": "event"
  },
  {
      "inputs": [],
      "name": "owner",
      "outputs": [
          {
              "internalType": "address",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "playGame",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "stateMutability": "payable",
      "type": "receive"
  }
]

app.frame('/', (c) => {
  const { buttonValue, inputText, status } = c
  const fruit = inputText || buttonValue
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background:
            status === 'response'
              ? 'linear-gradient(to right, #432889, #17101F)'
              : 'black',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {status === 'response'
            ? `Nice choice.${fruit ? ` ${fruit.toUpperCase()}!!` : ''}`
            : 'Welcome to Dice Roll! Use your 0.0001 ETH to play a game. You can win up to 0.0002 ETH depending on dice result!'}
        </div>
      </div>
    ),
    action: '/wait-results',
    intents: [
      <Button.Transaction target="/dice">Roll</Button.Transaction>,
      status === 'response' && <Button.Reset>Reset</Button.Reset>,
    ],
  })
})

app.transaction('/dice', async (c) => {
  return c.contract({
    abi: contractAbi,
    chainId: 'eip155:42161',
    functionName: 'playGame',
    to: `0x${contractAddress.substring(2)}`,
    value: BigInt(100000000000000),
  });
});

app.frame('/wait-results', (c) => {
  const { transactionId } = c;

  return c.res({
    action: `/result-dice/${transactionId}`,
    image: '/dice_all.jpg',
    intents: [
      <Button>Wait 5 seconds for the result</Button>,
    ]
  });
});

const { Image } = createSystem()

function getDiceImage(roll: number) {
  const imageSrc = `/icon.png`;
  return <Image src={imageSrc} objectFit="contain" height="256" width="256" />
}

// App frame handling function
app.frame('/result-dice/:transactionId', async (c) => {
  const transactionId = c.req.param('transactionId');

  if (!transactionId) {
    throw new Error('Transaction ID is required');
  }

  try {
    const gameResult = await getGameResult(transactionId);


    if (!gameResult) {
      throw new Error('Unable to fetch game result');
    }

    const { roll, amountWon } = gameResult;
    const message = `You won ${amountWon} ETH. Play again?`

    return c.res({
      action: '/',
      imageOptions: { width: 1024, height: 1024 },
      image: getDiceImage(roll),
      intents: [
        <Button value="play-again"> Play Again </Button>,
        <Button.Reset>Return</Button.Reset>
      ],
    });
  } catch (error) {
    console.error("Error handling frame:", error);
    throw new Error('An error occurred while processing your request.');
  }
});

// Function to get game result from transaction hash
async function getGameResult(txHash: string): Promise<{ roll: ethers.BigNumber, amountWon: ethers.BigNumber } | null> {
  try {
    // Fetch the transaction receipt
    const receipt = await provider.waitForTransaction(txHash);

    if (!receipt) {
      console.log("Transaction not found");
      return null;
    }

    // Initialize contract instance
    const contract = new ethers.Contract(contractAddress, contractAbi, provider);

    // Parse logs for GamePlayed event
    const gamePlayedEvent = receipt.logs.map(log => {
      try {
        return contract.interface.parseLog(log);
      } catch (error) {
        return null;
      }
    }).filter(event => event && event.name === 'GamePlayed')[0];

    if (gamePlayedEvent) {
      const { player, won, amountWon, roll } = gamePlayedEvent.args;
      return { roll, amountWon };
    } else {
      console.log("No GamePlayed event found in transaction logs");
      return null;
    }
  } catch (error) {
    console.error("Error fetching transaction receipt:", error);
    return null;
  }
}

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
