"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ethers } from "ethers"
import { Wallet, Sparkles, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Somnia Testnet Network Configuration
const SOMNIA_CHAIN_ID = "0xc488" // 50312 in hex
const SOMNIA_CHAIN_ID_DECIMAL = 50312
const SOMNIA_NETWORK = {
  chainId: SOMNIA_CHAIN_ID,
  chainName: "Somnia Testnet",
  nativeCurrency: {
    name: "STT",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: ["https://dream-rpc.somnia.network/"],
  blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
}

// GM Contract Address
const GM_CONTRACT_ADDRESS = "0xcbfcf704494cc45e53bab61b6f898eb5e7d0e7b1"
// Extended ABI for the GM function with potential payable option
const GM_CONTRACT_ABI = [
  {
    inputs: [],
    name: "gm",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Add potential view functions that might help diagnose issues
  {
    inputs: [{ name: "user", type: "address" }],
    name: "lastGmTime",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cooldownPeriod",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)
  const [isSendingGm, setIsSendingGm] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [gmAmount, setGmAmount] = useState("0.01")

  // Initialize wallet connection
  useEffect(() => {
    const initializeWallet = async () => {
      if (!window.ethereum) return

      try {
        // Get accounts
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setAccount(accounts[0])
        }

        // Get chain ID
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
        const currentChainId = Number.parseInt(chainIdHex, 16)
        setChainId(currentChainId)

        // Check if on Somnia network
        const isOnSomnia = currentChainId === SOMNIA_CHAIN_ID_DECIMAL
        setIsCorrectNetwork(isOnSomnia)
        setWalletError(null)
      } catch (error) {
        console.error("Error initializing wallet:", error)
        setWalletError("Error initializing wallet. Please refresh the page.")
      }
    }

    initializeWallet()

    // Setup event listeners
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected wallet
          setAccount(null)
        } else {
          setAccount(accounts[0])
        }
      }

      const handleChainChanged = (newChainIdHex: string) => {
        const newChainId = Number.parseInt(newChainIdHex, 16)
        setChainId(newChainId)
        setIsCorrectNetwork(newChainId === SOMNIA_CHAIN_ID_DECIMAL)

        // Force page reload to ensure clean state
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [])

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet Not Found",
        description: "Please install Metamask or Rabby wallet!",
        variant: "destructive",
      })
      return
    }

    try {
      setIsConnecting(true)
      setWalletError(null)

      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length > 0) {
        setAccount(accounts[0])

        // Get chain ID
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
        const currentChainId = Number.parseInt(chainIdHex, 16)
        setChainId(currentChainId)

        // Check if on Somnia network
        const isOnSomnia = currentChainId === SOMNIA_CHAIN_ID_DECIMAL
        setIsCorrectNetwork(isOnSomnia)
      }

      setIsConnecting(false)
    } catch (error) {
      console.error("Error connecting wallet:", error)
      setIsConnecting(false)
      setWalletError("Failed to connect wallet. Please try again.")
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const switchToSomniaNetwork = async () => {
    if (!window.ethereum) return

    try {
      setIsSwitchingNetwork(true)
      setWalletError(null)

      // First try to switch to the network if it's already added
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SOMNIA_CHAIN_ID }],
        })
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SOMNIA_NETWORK],
          })
        } else {
          throw switchError
        }
      }

      // The chainChanged event will handle updating the UI
      // We don't need to do anything else here as the page will reload

      setIsSwitchingNetwork(false)
    } catch (error) {
      console.error("Error switching network:", error)
      setIsSwitchingNetwork(false)
      setWalletError("Failed to switch network. Please try again.")
      toast({
        title: "Network Switch Failed",
        description: "Failed to switch to Somnia Testnet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleGmClick = async () => {
    if (!account) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first!",
        variant: "destructive",
      })
      return
    }

    if (!isCorrectNetwork) {
      toast({
        title: "Wrong Network",
        description: "Please switch to Somnia Testnet first!",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSendingGm(true)
      setWalletError(null)

      // Create a fresh provider and signer for this transaction
      const provider = new ethers.BrowserProvider(window.ethereum!)
      const signer = await provider.getSigner()

      // Create contract instance with the fresh signer
      const gmContract = new ethers.Contract(GM_CONTRACT_ADDRESS, GM_CONTRACT_ABI, signer)

      // Try to call the GM function with some STT value
      // Convert gmAmount from ETH to wei
      const valueInWei = ethers.parseEther(gmAmount)

      // Call the GM function with value
      const tx = await gmContract.gm({ value: valueInWei })

      // Wait for transaction to be mined
      toast({
        title: "Transaction Sent",
        description: "Your GM transaction is being processed...",
      })

      await tx.wait()

      // Increment click count
      setClickCount((prevCount) => prevCount + 1)

      toast({
        title: "GM Success!",
        description: "You successfully said GM on Somnia Testnet!",
      })

      setIsSendingGm(false)
    } catch (error) {
      console.error("Error sending GM:", error)
      setIsSendingGm(false)

      // Check if it's a network or signer issue
      const errorMessage = String(error)

      if (errorMessage.includes("execution reverted") || errorMessage.includes("require(false)")) {
        setWalletError(
          "The GM function reverted. This might be due to a cooldown period, insufficient STT, or other contract requirements.",
        )
        toast({
          title: "GM Failed",
          description: "The contract rejected your GM. Click the Help button for possible solutions.",
          variant: "destructive",
        })
      } else if (errorMessage.includes("network") || errorMessage.includes("chain")) {
        setWalletError("Network issue detected. Please refresh the page and try again.")
      } else if (errorMessage.includes("signer")) {
        setWalletError("Wallet connection issue. Please reconnect your wallet.")
      } else {
        setWalletError("Transaction failed. Please try again.")
      }
    }
  }

  const reconnectWallet = async () => {
    // Reset states
    setWalletError(null)

    // Force page reload to ensure clean state
    window.location.reload()
  }

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-900 to-black text-white">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-purple-400">Somnia GM Clicker</CardTitle>
          <CardDescription className="text-gray-400">Connect your wallet to Somnia Testnet and say GM!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {account ? (
            <div className="flex flex-col items-center gap-6">
              <div className="bg-gray-700 px-4 py-2 rounded-full flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-400" />
                <span className="text-sm">{formatAddress(account)}</span>
              </div>

              {!isCorrectNetwork ? (
                <Alert variant="destructive" className="bg-red-900/50 border-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Wrong Network</AlertTitle>
                  <AlertDescription>Please switch to Somnia Testnet to use this app.</AlertDescription>
                  <Button
                    onClick={switchToSomniaNetwork}
                    className="mt-2 w-full bg-purple-600 hover:bg-purple-700"
                    disabled={isSwitchingNetwork}
                  >
                    {isSwitchingNetwork ? "Switching..." : "Switch to Somnia Testnet"}
                  </Button>
                </Alert>
              ) : walletError ? (
                <Alert variant="destructive" className="bg-red-900/50 border-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Transaction Error</AlertTitle>
                  <AlertDescription>{walletError}</AlertDescription>
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => setShowHelpDialog(true)}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      Help
                    </Button>
                    <Button onClick={reconnectWallet} className="flex-1 bg-purple-600 hover:bg-purple-700">
                      Refresh
                    </Button>
                  </div>
                </Alert>
              ) : (
                <Alert className="bg-green-900/50 border-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Connected to Somnia Testnet</AlertTitle>
                  <AlertDescription>You're connected to the correct network!</AlertDescription>
                </Alert>
              )}

              <div className="text-center">
                <div className="text-6xl font-bold mb-2">{clickCount}</div>
                <p className="text-gray-400">Total GM Count</p>
              </div>

              <div className="w-full">
                <label htmlFor="gmAmount" className="block text-sm font-medium text-gray-400 mb-1">
                  STT Amount (might be required)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="gmAmount"
                    type="number"
                    value={gmAmount}
                    onChange={(e) => setGmAmount(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-gray-400">STT</span>
                </div>
              </div>

              <Button
                onClick={handleGmClick}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold text-xl px-8 py-6 rounded-full transition-all hover:scale-105 w-full"
                disabled={!isCorrectNetwork || isSendingGm || !!walletError}
              >
                {isSendingGm ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending GM...
                  </span>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Say GM!
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-gray-400 border-gray-600 hover:bg-gray-700"
                onClick={() => setShowHelpDialog(true)}
              >
                <Info className="h-4 w-4 mr-2" />
                Help with GM
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <img src="/placeholder.svg?height=120&width=120" alt="Wallet" className="w-24 h-24 opacity-80" />
              <p className="text-center text-gray-400">Connect your Metamask or Rabby wallet to start clicking!</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!account && (
            <Button
              onClick={connectWallet}
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </span>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {account && (
        <div className="mt-6 text-center text-gray-500 text-sm">
          Connected with {window.ethereum?.isMetaMask ? "MetaMask" : "Rabby"} •
          <button onClick={reconnectWallet} className="ml-1 text-yellow-400 hover:text-yellow-300 mr-2">
            Refresh
          </button>
          •
          <button onClick={() => window.location.reload()} className="ml-2 text-red-400 hover:text-red-300">
            Reload Page
          </button>
        </div>
      )}

      <div className="mt-6 text-center text-gray-500 text-xs">
        <p>Somnia Testnet • Chain ID: {SOMNIA_CHAIN_ID_DECIMAL}</p>
        <a
          href="https://shannon-explorer.somnia.network/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          Block Explorer
        </a>
      </div>

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Help with GM Function</DialogTitle>
            <DialogDescription className="text-gray-400">Troubleshooting the GM contract interaction</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-purple-400">Possible Issues:</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>The contract might require STT tokens to be sent with the transaction</li>
                <li>There might be a cooldown period between GM calls</li>
                <li>You might need to be whitelisted to use this function</li>
                <li>There could be a daily limit on GM calls per address</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-purple-400">Try These Solutions:</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Try sending different amounts of STT with your transaction</li>
                <li>Wait some time before trying again (cooldown period)</li>
                <li>Check if you need to be whitelisted for this contract</li>
                <li>Try a different wallet address</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-purple-400">Contract Information:</h3>
              <p className="text-sm mt-2">
                Contract Address:{" "}
                <a
                  href={`https://shannon-explorer.somnia.network/address/${GM_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  {GM_CONTRACT_ADDRESS}
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </main>
  )
}
