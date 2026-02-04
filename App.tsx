import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import React, { useEffect, useState } from 'react'
import { PaperProvider } from 'react-native-paper'
import { ElectricWaspTheme } from './theme'
import ConnectScreen from './screens/ConnectScreen'
import Dashboard from './screens/Dashboard'
import SubWalletScreen from './screens/SubWalletScreen'
import { useWalletStore } from './store/walletStore'
import { walletManager } from './services/WalletManager'
import { StorageService } from './services/StorageService'

export default function App() {
  const isConnected = useWalletStore((state) => state.isConnected)
  const selectedWalletId = useWalletStore((state) => state.selectedWalletId)
  const setConnected = useWalletStore((state) => state.setConnected)
  const setSubWallets = useWalletStore((state) => state.setSubWallets)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    initWallet()
  }, [])

  const initWallet = async () => {
    try {
      const savedUri = await StorageService.load<string>('master_nwc_uri')
      if (savedUri) {
        console.log('🔄 Auto-reconnecting to saved wallet...')
        await walletManager.connect(savedUri)
        const wallets = walletManager.listWallets()
        setSubWallets(wallets)
        setConnected(true)
      }
    } catch (error) {
      console.error('Failed to auto-reconnect:', error)
    } finally {
      setInitializing(false)
    }
  }

  const renderContent = () => {
    if (initializing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      )
    }
    if (!isConnected) return <ConnectScreen />
    if (selectedWalletId) return <SubWalletScreen />
    return <Dashboard />
  }

  return (
    <PaperProvider theme={ElectricWaspTheme}>
      <View style={styles.container}>
        {renderContent()}
        <StatusBar style="light" />
      </View>
    </PaperProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  }
})
