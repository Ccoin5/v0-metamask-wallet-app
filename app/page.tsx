"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ethers } from "ethers"
import { Wallet, Sparkles, AlertTriangle, CheckCircle2, Info, ExternalLink, Calendar } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// Network Configurations
const NETWORKS = {
  somnia: {
    name: "Somnia Testnet",
    chainId: "0xc488", // 50312 in hex
    chainIdDecimal: 50312,
    nativeCurrency: {
      name: "STT",
      symbol: "STT",
      decimals: 18,
    },
    rpcUrls: ["https://dream-rpc.somnia.network/"],
    blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
    contractAddress: "0xcbfcf704494cc45e53bab61b6f898eb5e7d0e7b1",
    explorerTxUrl: "https://shannon-explorer.somnia.network/tx/",
    explorerAddressUrl: "https://shannon-explorer.somnia.network/address/",
  },
  baseSepolia: {
    name: "Base Sepolia",
    chainId: "0xaa37dc", // 11155111 in hex
    chainIdDecimal: 11155111,
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
    contractAddress: "0xcbfcf704494cc45e53bab61b6f898eb5e7d0e7b1", // Same contract address for now
    explorerTxUrl: "https://sepolia.basescan.org/tx/",
    explorerAddressUrl: "https://sepolia.basescan.org/address/",
  },
  riseChain: {
    name: "RISE Testnet",
    chainId: "0xaa36db", // 11155931 in hex
    chainIdDecimal: 11155931, // Correct Chain ID
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://testnet.riselabs.xyz"],
    blockExplorerUrls: ["https://explorer.testnet.riselabs.xyz"],
    contractAddress: "0x9a7079b973127CEA6bc1a2804400036565177251",
    explorerTxUrl: "https://explorer.testnet.riselabs.xyz/tx/",
    explorerAddressUrl: "https://explorer.testnet.riselabs.xyz/address/",
    dailyGmEnabled: true, // Flag to indicate this network supports Daily GM
  },
}

type NetworkKey = keyof typeof NETWORKS

export default function Home() {
  const [account, setAccount] = useState<string | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false)
  const [isSendingGm, setIsSendingGm] = useState(false)
  const [isSendingDailyGm, setIsSendingDailyGm] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [gmAmount, setGmAmount] = useState("0.01")
  const [customData, setCustomData] = useState("0xc0129d43") // Default gm() function selector
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("riseChain") // Default to RISE Chain for Daily GM
  const [hasSentDailyGm, setHasSentDailyGm] = useState(false)
  const [dailyGmDate, setDailyGmDate] = useState<string | null>(null)

  // Get current network config
  const currentNetwork = NETWORKS[selectedNetwork]

  // Check if user has sent Daily GM today
  useEffect(() => {
    if (account) {
      const storedDate = localStorage.getItem(`dailyGm_${account}`)
      if (storedDate) {
        const today = new Date().toISOString().split("T")[0]
        if (storedDate === today) {
          setHasSentDailyGm(true)
          setDailyGmDate(today)
        } else {
          setHasSentDailyGm(false)
          setDailyGmDate(null)
        }
      } else {
        setHasSentDailyGm(false)
        setDailyGmDate(null)
      }
    }
  }, [account])

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

        // Check if on correct network
        checkIfCorrectNetwork(currentChainId)
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
        checkIfCorrectNetwork(newChainId)
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
  }, [selectedNetwork]) // Re-run when selected network changes

  // Check if the current chain ID matches the selected network
  const checkIfCorrectNetwork = (currentChainId: number) => {
    // Compare the current chain ID with the selected network's chain ID
    const isOnCorrectNetwork = currentChainId === currentNetwork.chainIdDecimal
    setIsCorrectNetwork(isOnCorrectNetwork)
    return isOnCorrectNetwork
  }

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

        // Check if on correct network
        checkIfCorrectNetwork(currentChainId)
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

  const switchToSelectedNetwork = async () => {
    if (!window.ethereum) return

    try {
      setIsSwitchingNetwork(true)
      setWalletError(null)

      // Try to add the network first before switching
      try {
        // Add the network to the wallet
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: currentNetwork.chainId,
              chainName: currentNetwork.name,
              nativeCurrency: currentNetwork.nativeCurrency,
              rpcUrls: currentNetwork.rpcUrls,
              blockExplorerUrls: currentNetwork.blockExplorerUrls,
            },
          ],
        })

        // After adding, try to switch to it
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: currentNetwork.chainId }],
        })
      } catch (error: any) {
        console.error("Network switch/add error:", error)

        // If user rejected the request, throw the error
        if (error.code === 4001) {
          throw new Error("User rejected the request to add/switch network")
        }

        // For other errors, try one more direct switch attempt
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: currentNetwork.chainId }],
          })
        } catch (finalError) {
          throw finalError
        }
      }

      // Get updated chain ID
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const currentChainId = Number.parseInt(chainIdHex, 16)
      setChainId(currentChainId)

      // Check if on correct network
      const isOnCorrectNetwork = checkIfCorrectNetwork(currentChainId)

      if (isOnCorrectNetwork) {
        toast({
          title: "Network Switched",
          description: `Successfully connected to ${currentNetwork.name}!`,
        })
      }

      setIsSwitchingNetwork(false)
    } catch (error) {
      console.error("Error switching network:", error)
      setIsSwitchingNetwork(false)
      setWalletError(`Failed to switch to ${currentNetwork.name}. Please try again or add the network manually.`)
      toast({
        title: "Network Switch Failed",
        description: `Failed to switch to ${currentNetwork.name}. Please try adding the network manually in your wallet.`,
        variant: "destructive",
      })
    }
  }

  // Handle network selection change
  const handleNetworkChange = (value: string) => {
    setSelectedNetwork(value as NetworkKey)

    // If already connected to a wallet, check if we need to switch networks
    if (account && chainId) {
      const isOnCorrectNetwork = checkIfCorrectNetwork(chainId)
      if (!isOnCorrectNetwork) {
        toast({
          title: "Network Change",
          description: `Please switch to ${NETWORKS[value as NetworkKey].name}`,
        })
      }
    }
  }

  // Direct transaction method using eth_sendTransaction
  const sendDirectTransaction = async (isDailyGm = false) => {
    if (!window.ethereum || !account) return null

    try {
      // Convert gmAmount from ETH to wei
      const valueInWei = ethers.parseEther(gmAmount)
      const valueHex = `0x${valueInWei.toString(16)}`

      // Use different function selector for Daily GM
      const data = isDailyGm ? "0xd5a44522" : customData // 0xd5a44522 is dailyGm() function selector

      // Send transaction directly using eth_sendTransaction
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: currentNetwork.contractAddress,
            value: valueHex,
            data: data,
          },
        ],
      })

      return txHash
    } catch (error) {
      console.error("Error sending direct transaction:", error)
      throw error
    }
  }

  const handleGmClick = async (isDailyGm = false) => {
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
        description: `Please switch to ${currentNetwork.name} first!`,
        variant: "destructive",
      })
      return
    }

    // For Daily GM, check if already sent today
    if (isDailyGm && hasSentDailyGm) {
      toast({
        title: "Daily GM Already Sent",
        description: "You've already sent your Daily GM today!",
        variant: "destructive",
      })
      return
    }

    try {
      if (isDailyGm) {
        setIsSendingDailyGm(true)
      } else {
        setIsSendingGm(true)
      }

      setWalletError(null)
      setLastTxHash(null)

      // Try direct transaction method
      const txHash = await sendDirectTransaction(isDailyGm)
      setLastTxHash(txHash)

      toast({
        title: "Transaction Sent",
        description: `Your ${isDailyGm ? "Daily " : ""}GM transaction is being processed...`,
      })

      // Increment click count
      setClickCount((prevCount) => prevCount + 1)

      // For Daily GM, mark as sent today
      if (isDailyGm) {
        const today = new Date().toISOString().split("T")[0]
        localStorage.setItem(`dailyGm_${account}`, today)
        setHasSentDailyGm(true)
        setDailyGmDate(today)
      }

      toast({
        title: `${isDailyGm ? "Daily " : ""}GM Success!`,
        description: "Transaction sent successfully!",
      })

      if (isDailyGm) {
        setIsSendingDailyGm(false)
      } else {
        setIsSendingGm(false)
      }
    } catch (error) {
      console.error(`Error sending ${isDailyGm ? "Daily " : ""}GM:`, error)

      if (isDailyGm) {
        setIsSendingDailyGm(false)
      } else {
        setIsSendingGm(false)
      }

      // Check if it's a user rejected error
      const errorMessage = String(error)

      if (errorMessage.includes("user rejected")) {
        setWalletError("Transaction was rejected by the user.")
      } else if (errorMessage.includes("execution reverted") || errorMessage.includes("require(false)")) {
        setWalletError(
          `The ${isDailyGm ? "Daily " : ""}GM function reverted. This might be due to a cooldown period, insufficient funds, or other contract requirements.`,
        )
      } else {
        setWalletError("Transaction failed. Please try again with different parameters.")
      }

      toast({
        title: `${isDailyGm ? "Daily " : ""}GM Failed`,
        description: "The transaction failed. Click the Help button for possible solutions.",
        variant: "destructive",
      })
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

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-900 to-black text-white">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-purple-400">GM Clicker</CardTitle>
          <CardDescription className="text-gray-400">Connect your wallet and say GM!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="network" className="text-sm font-medium text-gray-400">
              Select Network
            </Label>
            <Select value={selectedNetwork} onValueChange={handleNetworkChange}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select a network" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600 text-white">
                <SelectItem value="somnia">Somnia Testnet</SelectItem>
                <SelectItem value="baseSepolia">Base Sepolia</SelectItem>
                <SelectItem value="riseChain">RISE Testnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                  <AlertDescription>Please switch to {currentNetwork.name} to use this app.</AlertDescription>
                  <Button
                    onClick={switchToSelectedNetwork}
                    className="mt-2 w-full bg-purple-600 hover:bg-purple-700"
                    disabled={isSwitchingNetwork}
                  >
                    {isSwitchingNetwork ? "Switching..." : `Switch to ${currentNetwork.name}`}
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
                  <AlertTitle>Connected to {currentNetwork.name}</AlertTitle>
                  <AlertDescription>You're connected to the correct network!</AlertDescription>
                </Alert>
              )}

              <div className="text-center">
                <div className="text-6xl font-bold mb-2">{clickCount}</div>
                <p className="text-gray-400">Total GM Count</p>
              </div>

              {/* Daily GM Section - Only show for RISE Chain */}
              {currentNetwork.dailyGmEnabled && (
                <Card className="w-full bg-gray-700 border-gray-600">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-xl text-yellow-400 flex items-center">
                        <Calendar className="mr-2 h-5 w-5" />
                        Daily GM
                      </CardTitle>
                      {hasSentDailyGm ? (
                        <Badge className="bg-green-600">Completed</Badge>
                      ) : (
                        <Badge className="bg-blue-600">Available</Badge>
                      )}
                    </div>
                    <CardDescription className="text-gray-300">Send your daily GM on RISE Chain</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {hasSentDailyGm ? (
                      <div className="text-center py-2">
                        <p className="text-sm text-gray-300">You've already sent your Daily GM today!</p>
                        {dailyGmDate && <p className="text-xs text-gray-400 mt-1">Sent on {formatDate(dailyGmDate)}</p>}
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGmClick(true)}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                        disabled={!isCorrectNetwork || isSendingDailyGm}
                      >
                        {isSendingDailyGm ? (
                          <span className="flex items-center justify-center">
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
                            Sending Daily GM...
                          </span>
                        ) : (
                          <>
                            <Calendar className="mr-2 h-4 w-4" />
                            Send Daily GM
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="space-y-4">
                  <div>
                    <Label htmlFor="gmAmount" className="text-sm font-medium text-gray-400">
                      {currentNetwork.nativeCurrency.symbol} Amount
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="gmAmount"
                        type="number"
                        value={gmAmount}
                        onChange={(e) => setGmAmount(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        step="0.001"
                        min="0"
                      />
                      <span className="text-gray-400">{currentNetwork.nativeCurrency.symbol}</span>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="advanced" className="space-y-4">
                  <div>
                    <Label htmlFor="customData" className="text-sm font-medium text-gray-400">
                      Function Data (Hex)
                    </Label>
                    <Input
                      id="customData"
                      value={customData}
                      onChange={(e) => setCustomData(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white mt-1"
                      placeholder="0xc0129d43"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: 0xc0129d43 (gm function selector)</p>
                    {currentNetwork.dailyGmEnabled && (
                      <p className="text-xs text-yellow-500 mt-1">
                        Daily GM uses: 0xd5a44522 (dailyGm function selector)
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="gmAmount" className="text-sm font-medium text-gray-400">
                      {currentNetwork.nativeCurrency.symbol} Amount
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="gmAmount"
                        type="number"
                        value={gmAmount}
                        onChange={(e) => setGmAmount(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                        step="0.001"
                        min="0"
                      />
                      <span className="text-gray-400">{currentNetwork.nativeCurrency.symbol}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-400">Contract Address</Label>
                    <div className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 mt-1 text-xs text-gray-300 break-all">
                      {currentNetwork.contractAddress}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                onClick={() => handleGmClick(false)}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold text-xl px-8 py-6 rounded-full transition-all hover:scale-105 w-full"
                disabled={!isCorrectNetwork || isSendingGm}
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

              {lastTxHash && (
                <div className="w-full text-center">
                  <a
                    href={`${currentNetwork.explorerTxUrl}${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-sm flex items-center justify-center"
                  >
                    View Transaction <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </div>
              )}

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
        <p>
          {currentNetwork.name} • Chain ID: {currentNetwork.chainIdDecimal}
        </p>
        <a
          href={`${currentNetwork.explorerAddressUrl}${currentNetwork.contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300"
        >
          View Contract
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
                <li>The contract might require tokens to be sent with the transaction</li>
                <li>There might be a cooldown period between GM calls</li>
                <li>You might need to be whitelisted to use this function</li>
                <li>The function signature might be different than expected</li>
                <li>The contract might have special requirements for calling the function</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-purple-400">Try These Solutions:</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Try sending different amounts of {currentNetwork.nativeCurrency.symbol} with your transaction</li>
                <li>Wait some time before trying again (cooldown period)</li>
                <li>Try using the Advanced tab to modify the function data</li>
                <li>Try a different wallet address</li>
                <li>Try switching to a different network</li>
                <li>Check the contract on the block explorer for more information</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-purple-400">Advanced Users:</h3>
              <p className="text-sm mt-2">If you're familiar with Ethereum development, you can try:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>Checking if the contract is verified on the block explorer</li>
                <li>Using different function selectors if the contract has multiple functions</li>
                <li>Examining transaction logs to see why transactions are failing</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-purple-400">Contract Information:</h3>
              <p className="text-sm mt-2">
                Contract Address:{" "}
                <a
                  href={`${currentNetwork.explorerAddressUrl}${currentNetwork.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 break-all"
                >
                  {currentNetwork.contractAddress}
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add new dialog for network configuration help */}
      <Dialog
        open={walletError?.includes("Failed to switch to") || false}
        onOpenChange={(open) => {
          if (!open) setWalletError(null)
        }}
      >
        <DialogContent className="bg-gray-800 text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Manual Network Configuration</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add {currentNetwork.name} to your wallet manually with these settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium text-gray-400">Network Name:</div>
              <div className="text-white">{currentNetwork.name}</div>

              <div className="font-medium text-gray-400">RPC URL:</div>
              <div className="text-white break-all">{currentNetwork.rpcUrls[0]}</div>

              <div className="font-medium text-gray-400">Chain ID:</div>
              <div className="text-white">{currentNetwork.chainIdDecimal}</div>

              <div className="font-medium text-gray-400">Currency Symbol:</div>
              <div className="text-white">{currentNetwork.nativeCurrency.symbol}</div>

              <div className="font-medium text-gray-400">Block Explorer:</div>
              <div className="text-white break-all">{currentNetwork.blockExplorerUrls[0]}</div>
            </div>

            <Alert className="bg-yellow-900/50 border-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Network Addition</AlertTitle>
              <AlertDescription>
                Add this network in your wallet's network settings, then return to this app and select{" "}
                {currentNetwork.name} from the dropdown.
              </AlertDescription>
            </Alert>

            <Button onClick={() => setWalletError(null)} className="w-full bg-purple-600 hover:bg-purple-700">
              I've Added the Network
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </main>
  )
}
