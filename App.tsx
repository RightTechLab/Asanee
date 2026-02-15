import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
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
    const initWallet = async () => {
      try {
        const savedUri = await StorageService.load<string>('master_nwc_uri')
        if (savedUri) {
          await walletManager.connect(savedUri)
          const wallets = walletManager.listWallets()
          setSubWallets(wallets)
          setConnected(true)
        }
      } catch (error) {
      } finally {
        setInitializing(false)
      }
    }
    initWallet()
  }, [])

  if (initializing) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={ElectricWaspTheme}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <StatusBar style="light" />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={ElectricWaspTheme}>
        <View style={styles.container}>
          {!isConnected ? <ConnectScreen /> : (selectedWalletId ? <SubWalletScreen /> : <Dashboard />)}
          <StatusBar style="light" />
        </View>
      </PaperProvider>
    </SafeAreaProvider>
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
  },
})
