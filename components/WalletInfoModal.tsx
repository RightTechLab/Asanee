import React from 'react'
import { View, StyleSheet, Share, Pressable } from 'react-native'
import { Modal, Portal, Text } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import { Copy, Share2, X } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import { Colors, Spacing, Radius } from '../theme'

interface WalletInfoModalProps {
    visible: boolean
    onDismiss: () => void
    walletName: string
    nwcUri: string
}

export default function WalletInfoModal({ visible, onDismiss, walletName, nwcUri }: WalletInfoModalProps) {
    const handleCopy = async () => { await Clipboard.setStringAsync(nwcUri) }
    const handleShare = async () => { await Share.share({ message: nwcUri, title: `NWC - ${walletName}` }) }

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Connection</Text>
                        <Pressable onPress={onDismiss} hitSlop={8}>
                            <X size={18} color={Colors.textSecondary} />
                        </Pressable>
                    </View>

                    <Text style={styles.walletName}>{walletName}</Text>
                    <Text style={styles.description}>
                        Scan or copy the URI to connect another app to this wallet.
                    </Text>

                    <View style={styles.qrSection}>
                        <View style={styles.qrRing}>
                            <View style={styles.qrWrapper}>
                                <QRCode value={nwcUri} size={220} color="black" backgroundColor="white" />
                            </View>
                        </View>

                        <Text style={styles.uriText} numberOfLines={2} ellipsizeMode="middle">
                            {nwcUri}
                        </Text>

                        <View style={styles.actionRow}>
                            <Pressable style={styles.actionBtn} onPress={handleCopy}>
                                <Copy size={16} color={Colors.accent} />
                                <Text style={styles.actionText}>Copy URI</Text>
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={handleShare}>
                                <Share2 size={16} color={Colors.accent} />
                                <Text style={styles.actionText}>Share</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </Portal>
    )
}

const styles = StyleSheet.create({
    container: { margin: Spacing.lg },
    content: {
        backgroundColor: Colors.surfaceElevated,
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        color: Colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    walletName: {
        color: Colors.text,
        fontSize: 15,
        fontWeight: '500',
        marginBottom: Spacing.xs,
    },
    description: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginBottom: Spacing.lg,
        lineHeight: 18,
    },
    qrSection: {
        alignItems: 'center',
    },
    qrRing: {
        padding: 3,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: Colors.accent,
        marginBottom: Spacing.lg,
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    uriText: {
        color: Colors.textTertiary,
        marginBottom: Spacing.lg,
        width: '100%',
        textAlign: 'center',
        fontSize: 12,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        width: '100%',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    actionText: {
        color: Colors.accent,
        fontWeight: '500',
        fontSize: 14,
    },
})
