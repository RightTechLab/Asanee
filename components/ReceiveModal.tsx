import React, { useState } from 'react'
import { View, StyleSheet, Share } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, ActivityIndicator, IconButton } from 'react-native-paper'
import QRCode from 'react-native-qrcode-svg'
import { walletManager } from '../services/WalletManager'
import { Copy, Share2, X } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'

interface ReceiveModalProps {
    visible: boolean
    onDismiss: () => void
    walletName: string
    walletId?: string
}

export default function ReceiveModal({ visible, onDismiss, walletName, walletId }: ReceiveModalProps) {
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [invoice, setInvoice] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        if (!amount) return
        setLoading(true)
        try {
            const amountMsat = parseInt(amount) * 1000
            const response = await walletManager.makeInvoice(
                amountMsat,
                description || `Funding ${walletName}`,
                walletId
            )
            setInvoice(response.invoice)
        } catch (error) {
            console.error('Invoice generation failed:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = async () => {
        if (invoice) {
            await Clipboard.setStringAsync(invoice)
        }
    }

    const handleShare = async () => {
        if (invoice) {
            await Share.share({
                message: invoice,
                title: 'Lightning Invoice'
            })
        }
    }

    const reset = () => {
        setAmount('')
        setDescription('')
        setInvoice(null)
        onDismiss()
    }

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={reset}
                contentContainerStyle={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text variant="headlineSmall" style={styles.title}>Receive Sats</Text>
                        <IconButton icon="close" iconColor="#888" onPress={reset} />
                    </View>

                    {!invoice ? (
                        <>
                            <TextInput
                                label="Amount (sats)"
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                                mode="outlined"
                                style={styles.input}
                                placeholder="0"
                            />
                            <TextInput
                                label="Description (optional)"
                                value={description}
                                onChangeText={setDescription}
                                mode="outlined"
                                style={styles.input}
                                placeholder="What's this for?"
                            />
                            <Button
                                mode="contained"
                                onPress={handleGenerate}
                                loading={loading}
                                disabled={!amount || loading}
                                style={styles.button}
                                buttonColor="#FFD700"
                                textColor="#000"
                            >
                                Generate Invoice
                            </Button>
                        </>
                    ) : (
                        <View style={styles.qrContainer}>
                            <View style={styles.qrWrapper}>
                                <QRCode
                                    value={invoice}
                                    size={200}
                                    color="black"
                                    backgroundColor="white"
                                />
                            </View>

                            <Text variant="bodySmall" style={styles.invoiceText} numberOfLines={1} ellipsizeMode="middle">
                                {invoice}
                            </Text>

                            <View style={styles.actionRow}>
                                <Button
                                    mode="outlined"
                                    icon={() => <Copy size={18} color="#FFD700" />}
                                    onPress={handleCopy}
                                    style={styles.actionButton}
                                    textColor="#FFD700"
                                >
                                    Copy
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

                            <Button
                                mode="text"
                                onPress={() => setInvoice(null)}
                                style={styles.newInvoiceButton}
                                textColor="#888"
                            >
                                Create New Invoice
                            </Button>
                        </View>
                    )}
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
        marginBottom: 20,
    },
    title: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    input: {
        marginBottom: 16,
    },
    button: {
        marginTop: 8,
        paddingVertical: 6,
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
    invoiceText: {
        color: '#666',
        marginBottom: 20,
        width: '100%',
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        borderColor: '#333',
    },
    newInvoiceButton: {
        marginTop: 8,
    },
})
