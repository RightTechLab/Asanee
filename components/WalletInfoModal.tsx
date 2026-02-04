import React from 'react'
import { View, StyleSheet, Share } from 'react-native'
import { Modal, Portal, Text, Button, IconButton } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import { Copy, Share2 } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'

interface WalletInfoModalProps {
    visible: boolean
    onDismiss: () => void
    walletName: string
    nwcUri: string
}

export default function WalletInfoModal({ visible, onDismiss, walletName, nwcUri }: WalletInfoModalProps) {

    const handleCopy = async () => {
        await Clipboard.setStringAsync(nwcUri)
    }

    const handleShare = async () => {
        await Share.share({
            message: nwcUri,
            title: `NWC Connection - ${walletName}`
        })
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text variant="headlineSmall" style={styles.title}>Wallet Config</Text>
                        <IconButton icon="close" iconColor="#888" onPress={onDismiss} />
                    </View>

                    <Text variant="titleMedium" style={styles.subtitle}>{walletName}</Text>
                    <Text variant="bodySmall" style={styles.description}>
                        Scan this QR code or copy the URI to connect another app to this sub-wallet.
                    </Text>

                    <View style={styles.qrContainer}>
                        <View style={styles.qrWrapper}>
                            <QRCode
                                value={nwcUri}
                                size={220}
                                color="black"
                                backgroundColor="white"
                            />
                        </View>

                        <Text variant="bodySmall" style={styles.uriText} numberOfLines={2} ellipsizeMode="middle">
                            {nwcUri}
                        </Text>

                        <View style={styles.actionRow}>
                            <Button
                                mode="outlined"
                                icon={() => <Copy size={18} color="#FFD700" />}
                                onPress={handleCopy}
                                style={styles.actionButton}
                                textColor="#FFD700"
                            >
                                Copy URI
                            </Button>
                            <Button
                                mode="outlined"
                                icon={() => <Share2 size={18} color="#FFD700" />}
                                onPress={handleShare}
                                style={styles.actionButton}
                                textColor="#FFD700"
                            >
                                Share
                            </Button>
                        </View>
                    </View>
                </View>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    container: {
        margin: 20,
    },
    content: {
        backgroundColor: '#141414',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#fff',
        marginBottom: 8,
        fontWeight: '600',
    },
    description: {
        color: '#888',
        marginBottom: 20,
        lineHeight: 18,
    },
    qrContainer: {
        alignItems: 'center',
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 20,
    },
    uriText: {
        color: '#666',
        marginBottom: 24,
        width: '100%',
        textAlign: 'center',
        fontSize: 12,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    actionButton: {
        flex: 1,
        borderColor: '#333',
    },
})
