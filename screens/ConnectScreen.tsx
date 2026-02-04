import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { TextInput, Button, Text, Card, HelperText, IconButton } from 'react-native-paper'
import { walletManager } from '../services/WalletManager'
import { useWalletStore } from '../store/walletStore'
import QRScanner from '../components/QRScanner'
import { Eye, EyeOff, Scan } from 'lucide-react-native'

export default function ConnectScreen() {
    const [nwcUri, setNwcUri] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [secureEntry, setSecureEntry] = useState(true)
    const [scannerVisible, setScannerVisible] = useState(false)

    const setConnected = useWalletStore((state) => state.setConnected)
    const setSubWallets = useWalletStore((state) => state.setSubWallets)

    const handleConnect = async (uri?: string) => {
        const connectionUri = uri || nwcUri
        if (!connectionUri.trim()) {
            setError('Please enter a valid NWC URI')
            return
        }

        setLoading(true)
        setError('')

        try {
            await walletManager.connect(connectionUri)
            const wallets = walletManager.listWallets()
            setSubWallets(wallets)
            setConnected(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect')
        } finally {
            setLoading(false)
        }
    }

    const handleScan = (data: string) => {
        setScannerVisible(false)
        setNwcUri(data)
        handleConnect(data)
    }

    if (scannerVisible) {
        return <QRScanner onScan={handleScan} onClose={() => setScannerVisible(false)} />
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text variant="displaySmall" style={styles.title}>
                            Asanee ⚡
                        </Text>
                        <Text variant="bodyLarge" style={styles.subtitle}>
                            Connect your Master NWC
                        </Text>
                    </View>

                    {/* Connection Card */}
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text variant="titleMedium" style={styles.cardTitle}>
                                Master Wallet Connection
                            </Text>

                            <TextInput
                                label="NWC Connection URI"
                                value={nwcUri}
                                onChangeText={setNwcUri}
                                mode="outlined"
                                placeholder="nostr+walletconnect://..."
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                                error={!!error}
                                multiline={!secureEntry}
                                secureTextEntry={secureEntry}
                                right={
                                    <TextInput.Icon
                                        icon={() => secureEntry ? <EyeOff size={20} color="#888" /> : <Eye size={20} color="#888" />}
                                        onPress={() => setSecureEntry(!secureEntry)}
                                    />
                                }
                            />

                            <Button
                                mode="outlined"
                                icon={() => <Scan size={18} color="#FFD700" />}
                                onPress={() => setScannerVisible(true)}
                                style={styles.scanButton}
                                textColor="#FFD700"
                            >
                                Scan QR Code
                            </Button>

                            {error ? (
                                <HelperText type="error" visible={!!error}>
                                    {error}
                                </HelperText>
                            ) : null}

                            <Button
                                mode="contained"
                                onPress={() => handleConnect()}
                                loading={loading}
                                disabled={loading}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                Connect Wallet
                            </Button>

                            <Text variant="bodySmall" style={styles.hint}>
                                Your NWC URI is stored securely on device
                            </Text>
                        </Card.Content>
                    </Card>

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        <Text variant="bodyMedium" style={styles.infoText}>
                            🔒 Fully non-custodial{'\n'}
                            🎯 Create scoped sub-wallets{'\n'}
                            ⚡ Lightning-fast payments
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        maxWidth: 600,
        width: '100%',
        alignSelf: 'center',
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: '#E0E0E0',
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#141414',
        marginBottom: 24,
    },
    cardTitle: {
        color: '#FFFFFF',
        marginBottom: 16,
    },
    input: {
        marginBottom: 8,
    },
    scanButton: {
        marginBottom: 16,
        borderColor: '#333',
    },
    button: {
        marginTop: 16,
    },
    buttonContent: {
        paddingVertical: 8,
    },
    hint: {
        color: '#888888',
        marginTop: 12,
        textAlign: 'center',
    },
    infoSection: {
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
    },
    infoText: {
        color: '#E0E0E0',
        lineHeight: 24,
    },
})
